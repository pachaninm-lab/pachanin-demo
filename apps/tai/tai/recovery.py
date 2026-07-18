from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from tai.knowledge import KnowledgeStore
from tai.materialized_knowledge import (
    JsonMaterializedKnowledgeRepository,
    MaterializedEntry,
    MaterializedSnapshot,
    build_knowledge_store,
    reconcile_materialized_entries,
)
from tai.persistent_ingestion import JsonSnapshotRepository, active_manifests


@dataclass(frozen=True, slots=True)
class RecoveryResult:
    repaired: bool
    active_manifest_ids: tuple[str, ...]
    materialized_manifest_ids: tuple[str, ...]
    store: KnowledgeStore


class IngestionRecoveryCoordinator:
    def __init__(
        self,
        *,
        ingestion_repository: JsonSnapshotRepository,
        materialized_repository: JsonMaterializedKnowledgeRepository,
    ) -> None:
        self._ingestion_repository = ingestion_repository
        self._materialized_repository = materialized_repository

    def recover(self, *, now: datetime) -> RecoveryResult:
        ingestion_snapshot = self._ingestion_repository.load()
        active = active_manifests(ingestion_snapshot)
        materialized_snapshot = self._materialized_repository.load()
        reconciled = reconcile_materialized_entries(
            active_manifests=active,
            existing_entries=materialized_snapshot.entries,
        )
        repaired = reconciled != materialized_snapshot.entries
        if repaired:
            self._materialized_repository.save(
                MaterializedSnapshot(
                    schema_version=materialized_snapshot.schema_version,
                    generated_at=now,
                    entries=reconciled,
                )
            )

        return RecoveryResult(
            repaired=repaired,
            active_manifest_ids=tuple(item.manifest_id for item in active),
            materialized_manifest_ids=tuple(item.manifest_id for item in reconciled),
            store=build_knowledge_store(reconciled),
        )


def materialized_entries_by_manifest(
    entries: tuple[MaterializedEntry, ...],
) -> dict[str, MaterializedEntry]:
    return {entry.manifest_id: entry for entry in entries}
