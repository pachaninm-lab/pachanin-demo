from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Final

from tai.ingestion import IngestionManifest, IngestionState

SNAPSHOT_SCHEMA_VERSION: Final[str] = "tai.ingestion.snapshot.v1"


@dataclass(frozen=True, slots=True)
class IngestionSnapshot:
    schema_version: str
    generated_at: datetime
    manifests: tuple[IngestionManifest, ...]


class SnapshotIntegrityError(RuntimeError):
    pass


class JsonSnapshotRepository:
    def __init__(self, path: Path) -> None:
        self._path = path

    def save(self, snapshot: IngestionSnapshot) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": snapshot.schema_version,
            "generated_at": snapshot.generated_at.isoformat(),
            "manifests": [
                {
                    **asdict(manifest),
                    "ingested_at": manifest.ingested_at.isoformat(),
                    "state": manifest.state.value,
                }
                for manifest in snapshot.manifests
            ],
        }
        encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))

        temp_name: str | None = None
        try:
            with NamedTemporaryFile(
                mode="w",
                encoding="utf-8",
                dir=self._path.parent,
                prefix=f".{self._path.name}.",
                suffix=".tmp",
                delete=False,
            ) as handle:
                temp_name = handle.name
                handle.write(encoded)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_name, self._path)
            temp_name = None
        finally:
            if temp_name is not None:
                Path(temp_name).unlink(missing_ok=True)

    def load(self) -> IngestionSnapshot:
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise SnapshotIntegrityError("snapshot_unreadable") from exc

        if raw.get("schema_version") != SNAPSHOT_SCHEMA_VERSION:
            raise SnapshotIntegrityError("snapshot_schema_unsupported")

        try:
            manifests = tuple(
                IngestionManifest(
                    manifest_id=item["manifest_id"],
                    source_id=item["source_id"],
                    checksum_sha256=item["checksum_sha256"],
                    version=item["version"],
                    ingested_at=datetime.fromisoformat(item["ingested_at"]),
                    state=IngestionState(item["state"]),
                    reasons=tuple(item.get("reasons", ())),
                    supersedes_manifest_id=item.get("supersedes_manifest_id"),
                )
                for item in raw["manifests"]
            )
            generated_at = datetime.fromisoformat(raw["generated_at"])
        except (KeyError, TypeError, ValueError) as exc:
            raise SnapshotIntegrityError("snapshot_payload_invalid") from exc

        manifest_ids = [manifest.manifest_id for manifest in manifests]
        if len(manifest_ids) != len(set(manifest_ids)):
            raise SnapshotIntegrityError("snapshot_duplicate_manifest_id")

        return IngestionSnapshot(
            schema_version=SNAPSHOT_SCHEMA_VERSION,
            generated_at=generated_at,
            manifests=manifests,
        )


def active_manifests(snapshot: IngestionSnapshot) -> tuple[IngestionManifest, ...]:
    active_by_source: dict[str, IngestionManifest] = {}
    for manifest in sorted(snapshot.manifests, key=lambda item: item.ingested_at):
        if manifest.state is IngestionState.ACCEPTED:
            active_by_source[manifest.source_id] = manifest
        elif manifest.state in {IngestionState.REVOKED, IngestionState.SUPERSEDED}:
            current = active_by_source.get(manifest.source_id)
            if current is not None and current.manifest_id == manifest.manifest_id:
                del active_by_source[manifest.source_id]
    return tuple(sorted(active_by_source.values(), key=lambda item: item.source_id))
