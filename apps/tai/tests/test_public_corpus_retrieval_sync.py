from __future__ import annotations

import hashlib
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from tai.knowledge_chunking import KnowledgeChunk
from tai.public_corpus_retrieval_sync import (
    RosstatSharedRetrievalService,
    SharedRetrievalStatus,
    _compose_desired_documents,
    _validate_target_documents,
    canonical_manifest_sha256,
)
from tai.retrieval_index import (
    InMemoryRetrievalIndexRepository,
    RetrievalDocument,
)
from tai.rosstat_vshp2016254 import DATA_URI, HISTORICAL_LABEL, SOURCE_ID

NOW = datetime(2026, 7, 29, 9, 0, tzinfo=UTC)
ARTIFACT_SHA256 = hashlib.sha256(b"accepted-rosstat-artifact").hexdigest()


def _document(
    *,
    chunk_id: str,
    source_id: str = SOURCE_ID,
    tenant_id: str | None = None,
    revoked: bool = False,
    valid_until: datetime | None = None,
    trust_score: float = 0.97,
    text: str | None = None,
) -> RetrievalDocument:
    body = text or "\n".join(
        (
            HISTORICAL_LABEL,
            f"Официальный URI данных: {DATA_URI}",
            "Период данных: 2016-01-01 — 2016-12-31",
            "XPath: /GenericData[1]/DataSet[1]/Series[1]/Obs[1]/@OBS_VALUE",
            "Значение: 123.45",
        )
    )
    return RetrievalDocument(
        chunk=KnowledgeChunk(
            chunk_id=chunk_id,
            source_id=source_id,
            document_checksum_sha256=ARTIFACT_SHA256,
            ordinal=0,
            text=body,
            token_estimate=max(1, (len(body) + 3) // 4),
        ),
        tenant_id=tenant_id,
        trust_score=trust_score,
        valid_until=valid_until or NOW + timedelta(days=365),
        revoked=revoked,
    )


def _repository(
    *documents: RetrievalDocument,
) -> InMemoryRetrievalIndexRepository:
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(generation, tuple(documents))
    repository.activate(generation)
    return repository


def test_localized_queries_return_identical_exact_evidence() -> None:
    target = _document(chunk_id="1" * 64)
    unrelated = _document(
        chunk_id="2" * 64,
        source_id="official.other.public-source",
    )
    service = RosstatSharedRetrievalService(
        repository=_repository(target, unrelated),
    )

    responses = (
        service.retrieve(
            locale="ru",
            request_id="req-ru",
            text="Что показывает структура сельскохозяйственных угодий?",
            now=NOW,
        ),
        service.retrieve(
            locale="en",
            request_id="req-en",
            text="What does the agricultural land structure dataset show?",
            now=NOW,
        ),
        service.retrieve(
            locale="zh",
            request_id="req-zh",
            text="农业用地结构数据集显示什么？",
            now=NOW,
        ),
    )

    assert all(
        item.status is SharedRetrievalStatus.SUPPORTED for item in responses
    )
    assert {item.chunk_ids for item in responses} == {(target.chunk.chunk_id,)}
    assert {item.source_ids for item in responses} == {(SOURCE_ID,)}
    assert all(item.model_invoked is False for item in responses)
    assert all(item.citations for item in responses)
    assert all(
        citation.source_id == SOURCE_ID
        and citation.source_uri == DATA_URI
        and citation.chunk_id == target.chunk.chunk_id
        and "2016" in citation.historical_limitation
        for item in responses
        for citation in item.citations
    )


def test_irrelevant_and_empty_generation_queries_abstain() -> None:
    target = _document(chunk_id="3" * 64)
    populated = RosstatSharedRetrievalService(repository=_repository(target))
    irrelevant = populated.retrieve(
        locale="ru",
        request_id="req-irrelevant",
        text="Какая сейчас цена подсолнечника?",
        now=NOW,
    )
    assert irrelevant.status is SharedRetrievalStatus.ABSTAINED
    assert irrelevant.chunk_ids == ()
    assert irrelevant.citations == ()
    assert irrelevant.model_invoked is False

    empty = RosstatSharedRetrievalService(
        repository=InMemoryRetrievalIndexRepository(),
    )
    withdrawn = empty.retrieve(
        locale="en",
        request_id="req-withdrawn",
        text="What does the agricultural land structure dataset show?",
        now=NOW,
    )
    assert withdrawn.status is SharedRetrievalStatus.ABSTAINED
    assert withdrawn.generation is None
    assert withdrawn.chunk_ids == ()
    assert withdrawn.citations == ()


def test_unsupported_locale_and_blank_identity_fail_closed() -> None:
    service = RosstatSharedRetrievalService(
        repository=_repository(_document(chunk_id="4" * 64)),
    )
    with pytest.raises(ValueError, match="unsupported locale"):
        service.retrieve(
            locale="fr",
            request_id="req-fr",
            text="agricultural land",
            now=NOW,
        )
    with pytest.raises(ValueError, match="request_id"):
        service.retrieve(
            locale="en",
            request_id=" ",
            text="agricultural land",
            now=NOW,
        )
    with pytest.raises(ValueError, match="text"):
        service.retrieve(
            locale="en",
            request_id="req-empty",
            text=" ",
            now=NOW,
        )


def test_manifest_is_order_independent_and_content_bound() -> None:
    first = _document(chunk_id="5" * 64)
    second = _document(chunk_id="6" * 64)

    direct = canonical_manifest_sha256((first, second))
    reverse = canonical_manifest_sha256((second, first))
    assert direct == reverse

    changed = replace(
        second,
        chunk=replace(second.chunk, text=f"{second.chunk.text}\nДополнение"),
    )
    assert canonical_manifest_sha256((first, changed)) != direct


def test_compose_preserves_non_target_and_replaces_target() -> None:
    preserved = _document(
        chunk_id="7" * 64,
        source_id="official.other.public-source",
    )
    stale = _document(chunk_id="8" * 64)
    fresh = _document(chunk_id="9" * 64)

    desired = _compose_desired_documents(
        current_documents=(stale, preserved),
        source_documents=(fresh,),
    )

    assert tuple(item.chunk.chunk_id for item in desired) == (
        preserved.chunk.chunk_id,
        fresh.chunk.chunk_id,
    )
    assert stale.chunk.chunk_id not in {
        item.chunk.chunk_id for item in desired
    }


def test_compose_rejects_chunk_identity_collision() -> None:
    collision_id = "a" * 64
    preserved = _document(
        chunk_id=collision_id,
        source_id="official.other.public-source",
    )
    fresh = _document(chunk_id=collision_id)

    with pytest.raises(RuntimeError, match="identity collision"):
        _compose_desired_documents(
            current_documents=(preserved,),
            source_documents=(fresh,),
        )


@pytest.mark.parametrize(
    ("document", "message"),
    [
        (
            _document(
                chunk_id="b" * 64,
                source_id="official.unexpected.source",
            ),
            "unexpected source",
        ),
        (
            _document(chunk_id="c" * 64, tenant_id="tenant-cross-plane"),
            "tenant binding",
        ),
        (
            _document(chunk_id="d" * 64, revoked=True),
            "revoked",
        ),
        (
            _document(chunk_id="e" * 64, valid_until=NOW),
            "expired",
        ),
        (
            _document(chunk_id="f" * 64, trust_score=0.49),
            "trust score",
        ),
        (
            _document(chunk_id="0" * 64, text="XPath: /incomplete[1]"),
            "citation context",
        ),
    ],
)
def test_target_validation_rejects_contamination(
    document: RetrievalDocument,
    message: str,
) -> None:
    with pytest.raises(RuntimeError, match=message):
        _validate_target_documents((document,), now=NOW)


def test_target_validation_accepts_exact_governed_document() -> None:
    _validate_target_documents(
        (_document(chunk_id="1a" * 32),),
        now=NOW,
    )
