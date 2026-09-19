from __future__ import annotations

from datetime import UTC, datetime

import pytest

from tai.hybrid_retrieval import (
    EffectiveRetrievalMode,
    FusionPolicy,
    HybridRequiredUnavailable,
    HybridRetrievalMode,
    HybridRetrievalService,
    HybridRetriever,
    RerankerContractViolation,
    RerankerIdentity,
    RetrievalExecutionClass,
)
from tai.retrieval_index import RetrievalHit, RetrievalQuery
from tai.retrieval_service import RetrievalBudget
from tai.semantic_retrieval import (
    EmbeddingIdentity,
    RetrievalComponentStatus,
    SemanticAuthorityUnavailable,
    SemanticSearchResult,
    SemanticSearchTrace,
)

NOW = datetime(2026, 7, 19, tzinfo=UTC)


def _hit(chunk_id: str, score: float, *, source_id: str | None = None) -> RetrievalHit:
    return RetrievalHit(
        chunk_id=chunk_id,
        source_id=source_id or f"source-{chunk_id}",
        generation=1,
        score=score,
        text=f"text {chunk_id}",
        trust_score=1.0,
    )


class _Lexical:
    def __init__(self, hits: tuple[RetrievalHit, ...]) -> None:
        self._hits = hits

    @property
    def identity_sha256(self) -> str:
        return "d" * 64

    def search(self, query: RetrievalQuery) -> tuple[RetrievalHit, ...]:
        return self._hits[: query.limit]


class _Semantic:
    def __init__(
        self,
        hits: tuple[RetrievalHit, ...],
        *,
        status: RetrievalComponentStatus = RetrievalComponentStatus.ADMITTED,
        fail: bool = False,
    ) -> None:
        self._hits = hits
        self._fail = fail
        self._identity = EmbeddingIdentity(
            provider_id="local",
            model_id="embed",
            revision="r1",
            dimensions=2,
            status=status,
        )

    @property
    def identity(self) -> EmbeddingIdentity:
        return self._identity

    @property
    def identity_sha256(self) -> str:
        return "e" * 64 if self.components_admitted else "f" * 64

    @property
    def components_admitted(self) -> bool:
        return self._identity.status is RetrievalComponentStatus.ADMITTED

    def search(self, query: RetrievalQuery) -> SemanticSearchResult:
        if self._fail:
            raise SemanticAuthorityUnavailable("unavailable")
        hits = self._hits[: query.limit]
        return SemanticSearchResult(
            hits=hits,
            trace=SemanticSearchTrace(
                generation=1,
                embedding_identity_sha256=self.identity.sha256,
                vector_authority_sha256="c" * 64,
                query_vector_sha256="a" * 64,
                eligible_count=len(hits),
                indexed_count=len(hits),
                scored_count=len(hits),
                missing_chunk_ids=(),
                policy_sha256="b" * 64,
            ),
        )


class _Reranker:
    def __init__(self, order: tuple[str, ...]) -> None:
        self._order = order
        self._identity = RerankerIdentity(
            reranker_id="reranker",
            revision="r1",
            status=RetrievalComponentStatus.ADMITTED,
        )

    @property
    def identity(self) -> RerankerIdentity:
        return self._identity

    def rerank(
        self,
        query: RetrievalQuery,
        candidates: tuple[RetrievalHit, ...],
    ) -> tuple[str, ...]:
        del query, candidates
        return self._order


def _query(limit: int = 10) -> RetrievalQuery:
    return RetrievalQuery(text="query", tenant_id=None, now=NOW, limit=limit)


def test_rrf_is_stable_and_preserves_candidate_identity() -> None:
    engine = HybridRetriever(
        lexical=_Lexical((_hit("a", 9.0), _hit("b", 8.0))),
        semantic=_Semantic((_hit("b", 0.9), _hit("c", 0.8))),
        mode=HybridRetrievalMode.HYBRID_REQUIRED,
        fusion_policy=FusionPolicy(reciprocal_rank_constant=10),
    )

    first = engine.search(_query())
    second = engine.search(_query())

    assert [hit.chunk_id for hit in first.hits] == ["b", "a", "c"]
    assert first == second
    assert first.trace.effective_mode is EffectiveRetrievalMode.HYBRID
    assert first.trace.lexical_candidate_count == 2
    assert first.trace.semantic_candidate_count == 2
    assert len(first.trace.sha256) == 64


def test_optional_mode_records_lexical_fallback() -> None:
    engine = HybridRetriever(
        lexical=_Lexical((_hit("a", 1.0),)),
        semantic=_Semantic((), fail=True),
        mode=HybridRetrievalMode.HYBRID_OPTIONAL,
    )
    result = engine.search(_query())

    assert [hit.chunk_id for hit in result.hits] == ["a"]
    assert result.trace.effective_mode is EffectiveRetrievalMode.LEXICAL
    assert result.trace.fallback_reason == "SEMANTIC_UNAVAILABLE"


def test_required_mode_rejects_missing_or_failed_semantic_authority() -> None:
    with pytest.raises(HybridRequiredUnavailable, match="not configured"):
        HybridRetriever(
            lexical=_Lexical((_hit("a", 1.0),)),
            semantic=None,
            mode=HybridRetrievalMode.HYBRID_REQUIRED,
        ).search(_query())

    with pytest.raises(HybridRequiredUnavailable, match="unavailable"):
        HybridRetriever(
            lexical=_Lexical((_hit("a", 1.0),)),
            semantic=_Semantic((), fail=True),
            mode=HybridRetrievalMode.HYBRID_REQUIRED,
        ).search(_query())


def test_structural_semantic_component_cannot_be_measured() -> None:
    engine = HybridRetriever(
        lexical=_Lexical((_hit("a", 1.0),)),
        semantic=_Semantic(
            (_hit("b", 1.0),),
            status=RetrievalComponentStatus.TEST_ONLY,
        ),
        mode=HybridRetrievalMode.HYBRID_REQUIRED,
        fusion_policy=FusionPolicy(require_admitted_components=False),
    )

    result = engine.search(_query())

    assert engine.components_admitted is False
    assert result.trace.execution_class is RetrievalExecutionClass.STRUCTURAL_ONLY


def test_reranker_cannot_inject_or_remove_candidates() -> None:
    engine = HybridRetriever(
        lexical=_Lexical((_hit("a", 1.0),)),
        semantic=_Semantic((_hit("b", 1.0),)),
        mode=HybridRetrievalMode.HYBRID_REQUIRED,
        reranker=_Reranker(("a", "injected")),
    )

    with pytest.raises(RerankerContractViolation, match="add or remove"):
        engine.search(_query())


def test_hybrid_service_emits_digest_bound_evidence_and_budget() -> None:
    engine = HybridRetriever(
        lexical=_Lexical((_hit("a", 1.0), _hit("b", 0.9))),
        semantic=_Semantic((_hit("b", 1.0), _hit("a", 0.9))),
        mode=HybridRetrievalMode.HYBRID_REQUIRED,
    )
    response = HybridRetrievalService(
        engine,
        budget=RetrievalBudget(max_results=2, max_total_chars=256),
    ).retrieve(
        request_id="request-1",
        text="query",
        tenant_id=None,
        now=NOW,
    )

    assert response.evidence.effective_mode is EffectiveRetrievalMode.HYBRID
    assert response.evidence.chunk_ids == tuple(hit.chunk_id for hit in response.hits)
    assert response.evidence.search_trace_sha256 == response.trace.sha256
    assert len(response.evidence.sha256) == 64
    assert response.evidence.total_chars <= 256
