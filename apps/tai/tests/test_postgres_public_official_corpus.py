from __future__ import annotations

import hashlib
import os
import uuid
from collections import deque
from dataclasses import replace
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import psycopg
import pytest
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from tai.postgres_public_official_corpus import PostgreSQLPublicOfficialCorpusAuthority
from tai.public_official_corpus import (
    AuthorityAuditContext,
    PublicArtifactProvenance,
    PublicCorpusArtifact,
    PublicOfficialCorpusBuilder,
    PublicSourceAdmission,
    QuarantineReason,
    SourceAdmissionStatus,
    SourceClass,
    SourceLocatorKind,
)

NOW = datetime(2026, 7, 28, 18, 0, tzinfo=UTC)
TEXT = "Официальная инструкция ФГИС Зерно по учету партий. " * 20
PAYLOAD = TEXT.strip().encode("utf-8")
DIGEST = hashlib.sha256(PAYLOAD).hexdigest()
AUDIT_SHA = "e" * 64


class _Cursor:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.rows = deque(rows)
        self.calls: list[tuple[str, object]] = []

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def execute(self, query: str, parameters: object) -> None:
        self.calls.append((query, parameters))

    def fetchone(self) -> dict[str, Any] | None:
        return self.rows.popleft() if self.rows else None


class _Connection:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.cursor_value = _Cursor(rows)
        self.commits = 0
        self.rollbacks = 0

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def cursor(self) -> _Cursor:
        return self.cursor_value

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class _Factory:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def __call__(self) -> _Connection:
        return self.connection


def _audit(reason: str = "CORPUS_ACCEPTANCE", offset: int = 0) -> AuthorityAuditContext:
    return AuthorityAuditContext(
        actor_id="compliance-1",
        reason_code=reason,
        created_at=NOW + timedelta(seconds=offset),
    )


def _audit_row() -> dict[str, str]:
    return {"event_sha256": AUDIT_SHA}


def _admission() -> PublicSourceAdmission:
    return PublicSourceAdmission(
        source_id="official.specagro.fgis-grain.manual",
        source_class=SourceClass.OFFICIAL_MANUAL,
        rights_decision_id="AP14F0-PUBLIC_MANUAL_REVIEWED",
        official_uri="https://specagro.ru/fgis/api",
        host_pin="specagro.ru",
        rights_review_due_at=NOW + timedelta(days=180),
        admitted_at=NOW - timedelta(days=1),
        trust_score=0.95,
    )


def _provenance() -> PublicArtifactProvenance:
    return PublicArtifactProvenance(
        record_id="prov_0123456789abcdef",
        source_id="official.specagro.fgis-grain.manual",
        source_class=SourceClass.OFFICIAL_MANUAL,
        rights_decision_id="AP14F0-PUBLIC_MANUAL_REVIEWED",
        official_uri="https://specagro.ru/fgis/api",
        host_pin="specagro.ru",
        content_sha256=DIGEST,
        media_type="text/plain",
        size_bytes=len(PAYLOAD),
        publication_date=date(2026, 7, 1),
        effective_date=date(2026, 7, 1),
        observed_at=NOW - timedelta(hours=2),
        locator_kind=SourceLocatorKind.SECTION,
        locator_value="section:participant-manual",
        freshness_due_at=NOW + timedelta(days=30),
    )


def _snapshot():
    return PublicOfficialCorpusBuilder().build(
        admissions=(_admission(),),
        artifacts=(
            PublicCorpusArtifact(provenance=_provenance(), normalized_text=TEXT),
        ),
        now=NOW,
    )


def _parameters(value: object) -> tuple[Any, ...]:
    assert isinstance(value, tuple)
    return cast(tuple[Any, ...], value)


def test_admission_and_artifact_commit_with_atomic_audit() -> None:
    connection = _Connection(
        [
            {"source_id": _admission().source_id},
            _audit_row(),
            {"artifact_sha256": DIGEST},
            _audit_row(),
        ]
    )
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    authority.admit_source(_admission(), _audit("SOURCE_ADMITTED"))
    authority.record_artifact(_provenance(), _audit("ARTIFACT_ADMITTED", 1))

    assert connection.commits == 2
    assert connection.rollbacks == 0
    assert len(connection.cursor_value.calls) == 4
    source_query = " ".join(connection.cursor_value.calls[0][0].split())
    source_audit_query = connection.cursor_value.calls[1][0]
    artifact_query = " ".join(connection.cursor_value.calls[2][0].split())
    artifact_audit_query = connection.cursor_value.calls[3][0]
    assert "VALUES (%s, 'PUBLIC_OFFICIAL'" in source_query
    assert "status = 'ADMITTED'" in source_query
    assert "SET artifact_sha256 = EXCLUDED.artifact_sha256" in artifact_query
    assert "INSERT INTO tai_public_corpus_audit" in source_audit_query
    assert "INSERT INTO tai_public_corpus_audit" in artifact_audit_query


def test_withdrawn_source_is_rejected_before_database_access() -> None:
    connection = _Connection([])
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))
    withdrawn = replace(_admission(), status=SourceAdmissionStatus.WITHDRAWN)

    with pytest.raises(ValueError, match="only an ADMITTED source"):
        authority.admit_source(withdrawn, _audit())

    assert connection.cursor_value.calls == []
    assert connection.commits == 0
    assert connection.rollbacks == 0


def test_identity_conflicts_roll_back_before_audit() -> None:
    source_conflict = _Connection([None])
    artifact_conflict = _Connection([None])

    with pytest.raises(RuntimeError, match="source admission conflicts"):
        PostgreSQLPublicOfficialCorpusAuthority(_Factory(source_conflict)).admit_source(
            _admission(), _audit()
        )
    with pytest.raises(RuntimeError, match="artifact digest conflicts"):
        PostgreSQLPublicOfficialCorpusAuthority(
            _Factory(artifact_conflict)
        ).record_artifact(_provenance(), _audit())

    assert source_conflict.rollbacks == 1
    assert artifact_conflict.rollbacks == 1
    assert len(source_conflict.cursor_value.calls) == 1
    assert len(artifact_conflict.cursor_value.calls) == 1


def test_snapshot_persistence_is_atomic_and_audited() -> None:
    snapshot = _snapshot()
    rows: list[dict[str, Any] | None] = [
        {"snapshot_id": 7},
        {"status": "BUILDING"},
        *({"chunk_id": chunk.chunk_id} for chunk in snapshot.chunks),
        _audit_row(),
    ]
    connection = _Connection(rows)
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    snapshot_id = authority.persist_snapshot(snapshot, _audit("SNAPSHOT_CREATED"))

    assert snapshot_id == 7
    assert connection.commits == 1
    assert connection.rollbacks == 0
    snapshot_query, snapshot_parameters = connection.cursor_value.calls[0]
    assert "INSERT INTO tai_public_corpus_snapshots" in snapshot_query
    assert isinstance(_parameters(snapshot_parameters)[2], Jsonb)
    assert isinstance(_parameters(snapshot_parameters)[3], Jsonb)
    assert "FOR UPDATE" in connection.cursor_value.calls[1][0]
    assert "INSERT INTO tai_public_corpus_audit" in connection.cursor_value.calls[-1][0]


def test_snapshot_chunk_conflict_rolls_back_without_audit() -> None:
    snapshot = _snapshot()
    connection = _Connection([{"snapshot_id": 7}, {"status": "BUILDING"}, None])

    with pytest.raises(RuntimeError, match="chunk identity conflicts"):
        PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection)).persist_snapshot(
            snapshot, _audit()
        )

    assert connection.commits == 0
    assert connection.rollbacks == 1
    assert all(
        "INSERT INTO tai_public_corpus_audit" not in query
        for query, _ in connection.cursor_value.calls
    )


def test_activation_quarantine_release_withdrawal_and_read_paths() -> None:
    active_row = {
        "chunk_id": "b" * 64,
        "source_id": _admission().source_id,
        "artifact_sha256": DIGEST,
        "ordinal": 0,
        "chunk_text": "Официальный текст",
        "token_estimate": 4,
        "trust_score": 0.95,
        "valid_until": NOW + timedelta(days=30),
    }
    quarantine_id = uuid.UUID("00000000-0000-0000-0000-000000000007")
    connection = _Connection(
        [
            {"tai_activate_public_corpus_snapshot": None},
            _audit_row(),
            {"quarantine_id": quarantine_id},
            _audit_row(),
            {"source_id": _admission().source_id, "artifact_sha256": DIGEST},
            _audit_row(),
            {"tai_withdraw_public_corpus_source": None},
            _audit_row(),
            active_row,
            None,
        ]
    )
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    authority.activate_snapshot(7, _audit("SNAPSHOT_ACTIVATED"))
    authority.quarantine(
        quarantine_id=quarantine_id,
        source_id=_admission().source_id,
        artifact_sha256=DIGEST,
        reason=QuarantineReason.CONTENT_SAFETY,
        detail_code="PROMPT_INJECTION",
        audit=_audit("ARTIFACT_QUARANTINED", 1),
    )
    authority.release_quarantine(
        quarantine_id=quarantine_id,
        audit=_audit("QUARANTINE_RELEASED", 2),
    )
    authority.withdraw_source(
        source_id=_admission().source_id,
        audit=_audit("SOURCE_WITHDRAWN", 3),
    )
    documents = authority.active_documents(now=NOW)

    assert connection.commits == 5
    assert len(documents) == 1
    assert documents[0].tenant_id is None
    assert documents[0].chunk.document_checksum_sha256 == DIGEST
    audit_calls = [
        query
        for query, _ in connection.cursor_value.calls
        if "INSERT INTO tai_public_corpus_audit" in query
    ]
    assert len(audit_calls) == 4


def test_migration_registers_complete_audit_event_authority() -> None:
    root = Path(__file__).parents[1] / "tai" / "migrations"
    migration = (root / "0019_public_official_corpus.sql").read_text(
        encoding="utf-8"
    )
    manifest = (root / "manifest.json").read_text(encoding="utf-8")

    for token in (
        "tai_public_corpus_source_admissions",
        "tai_public_corpus_artifacts",
        "tai_public_corpus_snapshots",
        "tai_public_corpus_chunks",
        "tai_public_corpus_audit",
        "SNAPSHOT_CREATED",
        "ARTIFACT_QUARANTINED",
        "SNAPSHOT_ACTIVATED",
        "QUARANTINE_RELEASED",
        "SOURCE_WITHDRAWN",
        "manifest does not match persisted chunks",
        "contains quarantined material",
        "tai_active_public_corpus_chunks_v1",
    ):
        assert token in migration
    assert '"path": "0019_public_official_corpus.sql"' in manifest
    assert '"version": 20' in manifest


@pytest.mark.skipif(
    "TEST_DATABASE_URL" not in os.environ,
    reason="real PostgreSQL AP-14F1A acceptance requires TEST_DATABASE_URL",
)
def test_real_postgresql_blocks_silent_extension_and_withdrawal_revival() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    migration = (
        Path(__file__).parents[1]
        / "tai"
        / "migrations"
        / "0019_public_official_corpus.sql"
    ).read_text(encoding="utf-8")
    with psycopg.connect(database_url, autocommit=True) as connection:
        connection.execute(migration)

    runtime_now = datetime.now(UTC)
    admission = replace(
        _admission(),
        admitted_at=runtime_now - timedelta(days=1),
        rights_review_due_at=runtime_now + timedelta(days=180),
    )
    provenance = replace(
        _provenance(),
        publication_date=runtime_now.date() - timedelta(days=2),
        effective_date=runtime_now.date() - timedelta(days=1),
        observed_at=runtime_now - timedelta(hours=2),
        freshness_due_at=runtime_now + timedelta(days=30),
    )
    snapshot = PublicOfficialCorpusBuilder().build(
        admissions=(admission,),
        artifacts=(PublicCorpusArtifact(provenance=provenance, normalized_text=TEXT),),
        now=runtime_now,
    )

    def connection_factory():
        return psycopg.connect(database_url, row_factory=dict_row)

    authority = PostgreSQLPublicOfficialCorpusAuthority(connection_factory)
    source_audit = AuthorityAuditContext("compliance-1", "SOURCE_ADMITTED", runtime_now)
    artifact_audit = AuthorityAuditContext(
        "compliance-1", "ARTIFACT_ADMITTED", runtime_now + timedelta(seconds=1)
    )
    snapshot_audit = AuthorityAuditContext(
        "compliance-1", "SNAPSHOT_CREATED", runtime_now + timedelta(seconds=2)
    )
    activation_audit = AuthorityAuditContext(
        "compliance-1", "SNAPSHOT_ACTIVATED", runtime_now + timedelta(seconds=3)
    )

    authority.admit_source(admission, source_audit)
    authority.admit_source(admission, source_audit)
    with pytest.raises(RuntimeError, match="source admission conflicts"):
        authority.admit_source(
            replace(
                admission,
                rights_review_due_at=admission.rights_review_due_at + timedelta(days=1),
            ),
            source_audit,
        )

    authority.record_artifact(provenance, artifact_audit)
    authority.record_artifact(provenance, artifact_audit)
    with pytest.raises(RuntimeError, match="artifact digest conflicts"):
        authority.record_artifact(
            replace(
                provenance,
                freshness_due_at=provenance.freshness_due_at + timedelta(days=1),
            ),
            artifact_audit,
        )

    snapshot_id = authority.persist_snapshot(snapshot, snapshot_audit)
    assert authority.persist_snapshot(snapshot, snapshot_audit) == snapshot_id
    authority.activate_snapshot(snapshot_id, activation_audit)
    assert len(authority.active_documents(now=runtime_now)) == len(snapshot.chunks)

    with (
        pytest.raises(
            psycopg.Error,
            match="manifest does not match persisted chunks",
        ),
        psycopg.connect(database_url, row_factory=dict_row) as connection,
        connection.transaction(),
    ):
        bad_snapshot = connection.execute(
            """
            INSERT INTO tai_public_corpus_snapshots (
                snapshot_sha256, status, created_at, source_ids, artifact_sha256s
            ) VALUES (%s, 'BUILDING', %s, %s, %s)
            RETURNING snapshot_id
            """,
            (
                "c" * 64,
                runtime_now,
                Jsonb(["official.invalid.source"]),
                Jsonb([provenance.content_sha256]),
            ),
        ).fetchone()
        assert bad_snapshot is not None
        first_chunk = snapshot.chunks[0]
        first_document = snapshot.retrieval_documents[0]
        connection.execute(
            """
            INSERT INTO tai_public_corpus_chunks (
                snapshot_id, chunk_id, artifact_sha256, source_id, ordinal,
                chunk_text, token_estimate, trust_score, valid_until
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                bad_snapshot["snapshot_id"],
                first_chunk.chunk_id,
                first_chunk.document_checksum_sha256,
                first_chunk.source_id,
                first_chunk.ordinal,
                first_chunk.text,
                first_chunk.token_estimate,
                first_document.trust_score,
                first_document.valid_until,
            ),
        )
        connection.execute(
            "SELECT tai_activate_public_corpus_snapshot(%s)",
            (bad_snapshot["snapshot_id"],),
        )

    quarantine_id = uuid.uuid4()
    authority.quarantine(
        quarantine_id=quarantine_id,
        source_id=admission.source_id,
        artifact_sha256=provenance.content_sha256,
        reason=QuarantineReason.CONTENT_SAFETY,
        detail_code="PROMPT_INJECTION",
        audit=AuthorityAuditContext(
            "compliance-1",
            "ARTIFACT_QUARANTINED",
            runtime_now + timedelta(seconds=4),
        ),
    )
    assert authority.active_documents(now=runtime_now) == ()

    authority.release_quarantine(
        quarantine_id=quarantine_id,
        audit=AuthorityAuditContext(
            "compliance-1",
            "QUARANTINE_RELEASED",
            runtime_now + timedelta(seconds=5),
        ),
    )
    assert len(authority.active_documents(now=runtime_now)) == len(snapshot.chunks)

    authority.withdraw_source(
        source_id=admission.source_id,
        audit=AuthorityAuditContext(
            "compliance-1",
            "SOURCE_WITHDRAWN",
            runtime_now + timedelta(seconds=6),
        ),
    )
    assert authority.active_documents(now=runtime_now) == ()
    with pytest.raises(RuntimeError, match="source admission conflicts"):
        authority.admit_source(admission, source_audit)

    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        source_row = connection.execute(
            """
            SELECT status, rights_review_due_at
            FROM tai_public_corpus_source_admissions
            WHERE source_id = %s
            """,
            (admission.source_id,),
        ).fetchone()
        artifact_row = connection.execute(
            """
            SELECT status, freshness_due_at
            FROM tai_public_corpus_artifacts
            WHERE artifact_sha256 = %s
            """,
            (provenance.content_sha256,),
        ).fetchone()
        snapshot_row = connection.execute(
            "SELECT status FROM tai_public_corpus_snapshots WHERE snapshot_id = %s",
            (snapshot_id,),
        ).fetchone()
        audit_rows = connection.execute(
            "SELECT event_type FROM tai_public_corpus_audit ORDER BY event_type"
        ).fetchall()

    assert source_row == {
        "status": "WITHDRAWN",
        "rights_review_due_at": admission.rights_review_due_at,
    }
    assert artifact_row == {
        "status": "WITHDRAWN",
        "freshness_due_at": provenance.freshness_due_at,
    }
    assert snapshot_row == {"status": "RETIRED"}
    assert {
        "SOURCE_ADMITTED",
        "ARTIFACT_ADMITTED",
        "SNAPSHOT_CREATED",
        "SNAPSHOT_ACTIVATED",
        "ARTIFACT_QUARANTINED",
        "QUARANTINE_RELEASED",
        "SOURCE_WITHDRAWN",
    }.issubset({str(row["event_type"]) for row in audit_rows})
