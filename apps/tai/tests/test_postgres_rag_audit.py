from __future__ import annotations

from collections.abc import Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime
from typing import Any

import pytest

from tai.model_runtime import ModelAttemptStatus, ModelInvocationAttempt
from tai.postgres_rag_audit import PostgreSQLGroundedAnswerAuditSink, _trace_sha256
from tai.rag_pipeline import GroundedAnswerStatus, GroundedAnswerTrace

NOW = datetime(2026, 7, 18, 11, 0, tzinfo=UTC)


class FakeCursor(AbstractContextManager["FakeCursor"]):
    def __init__(self, row: dict[str, Any] | None, *, fail: bool = False) -> None:
        self.row = row
        self.fail = fail
        self.query = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        if self.fail:
            raise RuntimeError("database failure")
        self.query = query
        self.parameters = tuple(parameters)

    def fetchone(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection(AbstractContextManager["FakeConnection"]):
    def __init__(self, row: dict[str, Any] | None, *, fail: bool = False) -> None:
        self.cursor_instance = FakeCursor(row, fail=fail)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class FakeFactory:
    def __init__(self, row: dict[str, Any] | None, *, fail: bool = False) -> None:
        self.connection = FakeConnection(row, fail=fail)

    def __call__(self) -> FakeConnection:
        return self.connection


def _trace() -> GroundedAnswerTrace:
    return GroundedAnswerTrace(
        request_id="request-1",
        tenant_id="tenant-a",
        status=GroundedAnswerStatus.ANSWERED,
        model_id="local-model-v1",
        model_revision="r7",
        model_route_id="d" * 64,
        model_attempts=(
            ModelInvocationAttempt(
                model_id="local-model-v1",
                revision="r7",
                status=ModelAttemptStatus.SUCCEEDED,
                reason=None,
            ),
        ),
        model_invoked=True,
        generation=7,
        query_sha256="a" * 64,
        context_sha256="b" * 64,
        answer_sha256="c" * 64,
        chunk_ids=("chunk-1", "chunk-2"),
        source_ids=("source-1", "source-2"),
        citations=("S1",),
        reason=None,
        completed_at=NOW,
    )


def test_trace_insert_is_immutable_idempotent_and_complete() -> None:
    trace = _trace()
    digest = _trace_sha256(trace)
    factory = FakeFactory({"request_id": trace.request_id, "trace_sha256": digest})

    PostgreSQLGroundedAnswerAuditSink(factory).record(trace)

    cursor = factory.connection.cursor_instance
    assert "ON CONFLICT (request_id) DO UPDATE" in cursor.query
    assert "tai_rag_traces.trace_sha256 = EXCLUDED.trace_sha256" in cursor.query
    assert cursor.parameters[0] == "request-1"
    assert cursor.parameters[1] == "tenant-a"
    assert cursor.parameters[4] == "r7"
    assert cursor.parameters[5] == "d" * 64
    assert cursor.parameters[6] == [
        {
            "model_id": "local-model-v1",
            "reason": None,
            "revision": "r7",
            "status": "SUCCEEDED",
        }
    ]
    assert cursor.parameters[8] == 7
    assert cursor.parameters[12] == ["chunk-1", "chunk-2"]
    assert cursor.parameters[13] == ["source-1", "source-2"]
    assert cursor.parameters[14] == ["S1"]
    assert cursor.parameters[17] == digest
    assert factory.connection.committed is True
    assert factory.connection.rolled_back is False


def test_conflicting_request_id_fails_closed() -> None:
    factory = FakeFactory(None)

    with pytest.raises(RuntimeError, match="already bound"):
        PostgreSQLGroundedAnswerAuditSink(factory).record(_trace())


def test_database_error_rolls_back() -> None:
    factory = FakeFactory(None, fail=True)

    with pytest.raises(RuntimeError, match="database failure"):
        PostgreSQLGroundedAnswerAuditSink(factory).record(_trace())

    assert factory.connection.committed is False
    assert factory.connection.rolled_back is True
