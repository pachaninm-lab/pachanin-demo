"""The INFORMATIONAL_ONLY boundary, asserted directly rather than as a side effect.

Owner decision of 26.07.2026: TAI is strictly informational and read-only for every role
in this industrial release. It analyses, explains, shows risks, statuses, evidence and
recommended next steps; the person performs every platform action by hand.

The tests elsewhere in this suite each cover one path and would each keep passing if a
write tool were added next to the ones they exercise. These do not: they quantify over the
whole registry, the whole planner catalogue and the whole argument-contract table, so a
write reintroduced anywhere fails here even if it is never called.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast
from uuid import UUID

import pytest

from tai.agent_runtime import (
    AgentToolPlan,
    HMACToolConfirmationAuthority,
    PlannedToolCall,
    ToolConfirmation,
)
from tai.contracts import IdentityContext, ToolMode, ToolRequest
from tai.orchestration import OrchestrationError, OrchestrationErrorCode, OrchestrationRequest
from tai.policy import (
    INFORMATIONAL_ONLY_MODE,
    PROHIBITED_TOOL_NAMES,
    TOOL_REGISTRY,
    PolicyDenied,
    authorize_tool,
)
from tai.read_tool_contracts import (
    PLATFORM_TOOL_SPECS,
    ReadToolArgumentError,
    normalize_platform_tool_arguments,
    read_tool_names,
)
from tai.tool_planner import _INTENTS, GovernedToolPlanner
from tests.test_orchestration import _identity as _orchestration_identity
from tests.test_orchestration import _runtime as _orchestration_runtime

NOW = datetime(2026, 7, 26, 12, 0, tzinfo=UTC)
TRACE_ID = UUID("10000000-0000-0000-0000-000000000001")
USER_ID = UUID("30000000-0000-0000-0000-000000000003")
TENANT_ID = UUID("40000000-0000-0000-0000-000000000004")
SESSION_ID = UUID("50000000-0000-0000-0000-000000000005")

WRITE_MODES = frozenset(
    {ToolMode.DRAFT, ToolMode.CONFIRMED_WRITE, ToolMode.PRIVILEGED_WRITE}
)
REMOVED_TOOLS = ("prepareCommandDraft", "acknowledgeRisk", "createSupportCase")


def _identity(*, roles: frozenset[str] = frozenset({"operator"})) -> IdentityContext:
    return IdentityContext(
        user_id=USER_ID,
        tenant_id=TENANT_ID,
        session_id=SESSION_ID,
        roles=roles,
        authenticated=True,
        mfa_verified=True,
    )


# --- 1 and 2: every registered tool is READ_ONLY, and write tools number zero ----------


def test_every_registered_tool_is_read_only() -> None:
    assert TOOL_REGISTRY
    for name, definition in TOOL_REGISTRY.items():
        assert definition.mode is ToolMode.READ_ONLY, name
    assert {definition.mode for definition in TOOL_REGISTRY.values()} == {ToolMode.READ_ONLY}
    assert INFORMATIONAL_ONLY_MODE is ToolMode.READ_ONLY


def test_the_number_of_write_tools_is_zero() -> None:
    write_tools = [
        name for name, definition in TOOL_REGISTRY.items() if definition.mode in WRITE_MODES
    ]
    assert len(write_tools) == 0, write_tools

    write_specs = [spec.tool_name for spec in PLATFORM_TOOL_SPECS if spec.mode in WRITE_MODES]
    assert len(write_specs) == 0, write_specs

    write_intents = [intent.tool_name for intent in _INTENTS if intent.mode in WRITE_MODES]
    assert len(write_intents) == 0, write_intents


def test_the_three_removed_tools_are_absent_from_every_registry() -> None:
    for removed in REMOVED_TOOLS:
        assert removed not in TOOL_REGISTRY
        assert removed not in read_tool_names()
        assert removed not in {spec.tool_name for spec in PLATFORM_TOOL_SPECS}
        assert removed not in {intent.tool_name for intent in _INTENTS}


def test_the_registry_and_the_argument_contracts_describe_the_same_ten_tools() -> None:
    """A tool present in one table and not the other is how a write path comes back."""
    assert sorted(TOOL_REGISTRY) == sorted(spec.tool_name for spec in PLATFORM_TOOL_SPECS)
    assert sorted(TOOL_REGISTRY) == sorted(read_tool_names())


# --- 3: user confirmation promotes nothing --------------------------------------------


@pytest.mark.parametrize("mode", sorted(WRITE_MODES, key=lambda value: value.value))
@pytest.mark.parametrize("confirmed", [True, False])
def test_confirmation_does_not_make_a_write_mode_authorized(
    mode: ToolMode,
    confirmed: bool,
) -> None:
    """Item 4 of the boundary: a confirmed write is still not something TAI performs.

    Both values of the confirmation flag are asserted against the same registered tool, so
    the test would fail if confirmation changed the outcome in either direction.
    """
    request = ToolRequest(
        trace_id=TRACE_ID,
        tool_name="getDealSummary",
        arguments={"dealId": "deal-1"},
        requested_mode=mode,
        explicit_user_confirmation=confirmed,
        justification="user asked for it",
    )

    with pytest.raises(PolicyDenied):
        authorize_tool(_identity(), request)


@pytest.mark.parametrize("removed", REMOVED_TOOLS)
@pytest.mark.parametrize("confirmed", [True, False])
def test_confirmation_does_not_make_an_unknown_tool_authorized(
    removed: str,
    confirmed: bool,
) -> None:
    request = ToolRequest(
        trace_id=TRACE_ID,
        tool_name=removed,
        arguments={"dealId": "deal-1"},
        requested_mode=ToolMode.READ_ONLY,
        explicit_user_confirmation=confirmed,
        justification="user asked for it",
    )

    with pytest.raises(PolicyDenied):
        authorize_tool(_identity(), request)


def test_a_prohibited_tool_stays_prohibited_with_confirmation() -> None:
    for name in sorted(PROHIBITED_TOOL_NAMES):
        request = ToolRequest(
            trace_id=TRACE_ID,
            tool_name=name,
            arguments={"dealId": "deal-1"},
            requested_mode=ToolMode.READ_ONLY,
            explicit_user_confirmation=True,
            justification="user asked for it",
        )
        with pytest.raises(PolicyDenied):
            authorize_tool(_identity(), request)


def test_a_read_tool_is_authorized_without_any_confirmation() -> None:
    """The boundary must not be satisfied by denying everything."""
    request = ToolRequest(
        trace_id=TRACE_ID,
        tool_name="getDealSummary",
        arguments={"dealId": "deal-1"},
        requested_mode=ToolMode.READ_ONLY,
        explicit_user_confirmation=False,
    )

    assert authorize_tool(_identity(), request).mode is ToolMode.READ_ONLY


# --- 4: the model cannot form or execute a command -------------------------------------


def _plan_question(planner: GovernedToolPlanner, question: str) -> tuple[PlannedToolCall, ...]:
    request = OrchestrationRequest(
        request_id="informational-only-boundary",
        idempotency_key="-".join(("boundary", "test", "retry", "0001")),
        question=question,
        identity=_identity(),
        requested_at=NOW,
        deadline_at=NOW + timedelta(seconds=30),
    )
    plan = planner.plan(
        request=request,
        grounded=cast(Any, object()),
        trace_id=TRACE_ID,
        now=NOW,
    )
    return plan.calls


COMMAND_ATTEMPTS = (
    "Подготовь черновик команды для сделки №deal-77, действие №accept-quality",
    "Выполни действие №sign-contract по сделке №deal-77",
    "Prepare a command draft for deal_id=deal-77 action_id=accept-quality",
    "Создай заявку в поддержку по сделке №deal-77",
    "Подтверди риск по сделке №deal-77",
    "生成交易 deal-77 的命令草稿",
)


@pytest.mark.parametrize("question", COMMAND_ATTEMPTS)
def test_the_planner_cannot_be_talked_into_forming_a_command(question: str) -> None:
    planner = GovernedToolPlanner(available_tools=frozenset(TOOL_REGISTRY))

    for call in _plan_question(planner, question):
        # A read tool may still legitimately match — several of these name a deal. What
        # must never happen is a call in a write mode, or one carrying an action to take.
        assert call.requested_mode is ToolMode.READ_ONLY
        assert set(call.arguments) <= {"dealId"}


def test_no_planned_call_can_carry_an_action_or_payload_argument() -> None:
    """The argument contracts have nowhere to put an action, for any tool."""
    for spec in PLATFORM_TOOL_SPECS:
        declared = {argument.name for argument in spec.arguments}
        assert "actionId" not in declared, spec.tool_name
        assert "payload" not in declared, spec.tool_name
        assert "command" not in declared, spec.tool_name

    for tool_name in TOOL_REGISTRY:
        for forbidden in ({"actionId": "a-1"}, {"payload": {}}, {"command": "sign"}):
            with pytest.raises(ReadToolArgumentError):
                normalize_platform_tool_arguments(tool_name, {"dealId": "deal-1", **forbidden})


def test_no_command_envelope_schema_survives_in_the_tai_package() -> None:
    """The draft returned a ready-to-POST envelope; no code should still produce one."""
    package = Path(__file__).resolve().parents[1] / "tai"
    offenders = [
        path.relative_to(package).as_posix()
        for path in package.rglob("*.py")
        if "platform.deal-command-draft" in path.read_text(encoding="utf-8")
    ]
    assert offenders == []


def test_the_planner_refuses_a_catalog_containing_anything_but_read_tools() -> None:
    for removed in REMOVED_TOOLS:
        with pytest.raises(ValueError):
            GovernedToolPlanner(available_tools=frozenset({removed}))


# --- the confirmation path refuses rather than executing --------------------------------

CONFIRMATION_SECRET = b"orchestration-confirmation-secret-32-bytes"


def _stale_confirmation() -> ToolConfirmation:
    """A genuine confirmation of the kind the runtime used to mint before this change."""
    authority = HMACToolConfirmationAuthority(CONFIRMATION_SECRET)
    call = PlannedToolCall(
        call_id="stale-confirmation",
        tool_name="acknowledgeRisk",
        arguments={"riskId": "risk-1"},
        requested_mode=ToolMode.CONFIRMED_WRITE,
    )
    return authority.issue(
        call=call,
        trace_id=TRACE_ID,
        identity=_orchestration_identity(),
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=2),
    )


def test_confirm_action_refuses_a_previously_valid_confirmation() -> None:
    """A confirmation minted before this change must not still execute.

    Nothing can produce a prepared action now, so the only callers left are a client
    replaying an older confirmation or a probe. Both are refused, and the refusal names
    the boundary rather than reporting the action as missing — "not found" would invite a
    retry against a path that will never serve anyone.
    """
    runtime, _, _, _ = _orchestration_runtime()

    with pytest.raises(OrchestrationError, match="INFORMATIONAL_ONLY") as raised:
        runtime.confirm_action(
            _stale_confirmation(),
            identity=_orchestration_identity(),
            now=NOW,
        )

    assert raised.value.code is OrchestrationErrorCode.TOOL_PLAN_REJECTED
    assert raised.value.retryable is False


def test_confirm_action_refuses_before_looking_the_action_up() -> None:
    """The refusal does not depend on the store being empty.

    If the check ran after the lookup, a surviving stored action would change the outcome.
    Asserting that a repository which raises on any access is never touched pins the order.
    """

    class _ExplodingStore:
        def get(self, confirmation_id: object) -> object:
            raise AssertionError("prepared action store must not be consulted")

        def claim(self, confirmation_id: object) -> object:
            raise AssertionError("prepared action store must not be consulted")

    runtime, _, _, _ = _orchestration_runtime()
    runtime._prepared_actions = cast(Any, _ExplodingStore())

    with pytest.raises(OrchestrationError, match="INFORMATIONAL_ONLY"):
        runtime.confirm_action(
            _stale_confirmation(),
            identity=_orchestration_identity(),
            now=NOW,
        )


def test_preparing_an_action_refuses_even_when_called_directly() -> None:
    """`_partition_calls` already makes this unreachable; it fails closed regardless."""
    runtime, _, _, _ = _orchestration_runtime()
    call = PlannedToolCall(
        call_id="direct-prepare",
        tool_name="acknowledgeRisk",
        arguments={"riskId": "risk-1"},
        requested_mode=ToolMode.CONFIRMED_WRITE,
    )
    plan = AgentToolPlan(
        trace_id=TRACE_ID,
        plan_id=TRACE_ID,
        calls=(call,),
        generated_at=NOW,
    )

    with pytest.raises(OrchestrationError, match="INFORMATIONAL_ONLY"):
        runtime._prepare_actions(
            plan=plan,
            calls=(call,),
            identity=_orchestration_identity(),
            now=NOW,
        )
