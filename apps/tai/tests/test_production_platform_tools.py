from __future__ import annotations

import base64
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import pytest

from tai.production_platform_tools import production_platform_tool_handlers
from tai.production_runtime import ProductionConfigurationError, ProductionRuntimeConfig

NOW = datetime(2026, 7, 19, 2, 0, tzinfo=UTC)


class _Transport:
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
        del base_url, path, payload, headers, timeout_seconds, maximum_response_bytes
        return {"ok": True}


def _environment() -> dict[str, str]:
    return {
        "TAI_DATABASE_URL": "postgresql://tai:secret@postgres.internal:5432/tai",
        "TAI_IDENTITY_HMAC_SECRET_B64": base64.b64encode(b"i" * 32).decode(),
        "TAI_CONFIRMATION_HMAC_SECRET_B64": base64.b64encode(b"c" * 32).decode(),
        "TAI_MODEL_ENDPOINTS_JSON": (
            '{"agro@r1":"http://model.svc/v1/chat/completions"}'
        ),
    }


def test_platform_tools_are_disabled_when_bridge_is_not_configured() -> None:
    environment = _environment()
    config = ProductionRuntimeConfig.from_environment(environment)
    assert production_platform_tool_handlers(environment, config) == {}


def test_platform_tools_register_safe_tools_and_one_confirmed_handler() -> None:
    environment = _environment()
    environment.update(
        {
            "TAI_PLATFORM_TOOL_BASE_URL": "http://platform-api.svc",
            "TAI_PLATFORM_TOOL_HMAC_SECRET_B64": base64.b64encode(b"p" * 32).decode(),
            "TAI_PLATFORM_TOOL_TIMEOUT_SECONDS": "8",
        }
    )
    config = ProductionRuntimeConfig.from_environment(environment)
    handlers = production_platform_tool_handlers(
        environment,
        config,
        transport=_Transport(),
        clock=lambda: NOW,
    )
    assert set(handlers) == {
        "getDealSummary",
        "getRoleNextActions",
        "prepareCommandDraft",
        "assignLogistics",
    }
    assert "acknowledgeRisk" not in handlers
    assert "createSupportCase" not in handlers


def test_platform_tool_configuration_fails_closed() -> None:
    environment = _environment()
    config = ProductionRuntimeConfig.from_environment(environment)

    environment["TAI_PLATFORM_TOOL_BASE_URL"] = "http://platform-api.svc"
    with pytest.raises(ProductionConfigurationError, match="configured together"):
        production_platform_tool_handlers(environment, config)

    environment["TAI_PLATFORM_TOOL_HMAC_SECRET_B64"] = environment[
        "TAI_IDENTITY_HMAC_SECRET_B64"
    ]
    with pytest.raises(ProductionConfigurationError, match="must differ"):
        production_platform_tool_handlers(environment, config)

    environment["TAI_PLATFORM_TOOL_HMAC_SECRET_B64"] = base64.b64encode(
        b"p" * 32
    ).decode()
    environment["TAI_PLATFORM_TOOL_BASE_URL"] = "https://api.example.com"
    with pytest.raises(ProductionConfigurationError, match="configuration is invalid"):
        production_platform_tool_handlers(environment, config)
