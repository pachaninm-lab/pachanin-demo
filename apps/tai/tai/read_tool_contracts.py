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
        "prepareCommandDraft",
        ToolMode.DRAFT,
        (ArgumentSpec("dealId", required=True), ArgumentSpec("actionId")),
    ),
)

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
    if isinstance(value, bool) or not isinstance(value, str):
        raise ReadToolArgumentError(f"{tool_name}: {name} must be a portable identifier")
    candidate = value.strip()
    if _PORTABLE.fullmatch(candidate) is None:
        raise ReadToolArgumentError(f"{tool_name}: {name} must be a portable identifier")
    return candidate
