from __future__ import annotations

import argparse
import json
import os
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import psycopg
from psycopg import errors
from psycopg.rows import dict_row

from tai.postgres_loader_state import ConnectionFactory
from tai.postgres_public_official_corpus import PostgreSQLPublicOfficialCorpusAuthority
from tai.public_official_corpus import AuthorityAuditContext
from tai.rosstat_vshp2016254 import (
    DATA_URI,
    HISTORICAL_LABEL,
    SOURCE_ID,
    RosstatVshp2016254Materializer,
)

MIGRATIONS = (
    Path("apps/tai/tai/migrations/0019_public_official_corpus.sql"),
    Path("apps/tai/tai/migrations/0020_public_official_corpus_audit_authority.sql"),
)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("observed_at must be timezone-aware")
    return value.astimezone(UTC)


def _parse_datetime(value: str) -> datetime:
    return _aware(datetime.fromisoformat(value.replace("Z", "+00:00")))


def _apply_migrations(database_url: str) -> None:
    with psycopg.connect(database_url, autocommit=True) as connection:
        for migration in MIGRATIONS:
            connection.execute(migration.read_text(encoding="utf-8"))


def _connection_factory(database_url: str) -> ConnectionFactory:
    @contextmanager
    def factory() -> Iterator[Any]:
        with psycopg.connect(database_url, row_factory=dict_row) as connection:
            yield connection

    return cast(ConnectionFactory, factory)


def _fetch_one(database_url: str, query: str, parameters: tuple[object, ...] = ()) -> dict[str, Any]:
    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        row = connection.execute(query, parameters).fetchone()
        if row is None:
            raise RuntimeError("expected PostgreSQL row was not returned")
        return dict(row)


def _fetch_values(database_url: str, query: str) -> tuple[str, ...]:
    with psycopg.connect(database_url) as connection:
        rows = connection.execute(query).fetchall()
        return tuple(sorted(str(row[0]) for row in rows))


def _assert_audit_immutable(database_url: str) -> None:
    with psycopg.connect(database_url, autocommit=True) as connection:
        try:
            connection.execute(
                "UPDATE tai_public_corpus_audit SET actor_id = 'tampered' WHERE true"
            )
        except errors.RaiseException as error:
            if "immutable" not in str(error).casefold():
                raise
        else:
            raise RuntimeError("immutable public-corpus audit accepted UPDATE")


def verify(
    *,
    database_url: str,
    passport_csv: Path,
    structure_xml: Path,
    data_xml: Path,
    observed_at: datetime,
    evidence_output: Path,
) -> dict[str, object]:
    observed = _aware(observed_at)
    _apply_migrations(database_url)

    materialization = RosstatVshp2016254Materializer().materialize(
        passport_csv=passport_csv.read_bytes(),
        structure_xml=structure_xml.read_bytes(),
        data_xml=data_xml.read_bytes(),
        observed_at=observed,
    )
    authority = PostgreSQLPublicOfficialCorpusAuthority(_connection_factory(database_url))

    source_audit = AuthorityAuditContext(
        actor_id="tai-ap14f1c-verifier",
        reason_code="ROSSTAT_SOURCE_ADMISSION",
        created_at=observed,
    )
    artifact_audit = AuthorityAuditContext(
        actor_id="tai-ap14f1c-verifier",
        reason_code="ROSSTAT_ARTIFACT_ADMISSION",
        created_at=observed + timedelta(seconds=1),
    )
    snapshot_audit = AuthorityAuditContext(
        actor_id="tai-ap14f1c-verifier",
        reason_code="ROSSTAT_SNAPSHOT_BUILD",
        created_at=observed + timedelta(seconds=2),
    )
    activation_audit = AuthorityAuditContext(
        actor_id="tai-ap14f1c-verifier",
        reason_code="ROSSTAT_SNAPSHOT_ACTIVATE",
        created_at=observed + timedelta(seconds=3),
    )

    # Exact replay must be idempotent before the snapshot becomes ACTIVE.
    authority.admit_source(materialization.admission, source_audit)
    authority.admit_source(materialization.admission, source_audit)
    authority.record_artifact(materialization.provenance, artifact_audit)
    authority.record_artifact(materialization.provenance, artifact_audit)
    first_snapshot_id = authority.persist_snapshot(materialization.snapshot, snapshot_audit)
    second_snapshot_id = authority.persist_snapshot(materialization.snapshot, snapshot_audit)
    if first_snapshot_id != second_snapshot_id:
        raise RuntimeError("snapshot replay produced a second identity")

    authority.activate_snapshot(first_snapshot_id, activation_audit)
    active_documents = authority.active_documents(now=observed + timedelta(seconds=4))
    if not active_documents:
        raise RuntimeError("activated Rosstat snapshot exposed no retrieval documents")
    for document in active_documents:
        text = document.chunk.text
        if HISTORICAL_LABEL not in text or DATA_URI not in text or "XPath:" not in text:
            raise RuntimeError("active retrieval chunk lacks mandatory citation context")
        if document.tenant_id is not None or document.revoked:
            raise RuntimeError("shared public corpus document crossed tenant/revocation boundary")

    snapshot_row = _fetch_one(
        database_url,
        """
        SELECT snapshot_id, snapshot_sha256, status, source_ids, artifact_sha256s
        FROM tai_public_corpus_snapshots
        WHERE snapshot_id = %s
        """,
        (first_snapshot_id,),
    )
    if snapshot_row["status"] != "ACTIVE":
        raise RuntimeError("persisted Rosstat snapshot is not ACTIVE")
    if str(snapshot_row["snapshot_sha256"]) != materialization.snapshot_sha256:
        raise RuntimeError("PostgreSQL snapshot digest does not match materialization")

    active_count = int(
        _fetch_one(
            database_url,
            "SELECT count(*) AS count FROM tai_active_public_corpus_chunks_v1",
        )["count"]
    )
    if active_count != len(active_documents):
        raise RuntimeError("active view count differs from authority read model")

    audit_types_before_withdrawal = _fetch_values(
        database_url,
        "SELECT DISTINCT event_type FROM tai_public_corpus_audit",
    )
    required_audit_types = {
        "SOURCE_ADMITTED",
        "ARTIFACT_ADMITTED",
        "SNAPSHOT_CREATED",
        "SNAPSHOT_ACTIVATED",
    }
    if not required_audit_types.issubset(set(audit_types_before_withdrawal)):
        raise RuntimeError("required public-corpus audit events are absent")
    _assert_audit_immutable(database_url)

    withdrawal_audit = AuthorityAuditContext(
        actor_id="tai-ap14f1c-verifier",
        reason_code="ROSSTAT_SOURCE_WITHDRAW",
        created_at=observed + timedelta(seconds=5),
    )
    authority.withdraw_source(source_id=SOURCE_ID, audit=withdrawal_audit)
    active_after_withdrawal = authority.active_documents(now=observed + timedelta(seconds=6))
    if active_after_withdrawal:
        raise RuntimeError("withdrawn Rosstat source remains retrievable")

    terminal_row = _fetch_one(
        database_url,
        """
        SELECT
            admission.status AS source_status,
            artifact.status AS artifact_status,
            snapshot.status AS snapshot_status
        FROM tai_public_corpus_source_admissions AS admission
        JOIN tai_public_corpus_artifacts AS artifact
          ON artifact.source_id = admission.source_id
        JOIN tai_public_corpus_snapshots AS snapshot
          ON snapshot.snapshot_id = %s
        WHERE admission.source_id = %s
          AND artifact.artifact_sha256 = %s
        """,
        (first_snapshot_id, SOURCE_ID, materialization.artifact_sha256),
    )
    if terminal_row != {
        "source_status": "WITHDRAWN",
        "artifact_status": "WITHDRAWN",
        "snapshot_status": "RETIRED",
    }:
        raise RuntimeError(f"withdrawal state mismatch: {terminal_row}")

    audit_types = _fetch_values(
        database_url,
        "SELECT DISTINCT event_type FROM tai_public_corpus_audit",
    )
    if "SOURCE_WITHDRAWN" not in audit_types:
        raise RuntimeError("withdrawal audit event is absent")

    evidence: dict[str, object] = {
        "schemaVersion": "tai.ap14f1c-postgresql-snapshot-evidence.v1",
        "exactHead": os.environ.get("EXACT_HEAD", "LOCAL_UNATTESTED"),
        "sourceId": SOURCE_ID,
        "observedAt": observed.isoformat(),
        "artifactSha256": materialization.artifact_sha256,
        "snapshotId": first_snapshot_id,
        "snapshotSha256": materialization.snapshot_sha256,
        "recordCount": len(materialization.records),
        "chunkCount": len(materialization.snapshot.chunks),
        "activeChunkCountBeforeWithdrawal": active_count,
        "activeChunkCountAfterWithdrawal": len(active_after_withdrawal),
        "auditEventTypes": list(audit_types),
        "sourceStatus": terminal_row["source_status"],
        "artifactStatus": terminal_row["artifact_status"],
        "snapshotStatus": terminal_row["snapshot_status"],
        "everyChunkHasHistoricalLabel": True,
        "everyChunkHasExactSourceUri": True,
        "everyChunkHasXPath": True,
        "rawBytesPersisted": False,
        "tenantId": None,
        "operationalStatus": "NOT_ATTESTED",
        "productionHosting": "REG_RU_VPS_ONLY",
    }
    evidence_output.parent.mkdir(parents=True, exist_ok=True)
    evidence_output.write_text(
        json.dumps(evidence, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return evidence


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database-url", required=True)
    parser.add_argument("--passport-csv", type=Path, required=True)
    parser.add_argument("--structure-xml", type=Path, required=True)
    parser.add_argument("--data-xml", type=Path, required=True)
    parser.add_argument("--observed-at", required=True)
    parser.add_argument("--evidence-output", type=Path, required=True)
    args = parser.parse_args()

    evidence = verify(
        database_url=args.database_url,
        passport_csv=args.passport_csv,
        structure_xml=args.structure_xml,
        data_xml=args.data_xml,
        observed_at=_parse_datetime(args.observed_at),
        evidence_output=args.evidence_output,
    )
    print(json.dumps(evidence, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
