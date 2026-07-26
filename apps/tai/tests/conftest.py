"""Shared pytest support for the TAI suite.

`conftest.py` is loaded by pytest itself, so it needs no import path of its own and behaves
identically on a developer machine and on a clean runner. That is the point of putting the
shared factories here.

What this replaces: `tests/test_informational_only_boundary.py` imported
`tests.test_orchestration` to borrow its private `_identity` and `_runtime` helpers. That
worked locally and failed on CI with `ModuleNotFoundError: No module named 'tests'`, because
`pyproject.toml` declares `packages = ["tai"]`, `tests/` has no `__init__.py`, and CI runs
the `pytest` console script — which, unlike `python -m pytest`, does not put the working
directory on `sys.path`. Two test modules coupling through a private helper is also the kind
of dependency that breaks in one file when the other is edited, so the fix is a support
layer rather than a path workaround.

Nothing here is importable from the `tai` package, so none of it can reach production.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

import pytest

from tai.agent_runtime import (
    AgentAuditEvent,
    AgentRuntimePolicy,
    AgentToolRuntime,
    AuthorizedToolInvocation,
    HMACToolConfirmationAuthority,
    InMemoryConfirmationUseRepository,
    ToolExecutorRegistry,
)
from tai.contracts import IdentityContext
from tai.orchestration import (
    InMemoryOrchestrationIdempotencyRepository,
    InMemoryPreparedActionRepository,
    OrchestrationTrace,
    TAIOrchestrationRuntime,
)

BOUNDARY_NOW = datetime(2026, 7, 26, 12, 0, tzinfo=UTC)
BOUNDARY_USER_ID = UUID("30000000-0000-0000-0000-000000000003")
BOUNDARY_TENANT_ID = UUID("40000000-0000-0000-0000-000000000004")
BOUNDARY_SESSION_ID = UUID("50000000-0000-0000-0000-000000000005")
BOUNDARY_TRACE_ID = UUID("10000000-0000-0000-0000-000000000001")
BOUNDARY_CONFIRMATION_SECRET = b"orchestration-confirmation-secret-32-bytes"


def build_identity(
    *,
    roles: frozenset[str] = frozenset({"operator"}),
    user_id: UUID = BOUNDARY_USER_ID,
    tenant_id: UUID | None = BOUNDARY_TENANT_ID,
    session_id: UUID = BOUNDARY_SESSION_ID,
    mfa_verified: bool = True,
    authenticated: bool = True,
) -> IdentityContext:
    """A server-derived identity of the shape the orchestration runtime is handed."""
    return IdentityContext(
        user_id=user_id,
        tenant_id=tenant_id,
        session_id=session_id,
        roles=roles,
        mfa_verified=mfa_verified,
        authenticated=authenticated,
    )


class RecordingOrchestrationAudit:
    """Durable-sink stand-in that keeps every trace it is handed, in order."""

    def __init__(self) -> None:
        self.traces: list[OrchestrationTrace] = []

    def record(self, trace: OrchestrationTrace) -> None:
        self.traces.append(trace)


class RecordingToolHandler:
    """Records invocations so a test can assert a tool was never entered."""

    def __init__(self, result: dict[str, Any] | None = None) -> None:
        self.result = result or {"status": "ok"}
        self.calls: list[AuthorizedToolInvocation] = []

    def execute(self, invocation: AuthorizedToolInvocation) -> dict[str, Any]:
        self.calls.append(invocation)
        return self.result


class _NullAgentAudit:
    def record(self, event: AgentAuditEvent) -> None:
        del event


@dataclass
class ConfirmationHarness:
    """Everything a confirmation-boundary test needs, with the side effects observable."""

    runtime: TAIOrchestrationRuntime
    audit: RecordingOrchestrationAudit
    authority: HMACToolConfirmationAuthority
    prepared_actions: InMemoryPreparedActionRepository
    handlers: dict[str, RecordingToolHandler] = field(default_factory=dict)

    def tool_calls(self) -> int:
        return sum(len(handler.calls) for handler in self.handlers.values())


def build_confirmation_harness(
    *,
    handlers: dict[str, RecordingToolHandler] | None = None,
    clock: Callable[[], datetime] = lambda: BOUNDARY_NOW,
) -> ConfirmationHarness:
    """An orchestration runtime wired for the confirmation path only.

    `rag_pipeline` is a stub: `confirm_action` never reaches it, and building a real
    retrieval stack here would make the test depend on machinery it is not about. Anything
    a test needs to observe — the audit sink, the tool handlers, the prepared-action store —
    is real and inspectable.
    """
    selected_handlers = handlers if handlers is not None else {}
    audit = RecordingOrchestrationAudit()
    authority = HMACToolConfirmationAuthority(BOUNDARY_CONFIRMATION_SECRET)
    prepared_actions = InMemoryPreparedActionRepository()
    tool_runtime = AgentToolRuntime(
        handlers=ToolExecutorRegistry(cast(Any, selected_handlers)),
        confirmation_authority=authority,
        confirmation_uses=InMemoryConfirmationUseRepository(),
        audit_sink=_NullAgentAudit(),
        policy=AgentRuntimePolicy(),
    )
    runtime = TAIOrchestrationRuntime(
        rag_pipeline=cast(Any, object()),
        tool_planner=None,
        tool_runtime=tool_runtime,
        confirmation_authority=authority,
        idempotency=InMemoryOrchestrationIdempotencyRepository(),
        prepared_actions=prepared_actions,
        audit_sink=audit,
        clock=clock,
    )
    return ConfirmationHarness(
        runtime=runtime,
        audit=audit,
        authority=authority,
        prepared_actions=prepared_actions,
        handlers=selected_handlers,
    )


# Fixtures are the only supported way for a test module to reach any of the above.
# Importing `tests.conftest` would reintroduce the exact failure this file exists to fix:
# `tests` is not a package, and the `pytest` console script does not put the working
# directory on `sys.path`.


@pytest.fixture
def boundary_now() -> datetime:
    return BOUNDARY_NOW


@pytest.fixture
def boundary_trace_id() -> UUID:
    return BOUNDARY_TRACE_ID


@pytest.fixture
def make_identity() -> Callable[..., IdentityContext]:
    return build_identity


@pytest.fixture
def make_tool_handler() -> Callable[..., RecordingToolHandler]:
    return RecordingToolHandler


@pytest.fixture
def make_confirmation_harness() -> Callable[..., ConfirmationHarness]:
    return build_confirmation_harness


@pytest.fixture
def confirmation_harness() -> ConfirmationHarness:
    return build_confirmation_harness()
