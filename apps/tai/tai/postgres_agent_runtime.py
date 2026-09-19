from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from typing import Any

from tai.agent_runtime import AgentAuditEvent, ToolConfirmation
from tai.postgres_loader_state import ConnectionFactory


class PostgreSQLAgentAuditSink:
    """Immutable idempotent PostgreSQL authority for agent tool events."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record(self, event: AgentAuditEvent) -> None:
        event_sha256 = _event_sha256(event)
        query = """
            INSERT INTO tai_agent_tool_events (
                event_id,
                trace_id,
                plan_id,
                call_id,
                tool_name,
                mode,
                status,
                user_id,
                tenant_id,
                session_id,
                request_sha256,
                result_sha256,
                idempotency_key,
                reason,
                occurred_at,
                event_sha256
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (event_id) DO UPDATE
            SET event_id = EXCLUDED.event_id
            WHERE tai_agent_tool_events.event_sha256 = EXCLUDED.event_sha256
            RETURNING event_id, event_sha256
        """
        row = self._execute_returning(
            query,
            (
                event.event_id,
                event.trace_id,
                event.plan_id,
                event.call_id,
                event.tool_name,
                event.mode.value,
                event.status.value,
                event.user_id,
                event.tenant_id,
                event.session_id,
                event.request_sha256,
                event.result_sha256,
                event.idempotency_key,
                event.reason,
                event.occurred_at,
                event_sha256,
            ),
        )
        if row is None:
            raise RuntimeError("event_id is already bound to different agent audit data")
        if str(row["event_sha256"]) != event_sha256:
            raise RuntimeError("persisted agent event digest does not match")

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


class PostgreSQLConfirmationUseRepository:
    """Atomically bind a confirmation to one exact idempotent invocation."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def claim(
        self,
        *,
        confirmation: ToolConfirmation,
        request_sha256: str,
        idempotency_key: str,
        used_at: object,
    ) -> bool:
        query = """
            INSERT INTO tai_tool_confirmation_uses (
                confirmation_id,
                call_id,
                request_sha256,
                idempotency_key,
                user_id,
                tenant_id,
                session_id,
                used_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (confirmation_id) DO UPDATE
            SET confirmation_id = EXCLUDED.confirmation_id
            WHERE tai_tool_confirmation_uses.call_id = EXCLUDED.call_id
              AND tai_tool_confirmation_uses.request_sha256 = EXCLUDED.request_sha256
              AND tai_tool_confirmation_uses.idempotency_key = EXCLUDED.idempotency_key
              AND tai_tool_confirmation_uses.user_id = EXCLUDED.user_id
              AND tai_tool_confirmation_uses.tenant_id IS NOT DISTINCT FROM EXCLUDED.tenant_id
              AND tai_tool_confirmation_uses.session_id = EXCLUDED.session_id
            RETURNING confirmation_id
        """
        row = self._execute_returning(
            query,
            (
                confirmation.confirmation_id,
                confirmation.call_id,
                request_sha256,
                idempotency_key,
                confirmation.user_id,
                confirmation.tenant_id,
                confirmation.session_id,
                used_at,
            ),
        )
        return row is not None

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


def _event_sha256(event: AgentAuditEvent) -> str:
    payload = {
        "call_id": event.call_id,
        "event_id": event.event_id,
        "idempotency_key": event.idempotency_key,
        "mode": event.mode.value,
        "occurred_at": event.occurred_at.isoformat(),
        "plan_id": str(event.plan_id),
        "reason": event.reason,
        "request_sha256": event.request_sha256,
        "result_sha256": event.result_sha256,
        "session_id": str(event.session_id),
        "status": event.status.value,
        "tenant_id": None if event.tenant_id is None else str(event.tenant_id),
        "tool_name": event.tool_name,
        "trace_id": str(event.trace_id),
        "user_id": str(event.user_id),
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
