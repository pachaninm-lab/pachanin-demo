from uuid import uuid4

import pytest

from tai.contracts import IdentityContext, ToolMode, ToolRequest
from tai.policy import PolicyDenied, authorize_tool


def identity(*roles: str) -> IdentityContext:
    return IdentityContext(
        user_id=uuid4(),
        tenant_id=uuid4(),
        roles=frozenset(roles),
        session_id=uuid4(),
        authenticated=True,
    )


def request(name: str, mode: ToolMode, *, confirmed: bool = False) -> ToolRequest:
    return ToolRequest(
        trace_id=uuid4(),
        tool_name=name,
        arguments={},
        requested_mode=mode,
        explicit_user_confirmation=confirmed,
    )


def test_read_only_tool_is_allowed_for_authorized_role() -> None:
    result = authorize_tool(
        identity("buyer"),
        request("getDealSummary", ToolMode.READ_ONLY),
    )
    assert result.name == "getDealSummary"


def test_unknown_tool_is_denied_by_default() -> None:
    with pytest.raises(PolicyDenied):
        authorize_tool(
            identity("administrator"),
            request("rawSql", ToolMode.READ_ONLY),
        )


def test_prohibited_financial_action_is_always_denied() -> None:
    with pytest.raises(PolicyDenied):
        authorize_tool(
            identity("administrator", "bank"),
            request(
                "authorizePayout",
                ToolMode.PRIVILEGED_WRITE,
                confirmed=True,
            ),
        )


def test_confirmed_write_requires_explicit_confirmation() -> None:
    with pytest.raises(PolicyDenied):
        authorize_tool(
            identity("buyer"),
            request("acknowledgeRisk", ToolMode.CONFIRMED_WRITE),
        )


def test_client_cannot_upgrade_tool_mode() -> None:
    with pytest.raises(PolicyDenied):
        authorize_tool(
            identity("buyer"),
            request(
                "getDealSummary",
                ToolMode.PRIVILEGED_WRITE,
                confirmed=True,
            ),
        )


def test_cross_role_access_is_denied() -> None:
    with pytest.raises(PolicyDenied):
        authorize_tool(
            identity("public"),
            request("getDealSummary", ToolMode.READ_ONLY),
        )
