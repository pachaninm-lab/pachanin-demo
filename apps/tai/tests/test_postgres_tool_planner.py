from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import pytest

from tai.contracts import ToolMode
from tai.main import ReadinessStatus
from tai.postgres_tool_planner import (
    PlannerAwareReadinessProbe,
    PostgreSQLToolPlannerDecisionSink,
)
from tai.tool_planner import (
    PlannerDecision,
    PlannerDecisionStatus,
    PlannerSelectedCall,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


class _Cursor(AbstractContextManager["_Cursor"]):
    def __init__(self, rows: list[Mapping[str, Any] | None]) -> None:
        self.rows = rows
        self.query = ""
        self.parameters: Sequence[Any] = ()

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        self.query = query
        self.parameters = parameters

    def fetchone(self) -> Mapping[str, Any] | None:
        return self.rows.pop(0) if self.rows else None


class _Connection(AbstractContextManager["_Connection"]):
    def __init__(self, rows: list[Mapping[str, Any] | None]) -> None:
        self.rows = rows
        self.committed = False
        self.rolled_back = False
        self.last_cursor: _Cursor | None = None

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        self.last_cursor = _Cursor(self.rows)
        return self.last_cursor

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class _Factory:
    def __init__(self, rows: list[Mapping[str, Any] | None]) -> None:
        self.rows = rows
        self.connections: list[_Connection] = []

    def __call__(self) -> _Connection:
        connection = _Connection(self.rows)
        self.connections.append(connection)
        return connection


class _Probe:
    def __init__(self, status: ReadinessStatus) -> None:
        self.status = status

    def check(self) -> ReadinessStatus:
        return self.status


def _decision() -> PlannerDecision:
    return PlannerDecision(
        trace_id=UUID("40000000-0000-0000-0000-000000000004"),
        plan_id=UUID("50000000-0000-0000-0000-000000000005"),
        request_id="planner-request-1",
        tenant_id=UUID("20000000-0000-0000-0000-000000000002"),
        user_id=UUID("10000000-0000-0000-0000-000000000001"),
        session_id=UUID("30000000-0000-0000-0000-000000000003"),
        status=PlannerDecisionStatus.SELECTED,
        catalog_version="tai.tool-catalog.safe.v1",
        input_sha256="a" * 64,
        selected_calls=(
            PlannerSelectedCall(
                call_id="planner-call-1",
                tool_name="getDealSummary",
                mode=ToolMode.READ_ONLY,
                arguments_sha256="b" * 64,
            ),
        ),
        reason_codes=("EXPLICIT_USER_INTENT",),
        rejection_signals=(),
        generated_at=NOW,
        decision_sha256="c" * 64,
    )


def test_postgres_planner_sink_is_immutable_and_digest_bound() -> None:
    factory = _Factory(
        [
            {
                "trace_id": UUID("40000000-0000-0000-0000-000000000004"),
                "decision_sha256": "c" * 64,
            }
        ]
    )

    PostgreSQLToolPlannerDecisionSink(factory).record(_decision())

    connection = factory.connections[0]
    assert connection.committed is True
    assert connection.last_cursor is not None
    assert "ON CONFLICT (trace_id)" in connection.last_cursor.query
    selected_calls = connection.last_cursor.parameters[9]
    assert selected_calls == [
        {
            "arguments_sha256": "b" * 64,
            "call_id": "planner-call-1",
            "mode": "READ_ONLY",
            "tool_name": "getDealSummary",
        }
    ]

    conflict = _Factory([None])
    with pytest.raises(RuntimeError, match="different planner decision"):
        PostgreSQLToolPlannerDecisionSink(conflict).record(_decision())


def test_planner_readiness_is_fail_closed_only_when_tools_are_configured() -> None:
    base = ReadinessStatus(True, {"postgresql": "ready"}, ())
    disabled = PlannerAwareReadinessProbe(
        delegate=_Probe(base),
        connection_factory=_Factory([]),
        planner_required=False,
    ).check()
    ready = PlannerAwareReadinessProbe(
        delegate=_Probe(base),
        connection_factory=_Factory([{"relation": "tai_tool_planner_decisions"}]),
        planner_required=True,
    ).check()
    missing = PlannerAwareReadinessProbe(
        delegate=_Probe(base),
        connection_factory=_Factory([{"relation": None}]),
        planner_required=True,
    ).check()

    assert disabled.ready is True
    assert disabled.components["tool_planner"] == "disabled-safe"
    assert ready.ready is True
    assert ready.components["tool_planner"] == "ready"
    assert missing.ready is False
    assert missing.components["tool_planner"] == "schema_incomplete"
    assert missing.reasons == ("TOOL_PLANNER_SCHEMA_INCOMPLETE",)
