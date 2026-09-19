from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from tai.idempotent_materializer import (
    IdempotentLoaderMaterializer,
    InMemoryMaterializationClaimRepository,
    MaterializationKey,
)
from tai.source_governance import KnowledgeDomain, SourceDocument

NOW = datetime(2026, 7, 18, 16, tzinfo=UTC)


@dataclass
class RecordingSink:
    documents: list[SourceDocument] = field(default_factory=list)
    failures_remaining: int = 0

    def store(self, document: SourceDocument) -> None:
        if self.failures_remaining > 0:
            self.failures_remaining -= 1
            raise TimeoutError("temporary sink failure")
        self.documents.append(document)


def make_document(body: str = "Урожай обновлён") -> SourceDocument:
    return SourceDocument.build(
        source_id="official.minselhoz",
        source_uri="https://mcx.gov.ru/report",
        title="Рынок зерна",
        body=body,
        published_at=NOW,
        effective_at=NOW,
        fetched_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
    )


def test_materialization_key_is_stable_for_same_source_and_body() -> None:
    first = MaterializationKey.from_document(make_document())
    second = MaterializationKey.from_document(make_document())

    assert first == second


def test_duplicate_materialization_is_suppressed() -> None:
    sink = RecordingSink()
    materializer = IdempotentLoaderMaterializer(
        claims=InMemoryMaterializationClaimRepository(),
        sink=sink,
    )
    document = make_document()

    materializer.store(document)
    materializer.store(document)

    assert sink.documents == [document]


def test_different_content_versions_are_materialized() -> None:
    sink = RecordingSink()
    materializer = IdempotentLoaderMaterializer(
        claims=InMemoryMaterializationClaimRepository(),
        sink=sink,
    )

    materializer.store(make_document("Версия 1"))
    materializer.store(make_document("Версия 2"))

    assert [document.body for document in sink.documents] == ["Версия 1", "Версия 2"]


def test_failed_sink_releases_claim_for_retry() -> None:
    sink = RecordingSink(failures_remaining=1)
    materializer = IdempotentLoaderMaterializer(
        claims=InMemoryMaterializationClaimRepository(),
        sink=sink,
    )
    document = make_document()

    try:
        materializer.store(document)
    except TimeoutError:
        pass
    else:
        raise AssertionError("sink failure must be propagated")

    materializer.store(document)

    assert sink.documents == [document]
