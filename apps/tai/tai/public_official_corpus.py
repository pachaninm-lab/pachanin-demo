from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import UTC, date, datetime
from enum import StrEnum
from urllib.parse import urlparse

from tai.knowledge_chunking import DeterministicKnowledgeChunker, KnowledgeChunk
from tai.retrieval_index import RetrievalDocument

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_SOURCE_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{4,160}$")
_DECISION_ID = re.compile(r"^AP14F0-[A-Z0-9_-]{5,96}$")
_RECORD_ID = re.compile(r"^prov_[a-z0-9]{16,64}$")


class SourceClass(StrEnum):
    OFFICIAL_MANUAL = "OFFICIAL_MANUAL"
    OFFICIAL_REGULATION = "OFFICIAL_REGULATION"
    OPEN_DATASET = "OPEN_DATASET"
    PUBLIC_REGISTRY = "PUBLIC_REGISTRY"


class SourceAdmissionStatus(StrEnum):
    ADMITTED = "ADMITTED"
    WITHDRAWN = "WITHDRAWN"


class ArtifactStatus(StrEnum):
    ADMITTED = "ADMITTED"
    QUARANTINED = "QUARANTINED"
    WITHDRAWN = "WITHDRAWN"


class SnapshotStatus(StrEnum):
    BUILDING = "BUILDING"
    ACTIVE = "ACTIVE"
    RETIRED = "RETIRED"
    FAILED = "FAILED"


class SourceLocatorKind(StrEnum):
    PAGE = "PAGE"
    ROW = "ROW"
    SECTION = "SECTION"
    RECORD_ID = "RECORD_ID"
    JSON_POINTER = "JSON_POINTER"
    XML_XPATH = "XML_XPATH"
    API_FIELD = "API_FIELD"


class QuarantineReason(StrEnum):
    RIGHTS_UNRESOLVED = "RIGHTS_UNRESOLVED"
    RIGHTS_EXPIRED = "RIGHTS_EXPIRED"
    PROVENANCE_INCOMPLETE = "PROVENANCE_INCOMPLETE"
    HOST_MISMATCH = "HOST_MISMATCH"
    DIGEST_MISMATCH = "DIGEST_MISMATCH"
    FRESHNESS_EXPIRED = "FRESHNESS_EXPIRED"
    PRIVACY_OR_SECRET = "PRIVACY_OR_SECRET"  # noqa: S105
    TENANT_OR_CONTRACT_DATA = "TENANT_OR_CONTRACT_DATA"
    MIME_OR_SIZE_POLICY = "MIME_OR_SIZE_POLICY"
    CONTENT_SAFETY = "CONTENT_SAFETY"
    PARSER_FAILURE = "PARSER_FAILURE"
    WITHDRAWN_SOURCE = "WITHDRAWN_SOURCE"


def _aware(value: datetime, field: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must be timezone-aware")
    return value.astimezone(UTC)


def _sha256(value: str, field: str) -> str:
    normalized = value.strip().lower()
    if _SHA256.fullmatch(normalized) is None:
        raise ValueError(f"{field} must be a lowercase SHA-256 digest")
    return normalized


def _official_uri(value: str, host_pin: str) -> str:
    normalized = value.strip()
    parsed = urlparse(normalized)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValueError("official_uri must be an absolute HTTPS URI")
    if parsed.username is not None or parsed.password is not None or parsed.fragment:
        raise ValueError("official_uri must not contain credentials or a fragment")
    if parsed.hostname.casefold() != host_pin.casefold():
        raise ValueError("official_uri host must equal host_pin")
    return normalized


def _source_id(value: str) -> str:
    normalized = value.strip()
    if _SOURCE_ID.fullmatch(normalized) is None:
        raise ValueError("source_id does not satisfy the governed identifier contract")
    return normalized


@dataclass(frozen=True, slots=True)
class PublicSourceAdmission:
    source_id: str
    source_class: SourceClass
    rights_decision_id: str
    official_uri: str
    host_pin: str
    rights_review_due_at: datetime
    admitted_at: datetime
    trust_score: float
    status: SourceAdmissionStatus = SourceAdmissionStatus.ADMITTED

    def __post_init__(self) -> None:
        object.__setattr__(self, "source_id", _source_id(self.source_id))
        normalized_host = self.host_pin.strip().casefold()
        if not normalized_host or len(normalized_host) > 253:
            raise ValueError("host_pin must be a bounded hostname")
        object.__setattr__(self, "host_pin", normalized_host)
        object.__setattr__(self, "official_uri", _official_uri(self.official_uri, normalized_host))
        if _DECISION_ID.fullmatch(self.rights_decision_id.strip()) is None:
            raise ValueError("rights_decision_id must be an AP-14F0 decision id")
        object.__setattr__(
            self,
            "rights_review_due_at",
            _aware(self.rights_review_due_at, "rights_review_due_at"),
        )
        object.__setattr__(self, "admitted_at", _aware(self.admitted_at, "admitted_at"))
        if self.rights_review_due_at <= self.admitted_at:
            raise ValueError("rights review must expire after admission")
        if not 0.5 <= self.trust_score <= 1.0:
            raise ValueError("public-official trust_score must be between 0.5 and 1.0")

    def eligible_at(self, now: datetime) -> bool:
        current = _aware(now, "now")
        return self.status is SourceAdmissionStatus.ADMITTED and current < self.rights_review_due_at


@dataclass(frozen=True, slots=True)
class PublicArtifactProvenance:
    record_id: str
    source_id: str
    source_class: SourceClass
    rights_decision_id: str
    official_uri: str
    host_pin: str
    content_sha256: str
    media_type: str
    size_bytes: int
    publication_date: date | None
    effective_date: date | None
    observed_at: datetime
    locator_kind: SourceLocatorKind
    locator_value: str
    freshness_due_at: datetime
    unit: str | None = None
    period_start: date | None = None
    period_end: date | None = None

    def __post_init__(self) -> None:
        if _RECORD_ID.fullmatch(self.record_id.strip()) is None:
            raise ValueError("record_id must satisfy AP-14F0 provenance identity")
        object.__setattr__(self, "source_id", _source_id(self.source_id))
        normalized_host = self.host_pin.strip().casefold()
        object.__setattr__(self, "host_pin", normalized_host)
        object.__setattr__(self, "official_uri", _official_uri(self.official_uri, normalized_host))
        if _DECISION_ID.fullmatch(self.rights_decision_id.strip()) is None:
            raise ValueError("rights_decision_id must be an AP-14F0 decision id")
        object.__setattr__(self, "content_sha256", _sha256(self.content_sha256, "content_sha256"))
        normalized_media_type = self.media_type.strip().casefold()
        if normalized_media_type not in {
            "text/html",
            "text/plain",
            "application/json",
            "application/xml",
            "text/xml",
        }:
            raise ValueError("media_type is not admitted by the AP-14F1A text policy")
        object.__setattr__(self, "media_type", normalized_media_type)
        if self.size_bytes < 1 or self.size_bytes > 20_000_000:
            raise ValueError("size_bytes must be between 1 and 20000000")
        object.__setattr__(self, "observed_at", _aware(self.observed_at, "observed_at"))
        object.__setattr__(
            self,
            "freshness_due_at",
            _aware(self.freshness_due_at, "freshness_due_at"),
        )
        if self.freshness_due_at <= self.observed_at:
            raise ValueError("freshness_due_at must follow observed_at")
        if not self.locator_value.strip() or len(self.locator_value) > 1024:
            raise ValueError("locator_value must be non-blank and bounded")
        if self.unit is not None and not self.unit.strip():
            raise ValueError("unit must be null or non-blank")
        if (self.period_start is None) != (self.period_end is None):
            raise ValueError("period_start and period_end must both be null or both be set")
        if (
            self.period_start is not None
            and self.period_end is not None
            and self.period_end < self.period_start
        ):
            raise ValueError("period_end must not precede period_start")

    def eligible_at(self, now: datetime) -> bool:
        current = _aware(now, "now")
        if current >= self.freshness_due_at:
            return False
        current_date = current.date()
        if self.publication_date is not None and self.publication_date > current_date:
            return False
        return self.effective_date is None or self.effective_date <= current_date


@dataclass(frozen=True, slots=True)
class PublicCorpusArtifact:
    provenance: PublicArtifactProvenance
    normalized_text: str

    def __post_init__(self) -> None:
        normalized = self.normalized_text.strip()
        if not normalized:
            raise ValueError("normalized_text must not be blank")
        payload = normalized.encode("utf-8")
        if len(payload) != self.provenance.size_bytes:
            raise ValueError("artifact size does not match provenance")
        if hashlib.sha256(payload).hexdigest() != self.provenance.content_sha256:
            raise ValueError("artifact digest does not match provenance")
        object.__setattr__(self, "normalized_text", normalized)


@dataclass(frozen=True, slots=True)
class PublicCorpusSnapshot:
    snapshot_sha256: str
    created_at: datetime
    chunks: tuple[KnowledgeChunk, ...]
    retrieval_documents: tuple[RetrievalDocument, ...]
    source_ids: tuple[str, ...]
    artifact_sha256s: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "snapshot_sha256",
            _sha256(self.snapshot_sha256, "snapshot_sha256"),
        )
        object.__setattr__(self, "created_at", _aware(self.created_at, "created_at"))
        if not self.chunks:
            raise ValueError("snapshot must contain at least one chunk")
        if len(self.chunks) != len(self.retrieval_documents):
            raise ValueError("snapshot chunks and retrieval documents must align")
        if tuple(sorted(set(self.source_ids))) != self.source_ids:
            raise ValueError("source_ids must be sorted and unique")
        if tuple(sorted(set(self.artifact_sha256s))) != self.artifact_sha256s:
            raise ValueError("artifact_sha256s must be sorted and unique")


class PublicOfficialCorpusBuilder:
    """Fail-closed in-memory builder. PostgreSQL remains the runtime authority."""

    def __init__(self, chunker: DeterministicKnowledgeChunker | None = None) -> None:
        self._chunker = chunker or DeterministicKnowledgeChunker()

    def build(
        self,
        *,
        admissions: tuple[PublicSourceAdmission, ...],
        artifacts: tuple[PublicCorpusArtifact, ...],
        now: datetime,
    ) -> PublicCorpusSnapshot:
        current = _aware(now, "now")
        if not artifacts:
            raise ValueError("at least one admitted artifact is required")
        by_source: dict[str, PublicSourceAdmission] = {}
        for admission in admissions:
            if admission.source_id in by_source:
                raise ValueError("source admission ids must be unique")
            by_source[admission.source_id] = admission

        chunks: list[KnowledgeChunk] = []
        documents: list[RetrievalDocument] = []
        source_ids: set[str] = set()
        artifact_ids: set[str] = set()
        seen_chunk_ids: set[str] = set()

        for artifact in sorted(artifacts, key=lambda item: item.provenance.content_sha256):
            provenance = artifact.provenance
            admission = by_source.get(provenance.source_id)
            if admission is None:
                raise ValueError("artifact source has no public-official admission")
            if not admission.eligible_at(current):
                raise ValueError("artifact source admission is withdrawn or rights-expired")
            if not provenance.eligible_at(current):
                raise ValueError("artifact provenance is stale or not yet effective")
            if provenance.source_class is not admission.source_class:
                raise ValueError("artifact source class does not match admission")
            if provenance.rights_decision_id != admission.rights_decision_id:
                raise ValueError("artifact rights decision does not match admission")
            if provenance.host_pin != admission.host_pin:
                raise ValueError("artifact host pin does not match admission")
            if provenance.official_uri != admission.official_uri:
                raise ValueError("artifact official URI does not match admission")

            artifact_chunks = self._chunker.chunk(
                source_id=provenance.source_id,
                document_checksum_sha256=provenance.content_sha256,
                text=artifact.normalized_text,
            )
            if not artifact_chunks:
                raise ValueError("admitted artifact produced no retrieval chunks")
            valid_until = min(admission.rights_review_due_at, provenance.freshness_due_at)
            for chunk in artifact_chunks:
                if chunk.chunk_id in seen_chunk_ids:
                    raise ValueError("duplicate chunk identity across admitted artifacts")
                seen_chunk_ids.add(chunk.chunk_id)
                chunks.append(chunk)
                documents.append(
                    RetrievalDocument(
                        chunk=chunk,
                        tenant_id=None,
                        trust_score=admission.trust_score,
                        valid_until=valid_until,
                        revoked=False,
                    )
                )
            source_ids.add(provenance.source_id)
            artifact_ids.add(provenance.content_sha256)

        canonical = "\n".join(
            [
                "tai.public-official-corpus.snapshot.v1",
                current.isoformat(),
                *sorted(source_ids),
                *sorted(artifact_ids),
                *sorted(chunk.chunk_id for chunk in chunks),
            ]
        )
        return PublicCorpusSnapshot(
            snapshot_sha256=hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
            created_at=current,
            chunks=tuple(chunks),
            retrieval_documents=tuple(documents),
            source_ids=tuple(sorted(source_ids)),
            artifact_sha256s=tuple(sorted(artifact_ids)),
        )
