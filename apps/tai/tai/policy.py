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
    "prepareCommandDraft": ToolDefinition(
        name="prepareCommandDraft",
        mode=ToolMode.DRAFT,
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
    "acknowledgeRisk": ToolDefinition(
        name="acknowledgeRisk",
        mode=ToolMode.CONFIRMED_WRITE,
        allowed_roles=frozenset(
            {
                "buyer",
                "seller",
                "logistics",
                "elevator",
                "laboratory",
                "bank",
                "operator",
                "compliance",
            }
        ),
    ),
    "createSupportCase": ToolDefinition(
        name="createSupportCase",
        mode=ToolMode.CONFIRMED_WRITE,
        allowed_roles=frozenset(
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
            }
        ),
    ),
}

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

    if not identity.roles.intersection(definition.allowed_roles):
        raise PolicyDenied("role is not authorized for tool")

    if request.requested_mode != definition.mode:
        raise PolicyDenied("requested tool mode does not match registry")

    if definition.requires_mfa and not identity.mfa_verified:
        raise PolicyDenied("MFA is required")

    write_modes = {ToolMode.CONFIRMED_WRITE, ToolMode.PRIVILEGED_WRITE}
    if definition.mode in write_modes and not request.explicit_user_confirmation:
        raise PolicyDenied("explicit user confirmation required")

    if definition.mode is ToolMode.PRIVILEGED_WRITE and not request.justification:
        raise PolicyDenied("privileged action justification required")

    return definition
