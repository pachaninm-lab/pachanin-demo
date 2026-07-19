from __future__ import annotations

import base64
import hashlib
import hmac
import json
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import pytest

from tai.agent_runtime import AuthorizedToolInvocation
from tai.contracts import ToolMode
from tai.platform_tools import (
    PlatformSafeToolHandler,
    PlatformToolAssertionAuthority,
    PlatformToolConfigurationError,
    PlatformToolEndpointPolicy,
    canonical_platform_tool_json,
)

NOW = datetime(2026, 7, 19, 2, 0, tzinfo=UTC)
SECRET = b"p" * 32


class _Transport:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    def post_json(
        self,
        *,
        base_url: str,
        path: str,
        payload: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]:
        self.calls.append(
            {
                "base_url": base_url,
                "headers": dict(headers),
                "maximum_response_bytes": maximum_response_bytes,
                "path": path,
                "payload": dict(payload),
                "timeout_seconds": timeout_seconds,
            }
        )
        return {"schemaVersion": "platform.deal-summary.v1", "deal": {"id": "deal-1"}}


def _invocation(
    *,
    tool_name: str = "getDealSummary",
    mode: ToolMode = ToolMode.READ_ONLY,
    arguments: Mapping[str, Any] | None = None,
) -> AuthorizedToolInvocation:
    return AuthorizedToolInvocation(
        trace_id=UUID("44444444-4444-4444-8444-444444444444"),
        plan_id=UUID("66666666-6666-4666-8666-666666666666"),
        call_id="call-1",
        tool_name=tool_name,
        mode=mode,
        arguments=arguments or {"dealId": "deal-1"},
        user_id=UUID("55555555-5555-4555-8555-555555555555"),
        tenant_id=UUID("33333333-3333-4333-8333-333333333333"),
        session_id=UUID("22222222-2222-4222-8222-222222222222"),
        idempotency_key="tai.tool.request.0001",
        requested_at=NOW,
    )


def _decode_assertion(encoded: str) -> tuple[bytes, dict[str, Any]]:
    raw = encoded.encode("ascii")
    canonical = base64.urlsafe_b64decode(raw + b"=" * (-len(raw) % 4))
    decoded = json.loads(canonical)
    assert isinstance(decoded, dict)
    return canonical, decoded


def _handler(transport: _Transport) -> PlatformSafeToolHandler:
    return PlatformSafeToolHandler(
        base_url="http://platform-api.svc",
        assertion_authority=PlatformToolAssertionAuthority(SECRET),
        transport=transport,
        clock=lambda: NOW,
    )


def test_safe_tool_handler_binds_identity_request_and_idempotency() -> None:
    transport = _Transport()

    result = _handler(transport).execute(_invocation())

    assert result["deal"] == {"id": "deal-1"}
    assert len(transport.calls) == 1
    call = transport.calls[0]
    assert call["base_url"] == "http://platform-api.svc"
    assert call["path"] == "/api/internal/tai/tools/getDealSummary"
    assert call["payload"] == {"arguments": {"dealId": "deal-1"}}
    assert call["headers"]["X-Idempotency-Key"] == "tai.tool.request.0001"

    canonical, assertion = _decode_assertion(
        call["headers"]["X-TAI-Tool-Assertion"]
    )
    assert assertion["schema_version"] == "tai.platform-tool.v1"
    assert assertion["audience"] == "platform-api"
    assert assertion["tool_name"] == "getDealSummary"
    assert assertion["mode"] == "READ_ONLY"
    assert assertion["user_id"] == "55555555-5555-4555-8555-555555555555"
    assert assertion["tenant_id"] == "33333333-3333-4333-8333-333333333333"
    assert canonical == canonical_platform_tool_json(assertion).encode()
    expected_signature = hmac.new(SECRET, canonical, hashlib.sha256).hexdigest()
    assert call["headers"]["X-TAI-Tool-Signature"] == expected_signature


def test_confirmed_logistics_handler_is_bound_to_exact_mode_and_arguments() -> None:
    transport = _Transport()
    arguments = {
        "dealId": "deal-1",
        "carrierOrgId": "carrier-1",
        "driverUserId": "driver-1",
        "vehicleId": "vehicle-1",
        "routeFromFacilityId": "facility-1",
        "routeToFacilityId": "facility-2",
        "expectedUpdatedAt": "2026-07-19T01:59:00.000Z",
        "expectedVersion": "7",
    }

    _handler(transport).execute(
        _invocation(
            tool_name="assignLogistics",
            mode=ToolMode.CONFIRMED_WRITE,
            arguments=arguments,
        )
    )

    call = transport.calls[0]
    assert call["path"] == "/api/internal/tai/tools/assignLogistics"
    assert call["payload"] == {"arguments": arguments}
    _, assertion = _decode_assertion(call["headers"]["X-TAI-Tool-Assertion"])
    assert assertion["tool_name"] == "assignLogistics"
    assert assertion["mode"] == "CONFIRMED_WRITE"


def test_safe_tool_handler_rejects_unregistered_or_mode_rebound_tools() -> None:
    handler = _handler(_Transport())

    with pytest.raises(PermissionError, match="not executable"):
        handler.execute(_invocation(tool_name="createSupportCase", mode=ToolMode.CONFIRMED_WRITE))
    with pytest.raises(PermissionError, match="not executable"):
        handler.execute(_invocation(mode=ToolMode.DRAFT))
    with pytest.raises(PermissionError, match="not executable"):
        handler.execute(_invocation(tool_name="assignLogistics", mode=ToolMode.DRAFT))


def test_platform_tool_endpoint_policy_rejects_public_and_pathful_origins() -> None:
    policy = PlatformToolEndpointPolicy()
    assert policy.validate_base_url("http://platform-api.svc") == "http://platform-api.svc"
    with pytest.raises(PlatformToolConfigurationError, match="not local"):
        policy.validate_base_url("https://api.example.com")
    with pytest.raises(PlatformToolConfigurationError, match="origin"):
        policy.validate_base_url("http://platform-api.svc/internal")


def test_platform_tool_contract_rejects_floating_point_arguments() -> None:
    handler = _handler(_Transport())
    invocation = _invocation()
    rebound = AuthorizedToolInvocation(
        trace_id=invocation.trace_id,
        plan_id=invocation.plan_id,
        call_id=invocation.call_id,
        tool_name=invocation.tool_name,
        mode=invocation.mode,
        arguments={"dealId": "deal-1", "amount": 1.5},
        user_id=invocation.user_id,
        tenant_id=invocation.tenant_id,
        session_id=invocation.session_id,
        idempotency_key=invocation.idempotency_key,
        requested_at=invocation.requested_at,
    )
    with pytest.raises(TypeError, match="floating point"):
        handler.execute(rebound)
