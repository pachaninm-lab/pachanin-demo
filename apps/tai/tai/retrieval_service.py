from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from tai.retrieval_index import LexicalRetriever, RetrievalHit, RetrievalQuery


@dataclass(frozen=True, slots=True)
class RetrievalBudget:
    max_results: int = 10
    max_total_chars: int = 12_000

    def __post_init__(self) -> None:
        if self.max_results < 1 or self.max_results > 100:
            raise ValueError("max_results must be between 1 and 100")
        if self.max_total_chars < 256 or self.max_total_chars > 100_000:
            raise ValueError("max_total_chars must be between 256 and 100000")


@dataclass(frozen=True, slots=True)
class RetrievalEvidence:
    request_id: str
    query_sha256: str
    tenant_id: str | None
    generation: int | None
    retrieved_at: datetime
    minimum_trust_score: float
    result_count: int
    total_chars: int
    chunk_ids: tuple[str, ...]
    source_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class RetrievalResponse:
    hits: tuple[RetrievalHit, ...]
    evidence: RetrievalEvidence


class RetrievalAuditSink(Protocol):
    def record(self, evidence: RetrievalEvidence) -> None: ...


class NullRetrievalAuditSink:
    def record(self, evidence: RetrievalEvidence) -> None:
        del evidence


class RetrievalService:
    """Bounded retrieval facade producing immutable provenance evidence."""

    def __init__(
        self,
        retriever: LexicalRetriever,
        audit_sink: RetrievalAuditSink | None = None,
        budget: RetrievalBudget | None = None,
    ) -> None:
        self._retriever = retriever
        self._audit_sink = audit_sink or NullRetrievalAuditSink()
        self._budget = budget or RetrievalBudget()

    def retrieve(
        self,
        *,
        request_id: str,
        text: str,
        tenant_id: str | None,
        now: datetime,
        minimum_trust_score: float = 0.5,
    ) -> RetrievalResponse:
        normalized_request_id = request_id.strip()
        if not normalized_request_id:
            raise ValueError("request_id must not be blank")

        query = RetrievalQuery(
            text=text,
            tenant_id=tenant_id,
            now=now,
            minimum_trust_score=minimum_trust_score,
            limit=self._budget.max_results,
        )
        candidates = self._retriever.search(query)
        selected: list[RetrievalHit] = []
        total_chars = 0
        for hit in candidates:
            projected = total_chars + len(hit.text)
            if projected > self._budget.max_total_chars:
                continue
            selected.append(hit)
            total_chars = projected

        hits = tuple(selected)
        generations = {hit.generation for hit in hits}
        generation = next(iter(generations)) if len(generations) == 1 else None
        evidence = RetrievalEvidence(
            request_id=normalized_request_id,
            query_sha256=hashlib.sha256(text.strip().encode()).hexdigest(),
            tenant_id=None if tenant_id is None else tenant_id.strip(),
            generation=generation,
            retrieved_at=now,
            minimum_trust_score=minimum_trust_score,
            result_count=len(hits),
            total_chars=total_chars,
            chunk_ids=tuple(hit.chunk_id for hit in hits),
            source_ids=tuple(hit.source_id for hit in hits),
        )
        self._audit_sink.record(evidence)
        return RetrievalResponse(hits=hits, evidence=evidence)
