from __future__ import annotations

from datetime import UTC, datetime

import pytest

from tai.knowledge_chunking import KnowledgeChunk
from tai.retrieval_index import (
    InMemoryRetrievalIndexRepository,
    LexicalRetriever,
    RetrievalDocument,
)
from tai.retrieval_service import RetrievalBudget, RetrievalEvidence, RetrievalService


def _document(chunk_id: str, text: str, *, source_id: str = "source") -> RetrievalDocument:
    return RetrievalDocument(
        chunk=KnowledgeChunk(
            chunk_id=chunk_id,
            source_id=source_id,
            document_checksum_sha256="a" * 64,
            ordinal=0,
            text=text,
            token_estimate=1,
        ),
        tenant_id=None,
        trust_score=1.0,
        valid_until=None,
    )


class _AuditSink:
    def __init__(self) -> None:
        self.records: list[RetrievalEvidence] = []

    def record(self, evidence: RetrievalEvidence) -> None:
        self.records.append(evidence)


def _service(*documents: RetrievalDocument, budget: RetrievalBudget | None = None):
    repository = InMemoryRetrievalIndexRepository()
    generation = repository.begin_generation()
    repository.add(generation, tuple(documents))
    repository.activate(generation)
    sink = _AuditSink()
    service = RetrievalService(
        LexicalRetriever(repository),
        audit_sink=sink,
        budget=budget,
    )
    return service, sink, generation


def test_retrieval_emits_generation_and_provenance_evidence() -> None:
    service, sink, generation = _service(
        _document("chunk-a", "пшеница экспорт качество", source_id="authority-a")
    )
    now = datetime(2026, 7, 18, tzinfo=UTC)

    response = service.retrieve(
        request_id="request-1",
        text="пшеница качество",
        tenant_id=None,
        now=now,
    )

    assert response.evidence.generation == generation
    assert response.evidence.chunk_ids == ("chunk-a",)
    assert response.evidence.source_ids == ("authority-a",)
    assert response.evidence.result_count == 1
    assert response.evidence.total_chars == len(response.hits[0].text)
    assert sink.records == [response.evidence]


def test_retrieval_applies_total_character_budget_without_partial_chunks() -> None:
    service, _, _ = _service(
        _document("chunk-a", "зерно " * 50),
        _document("chunk-b", "зерно коротко"),
        budget=RetrievalBudget(max_results=10, max_total_chars=256),
    )

    response = service.retrieve(
        request_id="request-2",
        text="зерно",
        tenant_id=None,
        now=datetime(2026, 7, 18, tzinfo=UTC),
    )

    assert all(len(hit.text) <= 256 for hit in response.hits)
    assert response.evidence.total_chars <= 256
    assert "chunk-a" not in response.evidence.chunk_ids


def test_empty_result_is_still_audited_without_generation_claim() -> None:
    service, sink, _ = _service(_document("chunk-a", "кукуруза"))

    response = service.retrieve(
        request_id="request-3",
        text="подсолнечник",
        tenant_id=None,
        now=datetime(2026, 7, 18, tzinfo=UTC),
    )

    assert response.hits == ()
    assert response.evidence.generation is None
    assert response.evidence.result_count == 0
    assert sink.records == [response.evidence]


def test_request_id_is_fail_closed() -> None:
    service, sink, _ = _service(_document("chunk-a", "пшеница"))

    with pytest.raises(ValueError, match="request_id"):
        service.retrieve(
            request_id=" ",
            text="пшеница",
            tenant_id=None,
            now=datetime(2026, 7, 18, tzinfo=UTC),
        )

    assert sink.records == []


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"max_results": 0}, "max_results"),
        ({"max_results": 101}, "max_results"),
        ({"max_total_chars": 255}, "max_total_chars"),
        ({"max_total_chars": 100_001}, "max_total_chars"),
    ],
)
def test_budget_validation(kwargs: dict[str, int], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        RetrievalBudget(**kwargs)
