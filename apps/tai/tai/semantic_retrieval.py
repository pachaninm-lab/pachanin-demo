from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol

from tai.retrieval_index import (
    RetrievalHit,
    RetrievalIndexRepository,
    RetrievalQuery,
    active_eligible_documents,
)

_IDENTIFIER = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class RetrievalComponentStatus(StrEnum):
    TEST_ONLY = "TEST_ONLY"
    PENDING = "PENDING"
    ADMITTED = "ADMITTED"


@dataclass(frozen=True, slots=True)
class EmbeddingIdentity:
    provider_id: str
    model_id: str
    revision: str
    dimensions: int
    status: RetrievalComponentStatus

    def __post_init__(self) -> None:
        _portable(self.provider_id, "provider_id")
        _portable(self.model_id, "model_id")
        _portable(self.revision, "revision")
        if self.dimensions < 1 or self.dimensions > 32_768:
            raise ValueError("embedding dimensions must be between 1 and 32768")

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "dimensions": self.dimensions,
                "model_id": self.model_id,
                "provider_id": self.provider_id,
                "revision": self.revision,
                "status": self.status.value,
            }
        )


@dataclass(frozen=True, slots=True)
class EmbeddingVector:
    identity: EmbeddingIdentity
    values: tuple[float, ...]

    def __post_init__(self) -> None:
        if len(self.values) != self.identity.dimensions:
            raise ValueError("embedding vector dimension does not match identity")
        if any(not math.isfinite(value) for value in self.values):
            raise ValueError("embedding vector values must be finite")
        if math.fsum(value * value for value in self.values) <= 0.0:
            raise ValueError("embedding vector norm must be positive")

    @property
    def normalized_values(self) -> tuple[float, ...]:
        norm = math.sqrt(math.fsum(value * value for value in self.values))
        return tuple(value / norm for value in self.values)

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "identity_sha256": self.identity.sha256,
                "values": list(self.values),
            }
        )


class EmbeddingProvider(Protocol):
    @property
    def identity(self) -> EmbeddingIdentity: ...

    def embed(self, text: str) -> EmbeddingVector: ...


class SemanticVectorRepository(Protocol):
    @property
    def identity(self) -> EmbeddingIdentity: ...

    @property
    def authority_status(self) -> RetrievalComponentStatus: ...

    @property
    def authority_sha256(self) -> str: ...

    def vectors_for_generation(self, generation: int) -> Mapping[str, EmbeddingVector]: ...


class InMemorySemanticVectorRepository:
    """Deterministic local/test vector store. It is not a production ANN authority."""

    def __init__(self, identity: EmbeddingIdentity) -> None:
        self._identity = identity
        self._generations: dict[int, dict[str, EmbeddingVector]] = {}

    @property
    def identity(self) -> EmbeddingIdentity:
        return self._identity

    @property
    def authority_status(self) -> RetrievalComponentStatus:
        return RetrievalComponentStatus.TEST_ONLY

    @property
    def authority_sha256(self) -> str:
        return _sha256_json(
            {
                "embedding_identity_sha256": self._identity.sha256,
                "repository_kind": "IN_MEMORY_EXACT_MAP",
                "status": self.authority_status.value,
            }
        )

    def add_generation(
        self,
        generation: int,
        vectors: Mapping[str, EmbeddingVector],
    ) -> None:
        if generation < 1:
            raise ValueError("generation must be positive")
        normalized: dict[str, EmbeddingVector] = {}
        for chunk_id, vector in vectors.items():
            _portable(chunk_id, "chunk_id")
            if vector.identity != self._identity:
                raise ValueError("semantic vector identity does not match repository")
            normalized[chunk_id] = vector
        self._generations[generation] = normalized

    def vectors_for_generation(self, generation: int) -> Mapping[str, EmbeddingVector]:
        return dict(self._generations.get(generation, {}))


@dataclass(frozen=True, slots=True)
class SemanticRetrievalPolicy:
    require_admitted_model: bool = True
    require_admitted_index: bool = True
    require_complete_generation: bool = True
    minimum_similarity: float = 0.0

    def __post_init__(self) -> None:
        if not 0.0 <= self.minimum_similarity <= 1.0:
            raise ValueError("minimum_similarity must be between 0 and 1")

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "minimum_similarity": self.minimum_similarity,
                "require_admitted_index": self.require_admitted_index,
                "require_admitted_model": self.require_admitted_model,
                "require_complete_generation": self.require_complete_generation,
            }
        )


@dataclass(frozen=True, slots=True)
class SemanticSearchTrace:
    generation: int | None
    embedding_identity_sha256: str
    vector_authority_sha256: str
    query_vector_sha256: str | None
    eligible_count: int
    indexed_count: int
    scored_count: int
    missing_chunk_ids: tuple[str, ...]
    policy_sha256: str

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "eligible_count": self.eligible_count,
                "embedding_identity_sha256": self.embedding_identity_sha256,
                "generation": self.generation,
                "vector_authority_sha256": self.vector_authority_sha256,
                "indexed_count": self.indexed_count,
                "missing_chunk_ids": list(self.missing_chunk_ids),
                "policy_sha256": self.policy_sha256,
                "query_vector_sha256": self.query_vector_sha256,
                "scored_count": self.scored_count,
            }
        )


@dataclass(frozen=True, slots=True)
class SemanticSearchResult:
    hits: tuple[RetrievalHit, ...]
    trace: SemanticSearchTrace


class SemanticRetrievalError(RuntimeError):
    pass


class SemanticAuthorityUnavailable(SemanticRetrievalError):
    pass


class SemanticIndexIncomplete(SemanticRetrievalError):
    pass


class SemanticRetriever:
    """Cosine semantic retrieval after tenant, trust, revocation and freshness filters."""

    def __init__(
        self,
        *,
        retrieval_repository: RetrievalIndexRepository,
        vector_repository: SemanticVectorRepository,
        provider: EmbeddingProvider,
        policy: SemanticRetrievalPolicy | None = None,
    ) -> None:
        if vector_repository.identity != provider.identity:
            raise ValueError("semantic provider and vector repository identities differ")
        self._retrieval_repository = retrieval_repository
        self._vector_repository = vector_repository
        self._provider = provider
        self._policy = policy or SemanticRetrievalPolicy()

    @property
    def identity(self) -> EmbeddingIdentity:
        return self._provider.identity

    @property
    def identity_sha256(self) -> str:
        return _sha256_json(
            {
                "embedding_identity_sha256": self.identity.sha256,
                "policy_sha256": self._policy.sha256,
                "vector_authority_sha256": self._vector_repository.authority_sha256,
            }
        )

    @property
    def components_admitted(self) -> bool:
        return (
            self.identity.status is RetrievalComponentStatus.ADMITTED
            and self._vector_repository.authority_status
            is RetrievalComponentStatus.ADMITTED
        )

    @property
    def policy(self) -> SemanticRetrievalPolicy:
        return self._policy

    def search(self, query: RetrievalQuery) -> SemanticSearchResult:
        identity = self.identity
        if (
            self._policy.require_admitted_model
            and identity.status is not RetrievalComponentStatus.ADMITTED
        ):
            raise SemanticAuthorityUnavailable("semantic model is not admitted")
        if (
            self._policy.require_admitted_index
            and self._vector_repository.authority_status
            is not RetrievalComponentStatus.ADMITTED
        ):
            raise SemanticAuthorityUnavailable("semantic vector authority is not admitted")

        eligible = active_eligible_documents(self._retrieval_repository, query)
        if not eligible:
            return SemanticSearchResult(
                hits=(),
                trace=SemanticSearchTrace(
                    generation=None,
                    embedding_identity_sha256=identity.sha256,
                    vector_authority_sha256=self._vector_repository.authority_sha256,
                    query_vector_sha256=None,
                    eligible_count=0,
                    indexed_count=0,
                    scored_count=0,
                    missing_chunk_ids=(),
                    policy_sha256=self._policy.sha256,
                ),
            )

        generation = eligible[0].generation
        vectors = self._vector_repository.vectors_for_generation(generation)
        missing = tuple(
            sorted(
                item.document.chunk.chunk_id
                for item in eligible
                if item.document.chunk.chunk_id not in vectors
            )
        )
        if missing and self._policy.require_complete_generation:
            raise SemanticIndexIncomplete("semantic generation is incomplete")

        try:
            query_vector = self._provider.embed(query.text)
        except SemanticRetrievalError:
            raise
        except Exception as error:
            raise SemanticAuthorityUnavailable("semantic provider failed") from error
        if query_vector.identity != identity:
            raise SemanticAuthorityUnavailable("semantic provider returned a different identity")

        query_values = query_vector.normalized_values
        hits: list[RetrievalHit] = []
        indexed_count = 0
        for item in eligible:
            chunk = item.document.chunk
            vector = vectors.get(chunk.chunk_id)
            if vector is None:
                continue
            indexed_count += 1
            if vector.identity != identity:
                raise SemanticAuthorityUnavailable("semantic index contains a different identity")
            cosine = math.fsum(
                left * right
                for left, right in zip(query_values, vector.normalized_values, strict=True)
            )
            cosine = min(1.0, max(-1.0, cosine))
            if cosine < self._policy.minimum_similarity:
                continue
            normalized_similarity = (cosine + 1.0) / 2.0
            score = normalized_similarity * (0.5 + 0.5 * item.document.trust_score)
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
        selected = tuple(hits[: query.limit])
        return SemanticSearchResult(
            hits=selected,
            trace=SemanticSearchTrace(
                generation=generation,
                embedding_identity_sha256=identity.sha256,
                vector_authority_sha256=self._vector_repository.authority_sha256,
                query_vector_sha256=query_vector.sha256,
                eligible_count=len(eligible),
                indexed_count=indexed_count,
                scored_count=len(hits),
                missing_chunk_ids=missing,
                policy_sha256=self._policy.sha256,
            ),
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


def validate_sha256(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")
