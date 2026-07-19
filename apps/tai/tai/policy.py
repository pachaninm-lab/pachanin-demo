from __future__ import annotations

from dataclasses import dataclass

from .contracts import IdentityContext, ToolMode, ToolRequest


@dataclass(frozen=True, slots=True)
class ToolDefinition:
    name: str
    mode: ToolMode
    allowed_roles: frozenset[str]
    requires_mfa: bool = False


TOOL_REGISTRY: dict[str, ToolDefinition] = {
    "getDealSummary": ToolDefinition(
        name="getDealSummary",
        mode=ToolMode.READ_ONLY,
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
                "compliance",
                "arbitrator",
                "executive",
                "administrator",
                "support",
                "auditor",
            }
        ),
    ),
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
    "assignLogistics": ToolDefinition(
        name="assignLogistics",
        mode=ToolMode.CONFIRMED_WRITE,
        allowed_roles=frozenset(
            {
                "logistics",
                "operator",
                "administrator",
            }
        ),
        requires_mfa=True,
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
