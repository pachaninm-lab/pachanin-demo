from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Protocol

from tai.retrieval_index import IndexedChunk, RetrievalDocument, RetrievalIndexRepository
from tai.retrieval_service import RetrievalResponse, RetrievalService
from tai.rosstat_vshp2016254 import (
    DATA_URI,
    HISTORICAL_LABEL,
    PERIOD_END,
    PERIOD_START,
    SOURCE_ID,
)

_ALLOWED_SOURCE_IDS = frozenset({SOURCE_ID})


class SharedRetrievalLocale(StrEnum):
    RU = "ru"
    EN = "en"
    ZH = "zh"


class SharedRetrievalStatus(StrEnum):
    SUPPORTED = "SUPPORTED"
    ABSTAINED = "ABSTAINED"


@dataclass(frozen=True, slots=True)
class SharedRetrievalSyncEvidence:
    synchronized_at: datetime
    previous_generation: int | None
    active_generation: int
    changed: bool
    target_source_id: str
    target_document_count: int
    total_document_count: int
    target_manifest_sha256: str
    active_manifest_sha256: str
    chunk_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class SharedRetrievalCitation:
    source_id: str
    source_uri: str
    chunk_id: str
    period_start: str
    period_end: str
    historical_limitation: str


@dataclass(frozen=True, slots=True)
class SharedRetrievalResponse:
    locale: SharedRetrievalLocale
    status: SharedRetrievalStatus
    message: str
    retrieval: RetrievalResponse
    citations: tuple[SharedRetrievalCitation, ...]
    model_invoked: bool = False


class PublicCorpusDocumentAuthority(Protocol):
    def active_documents(self, *, now: datetime) -> tuple[RetrievalDocument, ...]: ...


class GovernedPublicCorpusRetrievalSynchronizer:
    """Replace one admitted public source in the durable shared retrieval generation."""

    def __init__(
        self,
        *,
        public_corpus: PublicCorpusDocumentAuthority,
        retrieval_index: RetrievalIndexRepository,
    ) -> None:
        self._public_corpus = public_corpus
        self._retrieval_index = retrieval_index

    def synchronize(self, *, now: datetime) -> SharedRetrievalSyncEvidence:
        current = _aware(now)
        target_documents = tuple(
            sorted(
                self._public_corpus.active_documents(now=current),
                key=lambda item: item.chunk.chunk_id,
            )
        )
        _validate_target_documents(target_documents, current)

        previous_generation = self._retrieval_index.active_generation()
        indexed = tuple(
            sorted(
                self._retrieval_index.active_documents(),
                key=lambda item: item.document.chunk.chunk_id,
            )
        )
        _validate_active_index(indexed, previous_generation)
        preserved = tuple(
            item.document
            for item in indexed
            if item.document.chunk.source_id not in _ALLOWED_SOURCE_IDS
        )
        existing_target = tuple(
            item.document
            for item in indexed
            if item.document.chunk.source_id in _ALLOWED_SOURCE_IDS
        )
        _validate_existing_target(existing_target)

        merged = tuple(
            sorted(
                (*preserved, *target_documents),
                key=lambda item: item.chunk.chunk_id,
            )
        )
        _require_unique_chunk_ids(merged)
        existing_documents = tuple(item.document for item in indexed)
        existing_manifest = _manifest_sha256(existing_documents)
        merged_manifest = _manifest_sha256(merged)
        target_manifest = _manifest_sha256(target_documents)

        if previous_generation is not None and existing_manifest == merged_manifest:
            return SharedRetrievalSyncEvidence(
                synchronized_at=current,
                previous_generation=previous_generation,
                active_generation=previous_generation,
                changed=False,
                target_source_id=SOURCE_ID,
                target_document_count=len(target_documents),
                total_document_count=len(merged),
                target_manifest_sha256=target_manifest,
                active_manifest_sha256=merged_manifest,
                chunk_ids=tuple(item.chunk.chunk_id for item in target_documents),
            )

        generation = self._retrieval_index.begin_generation()
        self._retrieval_index.add(generation, merged)
        self._retrieval_index.activate(generation)
        if self._retrieval_index.active_generation() != generation:
            raise RuntimeError("retrieval generation activation was not observable")
        activated = tuple(
            item.document
            for item in sorted(
                self._retrieval_index.active_documents(),
                key=lambda item: item.document.chunk.chunk_id,
            )
        )
        if _manifest_sha256(activated) != merged_manifest:
            raise RuntimeError("active retrieval manifest differs from synchronized manifest")
        return SharedRetrievalSyncEvidence(
            synchronized_at=current,
            previous_generation=previous_generation,
            active_generation=generation,
            changed=True,
            target_source_id=SOURCE_ID,
            target_document_count=len(target_documents),
            total_document_count=len(merged),
            target_manifest_sha256=target_manifest,
            active_manifest_sha256=merged_manifest,
            chunk_ids=tuple(item.chunk.chunk_id for item in target_documents),
        )


class RosstatSharedRetrievalService:
    """Source-filtered, non-generative retrieval with localized abstention and citations."""

    def __init__(self, retrieval_service: RetrievalService) -> None:
        self._retrieval_service = retrieval_service

    def retrieve(
        self,
        *,
        request_id: str,
        text: str,
        locale: SharedRetrievalLocale | str,
        now: datetime,
        tenant_id: str | None = None,
    ) -> SharedRetrievalResponse:
        language = _locale(locale)
        response = self._retrieval_service.retrieve(
            request_id=request_id,
            text=text,
            tenant_id=tenant_id,
            now=_aware(now),
            source_ids=_ALLOWED_SOURCE_IDS,
        )
        if not response.hits:
            return SharedRetrievalResponse(
                locale=language,
                status=SharedRetrievalStatus.ABSTAINED,
                message=_message(language, supported=False),
                retrieval=response,
                citations=(),
            )

        citations: list[SharedRetrievalCitation] = []
        for hit in response.hits:
            if hit.source_id != SOURCE_ID:
                raise RuntimeError("source-filtered retrieval returned an unexpected source")
            _validate_citation_text(hit.text)
            citations.append(
                SharedRetrievalCitation(
                    source_id=SOURCE_ID,
                    source_uri=DATA_URI,
                    chunk_id=hit.chunk_id,
                    period_start=PERIOD_START.isoformat(),
                    period_end=PERIOD_END.isoformat(),
                    historical_limitation=_historical_limitation(language),
                )
            )
        return SharedRetrievalResponse(
            locale=language,
            status=SharedRetrievalStatus.SUPPORTED,
            message=_message(language, supported=True),
            retrieval=response,
            citations=tuple(citations),
        )


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("now must be timezone-aware")
    return value.astimezone(UTC)


def _locale(value: SharedRetrievalLocale | str) -> SharedRetrievalLocale:
    try:
        return value if isinstance(value, SharedRetrievalLocale) else SharedRetrievalLocale(value)
    except ValueError as error:
        raise ValueError("locale must be one of: ru, en, zh") from error


def _validate_target_documents(
    documents: tuple[RetrievalDocument, ...],
    now: datetime,
) -> None:
    for document in documents:
        if document.chunk.source_id != SOURCE_ID:
            raise RuntimeError("public-corpus synchronization exposed an unexpected source")
        if document.tenant_id is not None:
            raise RuntimeError("public-corpus synchronization crossed the tenant boundary")
        if document.revoked:
            raise RuntimeError("revoked public-corpus document cannot be synchronized")
        if document.valid_until is None or document.valid_until <= now:
            raise RuntimeError("expired or unbounded public-corpus document cannot be synchronized")
        _validate_citation_text(document.chunk.text)
    _require_unique_chunk_ids(documents)


def _validate_existing_target(documents: tuple[RetrievalDocument, ...]) -> None:
    for document in documents:
        if document.tenant_id is not None or document.revoked:
            raise RuntimeError("active Rosstat retrieval document violates authority boundaries")
        _validate_citation_text(document.chunk.text)


def _validate_active_index(
    documents: tuple[IndexedChunk, ...],
    generation: int | None,
) -> None:
    observed = {item.generation for item in documents}
    if len(observed) > 1:
        raise RuntimeError("active retrieval documents span multiple generations")
    if observed and generation not in observed:
        raise RuntimeError("active retrieval generation does not match indexed documents")
    if generation is None and documents:
        raise RuntimeError("active retrieval documents exist without an ACTIVE generation")


def _validate_citation_text(text: str) -> None:
    if HISTORICAL_LABEL not in text or DATA_URI not in text or "XPath:" not in text:
        raise RuntimeError("Rosstat retrieval chunk lacks mandatory provenance context")


def _require_unique_chunk_ids(documents: tuple[RetrievalDocument, ...]) -> None:
    chunk_ids = [item.chunk.chunk_id for item in documents]
    if len(chunk_ids) != len(set(chunk_ids)):
        raise RuntimeError("retrieval manifest contains duplicate chunk ids")


def _manifest_sha256(documents: tuple[RetrievalDocument, ...]) -> str:
    payload = [
        {
            "chunkId": item.chunk.chunk_id,
            "sourceId": item.chunk.source_id,
            "documentChecksumSha256": item.chunk.document_checksum_sha256,
            "ordinal": item.chunk.ordinal,
            "tenantId": item.tenant_id,
            "trustScore": format(item.trust_score, ".12g"),
            "validUntil": (
                None if item.valid_until is None else _aware(item.valid_until).isoformat()
            ),
            "revoked": item.revoked,
            "textSha256": hashlib.sha256(item.chunk.text.encode("utf-8")).hexdigest(),
        }
        for item in sorted(documents, key=lambda value: value.chunk.chunk_id)
    ]
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _message(locale: SharedRetrievalLocale, *, supported: bool) -> str:
    messages = {
        SharedRetrievalLocale.RU: (
            "Найдены подтверждённые исторические данные Росстата."
            if supported
            else "Подтверждённых данных Росстата для этого запроса не найдено."
        ),
        SharedRetrievalLocale.EN: (
            "Verified historical Rosstat evidence was found."
            if supported
            else "No verified Rosstat evidence was found for this query."
        ),
        SharedRetrievalLocale.ZH: (
            "已找到经验证的俄罗斯统计局历史数据。"
            if supported
            else "未找到与此查询匹配的经验证俄罗斯统计局数据。"
        ),
    }
    return messages[locale]


def _historical_limitation(locale: SharedRetrievalLocale) -> str:
    messages = {
        SharedRetrievalLocale.RU: (
            "Исторические данные сельскохозяйственной переписи 2016 года; "
            "не являются текущими рыночными или хозяйственными данными."
        ),
        SharedRetrievalLocale.EN: (
            "Historical 2016 agricultural census data; not current market or farm-state evidence."
        ),
        SharedRetrievalLocale.ZH: (
            "2016年农业普查历史数据；不代表当前市场或农业经营状态。"
        ),
    }
    return messages[locale]
