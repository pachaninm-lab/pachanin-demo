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
from hashlib import sha256
from pathlib import Path
from typing import Any, cast
from uuid import UUID

import pytest

from tai.agent_runtime import AgentExecutionStatus, PlannedToolCall
from tai.contracts import IdentityContext, ToolMode, ToolRequest
from tai.orchestration import (
    CONFIRMATION_DENIAL_REASON_CODE,
    OrchestrationError,
    OrchestrationErrorCode,
    OrchestrationRequest,
    OrchestrationStatus,
)
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


# --- the confirmation path refuses, and the refusal is audited --------------------------
#
# The runtime arrives through fixtures declared in conftest.py. Nothing is imported from
# another test module and nothing is imported from `tests` at all: that is what broke on a
# clean runner, where `tests` is not a package and the `pytest` console script does not put
# the working directory on `sys.path`.


def _legacy_confirmation(harness: Any, make_identity: Any, *, call_id: str = "legacy") -> Any:
    """A confirmation of exactly the kind the runtime minted before the owner decision.

    Genuine, not forged: signed by the server authority, bound to this identity and trace,
    inside its TTL. If anything still executed on a valid confirmation, this would find it.
    """
    call = PlannedToolCall(
        call_id=call_id,
        tool_name="acknowledgeRisk",
        arguments={"riskId": "risk-1"},
        requested_mode=ToolMode.CONFIRMED_WRITE,
    )
    return harness.authority.issue(
        call=call,
        trace_id=TRACE_ID,
        identity=make_identity(),
        issued_at=NOW,
        expires_at=NOW + timedelta(minutes=2),
    )


def test_a_legacy_confirmation_is_denied(
    confirmation_harness: Any,
    make_identity: Any,
) -> None:
    with pytest.raises(OrchestrationError, match="INFORMATIONAL_ONLY") as raised:
        confirmation_harness.runtime.confirm_action(
            _legacy_confirmation(confirmation_harness, make_identity),
            identity=make_identity(),
            now=NOW,
        )

    assert raised.value.code is OrchestrationErrorCode.TOOL_PLAN_REJECTED
    assert raised.value.retryable is False


def test_a_direct_probe_of_the_retained_route_is_denied(
    make_confirmation_harness: Any,
    make_identity: Any,
) -> None:
    """A confirmation the server never issued is refused the same way.

    The route is retained deliberately, so it must refuse rather than disappear — and it
    must not tell a prober whether the confirmation was real. It cannot, because the
    refusal happens before anything is looked up.
    """
    harness = make_confirmation_harness()
    forged = _legacy_confirmation(harness, make_identity, call_id="never-issued")
    object.__setattr__(forged, "signature_sha256", "0" * 64)

    with pytest.raises(OrchestrationError, match="INFORMATIONAL_ONLY"):
        harness.runtime.confirm_action(forged, identity=make_identity(), now=NOW)

    assert len(harness.audit.traces) == 1


def test_exactly_one_denial_event_is_recorded(
    confirmation_harness: Any,
    make_identity: Any,
) -> None:
    with pytest.raises(OrchestrationError):
        confirmation_harness.runtime.confirm_action(
            _legacy_confirmation(confirmation_harness, make_identity),
            identity=make_identity(),
            now=NOW,
        )

    assert len(confirmation_harness.audit.traces) == 1


def test_the_denial_reason_code_and_boundary_are_stable(
    confirmation_harness: Any,
    make_identity: Any,
) -> None:
    """These are queried on, so they must not drift with the wording of the message."""
    with pytest.raises(OrchestrationError):
        confirmation_harness.runtime.confirm_action(
            _legacy_confirmation(confirmation_harness, make_identity),
            identity=make_identity(),
            now=NOW,
        )

    trace = confirmation_harness.audit.traces[0]
    identity = make_identity()
    assert trace.outcome == "DENIED"
    assert trace.denial_reason_code == "CONFIRMATION_DISABLED_BY_OWNER_DECISION"
    assert trace.boundary == "INFORMATIONAL_ONLY"
    assert trace.route_category == "PLATFORM_ACTION_CONFIRMATION"
    assert trace.reason == CONFIRMATION_DENIAL_REASON_CODE
    assert trace.status is OrchestrationStatus.REJECTED
    assert trace.tool_status is AgentExecutionStatus.DENIED
    # Server-derived identifiers only, in identifier form.
    assert trace.user_id == identity.user_id
    assert trace.tenant_id == identity.tenant_id
    assert trace.session_id == identity.session_id
    assert trace.completed_at == NOW
    # Not established anywhere, so recorded as absent rather than guessed.
    assert trace.organization_id is None
    assert trace.release_version is None


def test_the_tool_runtime_is_never_entered(
    make_confirmation_harness: Any,
    make_tool_handler: Any,
    make_identity: Any,
) -> None:
    handler = make_tool_handler()
    harness = make_confirmation_harness(handlers={"acknowledgeRisk": handler})

    with pytest.raises(OrchestrationError):
        harness.runtime.confirm_action(
            _legacy_confirmation(harness, make_identity),
            identity=make_identity(),
            now=NOW,
        )

    assert handler.calls == []
    assert harness.tool_calls() == 0


def test_the_denial_mutates_no_platform_state(
    confirmation_harness: Any,
    make_identity: Any,
) -> None:
    """No prepared action is stored, so nothing is left behind to be confirmed later."""
    confirmation = _legacy_confirmation(confirmation_harness, make_identity)

    with pytest.raises(OrchestrationError):
        confirmation_harness.runtime.confirm_action(
            confirmation,
            identity=make_identity(),
            now=NOW,
        )

    assert confirmation_harness.prepared_actions.get(confirmation.confirmation_id) is None
    assert confirmation_harness.audit.traces[0].prepared_action_count == 0


def test_no_confirmation_token_or_payload_reaches_the_audit(
    confirmation_harness: Any,
    make_identity: Any,
) -> None:
    """An audit row is read by more people than the request was.

    The whole trace is flattened to text and searched, so a secret added to a new field
    later is caught too — not only the fields this test happens to name.
    """
    confirmation = _legacy_confirmation(confirmation_harness, make_identity)

    with pytest.raises(OrchestrationError):
        confirmation_harness.runtime.confirm_action(
            confirmation,
            identity=make_identity(),
            now=NOW,
        )

    trace = confirmation_harness.audit.traces[0]
    rendered = repr(trace)
    for secret in (
        confirmation.signature_sha256,
        str(confirmation.confirmation_id),
        confirmation.call_id,
        confirmation.request_sha256,
        "risk-1",
        "acknowledgeRisk",
    ):
        assert secret not in rendered, secret
    # The confirmation is still correlatable, by digest rather than by token.
    expected = sha256(str(confirmation.confirmation_id).encode("utf-8")).hexdigest()
    assert trace.request_sha256 == expected


def test_a_repeated_attempt_creates_no_action_and_stays_auditable(
    make_confirmation_harness: Any,
    make_tool_handler: Any,
    make_identity: Any,
) -> None:
    """Repeating the refusal mutates nothing, and each attempt is still visible.

    Idempotence here means no platform mutation, not a suppressed audit: repeated probing
    of a disabled route is precisely what an operator needs to be able to count.
    """
    handler = make_tool_handler()
    harness = make_confirmation_harness(handlers={"acknowledgeRisk": handler})
    confirmation = _legacy_confirmation(harness, make_identity)

    for _ in range(3):
        with pytest.raises(OrchestrationError, match="INFORMATIONAL_ONLY"):
            harness.runtime.confirm_action(
                confirmation,
                identity=make_identity(),
                now=NOW,
            )

    assert handler.calls == []
    assert harness.prepared_actions.get(confirmation.confirmation_id) is None
    assert len(harness.audit.traces) == 3
    assert {trace.denial_reason_code for trace in harness.audit.traces} == {
        CONFIRMATION_DENIAL_REASON_CODE
    }
    # Distinct events, not one row overwritten.
    assert len({trace.trace_id for trace in harness.audit.traces}) == 3
