from datetime import UTC, datetime
from pathlib import Path

import pytest

from tai.ingestion import IngestionManifest, IngestionState
from tai.knowledge import KnowledgeRecord, KnowledgeScope
from tai.materialized_knowledge import (
    MATERIALIZED_SCHEMA_VERSION,
    JsonMaterializedKnowledgeRepository,
    MaterializedEntry,
    MaterializedKnowledgeIntegrityError,
    MaterializedSnapshot,
    build_knowledge_store,
    reconcile_materialized_entries,
)

NOW = datetime(2026, 7, 18, 12, 0, tzinfo=UTC)


def manifest(manifest_id: str, source_id: str = "official.minselhoz") -> IngestionManifest:
    return IngestionManifest(
        manifest_id=manifest_id,
        source_id=source_id,
        checksum_sha256="a" * 64,
        version="2026-07-18.1",
        ingested_at=NOW,
        state=IngestionState.ACCEPTED,
    )


def entry(manifest_id: str, record_id: str) -> MaterializedEntry:
    return MaterializedEntry(
        manifest_id=manifest_id,
        record=KnowledgeRecord(
            record_id=record_id,
            title="Состояние зернового рынка",
            body="Подтверждённые сведения.",
            version="2026-07-18.1",
            source_uri="https://mcx.gov.ru/analytics/grain-market",
            effective_at=NOW,
            trust_score=0.99,
            scope=KnowledgeScope.PUBLIC,
            tags=frozenset({"рынок", "зерно"}),
        ),
    )


def test_snapshot_round_trip_is_deterministic(tmp_path: Path) -> None:
    path = tmp_path / "knowledge.json"
    repository = JsonMaterializedKnowledgeRepository(path)
    snapshot = MaterializedSnapshot(
        schema_version=MATERIALIZED_SCHEMA_VERSION,
        generated_at=NOW,
        entries=(entry("manifest-1", "record-1"),),
    )

    repository.save(snapshot)
    first = path.read_bytes()
    loaded = repository.load()
    repository.save(loaded)

    assert path.read_bytes() == first
    assert loaded == snapshot


def test_reconcile_removes_revoked_or_superseded_materialization() -> None:
    entries = (
        entry("manifest-active", "record-active"),
        entry("manifest-old", "record-old"),
    )

    reconciled = reconcile_materialized_entries(
        active_manifests=(manifest("manifest-active"),),
        existing_entries=entries,
    )

    assert tuple(item.manifest_id for item in reconciled) == ("manifest-active",)


def test_recovery_builds_retrievable_store() -> None:
    store = build_knowledge_store((entry("manifest-1", "record-1"),))

    results = store.retrieve("зернового рынка", tenant_id=None)

    assert len(results) == 1
    assert results[0].record.record_id == "record-1"


def test_corrupt_snapshot_fails_closed(tmp_path: Path) -> None:
    path = tmp_path / "knowledge.json"
    path.write_text("not-json", encoding="utf-8")

    with pytest.raises(
        MaterializedKnowledgeIntegrityError,
        match="materialized_snapshot_unreadable",
    ):
        JsonMaterializedKnowledgeRepository(path).load()


def test_duplicate_record_id_fails_closed(tmp_path: Path) -> None:
    path = tmp_path / "knowledge.json"
    repository = JsonMaterializedKnowledgeRepository(path)
    repository.save(
        MaterializedSnapshot(
            schema_version=MATERIALIZED_SCHEMA_VERSION,
            generated_at=NOW,
            entries=(
                entry("manifest-1", "record-1"),
                entry("manifest-2", "record-1"),
            ),
        )
    )

    with pytest.raises(
        MaterializedKnowledgeIntegrityError,
        match="materialized_duplicate_record_id",
    ):
        repository.load()
