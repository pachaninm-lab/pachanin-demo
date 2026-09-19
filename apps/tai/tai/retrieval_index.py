from __future__ import annotations

import hashlib
import math
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Protocol

from tai.knowledge_chunking import KnowledgeChunk

_TOKEN = re.compile(r"[0-9A-Za-zА-Яа-яЁё]+", re.UNICODE)
_LEXICAL_IDENTITY_SHA256 = hashlib.sha256(
    b"tai.lexical.bm25.v1|k1=1.2|b=0.75|numerator=2.2|trust=0.5+0.5x"
).hexdigest()


class IndexGenerationStatus(StrEnum):
    BUILDING = "BUILDING"
    ACTIVE = "ACTIVE"
    RETIRED = "RETIRED"
    FAILED = "FAILED"


@dataclass(frozen=True, slots=True)
class RetrievalDocument:
    chunk: KnowledgeChunk
    tenant_id: str | None
    trust_score: float
    valid_until: datetime | None
    revoked: bool = False

    def __post_init__(self) -> None:
        if self.tenant_id is not None and not self.tenant_id.strip():
            raise ValueError("tenant_id must be null or non-blank")
        if not 0.0 <= self.trust_score <= 1.0:
            raise ValueError("trust_score must be between 0 and 1")


@dataclass(frozen=True, slots=True)
class IndexedChunk:
    generation: int
    document: RetrievalDocument
    term_frequencies: tuple[tuple[str, int], ...]
    document_length: int


@dataclass(frozen=True, slots=True)
class RetrievalQuery:
    text: str
    tenant_id: str | None
    now: datetime
    minimum_trust_score: float = 0.5
    limit: int = 10

    def __post_init__(self) -> None:
        if not self.text.strip():
            raise ValueError("query text must not be blank")
        if self.tenant_id is not None and not self.tenant_id.strip():
            raise ValueError("tenant_id must be null or non-blank")
        if not 0.0 <= self.minimum_trust_score <= 1.0:
            raise ValueError("minimum_trust_score must be between 0 and 1")
        if self.limit < 1 or self.limit > 100:
            raise ValueError("limit must be between 1 and 100")


@dataclass(frozen=True, slots=True)
class RetrievalHit:
    chunk_id: str
    source_id: str
    generation: int
    score: float
    text: str
    trust_score: float


class RetrievalIndexRepository(Protocol):
    def begin_generation(self) -> int: ...

    def add(self, generation: int, documents: tuple[RetrievalDocument, ...]) -> None: ...

    def activate(self, generation: int) -> None: ...

    def active_documents(self) -> tuple[IndexedChunk, ...]: ...


class InMemoryRetrievalIndexRepository:
    """Deterministic test/local authority. Production must use PostgreSQL."""

    def __init__(self) -> None:
        self._next_generation = 1
        self._statuses: dict[int, IndexGenerationStatus] = {}
        self._documents: dict[int, dict[str, IndexedChunk]] = {}

    def begin_generation(self) -> int:
        generation = self._next_generation
        self._next_generation += 1
        self._statuses[generation] = IndexGenerationStatus.BUILDING
        self._documents[generation] = {}
        return generation

    def add(self, generation: int, documents: tuple[RetrievalDocument, ...]) -> None:
        if self._statuses.get(generation) is not IndexGenerationStatus.BUILDING:
            raise RuntimeError("documents can only be added to a building generation")
        target = self._documents[generation]
        for document in documents:
            terms = Counter(_tokens(document.chunk.text))
            target[document.chunk.chunk_id] = IndexedChunk(
                generation=generation,
                document=document,
                term_frequencies=tuple(sorted(terms.items())),
                document_length=sum(terms.values()),
            )

    def activate(self, generation: int) -> None:
        if self._statuses.get(generation) is not IndexGenerationStatus.BUILDING:
            raise RuntimeError("only a building generation can be activated")
        for current, status in tuple(self._statuses.items()):
            if status is IndexGenerationStatus.ACTIVE:
                self._statuses[current] = IndexGenerationStatus.RETIRED
        self._statuses[generation] = IndexGenerationStatus.ACTIVE

    def active_documents(self) -> tuple[IndexedChunk, ...]:
        active = [
            generation
            for generation, status in self._statuses.items()
            if status is IndexGenerationStatus.ACTIVE
        ]
        if len(active) != 1:
            return ()
        return tuple(self._documents[active[0]].values())


class LexicalRetriever:
    """BM25-style deterministic retrieval with pre-ranking authority filters."""

    def __init__(self, repository: RetrievalIndexRepository) -> None:
        self._repository = repository

    @property
    def identity_sha256(self) -> str:
        return _LEXICAL_IDENTITY_SHA256

    def search(self, query: RetrievalQuery) -> tuple[RetrievalHit, ...]:
        query_terms = _tokens(query.text)
        if not query_terms:
            return ()
        eligible = active_eligible_documents(self._repository, query)
        if not eligible:
            return ()

        average_length = max(
            1.0,
            sum(item.document_length for item in eligible) / len(eligible),
        )
        document_frequency = Counter(
            term
            for item in eligible
            for term, _ in item.term_frequencies
            if term in query_terms
        )
        hits: list[RetrievalHit] = []
        for item in eligible:
            frequencies = dict(item.term_frequencies)
            score = 0.0
            for term in query_terms:
                frequency = frequencies.get(term, 0)
                if frequency == 0:
                    continue
                containing = document_frequency[term]
                inverse_frequency = math.log(
                    1.0 + (len(eligible) - containing + 0.5) / (containing + 0.5)
                )
                denominator = frequency + 1.2 * (
                    0.25 + 0.75 * item.document_length / average_length
                )
                score += inverse_frequency * frequency * 2.2 / denominator
            score *= 0.5 + 0.5 * item.document.trust_score
            if score > 0:
                chunk = item.document.chunk
                hits.append(
                    RetrievalHit(
                        chunk_id=chunk.chunk_id,
                        source_id=chunk.source_id,
                        generation=item.generation,
                        score=score,
                        text=chunk.text,
                        trust_score=item.document.trust_score,
                    )
                )
        hits.sort(key=lambda hit: (-hit.score, hit.chunk_id))
        return tuple(hits[: query.limit])


def active_eligible_documents(
    repository: RetrievalIndexRepository,
    query: RetrievalQuery,
) -> tuple[IndexedChunk, ...]:
    """Return one active generation after applying authority filters before scoring."""

    active = repository.active_documents()
    generations = {item.generation for item in active}
    if len(generations) > 1:
        raise RuntimeError("active retrieval documents span multiple generations")
    return tuple(item for item in active if is_document_eligible(item.document, query))


def is_document_eligible(document: RetrievalDocument, query: RetrievalQuery) -> bool:
    if document.revoked or document.trust_score < query.minimum_trust_score:
        return False
    if document.valid_until is not None and document.valid_until <= query.now:
        return False
    if document.tenant_id is None:
        return True
    return query.tenant_id is not None and document.tenant_id == query.tenant_id


def _tokens(text: str) -> tuple[str, ...]:
    return tuple(match.group(0).casefold() for match in _TOKEN.finditer(text))
