from __future__ import annotations

from dataclasses import replace
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
    InMemoryConfirmationUseRepository,
    PlannedToolCall,
    ToolConfirmation,
    ToolExecutorRegistry,
    ToolInvocationStatus,
    agent_plan_sha256,
    tool_request_sha256,
)
from tai.contracts import IdentityContext, ToolMode
from tai.policy import PolicyDenied

NOW = datetime(2026, 7, 18, 14, 0, tzinfo=UTC)
TRACE_ID = UUID("10000000-0000-0000-0000-000000000001")
PLAN_ID = UUID("20000000-0000-0000-0000-000000000002")
USER_ID = UUID("30000000-0000-0000-0000-000000000003")
TENANT_ID = UUID("40000000-0000-0000-0000-000000000004")
SESSION_ID = UUID("50000000-0000-0000-0000-000000000005")
OTHER_ID = UUID("60000000-0000-0000-0000-000000000006")
SECRET = b"confirmation-authority-secret-32-bytes-minimum"


def _identity(
    *,
    roles: frozenset[str] = frozenset({"buyer"}),
    authenticated: bool = True,
    mfa_verified: bool = True,
    user_id: UUID = USER_ID,
    tenant_id: UUID | None = TENANT_ID,
    session_id: UUID = SESSION_ID,
) -> IdentityContext:
    return IdentityContext(
        user_id=user_id,
        tenant_id=tenant_id,
        roles=roles,
        session_id=session_id,
        mfa_verified=mfa_verified,
        authenticated=authenticated,
    )


def _call(
    *,
    call_id: str = "call-1",
    tool_name: str = "getDealSummary",
    arguments: dict[str, Any] | None = None,
    mode: ToolMode = ToolMode.READ_ONLY,
) -> PlannedToolCall:
    return PlannedToolCall(
        call_id=call_id,
        tool_name=tool_name,
        arguments={"dealId": "deal-1"} if arguments is None else arguments,
        requested_mode=mode,
    )


def _plan(*calls: PlannedToolCall, generated_at: datetime = NOW) -> AgentToolPlan:
    return AgentToolPlan(
        trace_id=TRACE_ID,
        plan_id=PLAN_ID,
        calls=calls or (_call(),),
        generated_at=generated_at,
    )


class _Handler:
    def __init__(
        self,
        result: dict[str, Any] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.result = {"status": "ok"} if result is None else result
        self.error = error
        self.calls: list[AuthorizedToolInvocation] = []

    def execute(self, invocation: AuthorizedToolInvocation) -> dict[str, Any]:
        self.calls.append(invocation)
        if self.error is not None:
            raise self.error
        return self.result


class _Audit:
    def __init__(self) -> None:
        self.events: list[AgentAuditEvent] = []

    def record(self, event: AgentAuditEvent) -> None:
        self.events.append(event)


def _runtime(
    handlers: dict[str, _Handler],
    *,
    audit: _Audit | None = None,
    policy: AgentRuntimePolicy | None = None,
    authority: HMACToolConfirmationAuthority | None = None,
) -> AgentToolRuntime:
    return AgentToolRuntime(
        handlers=ToolExecutorRegistry(handlers),
        confirmation_authority=(
            authority or HMACToolConfirmationAuthority(SECRET)
        ),
        confirmation_uses=InMemoryConfirmationUseRepository(),
        audit_sink=audit,
        policy=policy,
    )


def test_read_only_execution_uses_server_identity_and_stable_idempotency() -> None:
    handler = _Handler({"deal": {"status": "ACTIVE"}})
    audit = _Audit()
    runtime = _runtime({"getDealSummary": handler}, audit=audit)
    plan = _plan(_call(arguments={"z": 2, "a": 1}))

    first = runtime.execute(plan, identity=_identity(), now=NOW)
    second = runtime.execute(plan, identity=_identity(), now=NOW)

    assert first.status is AgentExecutionStatus.COMPLETED
    assert first.calls[0].status is ToolInvocationStatus.SUCCEEDED
    assert first.calls[0].result == {"deal": {"status": "ACTIVE"}}
    assert first.calls[0].idempotency_key == second.calls[0].idempotency_key
    assert len(first.calls[0].idempotency_key or "") == 64
    invocation = handler.calls[0]
    assert invocation.user_id == USER_ID
    assert invocation.tenant_id == TENANT_ID
    assert invocation.session_id == SESSION_ID
    assert invocation.arguments == {"a": 1, "z": 2}
    assert invocation.requested_at == NOW
    assert audit.events[0].event_id == audit.events[1].event_id
    assert audit.events[0].result_sha256 == first.calls[0].result_sha256
    assert first.plan_sha256 == agent_plan_sha256(plan)


def test_draft_execution_is_allowed_without_confirmation() -> None:
    handler = _Handler({"draftId": "draft-1"})
    runtime = _runtime({"prepareCommandDraft": handler})
    call = _call(
        tool_name="prepareCommandDraft",
        mode=ToolMode.DRAFT,
        arguments={"command": "assignCarrier"},
    )

    result = runtime.execute(_plan(call), identity=_identity(), now=NOW)

    assert result.status is AgentExecutionStatus.COMPLETED
    assert handler.calls[0].mode is ToolMode.DRAFT


def test_confirmed_write_requires_server_issued_confirmation() -> None:
    handler = _Handler({"acknowledged": True})
    audit = _Audit()
    authority = HMACToolConfirmationAuthority(SECRET)
    runtime = _runtime(
        {"acknowledgeRisk": handler},
        audit=audit,
        authority=authority,
    )
    call = _call(
        tool_name="acknowledgeRisk",
        mode=ToolMode.CONFIRMED_WRITE,
        arguments={"riskId": "risk-1"},
    )
    plan = _plan(call)

    denied = runtime.execute(plan, identity=_identity(), now=NOW)
    confirmation = authority.issue(
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=2),
    )
    accepted = runtime.execute(
        plan,
        identity=_identity(),
        confirmations=(confirmation,),
        now=NOW + timedelta(seconds=1),
    )

    assert denied.status is AgentExecutionStatus.DENIED
    assert denied.calls[0].reason == "server-issued user confirmation required"
    assert accepted.status is AgentExecutionStatus.COMPLETED
    assert accepted.calls[0].status is ToolInvocationStatus.SUCCEEDED
    assert len(handler.calls) == 1
    assert audit.events[0].status is ToolInvocationStatus.DENIED
    assert audit.events[1].status is ToolInvocationStatus.SUCCEEDED


def test_confirmation_is_bound_to_call_identity_session_and_expiry() -> None:
    authority = HMACToolConfirmationAuthority(SECRET)
    call = _call(
        tool_name="acknowledgeRisk",
        mode=ToolMode.CONFIRMED_WRITE,
        arguments={"riskId": "risk-1"},
    )
    confirmation = authority.issue(
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=2),
    )

    assert authority.verify(
        confirmation,
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        now=NOW + timedelta(minutes=1),
    )
    variants = (
        replace(confirmation, call_id="other-call"),
        replace(confirmation, request_sha256="0" * 64),
        replace(confirmation, user_id=OTHER_ID),
        replace(confirmation, tenant_id=OTHER_ID),
        replace(confirmation, session_id=OTHER_ID),
        replace(confirmation, mfa_verified=False),
        replace(confirmation, signature_sha256="0" * 64),
        replace(confirmation, issued_at=NOW + timedelta(minutes=2)),
        replace(confirmation, expires_at=NOW - timedelta(seconds=1)),
        replace(confirmation, expires_at=NOW + timedelta(minutes=10)),
    )
    for variant in variants:
        assert not authority.verify(
            variant,
            call=call,
            trace_id=TRACE_ID,
            identity=_identity(),
            now=NOW + timedelta(minutes=1),
        )
    assert not authority.verify(
        confirmation,
        call=replace(call, arguments={"riskId": "risk-2"}),
        trace_id=TRACE_ID,
        identity=_identity(),
        now=NOW + timedelta(minutes=1),
    )


def test_confirmation_authority_validates_secret_mode_ttl_and_time() -> None:
    with pytest.raises(ValueError, match="32 bytes"):
        HMACToolConfirmationAuthority(b"short")
    with pytest.raises(ValueError, match="maximum_ttl"):
        HMACToolConfirmationAuthority(SECRET, maximum_ttl=timedelta(0))

    authority = HMACToolConfirmationAuthority(SECRET)
    confirmed_call = _call(
        tool_name="acknowledgeRisk",
        mode=ToolMode.CONFIRMED_WRITE,
    )
    with pytest.raises(ValueError, match="confirmed writes"):
        authority.issue(
            call=_call(),
            trace_id=TRACE_ID,
            identity=_identity(),
            issued_at=NOW,
            expires_at=NOW + timedelta(minutes=1),
        )
    with pytest.raises(PolicyDenied, match="authenticated"):
        authority.issue(
            call=confirmed_call,
            trace_id=TRACE_ID,
            identity=_identity(authenticated=False),
            issued_at=NOW,
            expires_at=NOW + timedelta(minutes=1),
        )
    with pytest.raises(ValueError, match="timezone-aware"):
        authority.issue(
            call=confirmed_call,
            trace_id=TRACE_ID,
            identity=_identity(),
            issued_at=datetime(2026, 7, 18, 14, 0),
            expires_at=NOW + timedelta(minutes=1),
        )
    with pytest.raises(ValueError, match="after issue"):
        authority.issue(
            call=confirmed_call,
            trace_id=TRACE_ID,
            identity=_identity(),
            issued_at=NOW,
            expires_at=NOW,
        )
    with pytest.raises(ValueError, match="TTL"):
        authority.issue(
            call=confirmed_call,
            trace_id=TRACE_ID,
            identity=_identity(),
            issued_at=NOW,
            expires_at=NOW + timedelta(minutes=6),
        )


def test_agent_cannot_override_identity_or_control_fields() -> None:
    handler = _Handler()
    audit = _Audit()
    runtime = _runtime({"getDealSummary": handler}, audit=audit)

    for arguments in (
        {"tenant_id": str(OTHER_ID)},
        {"nested": {"roles": ["administrator"]}},
        {"__proto__": {"polluted": True}},
        {"$where": "override"},
    ):
        result = runtime.execute(
            _plan(_call(arguments=arguments)),
            identity=_identity(),
            now=NOW,
        )
        assert result.status is AgentExecutionStatus.DENIED
        assert result.calls[0].status is ToolInvocationStatus.DENIED

    assert handler.calls == []
    assert len(audit.events) == 4


@pytest.mark.parametrize(
    ("call", "identity", "reason"),
    [
        (_call(tool_name="changeTenant"), _identity(), "prohibited"),
        (_call(tool_name="unknownTool"), _identity(), "not registered"),
        (
            _call(tool_name="getRoleNextActions"),
            _identity(roles=frozenset({"driver"})),
            "role is not authorized",
        ),
        (_call(mode=ToolMode.DRAFT), _identity(), "mode does not match"),
        (
            _call(mode=ToolMode.PRIVILEGED_WRITE),
            _identity(),
            "privileged writes",
        ),
    ],
)
def test_platform_policy_denials_are_preserved(
    call: PlannedToolCall,
    identity: IdentityContext,
    reason: str,
) -> None:
    audit = _Audit()
    runtime = _runtime({}, audit=audit)

    result = runtime.execute(_plan(call), identity=identity, now=NOW)

    assert result.status is AgentExecutionStatus.DENIED
    assert reason in (result.calls[0].reason or "")
    assert audit.events[0].reason == result.calls[0].reason


def test_missing_executor_handler_and_handler_failure_fail_closed() -> None:
    missing = _runtime({})
    failing_handler = _Handler(error=TimeoutError("down"))
    failing = _runtime({"getDealSummary": failing_handler})

    missing_result = missing.execute(_plan(), identity=_identity(), now=NOW)
    failing_result = failing.execute(_plan(), identity=_identity(), now=NOW)

    assert missing_result.status is AgentExecutionStatus.FAILED
    assert missing_result.calls[0].reason == "RuntimeError"
    assert failing_result.status is AgentExecutionStatus.FAILED
    assert failing_result.calls[0].reason == "TimeoutError"
    assert failing_result.calls[0].result is None


def test_invalid_or_oversized_results_fail_closed() -> None:
    oversized = _runtime(
        {"getDealSummary": _Handler({"value": "x" * 300})},
        policy=AgentRuntimePolicy(maximum_result_bytes=256),
    )
    invalid = _runtime(
        {"getDealSummary": _Handler({"value": object()})},
    )

    oversized_result = oversized.execute(_plan(), identity=_identity(), now=NOW)
    invalid_result = invalid.execute(_plan(), identity=_identity(), now=NOW)

    assert oversized_result.status is AgentExecutionStatus.FAILED
    assert oversized_result.calls[0].reason == "ValueError"
    assert invalid_result.status is AgentExecutionStatus.FAILED
    assert invalid_result.calls[0].reason == "TypeError"


def test_runtime_stops_or_continues_according_to_policy() -> None:
    second = _Handler()
    first_denied = _call(tool_name="unknownTool", call_id="call-1")
    second_call = _call(call_id="call-2")
    plan = _plan(first_denied, second_call)

    stopped = _runtime({"getDealSummary": second}).execute(
        plan,
        identity=_identity(),
        now=NOW,
    )
    continued = _runtime(
        {"getDealSummary": second},
        policy=AgentRuntimePolicy(stop_on_denial=False),
    ).execute(plan, identity=_identity(), now=NOW)

    assert len(stopped.calls) == 1
    assert stopped.status is AgentExecutionStatus.DENIED
    assert len(continued.calls) == 2
    assert continued.calls[1].status is ToolInvocationStatus.SUCCEEDED
    assert continued.status is AgentExecutionStatus.DENIED


def test_duplicate_confirmations_and_unauthenticated_identity_are_rejected() -> None:
    authority = HMACToolConfirmationAuthority(SECRET)
    call = _call(tool_name="acknowledgeRisk", mode=ToolMode.CONFIRMED_WRITE)
    confirmation = authority.issue(
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=1),
    )
    runtime = _runtime({"acknowledgeRisk": _Handler()}, authority=authority)

    with pytest.raises(ValueError, match="one confirmation"):
        runtime.execute(
            _plan(call),
            identity=_identity(),
            confirmations=(confirmation, confirmation),
            now=NOW,
        )
    with pytest.raises(PolicyDenied, match="authenticated"):
        runtime.execute(
            _plan(),
            identity=_identity(authenticated=False),
            now=NOW,
        )


def test_argument_and_plan_budgets_fail_closed() -> None:
    runtime = _runtime(
        {"getDealSummary": _Handler()},
        policy=AgentRuntimePolicy(
            maximum_calls=1,
            maximum_argument_bytes=256,
            maximum_argument_depth=2,
        ),
    )

    with pytest.raises(ValueError, match="call count"):
        runtime.execute(
            _plan(_call(call_id="one"), _call(call_id="two")),
            identity=_identity(),
            now=NOW,
        )
    oversized = runtime.execute(
        _plan(_call(arguments={"value": "x" * 300})),
        identity=_identity(),
        now=NOW,
    )
    nested = runtime.execute(
        _plan(_call(arguments={"a": {"b": {"c": 1}}})),
        identity=_identity(),
        now=NOW,
    )
    non_finite = runtime.execute(
        _plan(_call(arguments={"value": float("inf")})),
        identity=_identity(),
        now=NOW,
    )
    invalid_value = runtime.execute(
        _plan(_call(arguments={"value": object()})),
        identity=_identity(),
        now=NOW,
    )

    assert oversized.calls[0].reason == "ValueError"
    assert nested.calls[0].reason == "ValueError"
    assert non_finite.calls[0].reason == "ValueError"
    assert invalid_value.calls[0].reason == "TypeError"
    assert all(
        result.status is AgentExecutionStatus.FAILED
        for result in (oversized, nested, non_finite, invalid_value)
    )


def test_identifiers_plan_registry_and_policy_validation() -> None:
    with pytest.raises(ValueError, match="call_id"):
        _call(call_id="bad id")
    with pytest.raises(ValueError, match="tool_name"):
        _call(tool_name="bad tool")
    with pytest.raises(ValueError, match="prohibited mode"):
        _call(mode=ToolMode.PROHIBITED)
    duplicate = _call(call_id="duplicate")
    with pytest.raises(ValueError, match="unique"):
        _plan(duplicate, duplicate)
    with pytest.raises(ValueError, match="timezone-aware"):
        _plan(generated_at=datetime(2026, 7, 18, 14, 0))
    with pytest.raises(ValueError, match="portable"):
        ToolExecutorRegistry({"bad handler": _Handler()})
    with pytest.raises(ValueError, match="maximum_calls"):
        AgentRuntimePolicy(maximum_calls=0)
    with pytest.raises(ValueError, match="maximum_argument_bytes"):
        AgentRuntimePolicy(maximum_argument_bytes=255)
    with pytest.raises(ValueError, match="maximum_result_bytes"):
        AgentRuntimePolicy(maximum_result_bytes=255)
    with pytest.raises(ValueError, match="maximum_argument_depth"):
        AgentRuntimePolicy(maximum_argument_depth=0)
    with pytest.raises(ValueError, match="maximum_confirmation_ttl"):
        AgentRuntimePolicy(maximum_confirmation_ttl=timedelta(0))


def test_empty_plan_and_digests_are_deterministic() -> None:
    empty = AgentToolPlan(
        trace_id=TRACE_ID,
        plan_id=PLAN_ID,
        calls=(),
        generated_at=NOW,
    )
    runtime = _runtime({})

    result = runtime.execute(empty, identity=_identity(), now=NOW)

    assert result.status is AgentExecutionStatus.COMPLETED
    assert result.calls == ()
    assert len(agent_plan_sha256(empty)) == 64
    call = _call(arguments={"b": 2, "a": 1})
    reordered = _call(arguments={"a": 1, "b": 2})
    assert tool_request_sha256(TRACE_ID, call) == tool_request_sha256(
        TRACE_ID,
        reordered,
    )


def test_confirmation_runtime_ttl_and_naive_now_fail_closed() -> None:
    authority = HMACToolConfirmationAuthority(
        SECRET,
        maximum_ttl=timedelta(minutes=10),
    )
    call = _call(tool_name="acknowledgeRisk", mode=ToolMode.CONFIRMED_WRITE)
    confirmation = authority.issue(
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=6),
    )
    runtime = _runtime(
        {"acknowledgeRisk": _Handler()},
        authority=authority,
        policy=AgentRuntimePolicy(maximum_confirmation_ttl=timedelta(minutes=5)),
    )

    result = runtime.execute(
        _plan(call),
        identity=_identity(),
        confirmations=(confirmation,),
        now=NOW + timedelta(minutes=1),
    )

    assert result.status is AgentExecutionStatus.DENIED
    assert result.calls[0].reason == "tool confirmation exceeds runtime TTL"
    with pytest.raises(ValueError, match="timezone-aware"):
        runtime.execute(
            _plan(call),
            identity=_identity(),
            now=datetime(2026, 7, 18, 14, 0),
        )


def test_confirmation_with_naive_timestamp_is_rejected() -> None:
    authority = HMACToolConfirmationAuthority(SECRET)
    call = _call(tool_name="acknowledgeRisk", mode=ToolMode.CONFIRMED_WRITE)
    valid = authority.issue(
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=1),
    )
    naive = ToolConfirmation(
        confirmation_id=valid.confirmation_id,
        call_id=valid.call_id,
        request_sha256=valid.request_sha256,
        user_id=valid.user_id,
        tenant_id=valid.tenant_id,
        session_id=valid.session_id,
        issued_at=datetime(2026, 7, 18, 14, 0),
        expires_at=valid.expires_at,
        mfa_verified=valid.mfa_verified,
        signature_sha256=valid.signature_sha256,
    )

    assert not authority.verify(
        naive,
        call=call,
        trace_id=TRACE_ID,
        identity=_identity(),
        now=NOW,
    )
