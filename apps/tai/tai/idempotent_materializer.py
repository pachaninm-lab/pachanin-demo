from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Protocol

from tai.source_governance import SourceDocument


@dataclass(frozen=True, slots=True)
class MaterializationKey:
    source_id: str
    checksum_sha256: str

    @classmethod
    def from_document(cls, document: SourceDocument) -> MaterializationKey:
        return cls(document.source_id, document.checksum_sha256)


class MaterializationClaimRepository(Protocol):
    def claim(self, key: MaterializationKey) -> bool: ...

    def release(self, key: MaterializationKey) -> None: ...


class DocumentSink(Protocol):
    def store(self, document: SourceDocument) -> None: ...


class InMemoryMaterializationClaimRepository:
    def __init__(self) -> None:
        self._claimed: set[MaterializationKey] = set()
        self._lock = Lock()

    def claim(self, key: MaterializationKey) -> bool:
        with self._lock:
            if key in self._claimed:
                return False
            self._claimed.add(key)
            return True

    def release(self, key: MaterializationKey) -> None:
        with self._lock:
            self._claimed.discard(key)


class IdempotentLoaderMaterializer:
    def __init__(
        self,
        *,
        claims: MaterializationClaimRepository,
        sink: DocumentSink,
    ) -> None:
        self._claims = claims
        self._sink = sink

    def store(self, document: SourceDocument) -> None:
        key = MaterializationKey.from_document(document)
        if not self._claims.claim(key):
            return
        try:
            self._sink.store(document)
        except Exception:
            self._claims.release(key)
            raise
