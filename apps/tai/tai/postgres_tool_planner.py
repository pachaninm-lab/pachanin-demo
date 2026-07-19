from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, Protocol

from tai.main import ReadinessStatus
from tai.postgres_loader_state import ConnectionFactory
from tai.tool_planner import PlannerDecision


class ReadinessProbe(Protocol):
    def check(self) -> ReadinessStatus: ...


class PostgreSQLToolPlannerDecisionSink:
    """Immutable planner-decision authority without storing raw user prompts."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record(self, decision: PlannerDecision) -> None:
        query = """
            INSERT INTO tai_tool_planner_decisions (
                trace_id,
                plan_id,
                request_id,
                tenant_id,
                user_id,
                session_id,
                status,
                catalog_version,
                input_sha256,
                selected_calls,
                reason_codes,
                rejection_signals,
                generated_at,
                decision_sha256
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (trace_id) DO UPDATE
            SET trace_id = EXCLUDED.trace_id
            WHERE tai_tool_planner_decisions.decision_sha256 = EXCLUDED.decision_sha256
            RETURNING trace_id, decision_sha256
        """
        selected_calls = [
            {
                "arguments_sha256": item.arguments_sha256,
                "call_id": item.call_id,
                "mode": item.mode.value,
                "tool_name": item.tool_name,
            }
            for item in decision.selected_calls
        ]
        row = self._execute_returning(
            query,
            (
                decision.trace_id,
                decision.plan_id,
                decision.request_id,
                decision.tenant_id,
                decision.user_id,
                decision.session_id,
                decision.status.value,
                decision.catalog_version,
                decision.input_sha256,
                selected_calls,
                list(decision.reason_codes),
                list(decision.rejection_signals),
                decision.generated_at,
                decision.decision_sha256,
            ),
        )
        if row is None:
            raise RuntimeError("trace_id is already bound to a different planner decision")
        if str(row["decision_sha256"]) != decision.decision_sha256:
            raise RuntimeError("persisted planner decision digest does not match")

    def _execute_returning(
        self,
        query: str,
        parameters: Sequence[Any],
    ) -> Mapping[str, Any] | None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    row = cursor.fetchone()
                connection.commit()
                return row
            except Exception:
                connection.rollback()
                raise


class PlannerAwareReadinessProbe:
    """Fail readiness when configured planner authority is missing from PostgreSQL."""

    def __init__(
        self,
        *,
        delegate: ReadinessProbe,
        connection_factory: ConnectionFactory,
        planner_required: bool,
    ) -> None:
        self._delegate = delegate
        self._connection_factory = connection_factory
        self._planner_required = planner_required

    def check(self) -> ReadinessStatus:
        base = self._delegate.check()
        components = dict(base.components)
        reasons = list(base.reasons)
        if not self._planner_required:
            components["tool_planner"] = "disabled-safe"
            return ReadinessStatus(base.ready, components, tuple(reasons))
        try:
            relation_ready = self._relation_exists()
        except Exception:
            relation_ready = False
        if relation_ready:
            components["tool_planner"] = "ready"
        else:
            components["tool_planner"] = "schema_incomplete"
            reasons.append("TOOL_PLANNER_SCHEMA_INCOMPLETE")
        unique_reasons = tuple(dict.fromkeys(reasons))
        return ReadinessStatus(not unique_reasons, components, unique_reasons)

    def _relation_exists(self) -> bool:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT to_regclass('public.tai_tool_planner_decisions') AS relation",
                        (),
                    )
                    row = cursor.fetchone()
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        return row is not None and row.get("relation") is not None
