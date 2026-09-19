from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from contextvars import ContextVar
from datetime import timedelta
from typing import Any, cast
from uuid import UUID, uuid4

from pydantic import TypeAdapter

from tai.agent_runtime import AgentExecutionResult
from tai.orchestration import (
    IdempotencyClaim,
    IdempotencyClaimStatus,
    OrchestrationResponse,
    PreparedActionClaim,
    PreparedActionClaimStatus,
    StoredPreparedAction,
)
from tai.postgres_loader_state import ConnectionFactory

_RESPONSE_ADAPTER: TypeAdapter[OrchestrationResponse] = TypeAdapter(
    OrchestrationResponse
)
_STORED_ACTION_ADAPTER: TypeAdapter[StoredPreparedAction] = TypeAdapter(
    StoredPreparedAction
)
_EXECUTION_ADAPTER: TypeAdapter[AgentExecutionResult] = TypeAdapter(
    AgentExecutionResult
)


class _PostgreSQLRepository:
    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

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

    def _execute(self, query: str, parameters: Sequence[Any]) -> None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                connection.commit()
            except Exception:
                connection.rollback()
                raise


class PostgreSQLOrchestrationIdempotencyRepository(_PostgreSQLRepository):
    """Atomic cross-process request claim and immutable response replay authority."""

    def claim(self, scope_sha256: str, request_sha256: str) -> IdempotencyClaim:
        row = self._execute_returning(
            """
                INSERT INTO tai_orchestration_idempotency (
                    scope_sha256,
                    request_sha256,
                    status
                )
                VALUES (%s, %s, 'IN_PROGRESS')
                ON CONFLICT (scope_sha256) DO UPDATE
                SET scope_sha256 = EXCLUDED.scope_sha256
                RETURNING
                    request_sha256,
                    status,
                    response_payload,
                    (xmax = 0) AS inserted
            """,
            (scope_sha256, request_sha256),
        )
        if row is None:
            raise RuntimeError("idempotency claim did not return authority state")
        if str(row["request_sha256"]) != request_sha256:
            return IdempotencyClaim(IdempotencyClaimStatus.CONFLICT)
        if bool(row["inserted"]):
            return IdempotencyClaim(IdempotencyClaimStatus.NEW)
        status = str(row["status"])
        if status == "IN_PROGRESS":
            return IdempotencyClaim(IdempotencyClaimStatus.IN_PROGRESS)
        if status == "COMPLETED":
            payload = row["response_payload"]
            if payload is None:
                raise RuntimeError(
                    "completed idempotency record is missing response payload"
                )
            return IdempotencyClaim(
                IdempotencyClaimStatus.REPLAY,
                _RESPONSE_ADAPTER.validate_python(_json_object(payload)),
            )
        raise RuntimeError("unknown orchestration idempotency status")

    def complete(
        self,
        scope_sha256: str,
        request_sha256: str,
        response: OrchestrationResponse,
    ) -> None:
        payload = _response_payload(response)
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                            UPDATE tai_orchestration_idempotency
                            SET status = 'COMPLETED',
                                response_payload = %s,
                                updated_at = clock_timestamp()
                            WHERE scope_sha256 = %s
                              AND request_sha256 = %s
                              AND status = 'IN_PROGRESS'
                            RETURNING request_sha256, status, response_payload
                        """,
                        (payload, scope_sha256, request_sha256),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        cursor.execute(
                            """
                                SELECT request_sha256, status, response_payload
                                FROM tai_orchestration_idempotency
                                WHERE scope_sha256 = %s
                            """,
                            (scope_sha256,),
                        )
                        row = cursor.fetchone()
                if row is None or str(row["request_sha256"]) != request_sha256:
                    raise RuntimeError("idempotency claim does not match completion")
                if str(row["status"]) != "COMPLETED":
                    raise RuntimeError(
                        "idempotency completion requires an active claim"
                    )
                persisted = row["response_payload"]
                if persisted is None or _json_object(persisted) != payload:
                    raise RuntimeError("idempotency response is immutable")
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def abandon(self, scope_sha256: str, request_sha256: str) -> None:
        self._execute(
            """
                DELETE FROM tai_orchestration_idempotency
                WHERE scope_sha256 = %s
                  AND request_sha256 = %s
                  AND status = 'IN_PROGRESS'
            """,
            (scope_sha256, request_sha256),
        )


class PostgreSQLPreparedActionRepository(_PostgreSQLRepository):
    """Leased and fenced single-executor authority for confirmed actions."""

    def __init__(
        self,
        connection_factory: ConnectionFactory,
        *,
        execution_lease: timedelta = timedelta(minutes=5),
    ) -> None:
        super().__init__(connection_factory)
        lease_seconds = int(execution_lease.total_seconds())
        if not 1 <= lease_seconds <= 3_600:
            raise ValueError("execution_lease must be between 1 second and 1 hour")
        self._execution_lease_seconds = lease_seconds
        self._execution_tokens: ContextVar[dict[UUID, UUID] | None] = ContextVar(
            f"tai_prepared_action_tokens_{id(self)}",
            default=None,
        )

    def save(self, prepared: StoredPreparedAction) -> None:
        confirmation = prepared.action.confirmation
        row = self._execute_returning(
            """
                INSERT INTO tai_prepared_actions (
                    confirmation_id,
                    trace_id,
                    plan_id,
                    call_id,
                    request_sha256,
                    user_id,
                    tenant_id,
                    session_id,
                    expires_at,
                    prepared_payload,
                    status
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'PREPARED')
                ON CONFLICT (confirmation_id) DO UPDATE
                SET confirmation_id = EXCLUDED.confirmation_id
                WHERE tai_prepared_actions.prepared_payload = EXCLUDED.prepared_payload
                RETURNING confirmation_id
            """,
            (
                confirmation.confirmation_id,
                prepared.action.trace_id,
                prepared.action.plan_id,
                prepared.action.call.call_id,
                confirmation.request_sha256,
                prepared.identity.user_id,
                prepared.identity.tenant_id,
                prepared.identity.session_id,
                confirmation.expires_at,
                _stored_action_payload(prepared),
            ),
        )
        if row is None:
            raise RuntimeError("prepared action confirmation identity conflict")

    def get(self, confirmation_id: UUID) -> StoredPreparedAction | None:
        row = self._execute_returning(
            """
                SELECT prepared_payload, result_payload, status
                FROM tai_prepared_actions
                WHERE confirmation_id = %s
            """,
            (confirmation_id,),
        )
        return None if row is None else _stored_action_from_row(row)

    def claim(self, confirmation_id: UUID) -> PreparedActionClaim:
        execution_token = uuid4()
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                            UPDATE tai_prepared_actions
                            SET status = 'EXECUTING',
                                execution_token = %s,
                                execution_started_at = clock_timestamp(),
                                execution_expires_at = clock_timestamp()
                                    + (%s * INTERVAL '1 second'),
                                version = version + 1,
                                updated_at = clock_timestamp()
                            WHERE confirmation_id = %s
                              AND (
                                  status = 'PREPARED'
                                  OR (
                                      status = 'EXECUTING'
                                      AND execution_expires_at <= clock_timestamp()
                                  )
                              )
                            RETURNING
                                prepared_payload,
                                result_payload,
                                status,
                                execution_token
                        """,
                        (
                            execution_token,
                            self._execution_lease_seconds,
                            confirmation_id,
                        ),
                    )
                    row = cursor.fetchone()
                    claimed = row is not None
                    if row is None:
                        cursor.execute(
                            """
                                SELECT
                                    prepared_payload,
                                    result_payload,
                                    status,
                                    execution_token
                                FROM tai_prepared_actions
                                WHERE confirmation_id = %s
                            """,
                            (confirmation_id,),
                        )
                        row = cursor.fetchone()
                if row is None:
                    raise RuntimeError("prepared action does not exist")
                prepared = _stored_action_from_row(row)
                if claimed:
                    if UUID(str(row["execution_token"])) != execution_token:
                        raise RuntimeError("prepared action fencing token mismatch")
                    result = PreparedActionClaim(
                        PreparedActionClaimStatus.EXECUTE,
                        prepared,
                    )
                else:
                    status = str(row["status"])
                    if status == "COMPLETED":
                        if prepared.result is None:
                            raise RuntimeError(
                                "completed prepared action is missing its result"
                            )
                        result = PreparedActionClaim(
                            PreparedActionClaimStatus.REPLAY,
                            prepared,
                        )
                    elif status in {"PREPARED", "EXECUTING"}:
                        result = PreparedActionClaim(
                            PreparedActionClaimStatus.IN_PROGRESS,
                            prepared,
                        )
                    else:
                        raise RuntimeError("unknown prepared action status")
                connection.commit()
                if claimed:
                    self._remember_execution_token(
                        confirmation_id,
                        execution_token,
                    )
                return result
            except Exception:
                connection.rollback()
                raise

    def complete(
        self,
        confirmation_id: UUID,
        result: AgentExecutionResult,
    ) -> StoredPreparedAction:
        result_payload = _execution_payload(result)
        execution_token = self._execution_token(confirmation_id)
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                            UPDATE tai_prepared_actions
                            SET status = 'COMPLETED',
                                result_payload = %s,
                                execution_token = NULL,
                                execution_expires_at = NULL,
                                completed_at = %s,
                                version = version + 1,
                                updated_at = clock_timestamp()
                            WHERE confirmation_id = %s
                              AND status = 'EXECUTING'
                              AND execution_token IS NOT DISTINCT FROM %s
                              AND execution_expires_at > clock_timestamp()
                            RETURNING prepared_payload, result_payload, status
                        """,
                        (
                            result_payload,
                            result.completed_at,
                            confirmation_id,
                            execution_token,
                        ),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        cursor.execute(
                            """
                                SELECT prepared_payload, result_payload, status
                                FROM tai_prepared_actions
                                WHERE confirmation_id = %s
                            """,
                            (confirmation_id,),
                        )
                        row = cursor.fetchone()
                if row is None:
                    raise RuntimeError("prepared action does not exist")
                if str(row["status"]) != "COMPLETED":
                    raise RuntimeError(
                        "prepared action execution claim is stale or expired"
                    )
                persisted = row["result_payload"]
                if persisted is None or _json_object(persisted) != result_payload:
                    raise RuntimeError("prepared action result is immutable")
                prepared = _stored_action_from_row(row)
                connection.commit()
                self._forget_execution_token(confirmation_id)
                return prepared
            except Exception:
                connection.rollback()
                raise

    def abandon(self, confirmation_id: UUID) -> None:
        execution_token = self._execution_token(confirmation_id)
        self._execute(
            """
                UPDATE tai_prepared_actions
                SET status = 'PREPARED',
                    execution_token = NULL,
                    execution_started_at = NULL,
                    execution_expires_at = NULL,
                    version = version + 1,
                    updated_at = clock_timestamp()
                WHERE confirmation_id = %s
                  AND status = 'EXECUTING'
                  AND execution_token IS NOT DISTINCT FROM %s
                  AND result_payload IS NULL
            """,
            (confirmation_id, execution_token),
        )
        self._forget_execution_token(confirmation_id)

    def _remember_execution_token(
        self,
        confirmation_id: UUID,
        execution_token: UUID,
    ) -> None:
        current = self._execution_tokens.get()
        tokens = {} if current is None else dict(current)
        tokens[confirmation_id] = execution_token
        self._execution_tokens.set(tokens)

    def _execution_token(self, confirmation_id: UUID) -> UUID | None:
        tokens = self._execution_tokens.get()
        return None if tokens is None else tokens.get(confirmation_id)

    def _forget_execution_token(self, confirmation_id: UUID) -> None:
        current = self._execution_tokens.get()
        tokens = {} if current is None else dict(current)
        tokens.pop(confirmation_id, None)
        self._execution_tokens.set(tokens)


def _response_payload(response: OrchestrationResponse) -> dict[str, Any]:
    return cast(
        dict[str, Any],
        _RESPONSE_ADAPTER.dump_python(response, mode="json"),
    )


def _stored_action_payload(prepared: StoredPreparedAction) -> dict[str, Any]:
    payload = cast(
        dict[str, Any],
        _STORED_ACTION_ADAPTER.dump_python(prepared, mode="json"),
    )
    payload["result"] = None
    payload["executing"] = False
    return payload


def _execution_payload(result: AgentExecutionResult) -> dict[str, Any]:
    return cast(
        dict[str, Any],
        _EXECUTION_ADAPTER.dump_python(result, mode="json"),
    )


def _stored_action_from_row(row: Mapping[str, Any]) -> StoredPreparedAction:
    payload = _json_object(row["prepared_payload"])
    result_payload = row["result_payload"]
    payload["result"] = None if result_payload is None else _json_object(result_payload)
    payload["executing"] = str(row["status"]) == "EXECUTING"
    return _STORED_ACTION_ADAPTER.validate_python(payload)


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, str):
        value = json.loads(value)
    if not isinstance(value, Mapping):
        raise TypeError("database JSON value must be an object")
    return {str(key): item for key, item in value.items()}
