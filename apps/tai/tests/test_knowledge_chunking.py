from __future__ import annotations

import pytest

from tai.knowledge_chunking import ChunkingPolicy, DeterministicKnowledgeChunker

CHECKSUM = "a" * 64


def test_chunking_is_deterministic_and_normalizes_whitespace() -> None:
    chunker = DeterministicKnowledgeChunker(ChunkingPolicy(max_chars=256, overlap_chars=32))
    text = "  Урожай   пшеницы.\r\n\r\n  Цена зависит от качества.  "

    first = chunker.chunk(source_id="rosstat", document_checksum_sha256=CHECKSUM, text=text)
    second = chunker.chunk(source_id="rosstat", document_checksum_sha256=CHECKSUM, text=text)

    assert first == second
    assert len(first) == 1
    assert first[0].text == "Урожай пшеницы.\n\nЦена зависит от качества."
    assert first[0].chunk_id
    assert first[0].token_estimate > 0


def test_chunk_ids_change_when_authoritative_document_changes() -> None:
    chunker = DeterministicKnowledgeChunker()

    first = chunker.chunk(
        source_id="minselhoz",
        document_checksum_sha256="a" * 64,
        text="Официальный документ о зерновом рынке.",
    )
    second = chunker.chunk(
        source_id="minselhoz",
        document_checksum_sha256="b" * 64,
        text="Официальный документ о зерновом рынке.",
    )

    assert first[0].chunk_id != second[0].chunk_id


def test_long_text_is_bounded_and_has_stable_ordinals() -> None:
    chunker = DeterministicKnowledgeChunker(
        ChunkingPolicy(max_chars=256, overlap_chars=40, min_chars=20)
    )
    text = "\n\n".join(f"Раздел {index}: " + ("данные " * 30) for index in range(5))

    chunks = chunker.chunk(
        source_id="federal-source",
        document_checksum_sha256=CHECKSUM,
        text=text,
    )

    assert len(chunks) > 1
    assert [chunk.ordinal for chunk in chunks] == list(range(len(chunks)))
    assert all(len(chunk.text) <= 256 for chunk in chunks)
    assert all(chunk.source_id == "federal-source" for chunk in chunks)


def test_blank_document_produces_no_chunks() -> None:
    chunker = DeterministicKnowledgeChunker()

    assert (
        chunker.chunk(
            source_id="source",
            document_checksum_sha256=CHECKSUM,
            text=" \n\n ",
        )
        == ()
    )


@pytest.mark.parametrize(
    ("policy", "message"),
    [
        (ChunkingPolicy(max_chars=256, overlap_chars=0, min_chars=1), None),
    ],
)
def test_valid_policy(policy: ChunkingPolicy, message: str | None) -> None:
    assert policy.max_chars == 256
    assert message is None


@pytest.mark.parametrize(
    "kwargs",
    [
        {"max_chars": 255},
        {"overlap_chars": -1},
        {"max_chars": 256, "overlap_chars": 256},
        {"max_chars": 256, "min_chars": 257},
    ],
)
def test_invalid_policy_is_rejected(kwargs: dict[str, int]) -> None:
    with pytest.raises(ValueError):
        ChunkingPolicy(**kwargs)


def test_invalid_authority_identity_is_rejected() -> None:
    chunker = DeterministicKnowledgeChunker()

    with pytest.raises(ValueError, match="source_id"):
        chunker.chunk(source_id=" ", document_checksum_sha256=CHECKSUM, text="data")
    with pytest.raises(ValueError, match="SHA-256"):
        chunker.chunk(source_id="source", document_checksum_sha256="bad", text="data")
