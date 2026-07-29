from __future__ import annotations

from collections.abc import Iterator, Mapping, Sequence
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest

from tai.knowledge_chunking import KnowledgeChunk
from tai.postgres_loader_state import ConnectionFactory
from tai.public_corpus_retrieval_sync import (
    RosstatSharedRetrievalService,
    RosstatSharedRetrievalSynchronizer,
    SharedRetrievalStatus,
    _SourceBoundRetrievalRepository,
)
from tai.retrieval_index import (
    InMemoryRetrievalIndexRepository,
    RetrievalDocument,
)
from tai.rosstat_vshp2016254 import DATA_URI, HISTORICAL_LABEL, SOURCE_ID

NOW = datetime(2026, 7, 29, 9, 0, tzinfo=UTC)


def _document(
    *,
    chunk_id: str,
    source_id: str = SOURCE_ID,
    tenant_id: str | None = None,
    valid_until: datetime | None = None,
    revoked: bool = False,
) -> RetrievalDocument:
    text = "\n".join(
        (
            HISTORICAL_LABEL,
            f"Официальный URI данных: {DATA_URI}",
            "XPath: /GenericData[1]/DataSet[1]/Series[1]/Obs[1]/@OBS_VALUE",
            "Значение: 123.45",
        )
    )
    return RetrievalDocument(
        chunk=KnowledgeChunk(
            chunk_id=chunk_id,
            source_id=source_id,
            document_checksum_sha256="a" * 64,
            ordinal=0,
            text=text,
            token_estimate=max(1, (len(text) + 3) // 4),
        ),
        tenant_id=tenant_id,
        trust_score=0.97,
        valid_until=valid_until or NOW + timedelta(days=365),
        revoked=revoked,
    )


def _retrieval_row(document: RetrievalDocument) -> dict[str, object]:
    chunk = document.chunk
    return {
        "chunk_id": chunk.chunk_id,
        "source_id": chunk.source_id,
        "document_checksum_sha256": chunk.document_checksum_sha256,
        "ordinal": chunk.ordinal,
        "tenant_id": document.tenant_id,
        "trust_score": document.trust_score,
        "valid_until": document.valid_until,
        "revoked": document.revoked,
        "chunk_text": chunk.text,
    }


def _public_row(document: RetrievalDocument) -> dict[str, object]:
    row = _retrieval_row(document)
    row["artifact_sha256"] = row.pop("document_checksum_sha256")
    row["token_estimate"] = document.chunk.token_estimate
    return row


@dataclass
class _State:
    public_documents: tuple[RetrievalDocument, ...] = ()
    next_generation: int = 1
    statuses: dict[int, str] = field(default_factory=dict)
    chunks: dict[int, list[RetrievalDocument]] = field(default_factory=dict)
    fail_generation_insert: bool = False
    fail_activation: bool = False
    explode_on_public_read: bool = False
    commits: int = 0
    rollbacks: int = 0


class _Cursor:
    def __init__(self, state: _State) -> None:
        self._state = state
        self._rows: list[Mapping[str, Any]] = []

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        traceback: object | None,
    ) -> bool:
        del exc_type, exc, traceback
        return False

    def execute(
        self,
        query: str,
        parameters: Sequence[Any] = (),
    ) -> None:
        normalized = " ".join(query.split()).casefold()
        self._rows = []

        if "pg_advisory_xact_lock" in normalized:
            return

        if (
            "from tai_retrieval_generations" in normalized
            and "where status = 'active'" in normalized
        ):
            self._rows = [
                {"generation": generation}
                for generation, status in sorted(self._state.statuses.items())
                if status == "ACTIVE"
            ]
            return

        if "from tai_active_public_corpus_chunks_v1" in normalized:
            if self._state.explode_on_public_read:
                raise RuntimeError("synthetic public-corpus read failure")
            self._rows = [
                _public_row(document) for document in self._state.public_documents
            ]
            return

        if (
            "from tai_retrieval_chunks c" in normalized
            and "join tai_retrieval_generations g" in normalized
        ):
            rows: list[Mapping[str, Any]] = []
            for generation, status in sorted(self._state.statuses.items()):
                if status != "ACTIVE":
                    continue
                for document in self._state.chunks.get(generation, []):
                    row = _retrieval_row(document)
                    row = {
                        **row,
                        "generation": generation,
                        "terms": document.chunk.text.casefold().split(),
                    }
                    rows.append(row)
            self._rows = rows
            return

        if (
            "from tai_retrieval_chunks" in normalized
            and "where generation = %s" in normalized
        ):
            generation = int(parameters[0])
            self._rows = [
                _retrieval_row(document)
                for document in self._state.chunks.get(generation, [])
            ]
            return

        if "insert into tai_retrieval_generations" in normalized:
            if self._state.fail_generation_insert:
                return
            generation = self._state.next_generation
            self._state.next_generation += 1
            self._state.statuses[generation] = "BUILDING"
            self._state.chunks[generation] = []
            self._rows = [{"generation": generation}]
            return

        if "insert into tai_retrieval_chunks" in normalized:
            (
                generation,
                chunk_id,
                source_id,
                checksum,
                ordinal,
                tenant_id,
                trust_score,
                valid_until,
                revoked,
                chunk_text,
            ) = parameters
            text = str(chunk_text)
            self._state.chunks[int(generation)].append(
                RetrievalDocument(
                    chunk=KnowledgeChunk(
                        chunk_id=str(chunk_id),
                        source_id=str(source_id),
                        document_checksum_sha256=str(checksum),
                        ordinal=int(ordinal),
                        text=text,
                        token_estimate=max(1, (len(text) + 3) // 4),
                    ),
                    tenant_id=None if tenant_id is None else str(tenant_id),
                    trust_score=float(trust_score),
                    valid_until=valid_until,
                    revoked=bool(revoked),
                )
            )
            return

        if "tai_activate_retrieval_generation" in normalized:
            generation = int(parameters[0])
            if not self._state.fail_activation:
                for current, status in tuple(self._state.statuses.items()):
                    if status == "ACTIVE":
                        self._state.statuses[current] = "RETIRED"
                self._state.statuses[generation] = "ACTIVE"
            self._rows = [{"tai_activate_retrieval_generation": None}]
            return

        raise AssertionError(f"unexpected SQL in fake authority: {normalized}")

    def fetchone(self) -> Mapping[str, Any] | None:
        if not self._rows:
            return None
        return self._rows.pop(0)


class _Connection:
    def __init__(self, state: _State) -> None:
        self._state = state

    def cursor(self) -> _Cursor:
        return _Cursor(self._state)

    def commit(self) -> None:
        self._state.commits += 1

    def rollback(self) -> None:
        self._state.rollbacks += 1



def _factory(state: _State) -> ConnectionFactory:
    @contextmanager
    def factory() -> Iterator[Any]:
        yield _Connection(state)

    return cast(ConnectionFactory, factory)


def test_database_sync_creates_replays_retrieves_and_withdraws() -> None:
    target = _document(chunk_id="1" * 64)
    state = _State(public_documents=(target,))
    factory = _factory(state)
    synchronizer = RosstatSharedRetrievalSynchronizer(factory)

    first = synchronizer.sync(now=NOW)
    assert first.created_generation is True
    assert first.generation == 1
    assert first.previous_generation is None
    assert first.source_document_count == 1
    assert state.statuses == {1: "ACTIVE"}

    replay = synchronizer.sync(now=NOW + timedelta(seconds=1))
    assert replay.created_generation is False
    assert replay.generation == 1
    assert replay.manifest_sha256 == first.manifest_sha256

    service = RosstatSharedRetrievalService(factory)
    supported = service.retrieve(
        locale="en",
        request_id="database-supported",
        text="What does the agricultural land structure dataset show?",
        now=NOW + timedelta(seconds=2),
    )
    assert supported.status is SharedRetrievalStatus.SUPPORTED
    assert supported.generation == 1
    assert set(supported.source_ids) == {SOURCE_ID}
    assert supported.citations

    state.public_documents = ()
    withdrawal = synchronizer.sync(now=NOW + timedelta(seconds=3))
    assert withdrawal.created_generation is True
    assert withdrawal.generation == 2
    assert withdrawal.previous_generation == 1
    assert withdrawal.document_count == 0
    assert state.statuses == {1: "RETIRED", 2: "ACTIVE"}

    abstained = service.retrieve(
        locale="en",
        request_id="database-withdrawn",
        text="What does the agricultural land structure dataset show?",
        now=NOW + timedelta(seconds=4),
    )
    assert abstained.status is SharedRetrievalStatus.ABSTAINED
    assert abstained.citations == ()
    assert state.commits >= 5
    assert state.rollbacks == 0


def test_database_sync_handles_empty_uninitialized_authority() -> None:
    state = _State()
    result = RosstatSharedRetrievalSynchronizer(_factory(state)).sync(now=NOW)

    assert result.created_generation is False
    assert result.generation is None
    assert result.document_count == 0
    assert state.statuses == {}
    assert state.commits == 1


def test_database_sync_preserves_non_target_documents() -> None:
    unrelated = _document(
        chunk_id="2" * 64,
        source_id="official.other.public-source",
    )
    target = _document(chunk_id="3" * 64)
    state = _State(
        public_documents=(target,),
        next_generation=2,
        statuses={1: "ACTIVE"},
        chunks={1: [unrelated]},
    )

    result = RosstatSharedRetrievalSynchronizer(_factory(state)).sync(now=NOW)

    assert result.created_generation is True
    assert result.previous_generation == 1
    assert result.generation == 2
    assert state.statuses == {1: "RETIRED", 2: "ACTIVE"}
    assert {item.chunk.source_id for item in state.chunks[2]} == {
        SOURCE_ID,
        "official.other.public-source",
    }


def test_database_sync_fails_closed_and_rolls_back() -> None:
    target = _document(chunk_id="4" * 64)
    insert_failure = _State(
        public_documents=(target,),
        fail_generation_insert=True,
    )
    with pytest.raises(RuntimeError, match="insert returned no row"):
        RosstatSharedRetrievalSynchronizer(_factory(insert_failure)).sync(now=NOW)
    assert insert_failure.rollbacks == 1

    activation_failure = _State(
        public_documents=(target,),
        fail_activation=True,
    )
    with pytest.raises(RuntimeError, match="did not become authoritative"):
        RosstatSharedRetrievalSynchronizer(_factory(activation_failure)).sync(now=NOW)
    assert activation_failure.rollbacks == 1

    read_failure = _State(explode_on_public_read=True)
    with pytest.raises(RuntimeError, match="synthetic public-corpus"):
        RosstatSharedRetrievalSynchronizer(_factory(read_failure)).sync(now=NOW)
    assert read_failure.rollbacks == 1


def test_database_sync_rejects_multiple_active_or_unexpected_public_sources() -> None:
    multiple = _State(
        next_generation=3,
        statuses={1: "ACTIVE", 2: "ACTIVE"},
        chunks={1: [], 2: []},
    )
    with pytest.raises(RuntimeError, match="multiple active"):
        RosstatSharedRetrievalSynchronizer(_factory(multiple)).sync(now=NOW)

    unexpected = _State(
        public_documents=(
            _document(
                chunk_id="5" * 64,
                source_id="official.unexpected.source",
            ),
        )
    )
    with pytest.raises(RuntimeError, match="unexpected active public-corpus"):
        RosstatSharedRetrievalSynchronizer(_factory(unexpected)).sync(now=NOW)


def test_source_bound_repository_passthrough_and_filtering() -> None:
    target = _document(chunk_id="6" * 64)
    unrelated = _document(
        chunk_id="7" * 64,
        source_id="official.other.public-source",
    )
    repository = InMemoryRetrievalIndexRepository()
    bounded = _SourceBoundRetrievalRepository(repository, SOURCE_ID)

    generation = bounded.begin_generation()
    bounded.add(generation, (target, unrelated))
    bounded.activate(generation)

    active = bounded.active_documents()
    assert tuple(item.document.chunk.source_id for item in active) == (SOURCE_ID,)
