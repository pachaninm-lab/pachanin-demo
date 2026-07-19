from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from typing import Any

from tai.orchestration import OrchestrationTrace, RuntimeEvaluationObservation
from tai.postgres_loader_state import ConnectionFactory


class PostgreSQLOrchestrationAuditSink:
    """Immutable exact-trace authority for the joined TAI orchestration path."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record(self, trace: OrchestrationTrace) -> None:
        query = """
            INSERT INTO tai_orchestration_traces (
                trace_id,
                request_id,
                tenant_id,
                user_id,
                session_id,
                request_sha256,
                status,
                rag_status,
                model_id,
                model_revision,
                model_route_id,
                generation,
                source_ids,
                citations,
                tool_plan_sha256,
                tool_status,
                prepared_action_count,
                reason,
                completed_at,
                trace_sha256
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (trace_id) DO UPDATE
            SET trace_id = EXCLUDED.trace_id
            WHERE tai_orchestration_traces.trace_sha256 = EXCLUDED.trace_sha256
            RETURNING trace_id, trace_sha256
        """
        row = self._execute_returning(
            query,
            (
                trace.trace_id,
                trace.request_id,
                trace.tenant_id,
                trace.user_id,
                trace.session_id,
                trace.request_sha256,
                trace.status.value,
                trace.rag_status.value,
                trace.model_id,
                trace.model_revision,
                trace.model_route_id,
                trace.generation,
                list(trace.source_ids),
                list(trace.citations),
                trace.tool_plan_sha256,
                None if trace.tool_status is None else trace.tool_status.value,
                trace.prepared_action_count,
                trace.reason,
                trace.completed_at,
                trace.trace_sha256,
            ),
        )
        if row is None:
            raise RuntimeError("trace_id is already bound to different orchestration evidence")
        if str(row["trace_sha256"]) != trace.trace_sha256:
            raise RuntimeError("persisted orchestration trace digest does not match")

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


class PostgreSQLRuntimeEvaluationSink:
    """Append-only machine-readable observations for deterministic AP-09 evaluation."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def observe(self, observation: RuntimeEvaluationObservation) -> None:
        observation_sha256 = runtime_observation_sha256(observation)
        query = """
            INSERT INTO tai_runtime_evaluation_observations (
                trace_id,
                request_id,
                status,
                tenant_id,
                source_ids,
                citations,
                model_invoked,
                tool_modes,
                tool_status,
                reason,
                trace_sha256,
                observed_at,
                observation_sha256
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (trace_id) DO UPDATE
            SET trace_id = EXCLUDED.trace_id
            WHERE tai_runtime_evaluation_observations.observation_sha256
                = EXCLUDED.observation_sha256
            RETURNING trace_id, observation_sha256
        """
        row = self._execute_returning(
            query,
            (
                observation.trace_id,
                observation.request_id,
                observation.status.value,
                observation.tenant_id,
                list(observation.source_ids),
                list(observation.citations),
                observation.model_invoked,
                [mode.value for mode in observation.tool_modes],
                None if observation.tool_status is None else observation.tool_status.value,
                observation.reason,
                observation.trace_sha256,
                observation.observed_at,
                observation_sha256,
            ),
        )
        if row is None:
            raise RuntimeError("trace_id is already bound to a different runtime observation")
        if str(row["observation_sha256"]) != observation_sha256:
            raise RuntimeError("persisted runtime observation digest does not match")

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


def runtime_observation_sha256(observation: RuntimeEvaluationObservation) -> str:
    payload = {
        "citations": list(observation.citations),
        "model_invoked": observation.model_invoked,
        "observed_at": observation.observed_at.isoformat(),
        "reason": observation.reason,
        "request_id": observation.request_id,
        "source_ids": list(observation.source_ids),
        "status": observation.status.value,
        "tenant_id": (
            None if observation.tenant_id is None else str(observation.tenant_id)
        ),
        "tool_modes": [mode.value for mode in observation.tool_modes],
        "tool_status": (
            None if observation.tool_status is None else observation.tool_status.value
        ),
        "trace_id": str(observation.trace_id),
        "trace_sha256": observation.trace_sha256,
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
