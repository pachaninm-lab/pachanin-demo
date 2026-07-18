from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest

from tai.agent_runtime import (
    AgentAuditEvent,
    AgentExecutionStatus,
    AgentRuntimePolicy,
    AgentToolPlan,
    AgentToolRuntime,
    AuthorizedToolInvocation,
    HMACToolConfirmationAuthority,
    PlannedToolCall,
    ToolConfirmation,
    ToolExecutorRegistry,
    ToolInvocationStatus,
)
from tai.contracts import IdentityContext, ToolMode

NOW = datetime(2026, 7, 18, 16, 0, tzinfo=UTC)
TRACE_ID = UUID("71000000-0000-0000-0000-000000000001")
PLAN_ID = UUID("72000000-0000-0000-0000-000000000002")
USER_ID = UUID("73000000-0000-0000-0000-000000000003")
TENANT_ID = UUID("74000000-0000-0000-0000-000000000004")
SESSION_ID = UUID("75000000-0000-0000-0000-000000000005")
SIGNING_KEY = b"agent-confirmation-signing-key-at-least-32-bytes"


def _identity(*, roles: frozenset[str] = frozenset({"buyer"})) -> IdentityContext:
    return IdentityContext(
        user_id=USER_ID,
        tenant_id=TENANT_ID,
        roles=roles,
        session_id=SESSION_ID,
        mfa_verified=True,
        authenticated=True,
    )


def _call(
    *,
    call_id: str = "call-1",
    tool_name: str = "getDealSummary",
    mode: ToolMode = ToolMode.READ_ONLY,
    arguments: Any = None,
) -> PlannedToolCall:
    return PlannedToolCall(
        call_id=call_id,
        tool_name=tool_name,
        requested_mode=mode,
        arguments={"dealId": "deal-1"} if arguments is None else arguments,
    )


def _plan(*calls: PlannedToolCall) -> AgentToolPlan:
    return AgentToolPlan(
        trace_id=TRACE_ID,
        plan_id=PLAN_ID,
        calls=calls or (_call(),),
        generated_at=NOW,
    )


class _Handler:
    def __init__(self, result: Any = None, error: Exception | None = None) -> None:
        self.result = {"ok": True} if result is None else result
        self.error = error
        self.calls: list[AuthorizedToolInvocation] = []

    def execute(self, invocation: AuthorizedToolInvocation) -> Any:
        self.calls.append(invocation)
        if self.error is not None:
            raise self.error
        return self.result


class _Audit:
    def __init__(self) -> None:
        self.events: list[AgentAuditEvent] = []

    def record(self, event: AgentAuditEvent) -> None:
        self.events.append(event)


class _Claims:
    def __init__(self, accepted: bool = True) -> None:
        self.accepted = accepted
        self.calls: list[tuple[ToolConfirmation, str, str, datetime]] = []

    def claim(
        self,
        *,
        confirmation: ToolConfirmation,
        request_sha256: str,
        idempotency_key: str,
        used_at: datetime,
    ) -> bool:
        self.calls.append(
            (confirmation, request_sha256, idempotency_key, used_at)
        )
        return self.accepted


def _runtime(
    handlers: dict[str, _Handler],
    *,
    claims: _Claims | None = None,
    audit: _Audit | None = None,
    policy: AgentRuntimePolicy | None = None,
) -> AgentToolRuntime:
    return AgentToolRuntime(
        handlers=ToolExecutorRegistry(handlers),
        confirmation_authority=HMACToolConfirmationAuthority(SIGNING_KEY),
        confirmation_uses=claims or _Claims(),
        audit_sink=audit,
        policy=policy,
    )


def _confirmation(call: PlannedToolCall) -> ToolConfirmation:
    return HMACToolConfirmationAuthority(SIGNING_KEY).issue(
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=2),
    )


def test_each_attempt_gets_a_distinct_immutable_event_identity() -> None:
    audit = _Audit()
    runtime = _runtime({"getDealSummary": _Handler()}, audit=audit)
    plan = _plan()

    first = runtime.execute(plan, identity=_identity(), now=NOW)
    second = runtime.execute(
        plan,
        identity=_identity(),
        now=NOW + timedelta(milliseconds=1),
    )

    assert first.calls[0].idempotency_key == second.calls[0].idempotency_key
    assert audit.events[0].event_id != audit.events[1].event_id
    assert audit.events[0].occurred_at != audit.events[1].occurred_at


def test_non_object_tool_result_is_rejected() -> None:
    runtime = _runtime({"getDealSummary": _Handler(["not", "an", "object"])})

    result = runtime.execute(_plan(), identity=_identity(), now=NOW)

    assert result.status is AgentExecutionStatus.FAILED
    assert result.calls[0].status is ToolInvocationStatus.FAILED
    assert result.calls[0].reason == "TypeError"
    assert result.calls[0].result is None


def test_confirmation_at_exact_expiry_is_invalid() -> None:
    call = _call(
        tool_name="acknowledgeRisk",
        mode=ToolMode.CONFIRMED_WRITE,
        arguments={"riskId": "risk-1"},
    )
    confirmation = _confirmation(call)
    authority = HMACToolConfirmationAuthority(SIGNING_KEY)

    assert not authority.verify(
        confirmation,
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        now=confirmation.expires_at,
    )


def test_confirmation_is_claimed_only_after_platform_policy_authorizes() -> None:
    claims = _Claims()
    handler = _Handler()
    runtime = _runtime({"acknowledgeRisk": handler}, claims=claims)
    call = _call(
        tool_name="acknowledgeRisk",
        mode=ToolMode.CONFIRMED_WRITE,
        arguments={"riskId": "risk-1"},
    )
    confirmation = _confirmation(call)

    result = runtime.execute(
        _plan(call),
        identity=_identity(roles=frozenset({"driver"})),
        confirmations=(confirmation,),
        now=NOW + timedelta(seconds=1),
    )

    assert result.status is AgentExecutionStatus.DENIED
    assert "role is not authorized" in (result.calls[0].reason or "")
    assert claims.calls == []
    assert handler.calls == []


def test_conflicting_confirmation_claim_denies_before_handler() -> None:
    claims = _Claims(accepted=False)
    handler = _Handler()
    runtime = _runtime({"acknowledgeRisk": handler}, claims=claims)
    call = _call(
        tool_name="acknowledgeRisk",
        mode=ToolMode.CONFIRMED_WRITE,
        arguments={"riskId": "risk-1"},
    )

    result = runtime.execute(
        _plan(call),
        identity=_identity(),
        confirmations=(_confirmation(call),),
        now=NOW + timedelta(seconds=1),
    )

    assert result.status is AgentExecutionStatus.DENIED
    assert result.calls[0].reason == (
        "tool confirmation is already bound to a different invocation"
    )
    assert len(claims.calls) == 1
    assert handler.calls == []


def test_stop_on_failure_false_allows_later_safe_calls() -> None:
    first = _Handler(error=TimeoutError("unavailable"))
    second = _Handler({"value": 2})
    runtime = _runtime(
        {"getDealSummary": first, "getRiskSnapshot": second},
        policy=AgentRuntimePolicy(stop_on_failure=False),
    )
    plan = _plan(
        _call(call_id="call-1", tool_name="getDealSummary"),
        _call(call_id="call-2", tool_name="getRiskSnapshot"),
    )

    result = runtime.execute(plan, identity=_identity(), now=NOW)

    assert result.status is AgentExecutionStatus.FAILED
    assert [call.status for call in result.calls] == [
        ToolInvocationStatus.FAILED,
        ToolInvocationStatus.SUCCEEDED,
    ]
    assert len(second.calls) == 1


@pytest.mark.parametrize(
    ("arguments", "expected_status", "expected_reason"),
    [
        ({"values": [1, 2, 3]}, ToolInvocationStatus.SUCCEEDED, None),
        ({"ratio": 1.25}, ToolInvocationStatus.SUCCEEDED, None),
        ({1: "invalid-key"}, ToolInvocationStatus.FAILED, "TypeError"),
        ({"   ": "blank-key"}, ToolInvocationStatus.FAILED, "ValueError"),
    ],
)
def test_json_contract_edges(
    arguments: Any,
    expected_status: ToolInvocationStatus,
    expected_reason: str | None,
) -> None:
    runtime = _runtime({"getDealSummary": _Handler()})

    result = runtime.execute(
        _plan(_call(arguments=arguments)),
        identity=_identity(),
        now=NOW,
    )

    assert result.calls[0].status is expected_status
    assert result.calls[0].reason == expected_reason


def test_unregistered_confirmation_is_not_needed_for_read_only_calls() -> None:
    claims = _Claims(accepted=False)
    runtime = _runtime({"getDealSummary": _Handler()}, claims=claims)

    result = runtime.execute(_plan(), identity=_identity(), now=NOW)

    assert result.status is AgentExecutionStatus.COMPLETED
    assert claims.calls == []
