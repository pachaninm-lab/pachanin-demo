from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from tai.knowledge_chunking import KnowledgeChunk
from tai.postgres_loader_state import ConnectionFactory
from tai.postgres_retrieval_index import PostgreSQLRetrievalIndexRepository
from tai.retrieval_index import (
    IndexedChunk,
    LexicalRetriever,
    RetrievalDocument,
    RetrievalIndexRepository,
)
from tai.retrieval_service import RetrievalBudget, RetrievalService
from tai.rosstat_vshp2016254 import DATA_URI, HISTORICAL_LABEL, SOURCE_ID

_SYNC_LOCK = "tai.retrieval.activation.v2"
_CANONICAL_QUERY = "7708234640 VSHP2016254 2016"
_RECOGNIZED_QUERY_MARKERS: dict[str, tuple[str, ...]] = {
    "ru": (
        "угод",
        "сельскохозяй",
        "всхп",
        "7708234640",
        "vshp2016254",
    ),
    "en": (
        "agricultural land",
        "farmland",
        "land structure",
        "agricultural census",
        "7708234640",
        "vshp2016254",
    ),
    "zh": (
        "农业用地",
        "农用地",
        "土地结构",
        "农业普查",
        "7708234640",
        "vshp2016254",
    ),
}
_HISTORICAL_LIMITATION: dict[str, str] = {
    "ru": (
        "Исторические данные Всероссийской сельскохозяйственной переписи "
        "за 2016 год; не являются текущими данными рынка или конкретного "
        "хозяйства."
    ),
    "en": (
        "Historical 2016 Russian agricultural census data; not current market data "
        "or current evidence about a specific farm."
    ),
    "zh": (
        "俄罗斯2016年农业普查历史数据；不是当前市场数据，也不是特定农场的"
        "当前证据。"
    ),
}
_SUPPORTED_MESSAGE: dict[str, str] = {
    "ru": (
        "Найдены управляемые исторические данные Росстата с проверяемыми "
        "ссылками."
    ),
    "en": "Governed historical Rosstat evidence was found with verifiable citations.",
    "zh": "已找到带有可验证引用的俄罗斯统计局受控历史数据。",
}
_ABSTAINED_MESSAGE: dict[str, str] = {
    "ru": (
        "Подтверждённых данных по этому запросу в активном источнике "
        "Росстата не найдено."
    ),
    "en": (
        "No confirmed evidence for this request was found in the active "
        "Rosstat source."
    ),
    "zh": "在当前启用的俄罗斯统计局来源中未找到可确认此请求的证据。",
}


class SharedRetrievalStatus(StrEnum):
    SUPPORTED = "SUPPORTED"
    ABSTAINED = "ABSTAINED"


@dataclass(frozen=True, slots=True)
class SharedRetrievalSyncResult:
    generation: int | None
    previous_generation: int | None
    created_generation: bool
    manifest_sha256: str
    document_count: int
    source_document_count: int


@dataclass(frozen=True, slots=True)
class SharedRetrievalCitation:
    source_id: str
    source_uri: str
    chunk_id: str
    historical_limitation: str


@dataclass(frozen=True, slots=True)
class LocalizedSharedRetrievalResponse:
    locale: str
    status: SharedRetrievalStatus
    message: str
    generation: int | None
    query_sha256: str
    chunk_ids: tuple[str, ...]
    source_ids: tuple[str, ...]
    citations: tuple[SharedRetrievalCitation, ...]
    model_invoked: bool = False


class _SourceBoundRetrievalRepository:
    def __init__(
        self,
        repository: RetrievalIndexRepository,
        allowed_source_id: str,
    ) -> None:
        self._repository = repository
        self._allowed_source_id = allowed_source_id

    def begin_generation(self) -> int:
        return self._repository.begin_generation()

    def add(self, generation: int, documents: tuple[RetrievalDocument, ...]) -> None:
        self._repository.add(generation, documents)

    def activate(self, generation: int) -> None:
        self._repository.activate(generation)

    def active_documents(self) -> tuple[IndexedChunk, ...]:
        return tuple(
            item
            for item in self._repository.active_documents()
            if item.document.chunk.source_id == self._allowed_source_id
        )


class RosstatSharedRetrievalSynchronizer:
    """Atomically mirror one governed public-corpus source into retrieval authority."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def sync(self, *, now: datetime) -> SharedRetrievalSyncResult:
        observed = _aware(now)
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
                        (_SYNC_LOCK,),
                    )
                    current_generation = self._active_generation(cursor)
                    current_documents = self._active_retrieval_documents(
                        cursor,
                        current_generation,
                    )
                    source_documents = self._active_public_documents(cursor, observed)
                    _validate_target_documents(source_documents, now=observed)
                    desired_documents = _compose_desired_documents(
                        current_documents=current_documents,
                        source_documents=source_documents,
                    )
                    current_manifest = canonical_manifest_sha256(current_documents)
                    desired_manifest = canonical_manifest_sha256(desired_documents)

                    if (
                        current_generation is not None
                        and current_manifest == desired_manifest
                    ):
                        connection.commit()
                        return SharedRetrievalSyncResult(
                            generation=current_generation,
                            previous_generation=current_generation,
                            created_generation=False,
                            manifest_sha256=desired_manifest,
                            document_count=len(desired_documents),
                            source_document_count=len(source_documents),
                        )

                    if current_generation is None and not desired_documents:
                        connection.commit()
                        return SharedRetrievalSyncResult(
                            generation=None,
                            previous_generation=None,
                            created_generation=False,
                            manifest_sha256=desired_manifest,
                            document_count=0,
                            source_document_count=0,
                        )

                    cursor.execute(
                        """
                        INSERT INTO tai_retrieval_generations (status)
                        VALUES ('BUILDING')
                        RETURNING generation
                        """
                    )
                    row = cursor.fetchone()
                    if row is None:
                        raise RuntimeError(
                            "retrieval generation insert returned no row"
                        )
                    generation = int(row["generation"])
                    self._insert_documents(cursor, generation, desired_documents)
                    cursor.execute(
                        "SELECT tai_activate_retrieval_generation(%s)",
                        (generation,),
                    )
                    cursor.fetchone()
                    activated = self._active_generation(cursor)
                    if activated != generation:
                        raise RuntimeError(
                            "retrieval generation activation did not become "
                            "authoritative"
                         )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

        return SharedRetrievalSyncResult(
            generation=generation,
            previous_generation=current_generation,
            created_generation=True,
            manifest_sha256=desired_manifest,
            document_count=len(desired_documents),
            source_document_count=len(source_documents),
        )

    @staticmethod
    def _active_generation(cursor: Any) -> int | None:
        cursor.execute(
            """
            SELECT generation
            FROM tai_retrieval_generations
            WHERE status = 'ACTIVE'
            ORDER BY generation
            FOR UPDATE
            """
        )
        rows = _all_rows(cursor)
        if len(rows) > 1:
            raise RuntimeError("multiple active retrieval generations detected")
        return None if not rows else int(rows[0]["generation"])

    @staticmethod
    def _active_retrieval_documents(
        cursor: Any,
        generation: int | None,
    ) -> tuple[RetrievalDocument, ...]:
        if generation is None:
            return ()
        cursor.execute(
            """
            SELECT
                chunk_id,
                source_id,
                document_checksum_sha256,
                ordinal,
                tenant_id,
                trust_score,
                valid_until,
                revoked,
                chunk_text
            FROM tai_retrieval_chunks
            WHERE generation = %s
            ORDER BY chunk_id
            """,
            (generation,),
        )
        return tuple(_retrieval_document(row) for row in _all_rows(cursor))

    @staticmethod
    def _active_public_documents(
        cursor: Any,
        now: datetime,
    ) -> tuple[RetrievalDocument, ...]:
        cursor.execute(
            """
            SELECT
                chunk_id,
                artifact_sha256,
                source_id,
                ordinal,
                chunk_text,
                token_estimate,
                trust_score,
                valid_until
            FROM tai_active_public_corpus_chunks_v1
            WHERE valid_until > %s
            ORDER BY chunk_id
            """,
            (now,),
        )
        rows = _all_rows(cursor)
        unexpected = sorted(
            {
                str(row["source_id"])
                for row in rows
                if str(row["source_id"]) != SOURCE_ID
            }
        )
        if unexpected:
            raise RuntimeError(
                "unexpected active public-corpus sources: " + ",".join(unexpected)
            )
        return tuple(
            RetrievalDocument(
                chunk=KnowledgeChunk(
                    chunk_id=str(row["chunk_id"]),
                    source_id=str(row["source_id"]),
                    document_checksum_sha256=str(row["artifact_sha256"]),
                    ordinal=int(row["ordinal"]),
                    text=str(row["chunk_text"]),
                    token_estimate=int(row["token_estimate"]),
                ),
                tenant_id=None,
                trust_score=float(row["trust_score"]),
                valid_until=row["valid_until"],
                revoked=False,
            )
            for row in rows
        )

    @staticmethod
    def _insert_documents(
        cursor: Any,
        generation: int,
        documents: Sequence[RetrievalDocument],
    ) -> None:
        query = """
            INSERT INTO tai_retrieval_chunks (
                generation,
                chunk_id,
                source_id,
                document_checksum_sha256,
                ordinal,
                tenant_id,
                trust_score,
                valid_until,
                revoked,
                chunk_text
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        for document in documents:
            chunk = document.chunk
            cursor.execute(
                query,
                (
                    generation,
                    chunk.chunk_id,
                    chunk.source_id,
                    chunk.document_checksum_sha256,
                    chunk.ordinal,
                    document.tenant_id,
                    document.trust_score,
                    document.valid_until,
                    document.revoked,
                    chunk.text,
                ),
            )


class RosstatSharedRetrievalService:
    """Localized, model-free evidence retrieval bound to the exact admitted source."""

    def __init__(
        self,
        connection_factory: ConnectionFactory | None = None,
        *,
        repository: RetrievalIndexRepository | None = None,
        budget: RetrievalBudget | None = None,
    ) -> None:
        if repository is None:
            if connection_factory is None:
                raise ValueError("connection_factory is required without a repository")
            repository = PostgreSQLRetrievalIndexRepository(connection_factory)
        bounded = _SourceBoundRetrievalRepository(repository, SOURCE_ID)
        self._service = RetrievalService(
            LexicalRetriever(bounded),
            budget=budget or RetrievalBudget(max_results=5, max_total_chars=20_000),
        )

    def retrieve(
        self,
        *,
        locale: str,
        request_id: str,
        text: str,
        now: datetime,
    ) -> LocalizedSharedRetrievalResponse:
        normalized_locale = locale.strip().lower()
        if normalized_locale not in _RECOGNIZED_QUERY_MARKERS:
            raise ValueError("unsupported locale")
        normalized_request_id = request_id.strip()
        if not normalized_request_id:
            raise ValueError("request_id must not be blank")
        normalized_text = " ".join(text.split())
        if not normalized_text:
            raise ValueError("text must not be blank")
        if not _is_recognized_query(normalized_locale, normalized_text):
            return _abstained(normalized_locale, normalized_text)

        response = self._service.retrieve(
            request_id=normalized_request_id,
            text=_CANONICAL_QUERY,
            tenant_id=None,
            now=_aware(now),
            minimum_trust_score=0.5,
         )
        if not response.hits:
            return _abstained(
                normalized_locale,
                normalized_text,
                generation=response.evidence.generation,
            )
        if any(hit.source_id != SOURCE_ID for hit in response.hits):
            raise RuntimeError("source-bound retrieval returned an unexpected source")

        limitation = _HISTORICAL_LIMITATION[normalized_locale]
        citations = tuple(
            SharedRetrievalCitation(
                source_id=hit.source_id,
                source_uri=DATA_URI,
                chunk_id=hit.chunk_id,
                historical_limitation=limitation,
            )
            for hit in response.hits
        )
        return LocalizedSharedRetrievalResponse(
            locale=normalized_locale,
            status=SharedRetrievalStatus.SUPPORTED,
            message=_SUPPORTED_MESSAGE[normalized_locale],
            generation=response.evidence.generation,
            query_sha256=hashlib.sha256(normalized_text.encode()).hexdigest(),
            chunk_ids=tuple(hit.chunk_id for hit in response.hits),
            source_ids=tuple(hit.source_id for hit in response.hits),
            citations=citations,
        )


def canonical_manifest_sha256(documents: Sequence[RetrievalDocument]) -> str:
    payload = [
        {
            "chunkId": document.chunk.chunk_id,
            "sourceId": document.chunk.source_id,
            "documentChecksumSha256": document.chunk.document_checksum_sha256,
            "ordinal": document.chunk.ordinal,
            "tenantId": document.tenant_id,
            "trustScore": format(document.trust_score, ".6f"),
            "validUntil": (
                None
                if document.valid_until is None
                else _aware(document.valid_until).isoformat()
            ),
            "revoked": document.revoked,
            "textSha256": hashlib.sha256(document.chunk.text.encode()).hexdigest(),
        }
        for document in sorted(documents, key=lambda item: item.chunk.chunk_id)
    ]
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def _compose_desired_documents(
    *,
    current_documents: Sequence[RetrievalDocument],
    source_documents: Sequence[RetrievalDocument],
) -> tuple[RetrievalDocument, ...]:
    preserved = [
        document
        for document in current_documents
        if document.chunk.source_id != SOURCE_ID
    ]
    combined = [*preserved, *source_documents]
    chunk_ids = [document.chunk.chunk_id for document in combined]
    if len(set(chunk_ids)) != len(chunk_ids):
        raise RuntimeError("retrieval chunk identity collision")
    return tuple(sorted(combined, key=lambda item: item.chunk.chunk_id))


def _validate_target_documents(
    documents: Sequence[RetrievalDocument],
    *,
    now: datetime,
) -> None:
    observed = _aware(now)
    for document in documents:
        chunk = document.chunk
        if chunk.source_id != SOURCE_ID:
            raise RuntimeError("unexpected source entered Rosstat synchronization")
        if document.tenant_id is not None:
            raise RuntimeError("public source document has tenant binding")
        if document.revoked:
            raise RuntimeError("revoked public source document cannot be synchronized")
        if document.valid_until is None or _aware(document.valid_until) <= observed:
            raise RuntimeError("expired public source document cannot be synchronized")
        if document.trust_score < 0.5:
            raise RuntimeError("public source document trust score is below policy")
        if (
            HISTORICAL_LABEL not in chunk.text
            or DATA_URI not in chunk.text
            or "XPath:" not in chunk.text
        ):
            raise RuntimeError(
                "public source document lacks mandatory citation context"
            )


def _retrieval_document(row: Mapping[str, Any]) -> RetrievalDocument:
    text = str(row["chunk_text"])
    return RetrievalDocument(
        chunk=KnowledgeChunk(
            chunk_id=str(row["chunk_id"]),
            source_id=str(row["source_id"]),
            document_checksum_sha256=str(row["document_checksum_sha256"]),
            ordinal=int(row["ordinal"]),
            text=text,
            token_estimate=max(1, (len(text) + 3) // 4),
        ),
        tenant_id=None if row["tenant_id"] is None else str(row["tenant_id"]),
        trust_score=float(row["trust_score"]),
        valid_until=row["valid_until"],
        revoked=bool(row["revoked"]),
    )


def _all_rows(cursor: Any) -> tuple[Mapping[str, Any], ...]:
    rows: list[Mapping[str, Any]] = []
    while True:
        row = cursor.fetchone()
        if row is None:
            return tuple(rows)
        rows.append(row)


def _is_recognized_query(locale: str, text: str) -> bool:
    normalized = text.casefold()
    return any(marker in normalized for marker in _RECOGNIZED_QUERY_MARKERS[locale])


def _abstained(
    locale: str,
    text: str,
    *,
    generation: int | None = None,
) -> LocalizedSharedRetrievalResponse:
    return LocalizedSharedRetrievalResponse(
        locale=locale,
        status=SharedRetrievalStatus.ABSTAINED,
        message=_ABSTAINED_MESSAGE[locale],
        generation=generation,
        query_sha256=hashlib.sha256(text.strip().encode()).hexdigest(),
        chunk_ids=(),
        source_ids=(),
        citations=(),
    )


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("datetime must be timezone-aware")
    return value.astimezone(UTC)
