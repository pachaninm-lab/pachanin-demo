from datetime import UTC, datetime

import pytest

from tai.ingestion import IngestionManifest, IngestionState
from tai.persistent_ingestion import (
    SNAPSHOT_SCHEMA_VERSION,
    IngestionSnapshot,
    JsonSnapshotRepository,
    SnapshotIntegrityError,
    active_manifests,
)

NOW = datetime(2026, 7, 18, 12, 0, tzinfo=UTC)


def manifest(
    manifest_id: str,
    source_id: str,
    state: IngestionState,
    *,
    ingested_at: datetime = NOW,
) -> IngestionManifest:
    return IngestionManifest(
        manifest_id=manifest_id,
        source_id=source_id,
        checksum_sha256=(manifest_id * 64)[:64],
        version="1",
        ingested_at=ingested_at,
        state=state,
    )


def test_snapshot_round_trip_is_deterministic(tmp_path) -> None:
    repository = JsonSnapshotRepository(tmp_path / "ingestion.json")
    snapshot = IngestionSnapshot(
        schema_version=SNAPSHOT_SCHEMA_VERSION,
        generated_at=NOW,
        manifests=(manifest("a", "official.minselhoz", IngestionState.ACCEPTED),),
    )

    repository.save(snapshot)
    first_bytes = (tmp_path / "ingestion.json").read_bytes()
    recovered = repository.load()
    repository.save(recovered)

    assert recovered == snapshot
    assert (tmp_path / "ingestion.json").read_bytes() == first_bytes


def test_corrupt_snapshot_fails_closed(tmp_path) -> None:
    path = tmp_path / "ingestion.json"
    path.write_text("{broken", encoding="utf-8")

    with pytest.raises(SnapshotIntegrityError, match="snapshot_unreadable"):
        JsonSnapshotRepository(path).load()


def test_unknown_schema_fails_closed(tmp_path) -> None:
    path = tmp_path / "ingestion.json"
    path.write_text(
        '{"schema_version":"future","generated_at":"2026-07-18T12:00:00+00:00","manifests":[]}',
        encoding="utf-8",
    )

    with pytest.raises(SnapshotIntegrityError, match="snapshot_schema_unsupported"):
        JsonSnapshotRepository(path).load()


def test_duplicate_manifest_ids_fail_closed(tmp_path) -> None:
    repository = JsonSnapshotRepository(tmp_path / "ingestion.json")
    duplicate = manifest("same", "official.minselhoz", IngestionState.ACCEPTED)
    repository.save(
        IngestionSnapshot(
            schema_version=SNAPSHOT_SCHEMA_VERSION,
            generated_at=NOW,
            manifests=(duplicate, duplicate),
        )
    )

    with pytest.raises(SnapshotIntegrityError, match="snapshot_duplicate_manifest_id"):
        repository.load()


def test_active_manifest_recovery_excludes_revoked_and_superseded() -> None:
    snapshot = IngestionSnapshot(
        schema_version=SNAPSHOT_SCHEMA_VERSION,
        generated_at=NOW,
        manifests=(
            manifest("a", "source.a", IngestionState.SUPERSEDED),
            manifest("b", "source.a", IngestionState.ACCEPTED),
            manifest("c", "source.b", IngestionState.REVOKED),
            manifest("d", "source.c", IngestionState.QUARANTINED),
        ),
    )

    assert tuple(item.manifest_id for item in active_manifests(snapshot)) == ("b",)
