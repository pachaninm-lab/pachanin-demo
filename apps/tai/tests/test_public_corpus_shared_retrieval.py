from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import pytest

from tai.knowledge_chunking import KnowledgeChunk
from tai.public_corpus_shared_retrieval import (
    GovernedPublicCorpusRetrievalSynchronizer,
    RosstatSharedRetrievalService,
    SharedRetrievalLocale,
    SharedRetrievalStatus,
)
from tai.retrieval_index import (
    InMemoryRetrievalIndexRepository,
    LexicalRetriever,
    RetrievalDocument,
)
from tai.retrieval_service import RetrievalService
from tai.rosstat_vshp2016254 import DATA_URI, HISTORICAL_LABEL, SOURCE_ID

NOW = datetime(2026, 7, 29, 9, 0, tzinfo=UTC)


@dataclass
class MutablePublicCorpus:
    documents: tuple[RetrievalDocument, ...]

    def active_documents(self, *, now: datetime) -> tuple[RetrievalDocument, ...]:
        del now
        return self.documents


def _document(
    *,
    source_id: str,
    chunk_id: str,
    text: str,
    tenant_id: str | None = None,
    valid_until: datetime | None = None,
    revoked: bool = False,
) -> RetrievalDocument:
    return RetrievalDocument(
        chunk=KnowledgeChunk(
            chunk_id=chunk_id,
            source_id=source_id,
            document_checksum_sha256=("a" if source_id == SOURCE_ID else "b") * 64,
            ordinal=0,
            text=text,
            token_estimate=max(1, (len(text) + 3) // 4),
        ),
        tenant_id=tenant_id,
        trust_score=0.97,
        valid_until=valid_until,
        revoked=revoked,
    )


def _rosstat_document(**overrides: object) -> RetrievalDocument:
    values: dict[str, object] = {
        "source_id": SOURCE_ID,
        "chunk_id": "rosstat-chunk-1",
        "text": (
            f"{HISTORICAL_LABEL}\nИсточник: {DATA_URI}\n"
            "XPath: /GenericData[1]/DataSet[1]/Series[1]\n"
            "Площадь сельскохозяйственных угодий по данным переписи 2016 года."
        ),
        "valid_until": NOW + timedelta(days=30),
    }
    values.update(overrides)
    return _document(**values)  # type: ignore[arg-type]


def _baseline_document() -> RetrievalDocument:
    return _document(
        source_id="official.platform.manual",
        chunk_id="platform-chunk-1",
        text="Платформа объясняет сельскохозяйственные угодья и сделки.",
        valid_until=NOW + timedelta(days=30),
    )


def test_sync_preserves_other_sources_and_exact_replay_is_noop() -> None:
    repository = InMemoryRetrievalIndexRepository()
    baseline_generation = repository.begin_generation()
    repository.add(baseline_generation, (_baseline_document(),))
    repository.activate(baseline_generation)
    corpus = MutablePublicCorpus((_rosstat_document(),))
    synchronizer = GovernedPublicCorpusRetrievalSynchronizer(
        public_corpus=corpus,
        retrieval_index=repository,
    )

    first = synchronizer.synchronize(now=NOW)
    second = synchronizer.synchronize(now=NOW + timedelta(seconds=1))

    assert first.changed is True
    assert first.previous_generation == baseline_generation
    assert first.target_document_count == 1
    assert first.total_document_count == 2
    assert second.changed is False
    assert second.active_generation == first.active_generation
    assert {item.document.chunk.source_id for item in repository.active_documents()} == {
        "official.platform.manual",
        SOURCE_ID,
    }


def test_ru_en_zh_source_filter_returns_same_exact_citation() -> None:
    repository = InMemoryRetrievalIndexRepository()
    corpus = MutablePublicCorpus((_rosstat_document(),))
    sync = GovernedPublicCorpusRetrievalSynchronizer(
        public_corpus=corpus,
        retrieval_index=repository,
    )
    sync.synchronize(now=NOW)
    service = RosstatSharedRetrievalService(
        RetrievalService(LexicalRetriever(repository))
    )

    responses = tuple(
        service.retrieve(
            request_id=f"req-{locale.value}",
            text="площадь сельскохозяйственных угодий",
            locale=locale,
            now=NOW,
        )
        for locale in SharedRetrievalLocale
    )

    assert all(item.status is SharedRetrievalStatus.SUPPORTED for item in responses)
    assert all(item.model_invoked is False for item in responses)
    assert {item.retrieval.hits[0].chunk_id for item in responses} == {
        "rosstat-chunk-1"
    }
    assert {item.citations[0].source_uri for item in responses} == {DATA_URI}
    assert len({item.citations[0].historical_limitation for item in responses}) == 3


def test_source_filter_excludes_matching_unrelated_document() -> None:
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(generation, (_baseline_document(), _rosstat_document()))
    repository.activate(generation)
    service = RosstatSharedRetrievalService(
        RetrievalService(LexicalRetriever(repository))
    )

    response = service.retrieve(
        request_id="req-filter",
        text="платформа сделки сельскохозяйственные угодья",
        locale="ru",
        now=NOW,
    )

    assert response.status is SharedRetrievalStatus.SUPPORTED
    assert {hit.source_id for hit in response.retrieval.hits} == {SOURCE_ID}


def test_irrelevant_query_abstains_in_all_locales() -> None:
    repository = InMemoryRetrievalIndexRepository()
    corpus = MutablePublicCorpus((_rosstat_document(),))
    GovernedPublicCorpusRetrievalSynchronizer(
        public_corpus=corpus,
        retrieval_index=repository,
    ).synchronize(now=NOW)
    service = RosstatSharedRetrievalService(
        RetrievalService(LexicalRetriever(repository))
    )

    responses = tuple(
        service.retrieve(
            request_id=f"req-none-{locale.value}",
            text="квантовая оптика",
            locale=locale,
            now=NOW,
        )
        for locale in SharedRetrievalLocale
    )

    assert all(item.status is SharedRetrievalStatus.ABSTAINED for item in responses)
    assert all(not item.citations for item in responses)
    assert all(item.model_invoked is False for item in responses)


def test_withdrawal_sync_activates_generation_without_stale_target() -> None:
    repository = InMemoryRetrievalIndexRepository()
    corpus = MutablePublicCorpus((_rosstat_document(),))
    synchronizer = GovernedPublicCorpusRetrievalSynchronizer(
        public_corpus=corpus,
        retrieval_index=repository,
    )
    initial = synchronizer.synchronize(now=NOW)
    corpus.documents = ()

    withdrawn = synchronizer.synchronize(now=NOW + timedelta(seconds=1))
    replay = synchronizer.synchronize(now=NOW + timedelta(seconds=2))

    assert withdrawn.changed is True
    assert withdrawn.previous_generation == initial.active_generation
    assert withdrawn.active_generation != initial.active_generation
    assert withdrawn.target_document_count == 0
    assert repository.active_documents() == ()
    assert replay.changed is False
    assert replay.active_generation == withdrawn.active_generation


def test_contamination_expiry_and_missing_citation_fail_closed() -> None:
    invalid = (
        _rosstat_document(tenant_id="tenant-a"),
        _rosstat_document(revoked=True),
        _rosstat_document(valid_until=NOW),
        _rosstat_document(text="No governed citation context"),
        _document(
            source_id="official.other.source",
            chunk_id="other-chunk",
            text="Unexpected source",
            valid_until=NOW + timedelta(days=1),
        ),
    )
    expected = (
        "tenant boundary",
        "revoked",
        "expired or unbounded",
        "mandatory provenance context",
        "unexpected source",
    )
    for document, message in zip(invalid, expected, strict=True):
        with pytest.raises(RuntimeError, match=message):
            GovernedPublicCorpusRetrievalSynchronizer(
                public_corpus=MutablePublicCorpus((document,)),
                retrieval_index=InMemoryRetrievalIndexRepository(),
            ).synchronize(now=NOW)


def test_unsupported_locale_fails_closed() -> None:
    service = RosstatSharedRetrievalService(
        RetrievalService(LexicalRetriever(InMemoryRetrievalIndexRepository()))
    )
    with pytest.raises(ValueError, match="locale must be one of"):
        service.retrieve(
            request_id="req-locale",
            text="угодья",
            locale="de",
            now=NOW,
        )
