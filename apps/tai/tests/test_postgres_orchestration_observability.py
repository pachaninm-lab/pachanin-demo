from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import pytest

from tai.agent_runtime import AgentExecutionStatus
from tai.contracts import ToolMode
from tai.orchestration import (
    OrchestrationStatus,
    OrchestrationTrace,
    RuntimeEvaluationObservation,
)
from tai.postgres_orchestration_observability import (
    PostgreSQLOrchestrationAuditSink,
    PostgreSQLRuntimeEvaluationSink,
    runtime_observation_sha256,
)
from tai.rag_pipeline import GroundedAnswerStatus

NOW = datetime(2026, 7, 19, tzinfo=UTC)
TRACE_ID = UUID("10000000-0000-4000-8000-000000000001")


class _Cursor(AbstractContextManager["_Cursor"]):
    def __init__(self, row: Mapping[str, Any] | None) -> None:
        self.row = row
        self.query = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        self.query = query
        self.parameters = tuple(parameters)

    def fetchone(self) -> Mapping[str, Any] | None:
        return self.row


class _Connection(AbstractContextManager["_Connection"]):
    def __init__(self, row: Mapping[str, Any] | None) -> None:
        self.cursor_instance = _Cursor(row)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class _Factory:
    def __init__(self, row: Mapping[str, Any] | None) -> None:
        self.connection = _Connection(row)

    def __call__(self) -> _Connection:
        return self.connection


def _trace() -> OrchestrationTrace:
    return OrchestrationTrace(
        request_id="request-1",
        trace_id=TRACE_ID,
        tenant_id=None,
        user_id=UUID("20000000-0000-4000-8000-000000000002"),
        session_id=UUID("30000000-0000-4000-8000-000000000003"),
        request_sha256="a" * 64,
        status=OrchestrationStatus.ANSWERED,
        rag_status=GroundedAnswerStatus.ANSWERED,
        model_id="agro",
        model_revision="r1",
        model_route_id="b" * 64,
        generation=1,
        source_ids=("source-1",),
        citations=("S1",),
        tool_plan_sha256=None,
        tool_status=None,
        prepared_action_count=0,
        reason=None,
        completed_at=NOW,
        trace_sha256="c" * 64,
    )


def _observation() -> RuntimeEvaluationObservation:
    return RuntimeEvaluationObservation(
        request_id="request-1",
        trace_id=TRACE_ID,
        status=OrchestrationStatus.ANSWERED,
        tenant_id=None,
        source_ids=("source-1",),
        citations=("S1",),
        model_invoked=True,
        tool_modes=(ToolMode.READ_ONLY,),
        tool_status=AgentExecutionStatus.COMPLETED,
        reason=None,
        trace_sha256="c" * 64,
        observed_at=NOW,
    )


def test_orchestration_trace_is_persisted_idempotently() -> None:
    trace = _trace()
    factory = _Factory({"trace_id": TRACE_ID, "trace_sha256": trace.trace_sha256})
    PostgreSQLOrchestrationAuditSink(factory).record(trace)
    assert "ON CONFLICT (trace_id)" in factory.connection.cursor_instance.query
    assert factory.connection.committed is True


def test_orchestration_trace_conflict_fails_closed() -> None:
    with pytest.raises(RuntimeError, match="different orchestration evidence"):
        PostgreSQLOrchestrationAuditSink(_Factory(None)).record(_trace())


def test_runtime_observation_digest_and_persistence_are_deterministic() -> None:
    observation = _observation()
    digest = runtime_observation_sha256(observation)
    assert digest == runtime_observation_sha256(observation)
    factory = _Factory({"trace_id": TRACE_ID, "observation_sha256": digest})
    PostgreSQLRuntimeEvaluationSink(factory).observe(observation)
    assert "tai_runtime_evaluation_observations" in factory.connection.cursor_instance.query
    assert factory.connection.committed is True
