"""Typed argument contracts for the platform Safe Tools.

The adapter used to forward whatever argument object reached it straight to the
platform API. That let a model shape arbitrary JSON, and it left the platform as
the only thing standing between a generated object and a query.

This module closes that. Every tool the adapter can reach declares its arguments
up front, and :func:`normalize_platform_tool_arguments` is the only way to build
the body the adapter signs. It fails closed on an unknown tool, an unknown
argument, a missing required argument, or a value outside the platform's
portable identifier shape.

Two classes of argument are refused outright, whatever the tool:

* anything naming identity, tenancy, organization, membership or role — those
  are server-derived, and a model must never be able to propose them;
* anything naming a concurrency token, which only belongs to a confirmed write.

Refusing them here means a planner cannot smuggle authority into a tool call.

The registry deliberately mirrors what `apps/api` actually serves in
`TAI_PLATFORM_TOOL_MODES`. Advertising a tool the platform cannot answer would
be a capability that only looks real, so `tests/test_read_tool_contracts.py`
parses the server registry and fails if this one drifts past it.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Final

from tai.contracts import ToolMode

__all__ = [
    "FORBIDDEN_ARGUMENTS",
    "PLATFORM_TOOL_NAMES",
    "PLATFORM_TOOL_SPECS",
    "ArgumentSpec",
    "PlatformToolSpec",
    "ReadToolArgumentError",
    "normalize_platform_tool_arguments",
    "platform_tool_spec",
    "read_tool_names",
]

# The identifier shape the platform accepts, kept identical to the deterministic
# planner's portable-argument rule so a plan that validates there also validates here.
_PORTABLE: Final = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")

_MAX_ARGUMENTS: Final = 8


class ReadToolArgumentError(ValueError):
    """Raised when a tool invocation does not match its declared contract."""


@dataclass(frozen=True, slots=True)
class ArgumentSpec:
    name: str
    required: bool = False


@dataclass(frozen=True, slots=True)
class PlatformToolSpec:
    tool_name: str
    mode: ToolMode
    arguments: tuple[ArgumentSpec, ...]

    def __post_init__(self) -> None:
        names = [argument.name for argument in self.arguments]
        if len(set(names)) != len(names):
            raise ValueError(f"{self.tool_name}: argument names must be unique")
        if len(names) > _MAX_ARGUMENTS:
            raise ValueError(f"{self.tool_name}: too many declared arguments")
        for name in names:
            if name in FORBIDDEN_ARGUMENTS:
                raise ValueError(f"{self.tool_name}: {name} is a server-derived argument")

    def argument(self, name: str) -> ArgumentSpec | None:
        for argument in self.arguments:
            if argument.name == name:
                return argument
        return None


# Server-derived or write-only argument names. A tool may never declare these, and a
# caller may never supply them, so both the registry and every invocation are checked.
FORBIDDEN_ARGUMENTS: Final = frozenset(
    {
        "actor",
        "actorId",
        "actor_id",
        "asUser",
        "as_user",
        "expectedVersion",
        "expected_version",
        "impersonate",
        "membershipId",
        "membership_id",
        "onBehalfOf",
        "on_behalf_of",
        "organizationId",
        "organization_id",
        "role",
        "roles",
        "tenant",
        "tenantId",
        "tenant_id",
        "userId",
        "user_id",
    }
)


PLATFORM_TOOL_SPECS: Final[tuple[PlatformToolSpec, ...]] = (
    PlatformToolSpec(
        "getDealSummary", ToolMode.READ_ONLY, (ArgumentSpec("dealId", required=True),)
    ),
    # No role argument: the platform derives the caller's role from the session.
    PlatformToolSpec(
        "getRoleNextActions", ToolMode.READ_ONLY, (ArgumentSpec("dealId", required=True),)
    ),
    PlatformToolSpec(
        "getDealRisks", ToolMode.READ_ONLY, (ArgumentSpec("dealId", required=True),)
    ),
    # Each optional identifier narrows a collection the caller can already read; it is
    # never a lookup, so an id from another deal yields an empty projection rather than
    # disclosing whether it exists.
    PlatformToolSpec(
        "getDocumentStatus",
        ToolMode.READ_ONLY,
        (ArgumentSpec("dealId", required=True), ArgumentSpec("documentId")),
    ),
    PlatformToolSpec(
        "getLogisticsStatus",
        ToolMode.READ_ONLY,
        (ArgumentSpec("dealId", required=True), ArgumentSpec("shipmentId")),
    ),
    PlatformToolSpec(
        "getLaboratoryStatus",
        ToolMode.READ_ONLY,
        (ArgumentSpec("dealId", required=True), ArgumentSpec("sampleId")),
    ),
    PlatformToolSpec(
        "getMoneyReadiness", ToolMode.READ_ONLY, (ArgumentSpec("dealId", required=True),)
    ),
    PlatformToolSpec(
        "getDisputeStatus",
        ToolMode.READ_ONLY,
        (ArgumentSpec("dealId", required=True), ArgumentSpec("disputeId")),
    ),
    # The platform bounds this response itself; no paging argument is offered, so the
    # caller cannot ask for more than the server chose to return.
    PlatformToolSpec(
        "getEvidenceTimeline", ToolMode.READ_ONLY, (ArgumentSpec("dealId", required=True),)
    ),
    # The one read tool that is not a workspace projection: outbox delivery state is not in
    # the deal workspace, so the platform serves it from its own bounded read on the same
    # membership and RLS authority. It returns delivery metadata only — no event payload,
    # no failure text, no lease identifiers — and bounds the response itself, so like
    # getEvidenceTimeline it offers no paging argument.
    PlatformToolSpec(
        "getIntegrationStatus", ToolMode.READ_ONLY, (ArgumentSpec("dealId", required=True),)
    ),
)

# Owner decision of 26.07.2026: TAI is INFORMATIONAL_ONLY. Every argument contract the
# adapter can normalize must therefore be READ_ONLY. Checked at import so a write spec
# added later cannot reach a signed platform call.
_non_read_specs = tuple(
    spec.tool_name for spec in PLATFORM_TOOL_SPECS if spec.mode is not ToolMode.READ_ONLY
)
if _non_read_specs:  # pragma: no cover - import-time invariant
    raise RuntimeError(
        "TAI is INFORMATIONAL_ONLY: platform tool specs must all be READ_ONLY, found "
        f"{sorted(_non_read_specs)}"
    )
del _non_read_specs


PLATFORM_TOOL_NAMES: Final[tuple[str, ...]] = tuple(
    spec.tool_name for spec in PLATFORM_TOOL_SPECS
)

_SPECS_BY_NAME: Final[Mapping[str, PlatformToolSpec]] = {
    spec.tool_name: spec for spec in PLATFORM_TOOL_SPECS
}


def read_tool_names() -> tuple[str, ...]:
    """The read-only subset of the registry."""
    return tuple(
        spec.tool_name for spec in PLATFORM_TOOL_SPECS if spec.mode is ToolMode.READ_ONLY
    )


def platform_tool_spec(tool_name: str) -> PlatformToolSpec:
    """Return the contract for ``tool_name`` or fail closed."""
    spec = _SPECS_BY_NAME.get(tool_name)
    if spec is None:
        raise ReadToolArgumentError(f"{tool_name} is not a registered platform tool")
    return spec


def normalize_platform_tool_arguments(
    tool_name: str, arguments: Mapping[str, Any]
) -> dict[str, Any]:
    """Validate ``arguments`` against the declared contract and return them canonically.

    Values are returned stripped, so an equivalent request always produces the same
    signed body.
    """
    spec = platform_tool_spec(tool_name)

    for name in arguments:
        if not isinstance(name, str):
            raise ReadToolArgumentError(f"{tool_name}: argument names must be strings")
        if name in FORBIDDEN_ARGUMENTS:
            raise ReadToolArgumentError(
                f"{tool_name}: {name} is server-derived and cannot be supplied by a caller"
            )
        if spec.argument(name) is None:
            raise ReadToolArgumentError(f"{tool_name}: {name} is not a declared argument")

    normalized: dict[str, Any] = {}
    for argument in spec.arguments:
        if argument.name not in arguments:
            if argument.required:
                raise ReadToolArgumentError(f"{tool_name}: {argument.name} is required")
            continue
        normalized[argument.name] = _normalize_identifier(
            tool_name, argument.name, arguments[argument.name]
        )
    return normalized


def _normalize_identifier(tool_name: str, name: str, value: Any) -> str:
    if not isinstance(value, str):
        raise ReadToolArgumentError(f"{tool_name}: {name} must be a portable identifier")
    candidate: str = value.strip()
    if _PORTABLE.fullmatch(candidate) is None:
        raise ReadToolArgumentError(f"{tool_name}: {name} must be a portable identifier")
    return candidate
