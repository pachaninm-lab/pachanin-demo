from datetime import UTC, datetime, timedelta

import pytest

from tai.knowledge_chunking import DeterministicKnowledgeChunker
from tai.retrieval_index import (
    InMemoryRetrievalIndexRepository,
    LexicalRetriever,
    RetrievalDocument,
    RetrievalQuery,
)

NOW = datetime(2026, 7, 18, tzinfo=UTC)


def _document(
    text: str,
    *,
    source_id: str = "source-1",
    tenant_id: str | None = None,
    trust_score: float = 0.9,
    valid_until: datetime | None = None,
    revoked: bool = False,
) -> RetrievalDocument:
    chunk = DeterministicKnowledgeChunker().chunk(
        source_id=source_id,
        document_checksum_sha256="a" * 64,
        text=text,
    )[0]
    return RetrievalDocument(
        chunk=chunk,
        tenant_id=tenant_id,
        trust_score=trust_score,
        valid_until=valid_until,
        revoked=revoked,
    )


def _query(text: str, *, tenant_id: str | None = None) -> RetrievalQuery:
    return RetrievalQuery(text=text, tenant_id=tenant_id, now=NOW)


def test_building_generation_is_not_searchable() -> None:
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(generation, (_document("Пшеница урожай качество"),))

    assert LexicalRetriever(repository).search(_query("пшеница")) == ()


def test_activation_atomically_replaces_previous_generation() -> None:
    repository = InMemoryRetrievalIndexRepository()
    first = repository.begin_generation()
    repository.add(first, (_document("старые данные пшеница"),))
    repository.activate(first)
    second = repository.begin_generation()
    repository.add(second, (_document("новые данные кукуруза", source_id="source-2"),))
    repository.activate(second)

    retriever = LexicalRetriever(repository)
    assert retriever.search(_query("пшеница")) == ()
    hits = retriever.search(_query("кукуруза"))
    assert len(hits) == 1
    assert hits[0].generation == second


def test_tenant_document_is_only_visible_to_same_tenant() -> None:
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(
        generation,
        (
            _document("общая рыночная цена", source_id="public"),
            _document("частный контракт цена", source_id="private", tenant_id="tenant-a"),
        ),
    )
    repository.activate(generation)
    retriever = LexicalRetriever(repository)

    anonymous = retriever.search(_query("цена"))
    tenant_a = retriever.search(_query("цена", tenant_id="tenant-a"))
    tenant_b = retriever.search(_query("цена", tenant_id="tenant-b"))

    assert {hit.source_id for hit in anonymous} == {"public"}
    assert {hit.source_id for hit in tenant_a} == {"public", "private"}
    assert {hit.source_id for hit in tenant_b} == {"public"}


def test_revoked_expired_and_low_trust_documents_are_filtered_before_ranking() -> None:
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(
        generation,
        (
            _document("зерно разрешённый источник", source_id="allowed"),
            _document("зерно отозванный источник", source_id="revoked", revoked=True),
            _document(
                "зерно просроченный источник",
                source_id="expired",
                valid_until=NOW - timedelta(seconds=1),
            ),
            _document("зерно слабый источник", source_id="weak", trust_score=0.49),
        ),
    )
    repository.activate(generation)

    hits = LexicalRetriever(repository).search(_query("зерно"))
    assert [hit.source_id for hit in hits] == ["allowed"]


def test_trust_score_affects_ranking_but_not_authority_identity() -> None:
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(
        generation,
        (
            _document("пшеница цена", source_id="trusted", trust_score=1.0),
            _document("пшеница цена", source_id="less-trusted", trust_score=0.6),
        ),
    )
    repository.activate(generation)

    hits = LexicalRetriever(repository).search(_query("пшеница цена"))
    assert [hit.source_id for hit in hits] == ["trusted", "less-trusted"]


def test_invalid_queries_and_documents_fail_closed() -> None:
    with pytest.raises(ValueError):
        RetrievalQuery(text=" ", tenant_id=None, now=NOW)
    with pytest.raises(ValueError):
        RetrievalQuery(text="зерно", tenant_id=None, now=NOW, limit=0)
    with pytest.raises(ValueError):
        _document("зерно", trust_score=1.1)


def test_non_token_query_returns_no_results() -> None:
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(generation, (_document("зерно"),))
    repository.activate(generation)

    assert LexicalRetriever(repository).search(_query("---")) == ()
