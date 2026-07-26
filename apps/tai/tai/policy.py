from __future__ import annotations

from dataclasses import dataclass

from .contracts import IdentityContext, ToolMode, ToolRequest


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    name: str
    mode: ToolMode
    allowed_roles: frozenset[str]
    requires_mfa: bool = False


# These read tools are projections of the one `workspace(dealId, user)` call the platform
# already makes for `getDealSummary`, and the platform resolves membership and RLS on that
# call. So a caller entitled to the summary is, by construction, entitled to any projection
# of it: a narrower role set here would deny a read the same caller can already obtain from
# the summary, which is theatre rather than a control. They share one set for that reason.
#
# `getRoleNextActions` is not in this group. It stays on its own narrower set, unchanged,
# because it answers what the caller should do rather than what the deal contains.
_WORKSPACE_READ_ROLES = frozenset(
    {
        "buyer",
        "seller",
        "logistics",
        "driver",
        "elevator",
        "laboratory",
        "surveyor",
        "bank",
        "operator",
        "compliance",
        "arbitrator",
        "executive",
        "administrator",
        "support",
        "auditor",
    }
)


def _workspace_read_tool(name: str) -> ToolDefinition:
    return ToolDefinition(
        name=name,
        mode=ToolMode.READ_ONLY,
        allowed_roles=_WORKSPACE_READ_ROLES,
    )


TOOL_REGISTRY: dict[str, ToolDefinition] = {
    "getDealSummary": _workspace_read_tool("getDealSummary"),
    "getDealRisks": _workspace_read_tool("getDealRisks"),
    "getDocumentStatus": _workspace_read_tool("getDocumentStatus"),
    "getLogisticsStatus": _workspace_read_tool("getLogisticsStatus"),
    "getLaboratoryStatus": _workspace_read_tool("getLaboratoryStatus"),
    "getMoneyReadiness": _workspace_read_tool("getMoneyReadiness"),
    "getDisputeStatus": _workspace_read_tool("getDisputeStatus"),
    "getEvidenceTimeline": _workspace_read_tool("getEvidenceTimeline"),
    # Not a workspace projection, but gated the same way and for the same reason: the
    # platform resolves the caller's deal membership before reading, and what comes back is
    # delivery metadata about the caller's own deal, never an event payload.
    "getIntegrationStatus": _workspace_read_tool("getIntegrationStatus"),
    # The name says "next actions" and it stays, but under the owner decision it answers
    # what the caller may do — it never prepares, reserves or performs any of it. The
    # answer is a recommendation the person carries out by hand in the platform UI.
    "getRoleNextActions": ToolDefinition(
        name="getRoleNextActions",
        mode=ToolMode.READ_ONLY,
        allowed_roles=frozenset(
            {
                "buyer",
                "seller",
                "logistics",
                "elevator",
                "laboratory",
                "bank",
                "operator",
            }
        ),
    ),
}

# Owner decision of 26.07.2026: TAI is INFORMATIONAL_ONLY / READ_ONLY for every role in
# this industrial release. The registry is checked at import rather than per request, so a
# write tool added later fails the process at composition time instead of being caught —
# or not — by whichever request happens to reach it first.
#
# `prepareCommandDraft` (DRAFT), `acknowledgeRisk` and `createSupportCase`
# (CONFIRMED_WRITE) were removed here rather than disabled behind a flag: a disabled entry
# is a switch, and a switch is a runtime path back to a write.
INFORMATIONAL_ONLY_MODE = ToolMode.READ_ONLY

_non_read_tools = sorted(
    name
    for name, definition in TOOL_REGISTRY.items()
    if definition.mode is not INFORMATIONAL_ONLY_MODE
)
if _non_read_tools:  # pragma: no cover - import-time invariant
    raise RuntimeError(
        "TAI is INFORMATIONAL_ONLY: registry may contain only READ_ONLY tools, found "
        f"{_non_read_tools}"
    )
del _non_read_tools


PROHIBITED_TOOL_NAMES = frozenset(
    {
        "changeRole",
        "changeTenant",
        "selectAuctionWinner",
        "confirmBankOperation",
        "authorizePayout",
        "changeLaboratoryResult",
        "signDocument",
        "closeDispute",
        "deleteAudit",
        "disableSecurity",
        "exportAllTenantData",
    }
)


class PolicyDenied(PermissionError):
    pass


def authorize_tool(identity: IdentityContext, request: ToolRequest) -> ToolDefinition:
    if request.tool_name in PROHIBITED_TOOL_NAMES:
        raise PolicyDenied("tool is prohibited for AI execution")

    definition = TOOL_REGISTRY.get(request.tool_name)
    if definition is None:
        raise PolicyDenied("tool is not registered")

    if not identity.authenticated:
        raise PolicyDenied("authenticated server session required")

    # Both sides of the mode are refused before anything else about the request is
    # considered. The registry side cannot currently be anything but READ_ONLY — the
    # import-time invariant sees to that — but this does not lean on it: if a write
    # definition ever reaches here, it is denied rather than executed.
    #
    # The requested side matters more. A caller asking for DRAFT, CONFIRMED_WRITE or
    # PRIVILEGED_WRITE is refused on the mode itself, so no combination of arguments,
    # roles, MFA or confirmation reaches an authorization. In particular
    # `explicit_user_confirmation` is never consulted: under the owner decision a user
    # confirming an action does not make it an action TAI may take. The person performs it
    # by hand in the platform.
    if definition.mode is not INFORMATIONAL_ONLY_MODE:
        raise PolicyDenied("TAI is INFORMATIONAL_ONLY: registered tool is not READ_ONLY")

    if request.requested_mode is not INFORMATIONAL_ONLY_MODE:
        raise PolicyDenied("TAI is INFORMATIONAL_ONLY: only READ_ONLY may be requested")

    if not identity.roles.intersection(definition.allowed_roles):
        raise PolicyDenied("role is not authorized for tool")

    if request.requested_mode != definition.mode:
        raise PolicyDenied("requested tool mode does not match registry")

    if definition.requires_mfa and not identity.mfa_verified:
        raise PolicyDenied("MFA is required")

    return definition
