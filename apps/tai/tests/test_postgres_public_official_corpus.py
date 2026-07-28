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


def _audit(
    reason_code: str,
    *,
    offset_seconds: int = 0,
) -> AuthorityAuditContext:
    return AuthorityAuditContext(
        actor_id="compliance-1",
        reason_code=reason_code,
        created_at=NOW + timedelta(seconds=offset_seconds),
    )


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


def test_source_and_artifact_mutations_commit_with_atomic_audit() -> None:
    connection = _Connection(
        [
            {"source_id": _admission().source_id},
            {"event_sha256": "a" * 64},
            {"artifact_sha256": DIGEST},
            {"event_sha256": "b" * 64},
        ]
    )
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    authority.admit_source(_admission(), _audit("SOURCE_RIGHTS_APPROVED"))
    authority.record_artifact(_provenance(), _audit("ARTIFACT_VERIFIED", offset_seconds=1))

    assert connection.commits == 2
    assert connection.rollbacks == 0
    calls = connection.cursor_value.calls
    assert len(calls) == 4
    assert "SET source_id = EXCLUDED.source_id" in calls[0][0]
    assert "INSERT INTO tai_public_corpus_audit" in calls[1][0]
    assert "SET artifact_sha256 = EXCLUDED.artifact_sha256" in calls[2][0]
    assert "INSERT INTO tai_public_corpus_audit" in calls[3][0]
    assert "SOURCE_ADMITTED" in _parameters(calls[1][1])
    assert "ARTIFACT_ADMITTED" in _parameters(calls[3][1])


def test_audit_failure_rolls_back_source_mutation() -> None:
    connection = _Connection(
        [
            {"source_id": _admission().source_id},
            None,
        ]
    )
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    with pytest.raises(RuntimeError, match="audit event conflicts"):
        authority.admit_source(_admission(), _audit("SOURCE_RIGHTS_APPROVED"))

    assert connection.commits == 0
    assert connection.rollbacks == 1


def test_withdrawn_source_cannot_be_re_admitted() -> None:
    connection = _Connection([])
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))
    withdrawn = replace(_admission(), status=SourceAdmissionStatus.WITHDRAWN)

    with pytest.raises(ValueError, match="only an ADMITTED source"):
        authority.admit_source(withdrawn, _audit("SOURCE_RIGHTS_APPROVED"))

    assert connection.cursor_value.calls == []


def test_snapshot_persistence_is_chunk_bound_and_audited() -> None:
    snapshot = _snapshot()
    rows: list[dict[str, Any] | None] = [
        {"snapshot_id": 7},
        {"status": "BUILDING"},
        *({"chunk_id": chunk.chunk_id} for chunk in snapshot.chunks),
        {"event_sha256": "c" * 64},
    ]
    connection = _Connection(rows)
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    snapshot_id = authority.persist_snapshot(
        snapshot,
        _audit("SNAPSHOT_MATERIALIZED"),
    )

    assert snapshot_id == 7
    assert connection.commits == 1
    snapshot_query, snapshot_parameters = connection.cursor_value.calls[0]
    assert "INSERT INTO tai_public_corpus_snapshots" in snapshot_query
    assert isinstance(_parameters(snapshot_parameters)[2], Jsonb)
    assert isinstance(_parameters(snapshot_parameters)[3], Jsonb)
    assert "FOR UPDATE" in connection.cursor_value.calls[1][0]
    assert "INSERT INTO tai_public_corpus_audit" in connection.cursor_value.calls[-1][0]
    assert "SNAPSHOT_CREATED" in _parameters(connection.cursor_value.calls[-1][1])


def test_snapshot_chunk_conflict_rolls_back_without_audit() -> None:
    snapshot = _snapshot()
    connection = _Connection([{"snapshot_id": 7}, {"status": "BUILDING"}, None])

    with pytest.raises(RuntimeError, match="chunk identity conflicts"):
        PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection)).persist_snapshot(
            snapshot,
            _audit("SNAPSHOT_MATERIALIZED"),
        )

    assert connection.commits == 0
    assert connection.rollbacks == 1
    assert all(
        "INSERT INTO tai_public_corpus_audit" not in query
        for query, _ in connection.cursor_value.calls
    )


def test_activation_quarantine_release_withdrawal_are_audited() -> None:
    quarantine_id = uuid.uuid4()
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
    connection = _Connection(
        [
            None,
            {"event_sha256": "d" * 64},
            {"quarantine_id": quarantine_id},
            {"event_sha256": "e" * 64},
            {"source_id": _admission().source_id, "artifact_sha256": DIGEST},
            {"event_sha256": "f" * 64},
            None,
            {"event_sha256": "1" * 64},
            active_row,
            None,
        ]
    )
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    authority.activate_snapshot(7, _audit("SNAPSHOT_APPROVED"))
    authority.quarantine(
        quarantine_id=quarantine_id,
        source_id=_admission().source_id,
        artifact_sha256=DIGEST,
        reason=QuarantineReason.CONTENT_SAFETY,
        detail_code="PROMPT_INJECTION",
        audit=_audit("QUARANTINE_OPENED", offset_seconds=1),
    )
    authority.release_quarantine(
        quarantine_id=quarantine_id,
        audit=_audit("QUARANTINE_REVIEWED", offset_seconds=2),
    )
    authority.withdraw_source(
        source_id=_admission().source_id,
        audit=_audit("RIGHTS_WITHDRAWN", offset_seconds=3),
    )
    documents = authority.active_documents(now=NOW)

    calls = connection.cursor_value.calls
    audit_types = [
        _parameters(parameters)[1]
        for query, parameters in calls
        if "INSERT INTO tai_public_corpus_audit" in query
    ]
    assert audit_types == [
        "SNAPSHOT_ACTIVATED",
        "ARTIFACT_QUARANTINED",
        "QUARANTINE_RELEASED",
        "SOURCE_WITHDRAWN",
    ]
    assert len(documents) == 1
    assert documents[0].tenant_id is None


def test_migrations_register_audit_authority_and_immutability() -> None:
    root = Path(__file__).parents[1] / "tai" / "migrations"
    corpus = (root / "0019_public_official_corpus.sql").read_text(encoding="utf-8")
    audit = (root / "0020_public_official_corpus_audit_authority.sql").read_text(
        encoding="utf-8"
    )
    manifest = (root / "manifest.json").read_text(encoding="utf-8")

    assert "tai_public_corpus_audit" in corpus
    assert "SNAPSHOT_CREATED" in audit
    assert "ARTIFACT_QUARANTINED" in audit
    assert "tai_public_corpus_audit_immutable_guard" in audit
    assert "BEFORE UPDATE OR DELETE" in audit
    assert '"path": "0020_public_official_corpus_audit_authority.sql"' in manifest
    assert '"version": 21' in manifest


@pytest.mark.skipif(
    "TEST_DATABASE_URL" not in os.environ,
    reason="real PostgreSQL AP-14F1A acceptance requires TEST_DATABASE_URL",
)
def test_real_postgresql_mutations_are_fail_closed_audited_and_immutable() -> None:
    database_url = os.environ["TEST_DATABASE_URL"]
    migration_root = Path(__file__).parents[1] / "tai" / "migrations"
    migrations = [
        migration_root / "0019_public_official_corpus.sql",
        migration_root / "0020_public_official_corpus_audit_authority.sql",
    ]
    with psycopg.connect(database_url, autocommit=True) as connection:
        for migration in migrations:
            connection.execute(migration.read_text(encoding="utf-8"))

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
    source_audit = AuthorityAuditContext(
        actor_id="compliance-1",
        reason_code="SOURCE_RIGHTS_APPROVED",
        created_at=runtime_now,
    )
    artifact_audit = AuthorityAuditContext(
        actor_id="compliance-1",
        reason_code="ARTIFACT_VERIFIED",
        created_at=runtime_now + timedelta(seconds=1),
    )
    snapshot_audit = AuthorityAuditContext(
        actor_id="tai-ingestion-worker",
        reason_code="SNAPSHOT_MATERIALIZED",
        created_at=runtime_now + timedelta(seconds=2),
    )
    activation_audit = AuthorityAuditContext(
        actor_id="compliance-1",
        reason_code="SNAPSHOT_APPROVED",
        created_at=runtime_now + timedelta(seconds=3),
    )

    authority.admit_source(admission, source_audit)
    authority.admit_source(admission, source_audit)
    authority.record_artifact(provenance, artifact_audit)
    authority.record_artifact(provenance, artifact_audit)
    snapshot_id = authority.persist_snapshot(snapshot, snapshot_audit)
    assert authority.persist_snapshot(snapshot, snapshot_audit) == snapshot_id
    authority.activate_snapshot(snapshot_id, activation_audit)
    assert len(authority.active_documents(now=runtime_now)) == len(snapshot.chunks)

    with psycopg.connect(database_url) as connection:
        audit_count_before = connection.execute(
            "SELECT count(*) FROM tai_public_corpus_audit"
        ).fetchone()
    assert audit_count_before == (4,)

    with pytest.raises(RuntimeError, match="source admission conflicts"):
        authority.admit_source(
            replace(
                admission,
                rights_review_due_at=admission.rights_review_due_at + timedelta(days=1),
            ),
            AuthorityAuditContext(
                actor_id="compliance-1",
                reason_code="SOURCE_RIGHTS_EXTENDED",
                created_at=runtime_now + timedelta(seconds=4),
            ),
        )
    with pytest.raises(RuntimeError, match="artifact digest conflicts"):
        authority.record_artifact(
            replace(
                provenance,
                freshness_due_at=provenance.freshness_due_at + timedelta(days=1),
            ),
            AuthorityAuditContext(
                actor_id="compliance-1",
                reason_code="ARTIFACT_FRESHNESS_EXTENDED",
                created_at=runtime_now + timedelta(seconds=5),
            ),
        )
    with psycopg.connect(database_url) as connection:
        audit_count_after_failed_replays = connection.execute(
            "SELECT count(*) FROM tai_public_corpus_audit"
        ).fetchone()
    assert audit_count_after_failed_replays == audit_count_before

    quarantine_id = uuid.uuid4()
    authority.quarantine(
        quarantine_id=quarantine_id,
        source_id=admission.source_id,
        artifact_sha256=provenance.content_sha256,
        reason=QuarantineReason.CONTENT_SAFETY,
        detail_code="PROMPT_INJECTION",
        audit=AuthorityAuditContext(
            actor_id="tai-ingestion-worker",
            reason_code="QUARANTINE_OPENED",
            created_at=runtime_now + timedelta(seconds=6),
        ),
    )
    assert authority.active_documents(now=runtime_now) == ()
    authority.release_quarantine(
        quarantine_id=quarantine_id,
        audit=AuthorityAuditContext(
            actor_id="compliance-1",
            reason_code="QUARANTINE_REVIEWED",
            created_at=runtime_now + timedelta(seconds=7),
        ),
    )
    assert len(authority.active_documents(now=runtime_now)) == len(snapshot.chunks)

    authority.withdraw_source(
        source_id=admission.source_id,
        audit=AuthorityAuditContext(
            actor_id="compliance-1",
            reason_code="RIGHTS_WITHDRAWN",
            created_at=runtime_now + timedelta(seconds=8),
        ),
    )
    assert authority.active_documents(now=runtime_now) == ()
    with pytest.raises(RuntimeError, match="source admission conflicts"):
        authority.admit_source(
            admission,
            AuthorityAuditContext(
                actor_id="compliance-1",
                reason_code="SOURCE_REOPEN_ATTEMPT",
                created_at=runtime_now + timedelta(seconds=9),
            ),
        )

    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        events = connection.execute(
            """
            SELECT event_type, event_sha256, payload_sha256
            FROM tai_public_corpus_audit
            ORDER BY created_at, event_type
            """
        ).fetchall()
    assert [row["event_type"] for row in events] == [
        "SOURCE_ADMITTED",
        "ARTIFACT_ADMITTED",
        "SNAPSHOT_CREATED",
        "SNAPSHOT_ACTIVATED",
        "ARTIFACT_QUARANTINED",
        "QUARANTINE_RELEASED",
        "SOURCE_WITHDRAWN",
    ]
    assert all(len(row["event_sha256"]) == 64 for row in events)
    assert all(len(row["payload_sha256"]) == 64 for row in events)

    event_sha = events[0]["event_sha256"]
    with (
        pytest.raises(psycopg.Error, match="immutable"),
        psycopg.connect(database_url) as connection,
    ):
        connection.execute(
            "UPDATE tai_public_corpus_audit SET reason_code = 'TAMPER' WHERE event_sha256 = %s",
            (event_sha,),
        )
        connection.commit()
    with (
        pytest.raises(psycopg.Error, match="immutable"),
        psycopg.connect(database_url) as connection,
    ):
        connection.execute(
            "DELETE FROM tai_public_corpus_audit WHERE event_sha256 = %s",
            (event_sha,),
        )
        connection.commit()
