from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Final

_WHITESPACE: Final[re.Pattern[str]] = re.compile(r"\s+")
_PARAGRAPH_BREAK: Final[re.Pattern[str]] = re.compile(r"\n\s*\n+")


@dataclass(frozen=True, slots=True)
class KnowledgeChunk:
    chunk_id: str
    source_id: str
    document_checksum_sha256: str
    ordinal: int
    text: str
    token_estimate: int


@dataclass(frozen=True, slots=True)
class ChunkingPolicy:
    max_chars: int = 1600
    overlap_chars: int = 160
    min_chars: int = 80

    def __post_init__(self) -> None:
        if self.max_chars < 256:
            raise ValueError("max_chars must be at least 256")
        if self.overlap_chars < 0:
            raise ValueError("overlap_chars must not be negative")
        if self.overlap_chars >= self.max_chars:
            raise ValueError("overlap_chars must be smaller than max_chars")
        if self.min_chars < 1 or self.min_chars > self.max_chars:
            raise ValueError("min_chars must be between 1 and max_chars")


class DeterministicKnowledgeChunker:
    """Split normalized knowledge into stable, reproducible retrieval units."""

    def __init__(self, policy: ChunkingPolicy | None = None) -> None:
        self._policy = policy or ChunkingPolicy()

    def chunk(
        self,
        *,
        source_id: str,
        document_checksum_sha256: str,
        text: str,
    ) -> tuple[KnowledgeChunk, ...]:
        normalized_source_id = source_id.strip()
        normalized_checksum = document_checksum_sha256.strip().lower()
        normalized_text = self._normalize_text(text)

        if not normalized_source_id:
            raise ValueError("source_id must not be blank")
        if len(normalized_checksum) != 64 or any(
            character not in "0123456789abcdef" for character in normalized_checksum
        ):
            raise ValueError("document_checksum_sha256 must be a lowercase SHA-256 hex digest")
        if not normalized_text:
            return ()

        segments = self._segments(normalized_text)
        chunks: list[KnowledgeChunk] = []
        buffer = ""

        for segment in segments:
            if not buffer:
                buffer = segment
                continue
            candidate = f"{buffer}\n\n{segment}"
            if len(candidate) <= self._policy.max_chars:
                buffer = candidate
                continue
            chunks.extend(
                self._emit_with_hard_limit(
                    source_id=normalized_source_id,
                    checksum=normalized_checksum,
                    text=buffer,
                    start_ordinal=len(chunks),
                )
            )
            overlap = self._tail(buffer)
            buffer = f"{overlap}\n\n{segment}" if overlap else segment

        if buffer:
            chunks.extend(
                self._emit_with_hard_limit(
                    source_id=normalized_source_id,
                    checksum=normalized_checksum,
                    text=buffer,
                    start_ordinal=len(chunks),
                )
            )

        return tuple(chunks)

    def _emit_with_hard_limit(
        self,
        *,
        source_id: str,
        checksum: str,
        text: str,
        start_ordinal: int,
    ) -> list[KnowledgeChunk]:
        emitted: list[KnowledgeChunk] = []
        cursor = 0
        ordinal = start_ordinal
        while cursor < len(text):
            end = min(len(text), cursor + self._policy.max_chars)
            candidate = text[cursor:end].strip()
            if candidate and (
                len(candidate) >= self._policy.min_chars or end == len(text)
            ):
                emitted.append(
                    self._build_chunk(
                        source_id=source_id,
                        checksum=checksum,
                        ordinal=ordinal,
                        text=candidate,
                    )
                )
                ordinal += 1
            if end == len(text):
                break
            cursor = max(cursor + 1, end - self._policy.overlap_chars)
        return emitted

    @staticmethod
    def _normalize_text(text: str) -> str:
        paragraphs = []
        for paragraph in _PARAGRAPH_BREAK.split(text.replace("\r\n", "\n")):
            normalized = _WHITESPACE.sub(" ", paragraph).strip()
            if normalized:
                paragraphs.append(normalized)
        return "\n\n".join(paragraphs)

    @staticmethod
    def _segments(text: str) -> tuple[str, ...]:
        return tuple(segment for segment in text.split("\n\n") if segment)

    def _tail(self, text: str) -> str:
        if self._policy.overlap_chars == 0:
            return ""
        return text[-self._policy.overlap_chars :].strip()

    @staticmethod
    def _build_chunk(
        *,
        source_id: str,
        checksum: str,
        ordinal: int,
        text: str,
    ) -> KnowledgeChunk:
        digest = hashlib.sha256(
            f"{source_id}\n{checksum}\n{ordinal}\n{text}".encode()
        ).hexdigest()
        return KnowledgeChunk(
            chunk_id=digest,
            source_id=source_id,
            document_checksum_sha256=checksum,
            ordinal=ordinal,
            text=text,
            token_estimate=max(1, (len(text) + 3) // 4),
        )
