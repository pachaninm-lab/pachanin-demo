from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Final

from tai.ingestion import IngestionManifest
from tai.knowledge import KnowledgeRecord, KnowledgeScope, KnowledgeStore

MATERIALIZED_SCHEMA_VERSION: Final[str] = "tai.materialized-knowledge.v1"


@dataclass(frozen=True, slots=True)
class MaterializedEntry:
    manifest_id: str
    record: KnowledgeRecord


@dataclass(frozen=True, slots=True)
class MaterializedSnapshot:
    schema_version: str
    generated_at: datetime
    entries: tuple[MaterializedEntry, ...]


class MaterializedKnowledgeIntegrityError(RuntimeError):
    pass


class JsonMaterializedKnowledgeRepository:
    def __init__(self, path: Path) -> None:
        self._path = path

    def save(self, snapshot: MaterializedSnapshot) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "schema_version": snapshot.schema_version,
            "generated_at": snapshot.generated_at.isoformat(),
            "entries": [
                {
                    "manifest_id": entry.manifest_id,
                    "record": {
                        **asdict(entry.record),
                        "effective_at": entry.record.effective_at.isoformat(),
                        "scope": entry.record.scope.value,
                        "tenant_id": str(entry.record.tenant_id) if entry.record.tenant_id else None,
                        "tags": sorted(entry.record.tags),
                    },
                }
                for entry in snapshot.entries
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

    def load(self) -> MaterializedSnapshot:
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise MaterializedKnowledgeIntegrityError("materialized_snapshot_unreadable") from exc

        if raw.get("schema_version") != MATERIALIZED_SCHEMA_VERSION:
            raise MaterializedKnowledgeIntegrityError("materialized_snapshot_schema_unsupported")

        try:
            entries = tuple(
                MaterializedEntry(
                    manifest_id=item["manifest_id"],
                    record=KnowledgeRecord(
                        record_id=item["record"]["record_id"],
                        title=item["record"]["title"],
                        body=item["record"]["body"],
                        version=item["record"]["version"],
                        source_uri=item["record"]["source_uri"],
                        effective_at=datetime.fromisoformat(item["record"]["effective_at"]),
                        trust_score=float(item["record"]["trust_score"]),
                        scope=KnowledgeScope(item["record"]["scope"]),
                        tenant_id=None,
                        tags=frozenset(item["record"].get("tags", ())),
                    ),
                )
                for item in raw["entries"]
            )
            generated_at = datetime.fromisoformat(raw["generated_at"])
        except (KeyError, TypeError, ValueError) as exc:
            raise MaterializedKnowledgeIntegrityError("materialized_snapshot_payload_invalid") from exc

        manifest_ids = [entry.manifest_id for entry in entries]
        record_ids = [entry.record.record_id for entry in entries]
        if len(manifest_ids) != len(set(manifest_ids)):
            raise MaterializedKnowledgeIntegrityError("materialized_duplicate_manifest_id")
        if len(record_ids) != len(set(record_ids)):
            raise MaterializedKnowledgeIntegrityError("materialized_duplicate_record_id")

        return MaterializedSnapshot(
            schema_version=MATERIALIZED_SCHEMA_VERSION,
            generated_at=generated_at,
            entries=entries,
        )


def reconcile_materialized_entries(
    *,
    active_manifests: tuple[IngestionManifest, ...],
    existing_entries: tuple[MaterializedEntry, ...],
) -> tuple[MaterializedEntry, ...]:
    active_ids = {manifest.manifest_id for manifest in active_manifests}
    return tuple(
        sorted(
            (entry for entry in existing_entries if entry.manifest_id in active_ids),
            key=lambda item: item.record.record_id,
        )
    )


def build_knowledge_store(entries: tuple[MaterializedEntry, ...]) -> KnowledgeStore:
    return KnowledgeStore(tuple(entry.record for entry in entries))
