from __future__ import annotations

import hashlib
from collections import deque
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from tai.postgres_public_official_corpus import PostgreSQLPublicOfficialCorpusAuthority
from tai.public_official_corpus import (
    PublicArtifactProvenance,
    PublicCorpusArtifact,
    PublicOfficialCorpusBuilder,
    PublicSourceAdmission,
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


def test_admit_source_and_artifact_use_fail_closed_conflict_predicates() -> None:
    connection = _Connection(
        [{"source_id": _admission().source_id}, {"artifact_sha256": DIGEST}]
    )
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    authority.admit_source(_admission())
    authority.record_artifact(_provenance())

    assert connection.commits == 2
    assert connection.rollbacks == 0
    admission_query, admission_parameters = connection.cursor_value.calls[0]
    artifact_query, artifact_parameters = connection.cursor_value.calls[1]
    assert "data_plane = 'PUBLIC_OFFICIAL'" in admission_query
    assert "rights_decision_id = EXCLUDED.rights_decision_id" in admission_query
    assert _admission().rights_decision_id in _parameters(admission_parameters)
    assert "official_uri = EXCLUDED.official_uri" in artifact_query
    assert DIGEST in _parameters(artifact_parameters)


def test_conflicting_source_or_artifact_identity_rolls_back() -> None:
    source_conflict = _Connection([None])
    artifact_conflict = _Connection([None])

    with pytest.raises(RuntimeError, match="source admission conflicts"):
        PostgreSQLPublicOfficialCorpusAuthority(
            _Factory(source_conflict)
        ).admit_source(_admission())
    with pytest.raises(RuntimeError, match="artifact digest conflicts"):
        PostgreSQLPublicOfficialCorpusAuthority(
            _Factory(artifact_conflict)
        ).record_artifact(_provenance())

    assert source_conflict.rollbacks == 1
    assert artifact_conflict.rollbacks == 1


def test_snapshot_persistence_is_atomic_and_chunk_bound() -> None:
    snapshot = _snapshot()
    rows: list[dict[str, Any] | None] = [
        {"snapshot_id": 7},
        {"status": "BUILDING"},
        *({"chunk_id": chunk.chunk_id} for chunk in snapshot.chunks),
    ]
    connection = _Connection(rows)
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    snapshot_id = authority.persist_snapshot(snapshot)

    assert snapshot_id == 7
    assert connection.commits == 1
    assert connection.rollbacks == 0
    assert "INSERT INTO tai_public_corpus_snapshots" in connection.cursor_value.calls[0][0]
    assert "FOR UPDATE" in connection.cursor_value.calls[1][0]
    chunk_calls = connection.cursor_value.calls[2:]
    assert len(chunk_calls) == len(snapshot.chunks)
    assert all(
        "INSERT INTO tai_public_corpus_chunks" in query for query, _ in chunk_calls
    )
    assert all(DIGEST in _parameters(parameters) for _, parameters in chunk_calls)


def test_snapshot_chunk_conflict_rolls_back_whole_transaction() -> None:
    snapshot = _snapshot()
    connection = _Connection([{"snapshot_id": 7}, {"status": "BUILDING"}, None])

    with pytest.raises(RuntimeError, match="chunk identity conflicts"):
        PostgreSQLPublicOfficialCorpusAuthority(
            _Factory(connection)
        ).persist_snapshot(snapshot)

    assert connection.commits == 0
    assert connection.rollbacks == 1


def test_activation_withdrawal_and_active_read_use_governed_functions_and_view() -> None:
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
    connection = _Connection([active_row, None])
    authority = PostgreSQLPublicOfficialCorpusAuthority(_Factory(connection))

    authority.activate_snapshot(7)
    authority.withdraw_source(
        source_id=_admission().source_id,
        actor_id="compliance-1",
        reason="rights_expired",
        withdrawn_at=NOW,
    )
    documents = authority.active_documents(now=NOW)

    assert "tai_activate_public_corpus_snapshot" in connection.cursor_value.calls[0][0]
    assert "tai_withdraw_public_corpus_source" in connection.cursor_value.calls[1][0]
    assert "tai_active_public_corpus_chunks_v1" in connection.cursor_value.calls[2][0]
    assert len(documents) == 1
    assert documents[0].tenant_id is None
    assert documents[0].chunk.document_checksum_sha256 == DIGEST


def test_migration_registers_public_corpus_authority_and_manifest_version() -> None:
    root = Path(__file__).parents[1] / "tai" / "migrations"
    migration = (root / "0019_public_official_corpus.sql").read_text(
        encoding="utf-8"
    )
    manifest = (root / "manifest.json").read_text(encoding="utf-8")

    assert "CREATE TABLE IF NOT EXISTS tai_public_corpus_source_admissions" in migration
    assert "CREATE TABLE IF NOT EXISTS tai_public_corpus_artifacts" in migration
    assert "CREATE TABLE IF NOT EXISTS tai_public_corpus_snapshots" in migration
    assert "CREATE TABLE IF NOT EXISTS tai_public_corpus_chunks" in migration
    assert "tai_activate_public_corpus_snapshot" in migration
    assert "tai_withdraw_public_corpus_source" in migration
    assert "tai_active_public_corpus_chunks_v1" in migration
    assert '"path": "0019_public_official_corpus.sql"' in manifest
    assert '"version": 20' in manifest
