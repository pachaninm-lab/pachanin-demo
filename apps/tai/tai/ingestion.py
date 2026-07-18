from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from tai.knowledge import KnowledgeRecord, KnowledgeScope
from tai.source_governance import SourceDocument, SourceRegistry


class IngestionState(StrEnum):
    ACCEPTED = "ACCEPTED"
    QUARANTINED = "QUARANTINED"
    DUPLICATE = "DUPLICATE"
    SUPERSEDED = "SUPERSEDED"
    REVOKED = "REVOKED"


@dataclass(frozen=True, slots=True)
class IngestionManifest:
    manifest_id: str
    source_id: str
    checksum_sha256: str
    version: str
    ingested_at: datetime
    state: IngestionState
    reasons: tuple[str, ...] = ()
    supersedes_manifest_id: str | None = None


@dataclass(frozen=True, slots=True)
class IngestionResult:
    manifest: IngestionManifest
    record: KnowledgeRecord | None


class IngestionLedger:
    def __init__(self) -> None:
        self._by_manifest: dict[str, IngestionManifest] = {}
        self._by_checksum: dict[str, str] = {}
        self._active_by_source: dict[str, str] = {}

    def ingest(
        self,
        document: SourceDocument,
        *,
        manifest_id: str,
        version: str,
        now: datetime,
        registry: SourceRegistry,
    ) -> IngestionResult:
        if manifest_id in self._by_manifest:
            raise ValueError("manifest_id_already_exists")

        duplicate_id = self._by_checksum.get(document.checksum_sha256)
        if duplicate_id is not None:
            manifest = IngestionManifest(
                manifest_id=manifest_id,
                source_id=document.source_id,
                checksum_sha256=document.checksum_sha256,
                version=version,
                ingested_at=now,
                state=IngestionState.DUPLICATE,
                reasons=("checksum_already_ingested", duplicate_id),
            )
            self._by_manifest[manifest_id] = manifest
            return IngestionResult(manifest=manifest, record=None)

        admission = registry.admit(document, now=now)
        if not admission.accepted:
            manifest = IngestionManifest(
                manifest_id=manifest_id,
                source_id=document.source_id,
                checksum_sha256=document.checksum_sha256,
                version=version,
                ingested_at=now,
                state=IngestionState.QUARANTINED,
                reasons=admission.reasons,
            )
            self._by_manifest[manifest_id] = manifest
            return IngestionResult(manifest=manifest, record=None)

        prior_id = self._active_by_source.get(document.source_id)
        manifest = IngestionManifest(
            manifest_id=manifest_id,
            source_id=document.source_id,
            checksum_sha256=document.checksum_sha256,
            version=version,
            ingested_at=now,
            state=IngestionState.ACCEPTED,
            supersedes_manifest_id=prior_id,
        )
        self._by_manifest[manifest_id] = manifest
        self._by_checksum[document.checksum_sha256] = manifest_id
        self._active_by_source[document.source_id] = manifest_id

        if prior_id is not None:
            prior = self._by_manifest[prior_id]
            self._by_manifest[prior_id] = IngestionManifest(
                manifest_id=prior.manifest_id,
                source_id=prior.source_id,
                checksum_sha256=prior.checksum_sha256,
                version=prior.version,
                ingested_at=prior.ingested_at,
                state=IngestionState.SUPERSEDED,
                reasons=("superseded_by", manifest_id),
                supersedes_manifest_id=prior.supersedes_manifest_id,
            )

        record = KnowledgeRecord(
            record_id=f"agro.{document.source_id}.{document.checksum_sha256[:12]}",
            title=document.title,
            body=document.body,
            version=version,
            source_uri=document.source_uri,
            effective_at=document.effective_at or document.published_at,
            trust_score=document.trust_score,
            scope=KnowledgeScope.PUBLIC,
            tags=frozenset({document.domain.value.casefold(), document.source_id}),
        )
        return IngestionResult(manifest=manifest, record=record)

    def revoke(self, manifest_id: str, *, reason: str) -> IngestionManifest:
        current = self._by_manifest.get(manifest_id)
        if current is None:
            raise KeyError("manifest_not_found")
        if current.state is not IngestionState.ACCEPTED:
            raise ValueError("only_active_manifest_can_be_revoked")

        revoked = IngestionManifest(
            manifest_id=current.manifest_id,
            source_id=current.source_id,
            checksum_sha256=current.checksum_sha256,
            version=current.version,
            ingested_at=current.ingested_at,
            state=IngestionState.REVOKED,
            reasons=(reason,),
            supersedes_manifest_id=current.supersedes_manifest_id,
        )
        self._by_manifest[manifest_id] = revoked
        if self._active_by_source.get(current.source_id) == manifest_id:
            del self._active_by_source[current.source_id]
        return revoked

    def get(self, manifest_id: str) -> IngestionManifest:
        return self._by_manifest[manifest_id]
