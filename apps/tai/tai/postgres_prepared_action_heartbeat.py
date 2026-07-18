from __future__ import annotations

import threading
from contextvars import Context, ContextVar, copy_context
from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID

from tai.agent_runtime import AgentExecutionResult
from tai.orchestration import (
    PreparedActionClaim,
    PreparedActionClaimStatus,
    StoredPreparedAction,
)
from tai.postgres_loader_state import ConnectionFactory
from tai.postgres_orchestration import PostgreSQLPreparedActionRepository


class PreparedActionHeartbeatError(RuntimeError):
    """The executing replica lost its durable prepared-action lease."""


@dataclass(slots=True)
class _HeartbeatHandle:
    stop_event: threading.Event
    thread: threading.Thread | None = None
    failure: BaseException | None = None


class HeartbeatingPostgreSQLPreparedActionRepository(
    PostgreSQLPreparedActionRepository
):
    """Keep a fenced execution lease alive while a blocking tool call is running.

    The lease token remains bound to the request context created by the base
    repository. A copied context is used only by the dedicated heartbeat thread.
    Process death stops heartbeats, allowing another replica to reclaim the action
    after the database lease expires. A stale executor is never allowed to persist
    a result after heartbeat loss.
    """

    def __init__(
        self,
        connection_factory: ConnectionFactory,
        *,
        execution_lease: timedelta = timedelta(minutes=5),
        heartbeat_interval: timedelta | None = None,
    ) -> None:
        super().__init__(
            connection_factory,
            execution_lease=execution_lease,
        )
        interval = heartbeat_interval or execution_lease / 3
        interval_seconds = interval.total_seconds()
        lease_seconds = execution_lease.total_seconds()
        if interval_seconds < 0.05:
            raise ValueError("heartbeat_interval must be at least 50 milliseconds")
        if interval_seconds >= lease_seconds:
            raise ValueError("heartbeat_interval must be shorter than execution_lease")
        self._heartbeat_interval_seconds = interval_seconds
        self._heartbeat_handles: ContextVar[dict[UUID, _HeartbeatHandle] | None] = (
            ContextVar(
                f"tai_prepared_action_heartbeats_{id(self)}",
                default=None,
            )
        )

    def claim(self, confirmation_id: UUID) -> PreparedActionClaim:
        claim = super().claim(confirmation_id)
        if claim.status is PreparedActionClaimStatus.EXECUTE:
            self._start_heartbeat(confirmation_id)
        return claim

    def complete(
        self,
        confirmation_id: UUID,
        result: AgentExecutionResult,
    ) -> StoredPreparedAction:
        self._stop_heartbeat(confirmation_id, raise_on_failure=True)
        return super().complete(confirmation_id, result)

    def abandon(self, confirmation_id: UUID) -> None:
        self._stop_heartbeat(confirmation_id, raise_on_failure=False)
        super().abandon(confirmation_id)

    def _start_heartbeat(self, confirmation_id: UUID) -> None:
        handles = self._handles()
        if confirmation_id in handles:
            raise RuntimeError("prepared action heartbeat is already active")
        execution_context = copy_context()
        handle = _HeartbeatHandle(stop_event=threading.Event())
        handle.thread = threading.Thread(
            target=self._heartbeat_loop,
            args=(confirmation_id, execution_context, handle),
            name=f"tai-action-heartbeat-{confirmation_id}",
            daemon=True,
        )
        updated = dict(handles)
        updated[confirmation_id] = handle
        self._heartbeat_handles.set(updated)
        try:
            handle.thread.start()
        except Exception:
            updated.pop(confirmation_id, None)
            self._heartbeat_handles.set(updated)
            raise

    def _stop_heartbeat(
        self,
        confirmation_id: UUID,
        *,
        raise_on_failure: bool,
    ) -> None:
        handles = self._handles()
        handle = handles.get(confirmation_id)
        if handle is None:
            return
        handle.stop_event.set()
        if handle.thread is not None:
            handle.thread.join()
        updated = dict(handles)
        updated.pop(confirmation_id, None)
        self._heartbeat_handles.set(updated)
        if raise_on_failure and handle.failure is not None:
            raise PreparedActionHeartbeatError(
                "prepared action execution lease was lost before completion"
            ) from handle.failure

    def _heartbeat_loop(
        self,
        confirmation_id: UUID,
        execution_context: Context,
        handle: _HeartbeatHandle,
    ) -> None:
        while not handle.stop_event.wait(self._heartbeat_interval_seconds):
            try:
                renewed = execution_context.run(
                    self._renew_execution_lease,
                    confirmation_id,
                )
            except BaseException as error:
                handle.failure = error
                handle.stop_event.set()
                return
            if not renewed:
                handle.failure = PreparedActionHeartbeatError(
                    "prepared action execution lease is stale, expired, or fenced"
                )
                handle.stop_event.set()
                return

    def _renew_execution_lease(self, confirmation_id: UUID) -> bool:
        execution_token = self._execution_token(confirmation_id)
        if execution_token is None:
            return False
        row = self._execute_returning(
            """
                UPDATE tai_prepared_actions
                SET execution_expires_at = clock_timestamp()
                        + (%s * INTERVAL '1 second'),
                    updated_at = clock_timestamp()
                WHERE confirmation_id = %s
                  AND status = 'EXECUTING'
                  AND execution_token = %s
                  AND execution_expires_at > clock_timestamp()
                RETURNING confirmation_id
            """,
            (
                self._execution_lease_seconds,
                confirmation_id,
                execution_token,
            ),
        )
        return row is not None

    def _handles(self) -> dict[UUID, _HeartbeatHandle]:
        current = self._heartbeat_handles.get()
        return {} if current is None else current
