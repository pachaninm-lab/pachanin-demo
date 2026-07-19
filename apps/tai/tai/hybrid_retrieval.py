from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Sequence
from dataclasses import dataclass, replace
from datetime import datetime
from enum import StrEnum
from typing import Any, Protocol

from tai.retrieval_index import RetrievalHit, RetrievalQuery
from tai.retrieval_service import RetrievalBudget
from tai.semantic_retrieval import (
    EmbeddingIdentity,
    RetrievalComponentStatus,
    SemanticRetrievalError,
    SemanticSearchResult,
)

_IDENTIFIER = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")


class HybridRetrievalMode(StrEnum):
    LEXICAL_ONLY = "LEXICAL_ONLY"
    HYBRID_OPTIONAL = "HYBRID_OPTIONAL"
    HYBRID_REQUIRED = "HYBRID_REQUIRED"


class EffectiveRetrievalMode(StrEnum):
    LEXICAL = "LEXICAL"
    HYBRID = "HYBRID"


class RetrievalExecutionClass(StrEnum):
    STRUCTURAL_ONLY = "STRUCTURAL_ONLY"
    MEASURED = "MEASURED"


class LexicalSearch(Protocol):
    @property
    def identity_sha256(self) -> str: ...

    def search(self, query: RetrievalQuery) -> tuple[RetrievalHit, ...]: ...


class SemanticSearch(Protocol):
    @property
    def identity(self) -> EmbeddingIdentity: ...

    @property
    def identity_sha256(self) -> str: ...

    @property
    def components_admitted(self) -> bool: ...

    def search(self, query: RetrievalQuery) -> SemanticSearchResult: ...


@dataclass(frozen=True, slots=True)
class RerankerIdentity:
    reranker_id: str
    revision: str
    status: RetrievalComponentStatus

    def __post_init__(self) -> None:
        _portable(self.reranker_id, "reranker_id")
        _portable(self.revision, "reranker revision")

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "reranker_id": self.reranker_id,
                "revision": self.revision,
                "status": self.status.value,
            }
        )


class Reranker(Protocol):
    @property
    def identity(self) -> RerankerIdentity: ...

    def rerank(
        self,
        query: RetrievalQuery,
        candidates: tuple[RetrievalHit, ...],
    ) -> tuple[str, ...]: ...


@dataclass(frozen=True, slots=True)
class FusionPolicy:
    reciprocal_rank_constant: int = 60
    lexical_weight: float = 1.0
    semantic_weight: float = 1.0
    candidate_multiplier: int = 4
    require_admitted_components: bool = True

    def __post_init__(self) -> None:
        if self.reciprocal_rank_constant < 1 or self.reciprocal_rank_constant > 10_000:
            raise ValueError("reciprocal_rank_constant must be between 1 and 10000")
        if self.lexical_weight <= 0.0 or self.semantic_weight <= 0.0:
            raise ValueError("fusion weights must be positive")
        if self.candidate_multiplier < 1 or self.candidate_multiplier > 10:
            raise ValueError("candidate_multiplier must be between 1 and 10")

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "candidate_multiplier": self.candidate_multiplier,
                "lexical_weight": self.lexical_weight,
                "reciprocal_rank_constant": self.reciprocal_rank_constant,
                "require_admitted_components": self.require_admitted_components,
                "semantic_weight": self.semantic_weight,
                "strategy": "RECIPROCAL_RANK_FUSION",
            }
        )


@dataclass(frozen=True, slots=True)
class HybridCandidateTrace:
    chunk_id: str
    lexical_rank: int | None
    semantic_rank: int | None
    fused_score: float
    final_rank: int


@dataclass(frozen=True, slots=True)
class HybridSearchTrace:
    requested_mode: HybridRetrievalMode
    effective_mode: EffectiveRetrievalMode
    execution_class: RetrievalExecutionClass
    lexical_identity_sha256: str
    lexical_candidate_count: int
    semantic_candidate_count: int
    fused_candidate_count: int
    fusion_policy_sha256: str
    semantic_identity_sha256: str | None
    embedding_identity_sha256: str | None
    semantic_trace_sha256: str | None
    reranker_identity_sha256: str | None
    fallback_reason: str | None
    candidates: tuple[HybridCandidateTrace, ...]
    selected_chunk_ids: tuple[str, ...]

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "candidates": [
                    {
                        "chunk_id": candidate.chunk_id,
                        "final_rank": candidate.final_rank,
                        "fused_score": candidate.fused_score,
                        "lexical_rank": candidate.lexical_rank,
                        "semantic_rank": candidate.semantic_rank,
                    }
                    for candidate in self.candidates
                ],
                "effective_mode": self.effective_mode.value,
                "execution_class": self.execution_class.value,
                "embedding_identity_sha256": self.embedding_identity_sha256,
                "fallback_reason": self.fallback_reason,
                "fused_candidate_count": self.fused_candidate_count,
                "fusion_policy_sha256": self.fusion_policy_sha256,
                "lexical_candidate_count": self.lexical_candidate_count,
                "lexical_identity_sha256": self.lexical_identity_sha256,
                "requested_mode": self.requested_mode.value,
                "reranker_identity_sha256": self.reranker_identity_sha256,
                "selected_chunk_ids": list(self.selected_chunk_ids),
                "semantic_candidate_count": self.semantic_candidate_count,
                "semantic_identity_sha256": self.semantic_identity_sha256,
                "semantic_trace_sha256": self.semantic_trace_sha256,
            }
        )


@dataclass(frozen=True, slots=True)
class HybridSearchResult:
    hits: tuple[RetrievalHit, ...]
    trace: HybridSearchTrace


class HybridRetrievalError(RuntimeError):
    pass


class HybridRequiredUnavailable(HybridRetrievalError):
    pass


class CandidateIdentityConflict(HybridRetrievalError):
    pass


class RerankerContractViolation(HybridRetrievalError):
    pass


class HybridRetriever:
    """Deterministic lexical/semantic fusion that cannot expand retrieval authority."""

    def __init__(
        self,
        *,
        lexical: LexicalSearch,
        semantic: SemanticSearch | None,
        mode: HybridRetrievalMode,
        fusion_policy: FusionPolicy | None = None,
        reranker: Reranker | None = None,
    ) -> None:
        self._lexical = lexical
        self._semantic = semantic
        self._mode = mode
        self._fusion_policy = fusion_policy or FusionPolicy()
        self._reranker = reranker

    @property
    def identity_sha256(self) -> str:
        return _sha256_json(
            {
                "lexical_identity_sha256": self._lexical.identity_sha256,
                "semantic_identity_sha256": (
                    None if self._semantic is None else self._semantic.identity_sha256
                ),
                "fusion_policy_sha256": self._fusion_policy.sha256,
                "mode": self._mode.value,
                "reranker_identity_sha256": (
                    None if self._reranker is None else self._reranker.identity.sha256
                ),
            }
        )

    @property
    def components_admitted(self) -> bool:
        if self._mode is HybridRetrievalMode.LEXICAL_ONLY or self._semantic is None:
            return False
        if not self._semantic.components_admitted:
            return False
        return self._reranker is None or (
            self._reranker.identity.status is RetrievalComponentStatus.ADMITTED
        )

    @property
    def execution_class(self) -> RetrievalExecutionClass:
        return (
            RetrievalExecutionClass.MEASURED
            if self.components_admitted
            else RetrievalExecutionClass.STRUCTURAL_ONLY
        )

    def search(self, query: RetrievalQuery) -> HybridSearchResult:
        candidate_limit = min(
            100,
            max(query.limit, query.limit * self._fusion_policy.candidate_multiplier),
        )
        candidate_query = replace(query, limit=candidate_limit)
        lexical_hits = self._lexical.search(candidate_query)
        semantic_result: SemanticSearchResult | None = None
        semantic_identity_sha256 = (
            None if self._semantic is None else self._semantic.identity_sha256
        )
        fallback_reason: str | None = None

        if self._mode is not HybridRetrievalMode.LEXICAL_ONLY:
            if self._semantic is None:
                if self._mode is HybridRetrievalMode.HYBRID_REQUIRED:
                    raise HybridRequiredUnavailable("semantic retrieval is not configured")
                fallback_reason = "SEMANTIC_NOT_CONFIGURED"
            else:
                try:
                    semantic_result = self._semantic.search(candidate_query)
                except SemanticRetrievalError as error:
                    if self._mode is HybridRetrievalMode.HYBRID_REQUIRED:
                        raise HybridRequiredUnavailable(
                            "semantic retrieval is unavailable"
                        ) from error
                    fallback_reason = "SEMANTIC_UNAVAILABLE"

        if semantic_result is None:
            effective_mode = EffectiveRetrievalMode.LEXICAL
            ordered = lexical_hits
            lexical_ranks = _ranks(lexical_hits)
            semantic_ranks: dict[str, int] = {}
            embedding_identity_sha256 = None
            semantic_trace_sha256 = None
        else:
            if (
                self._fusion_policy.require_admitted_components
                and self._semantic is not None
                and not self._semantic.components_admitted
            ):
                raise HybridRequiredUnavailable("semantic component is not admitted")
            effective_mode = EffectiveRetrievalMode.HYBRID
            lexical_ranks = _ranks(lexical_hits)
            semantic_ranks = _ranks(semantic_result.hits)
            ordered = self._fuse(lexical_hits, semantic_result.hits)
            embedding_identity_sha256 = semantic_result.trace.embedding_identity_sha256
            semantic_trace_sha256 = semantic_result.trace.sha256

        if self._reranker is not None:
            if (
                self._fusion_policy.require_admitted_components
                and self._reranker.identity.status is not RetrievalComponentStatus.ADMITTED
            ):
                raise HybridRequiredUnavailable("reranker component is not admitted")
            ordered = self._apply_reranker(query, ordered)

        selected = tuple(ordered[: query.limit])
        final_ranks = {hit.chunk_id: rank for rank, hit in enumerate(ordered, start=1)}
        candidate_traces = tuple(
            HybridCandidateTrace(
                chunk_id=hit.chunk_id,
                lexical_rank=lexical_ranks.get(hit.chunk_id),
                semantic_rank=semantic_ranks.get(hit.chunk_id),
                fused_score=hit.score,
                final_rank=final_ranks[hit.chunk_id],
            )
            for hit in ordered
        )
        return HybridSearchResult(
            hits=selected,
            trace=HybridSearchTrace(
                requested_mode=self._mode,
                effective_mode=effective_mode,
                execution_class=self.execution_class,
                lexical_identity_sha256=self._lexical.identity_sha256,
                lexical_candidate_count=len(lexical_hits),
                semantic_candidate_count=(
                    0 if semantic_result is None else len(semantic_result.hits)
                ),
                fused_candidate_count=len(ordered),
                fusion_policy_sha256=self._fusion_policy.sha256,
                semantic_identity_sha256=semantic_identity_sha256,
                embedding_identity_sha256=embedding_identity_sha256,
                semantic_trace_sha256=semantic_trace_sha256,
                reranker_identity_sha256=(
                    None if self._reranker is None else self._reranker.identity.sha256
                ),
                fallback_reason=fallback_reason,
                candidates=candidate_traces,
                selected_chunk_ids=tuple(hit.chunk_id for hit in selected),
            ),
        )

    def _fuse(
        self,
        lexical_hits: tuple[RetrievalHit, ...],
        semantic_hits: tuple[RetrievalHit, ...],
    ) -> tuple[RetrievalHit, ...]:
        candidates: dict[str, RetrievalHit] = {}
        for hit in (*lexical_hits, *semantic_hits):
            existing = candidates.get(hit.chunk_id)
            if existing is not None and not _same_candidate(existing, hit):
                raise CandidateIdentityConflict("retrieval components disagree on chunk identity")
            candidates[hit.chunk_id] = hit

        lexical_ranks = _ranks(lexical_hits)
        semantic_ranks = _ranks(semantic_hits)
        fused: list[RetrievalHit] = []
        for chunk_id, hit in candidates.items():
            score = 0.0
            lexical_rank = lexical_ranks.get(chunk_id)
            semantic_rank = semantic_ranks.get(chunk_id)
            if lexical_rank is not None:
                score += self._fusion_policy.lexical_weight / (
                    self._fusion_policy.reciprocal_rank_constant + lexical_rank
                )
            if semantic_rank is not None:
                score += self._fusion_policy.semantic_weight / (
                    self._fusion_policy.reciprocal_rank_constant + semantic_rank
                )
            fused.append(replace(hit, score=score))
        fused.sort(key=lambda item: (-item.score, item.chunk_id))
        return tuple(fused)

    def _apply_reranker(
        self,
        query: RetrievalQuery,
        candidates: tuple[RetrievalHit, ...],
    ) -> tuple[RetrievalHit, ...]:
        reranker = self._reranker
        if reranker is None:
            raise RuntimeError("reranker is not configured")
        ordered_ids = reranker.rerank(query, candidates)
        candidate_ids = tuple(hit.chunk_id for hit in candidates)
        if len(ordered_ids) != len(candidate_ids) or len(set(ordered_ids)) != len(ordered_ids):
            raise RerankerContractViolation("reranker must return one unique ID per candidate")
        if set(ordered_ids) != set(candidate_ids):
            raise RerankerContractViolation("reranker cannot add or remove candidates")
        by_id = {hit.chunk_id: hit for hit in candidates}
        return tuple(by_id[chunk_id] for chunk_id in ordered_ids)


@dataclass(frozen=True, slots=True)
class HybridRetrievalEvidence:
    request_id: str
    query_sha256: str
    tenant_id: str | None
    retrieved_at: datetime
    minimum_trust_score: float
    generation: int | None
    result_count: int
    total_chars: int
    chunk_ids: tuple[str, ...]
    source_ids: tuple[str, ...]
    effective_mode: EffectiveRetrievalMode
    execution_class: RetrievalExecutionClass
    engine_identity_sha256: str
    search_trace_sha256: str

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "chunk_ids": list(self.chunk_ids),
                "effective_mode": self.effective_mode.value,
                "execution_class": self.execution_class.value,
                "engine_identity_sha256": self.engine_identity_sha256,
                "generation": self.generation,
                "minimum_trust_score": self.minimum_trust_score,
                "query_sha256": self.query_sha256,
                "request_id": self.request_id,
                "result_count": self.result_count,
                "retrieved_at": self.retrieved_at.isoformat(),
                "search_trace_sha256": self.search_trace_sha256,
                "source_ids": list(self.source_ids),
                "tenant_id": self.tenant_id,
                "total_chars": self.total_chars,
            }
        )


@dataclass(frozen=True, slots=True)
class HybridRetrievalResponse:
    hits: tuple[RetrievalHit, ...]
    evidence: HybridRetrievalEvidence
    trace: HybridSearchTrace


class HybridRetrievalAuditSink(Protocol):
    def record(self, evidence: HybridRetrievalEvidence) -> None: ...


class NullHybridRetrievalAuditSink:
    def record(self, evidence: HybridRetrievalEvidence) -> None:
        del evidence


class HybridRetrievalService:
    def __init__(
        self,
        engine: HybridRetriever,
        *,
        budget: RetrievalBudget | None = None,
        audit_sink: HybridRetrievalAuditSink | None = None,
    ) -> None:
        self._engine = engine
        self._budget = budget or RetrievalBudget()
        self._audit_sink = audit_sink or NullHybridRetrievalAuditSink()

    def retrieve(
        self,
        *,
        request_id: str,
        text: str,
        tenant_id: str | None,
        now: datetime,
        minimum_trust_score: float = 0.5,
    ) -> HybridRetrievalResponse:
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
        search_result = self._engine.search(query)
        selected: list[RetrievalHit] = []
        total_chars = 0
        for hit in search_result.hits:
            projected = total_chars + len(hit.text)
            if projected > self._budget.max_total_chars:
                continue
            selected.append(hit)
            total_chars = projected
        hits = tuple(selected)
        generations = {hit.generation for hit in hits}
        evidence = HybridRetrievalEvidence(
            request_id=normalized_request_id,
            query_sha256=hashlib.sha256(text.strip().encode()).hexdigest(),
            tenant_id=None if tenant_id is None else tenant_id.strip(),
            retrieved_at=now,
            minimum_trust_score=minimum_trust_score,
            generation=(next(iter(generations)) if len(generations) == 1 else None),
            result_count=len(hits),
            total_chars=total_chars,
            chunk_ids=tuple(hit.chunk_id for hit in hits),
            source_ids=tuple(hit.source_id for hit in hits),
            effective_mode=search_result.trace.effective_mode,
            execution_class=search_result.trace.execution_class,
            engine_identity_sha256=self._engine.identity_sha256,
            search_trace_sha256=search_result.trace.sha256,
        )
        self._audit_sink.record(evidence)
        return HybridRetrievalResponse(hits=hits, evidence=evidence, trace=search_result.trace)


def _ranks(hits: Sequence[RetrievalHit]) -> dict[str, int]:
    ranks: dict[str, int] = {}
    for rank, hit in enumerate(hits, start=1):
        if hit.chunk_id in ranks:
            raise CandidateIdentityConflict("retrieval component returned duplicate chunk IDs")
        ranks[hit.chunk_id] = rank
    return ranks


def _same_candidate(left: RetrievalHit, right: RetrievalHit) -> bool:
    return (
        left.chunk_id == right.chunk_id
        and left.source_id == right.source_id
        and left.generation == right.generation
        and left.text == right.text
        and left.trust_score == right.trust_score
    )


def _portable(value: str, name: str) -> None:
    if _IDENTIFIER.fullmatch(value.strip()) is None:
        raise ValueError(f"{name} must use a bounded portable identifier")


def _sha256_json(value: Any) -> str:
    canonical = json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
