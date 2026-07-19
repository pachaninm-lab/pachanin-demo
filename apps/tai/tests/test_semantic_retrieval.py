from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from tai.knowledge_chunking import KnowledgeChunk
from tai.retrieval_index import (
    InMemoryRetrievalIndexRepository,
    RetrievalDocument,
    RetrievalQuery,
)
from tai.semantic_retrieval import (
    EmbeddingIdentity,
    EmbeddingVector,
    InMemorySemanticVectorRepository,
    RetrievalComponentStatus,
    SemanticAuthorityUnavailable,
    SemanticIndexIncomplete,
    SemanticRetrievalPolicy,
    SemanticRetriever,
)

NOW = datetime(2026, 7, 19, tzinfo=UTC)
STRUCTURAL_POLICY = SemanticRetrievalPolicy(require_admitted_index=False)


def _identity(status: RetrievalComponentStatus = RetrievalComponentStatus.ADMITTED):
    return EmbeddingIdentity(
        provider_id="local-embedding",
        model_id="embedding-model",
        revision="rev-1",
        dimensions=2,
        status=status,
    )


def _vector(identity: EmbeddingIdentity, left: float, right: float) -> EmbeddingVector:
    return EmbeddingVector(identity=identity, values=(left, right))


def _document(
    chunk_id: str,
    text: str,
    *,
    source_id: str,
    tenant_id: str | None = None,
    trust_score: float = 1.0,
    valid_until: datetime | None = None,
    revoked: bool = False,
) -> RetrievalDocument:
    return RetrievalDocument(
        chunk=KnowledgeChunk(
            chunk_id=chunk_id,
            source_id=source_id,
            document_checksum_sha256="a" * 64,
            ordinal=0,
            text=text,
            token_estimate=1,
        ),
        tenant_id=tenant_id,
        trust_score=trust_score,
        valid_until=valid_until,
        revoked=revoked,
    )


class _Provider:
    def __init__(
        self,
        identity: EmbeddingIdentity,
        vectors: dict[str, EmbeddingVector],
    ) -> None:
        self._identity = identity
        self._vectors = vectors

    @property
    def identity(self) -> EmbeddingIdentity:
        return self._identity

    def embed(self, text: str) -> EmbeddingVector:
        return self._vectors[text]


class _FailingProvider(_Provider):
    def embed(self, text: str) -> EmbeddingVector:
        del text
        raise RuntimeError("private provider failure")


def _repository(*documents: RetrievalDocument):
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(generation, tuple(documents))
    repository.activate(generation)
    return repository, generation


def test_semantic_filters_authority_before_scoring() -> None:
    identity = _identity()
    public = _document("public", "public grain", source_id="public")
    other_tenant = _document(
        "private-other",
        "private exact match",
        source_id="private",
        tenant_id="tenant-b",
    )
    expired = _document(
        "expired",
        "expired exact match",
        source_id="expired",
        valid_until=NOW - timedelta(seconds=1),
    )
    revoked = _document(
        "revoked",
        "revoked exact match",
        source_id="revoked",
        revoked=True,
    )
    repository, generation = _repository(public, other_tenant, expired, revoked)
    vectors = InMemorySemanticVectorRepository(identity)
    vectors.add_generation(
        generation,
        {
            "public": _vector(identity, 0.8, 0.2),
            "private-other": _vector(identity, 1.0, 0.0),
            "expired": _vector(identity, 1.0, 0.0),
            "revoked": _vector(identity, 1.0, 0.0),
        },
    )
    provider = _Provider(identity, {"grain query": _vector(identity, 1.0, 0.0)})
    result = SemanticRetriever(
        retrieval_repository=repository,
        vector_repository=vectors,
        provider=provider,
        policy=STRUCTURAL_POLICY,
    ).search(
        RetrievalQuery(
            text="grain query",
            tenant_id="tenant-a",
            now=NOW,
            limit=10,
        )
    )

    assert [hit.chunk_id for hit in result.hits] == ["public"]
    assert result.trace.eligible_count == 1
    assert result.trace.indexed_count == 1
    assert result.trace.missing_chunk_ids == ()


def test_semantic_requires_complete_generation() -> None:
    identity = _identity()
    repository, generation = _repository(
        _document("a", "a", source_id="a"),
        _document("b", "b", source_id="b"),
    )
    vectors = InMemorySemanticVectorRepository(identity)
    vectors.add_generation(generation, {"a": _vector(identity, 1.0, 0.0)})
    provider = _Provider(identity, {"query": _vector(identity, 1.0, 0.0)})

    with pytest.raises(SemanticIndexIncomplete, match="incomplete"):
        SemanticRetriever(
            retrieval_repository=repository,
            vector_repository=vectors,
            provider=provider,
            policy=STRUCTURAL_POLICY,
        ).search(RetrievalQuery(text="query", tenant_id=None, now=NOW))


def test_test_only_embedding_is_rejected_by_admission_policy() -> None:
    identity = _identity(RetrievalComponentStatus.TEST_ONLY)
    repository, generation = _repository(_document("a", "a", source_id="a"))
    vectors = InMemorySemanticVectorRepository(identity)
    vectors.add_generation(generation, {"a": _vector(identity, 1.0, 0.0)})
    provider = _Provider(identity, {"query": _vector(identity, 1.0, 0.0)})

    with pytest.raises(SemanticAuthorityUnavailable, match="not admitted"):
        SemanticRetriever(
            retrieval_repository=repository,
            vector_repository=vectors,
            provider=provider,
        ).search(RetrievalQuery(text="query", tenant_id=None, now=NOW))

    structural = SemanticRetriever(
        retrieval_repository=repository,
        vector_repository=vectors,
        provider=provider,
        policy=SemanticRetrievalPolicy(
            require_admitted_model=False,
            require_admitted_index=False,
        ),
    ).search(RetrievalQuery(text="query", tenant_id=None, now=NOW))
    assert structural.hits[0].chunk_id == "a"


def test_in_memory_vector_authority_never_counts_as_admitted() -> None:
    identity = _identity()
    repository, generation = _repository(_document("a", "a", source_id="a"))
    vectors = InMemorySemanticVectorRepository(identity)
    vectors.add_generation(generation, {"a": _vector(identity, 1.0, 0.0)})
    provider = _Provider(identity, {"query": _vector(identity, 1.0, 0.0)})
    retriever = SemanticRetriever(
        retrieval_repository=repository,
        vector_repository=vectors,
        provider=provider,
    )

    assert retriever.components_admitted is False
    with pytest.raises(SemanticAuthorityUnavailable, match="vector authority"):
        retriever.search(RetrievalQuery(text="query", tenant_id=None, now=NOW))

    structural = SemanticRetriever(
        retrieval_repository=repository,
        vector_repository=vectors,
        provider=provider,
        policy=STRUCTURAL_POLICY,
    ).search(RetrievalQuery(text="query", tenant_id=None, now=NOW))
    assert structural.trace.vector_authority_sha256 == vectors.authority_sha256


def test_provider_failure_is_bounded() -> None:
    identity = _identity()
    repository, generation = _repository(_document("a", "a", source_id="a"))
    vectors = InMemorySemanticVectorRepository(identity)
    vectors.add_generation(generation, {"a": _vector(identity, 1.0, 0.0)})

    with pytest.raises(SemanticAuthorityUnavailable, match="provider failed"):
        SemanticRetriever(
            retrieval_repository=repository,
            vector_repository=vectors,
            provider=_FailingProvider(identity, {}),
            policy=STRUCTURAL_POLICY,
        ).search(RetrievalQuery(text="query", tenant_id=None, now=NOW))


def test_embedding_vector_validation_fails_closed() -> None:
    identity = _identity()
    with pytest.raises(ValueError, match="dimension"):
        EmbeddingVector(identity=identity, values=(1.0,))
    with pytest.raises(ValueError, match="finite"):
        EmbeddingVector(identity=identity, values=(float("nan"), 1.0))
    with pytest.raises(ValueError, match="norm"):
        EmbeddingVector(identity=identity, values=(0.0, 0.0))
