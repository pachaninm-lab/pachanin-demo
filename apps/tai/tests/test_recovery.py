from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from tai.ingestion import IngestionManifest, IngestionState
from tai.knowledge import KnowledgeRecord
from tai.materialized_knowledge import (
    MATERIALIZED_SCHEMA_VERSION,
    JsonMaterializedKnowledgeRepository,
    MaterializedEntry,
    MaterializedSnapshot,
)
from tai.persistent_ingestion import (
    SNAPSHOT_SCHEMA_VERSION,
    IngestionSnapshot,
    JsonSnapshotRepository,
)
from tai.recovery import IngestionRecoveryCoordinator, materialized_entries_by_manifest

NOW = datetime(2026, 7, 18, 3, 30, tzinfo=UTC)


def _manifest(manifest_id: str, source_id: str, state: IngestionState) -> IngestionManifest:
    return IngestionManifest(
        manifest_id=manifest_id,
        source_id=source_id,
        checksum_sha256=(manifest_id * 64)[:64],
        version="2026-07-18.1",
        ingested_at=NOW,
        state=state,
    )


def _entry(manifest_id: str) -> MaterializedEntry:
    return MaterializedEntry(
        manifest_id=manifest_id,
        record=KnowledgeRecord(
            record_id=f"record.{manifest_id}",
            title=f"Title {manifest_id}",
            body="Grounded body",
            version="2026-07-18.1",
            source_uri=f"repo://{manifest_id}",
            effective_at=NOW,
            trust_score=1.0,
        ),
    )


def test_recovery_removes_non_active_materialization(tmp_path: Path) -> None:
    ingestion_repository = JsonSnapshotRepository(tmp_path / "ingestion.json")
    materialized_repository = JsonMaterializedKnowledgeRepository(tmp_path / "knowledge.json")
    ingestion_repository.save(
        IngestionSnapshot(
            schema_version=SNAPSHOT_SCHEMA_VERSION,
            generated_at=NOW,
            manifests=(
                _manifest("m1", "source-1", IngestionState.ACCEPTED),
                _manifest("m2", "source-2", IngestionState.REVOKED),
            ),
        )
    )
    materialized_repository.save(
        MaterializedSnapshot(
            schema_version=MATERIALIZED_SCHEMA_VERSION,
            generated_at=NOW,
            entries=(_entry("m1"), _entry("m2")),
        )
    )

    result = IngestionRecoveryCoordinator(
        ingestion_repository=ingestion_repository,
        materialized_repository=materialized_repository,
    ).recover(now=NOW)

    assert result.repaired is True
    assert result.active_manifest_ids == ("m1",)
    assert result.materialized_manifest_ids == ("m1",)
    persisted = materialized_repository.load()
    assert tuple(materialized_entries_by_manifest(persisted.entries)) == ("m1",)
    assert result.store.retrieve("Grounded", tenant_id=None)[0].record.record_id == "record.m1"


def test_recovery_is_idempotent_when_snapshots_are_aligned(tmp_path: Path) -> None:
    ingestion_repository = JsonSnapshotRepository(tmp_path / "ingestion.json")
    materialized_repository = JsonMaterializedKnowledgeRepository(tmp_path / "knowledge.json")
    ingestion_repository.save(
        IngestionSnapshot(
            schema_version=SNAPSHOT_SCHEMA_VERSION,
            generated_at=NOW,
            manifests=(_manifest("m1", "source-1", IngestionState.ACCEPTED),),
        )
    )
    materialized_repository.save(
        MaterializedSnapshot(
            schema_version=MATERIALIZED_SCHEMA_VERSION,
            generated_at=NOW,
            entries=(_entry("m1"),),
        )
    )

    result = IngestionRecoveryCoordinator(
        ingestion_repository=ingestion_repository,
        materialized_repository=materialized_repository,
    ).recover(now=NOW)

    assert result.repaired is False
    assert result.active_manifest_ids == result.materialized_manifest_ids == ("m1",)
