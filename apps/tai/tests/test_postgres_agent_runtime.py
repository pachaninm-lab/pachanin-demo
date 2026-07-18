from __future__ import annotations

from collections.abc import Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest

from tai.agent_runtime import (
    AgentAuditEvent,
    ToolConfirmation,
    ToolInvocationStatus,
)
from tai.contracts import ToolMode
from tai.postgres_agent_runtime import (
    PostgreSQLAgentAuditSink,
    PostgreSQLConfirmationUseRepository,
    _event_sha256,
)

NOW = datetime(2026, 7, 18, 15, 0, tzinfo=UTC)
TRACE_ID = UUID("10000000-0000-0000-0000-000000000001")
PLAN_ID = UUID("20000000-0000-0000-0000-000000000002")
USER_ID = UUID("30000000-0000-0000-0000-000000000003")
TENANT_ID = UUID("40000000-0000-0000-0000-000000000004")
SESSION_ID = UUID("50000000-0000-0000-0000-000000000005")
CONFIRMATION_ID = UUID("60000000-0000-0000-0000-000000000006")


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


def _event() -> AgentAuditEvent:
    return AgentAuditEvent(
        event_id="a" * 64,
        trace_id=TRACE_ID,
        plan_id=PLAN_ID,
        call_id="call-1",
        tool_name="getDealSummary",
        mode=ToolMode.READ_ONLY,
        status=ToolInvocationStatus.SUCCEEDED,
        user_id=USER_ID,
        tenant_id=TENANT_ID,
        session_id=SESSION_ID,
        request_sha256="b" * 64,
        result_sha256="c" * 64,
        idempotency_key="d" * 64,
        reason=None,
        occurred_at=NOW,
    )


def _confirmation() -> ToolConfirmation:
    return ToolConfirmation(
        confirmation_id=CONFIRMATION_ID,
        call_id="call-1",
        request_sha256="b" * 64,
        user_id=USER_ID,
        tenant_id=TENANT_ID,
        session_id=SESSION_ID,
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=2),
        mfa_verified=True,
        signature_sha256="e" * 64,
    )


def test_agent_event_insert_is_immutable_and_idempotent() -> None:
    event = _event()
    digest = _event_sha256(event)
    factory = FakeFactory({"event_id": event.event_id, "event_sha256": digest})

    PostgreSQLAgentAuditSink(factory).record(event)

    cursor = factory.connection.cursor_instance
    assert "ON CONFLICT (event_id) DO UPDATE" in cursor.query
    assert "event_sha256 = EXCLUDED.event_sha256" in cursor.query
    assert cursor.parameters[0] == "a" * 64
    assert cursor.parameters[1] == TRACE_ID
    assert cursor.parameters[5:7] == ("READ_ONLY", "SUCCEEDED")
    assert cursor.parameters[10:13] == ("b" * 64, "c" * 64, "d" * 64)
    assert cursor.parameters[15] == digest
    assert factory.connection.committed is True
    assert factory.connection.rolled_back is False


def test_agent_event_conflict_and_digest_mismatch_fail_closed() -> None:
    with pytest.raises(RuntimeError, match="already bound"):
        PostgreSQLAgentAuditSink(FakeFactory(None)).record(_event())
    with pytest.raises(RuntimeError, match="does not match"):
        PostgreSQLAgentAuditSink(
            FakeFactory({"event_id": "a" * 64, "event_sha256": "0" * 64})
        ).record(_event())


def test_confirmation_claim_is_atomic_and_same_binding_is_retryable() -> None:
    factory = FakeFactory({"confirmation_id": CONFIRMATION_ID})
    repository = PostgreSQLConfirmationUseRepository(factory)

    accepted = repository.claim(
        confirmation=_confirmation(),
        request_sha256="b" * 64,
        idempotency_key="d" * 64,
        used_at=NOW,
    )

    cursor = factory.connection.cursor_instance
    assert accepted is True
    assert "ON CONFLICT (confirmation_id) DO UPDATE" in cursor.query
    assert "IS NOT DISTINCT FROM EXCLUDED.tenant_id" in cursor.query
    assert cursor.parameters == (
        CONFIRMATION_ID,
        "call-1",
        "b" * 64,
        "d" * 64,
        USER_ID,
        TENANT_ID,
        SESSION_ID,
        NOW,
    )
    assert factory.connection.committed is True


def test_confirmation_claim_conflict_returns_false() -> None:
    repository = PostgreSQLConfirmationUseRepository(FakeFactory(None))

    assert (
        repository.claim(
            confirmation=_confirmation(),
            request_sha256="b" * 64,
            idempotency_key="d" * 64,
            used_at=NOW,
        )
        is False
    )


def test_database_failures_roll_back() -> None:
    audit_factory = FakeFactory(None, fail=True)
    claim_factory = FakeFactory(None, fail=True)

    with pytest.raises(RuntimeError, match="database failure"):
        PostgreSQLAgentAuditSink(audit_factory).record(_event())
    with pytest.raises(RuntimeError, match="database failure"):
        PostgreSQLConfirmationUseRepository(claim_factory).claim(
            confirmation=_confirmation(),
            request_sha256="b" * 64,
            idempotency_key="d" * 64,
            used_at=NOW,
        )

    assert audit_factory.connection.rolled_back is True
    assert claim_factory.connection.rolled_back is True
