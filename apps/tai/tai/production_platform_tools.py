from __future__ import annotations

import base64
import binascii
import json
from collections.abc import Callable, Mapping
from datetime import datetime

from tai.agent_runtime import ToolHandler
from tai.platform_tools import (
    PlatformToolConfigurationError,
    PlatformToolTransport,
    platform_safe_tool_handlers,
)
from tai.production_runtime import ProductionConfigurationError, ProductionRuntimeConfig


def production_platform_tool_handlers(
    environment: Mapping[str, str],
    config: ProductionRuntimeConfig,
    *,
    transport: PlatformToolTransport | None = None,
    clock: Callable[[], datetime] | None = None,
) -> dict[str, ToolHandler]:
    raw_base_url = environment.get("TAI_PLATFORM_TOOL_BASE_URL", "").strip()
    raw_secret = environment.get("TAI_PLATFORM_TOOL_HMAC_SECRET_B64", "").strip()
    if not raw_base_url and not raw_secret:
        return {}
    if not raw_base_url or not raw_secret:
        raise ProductionConfigurationError(
            "TAI platform tool base URL and HMAC secret must be configured together"
        )
    secret = _decode_secret(raw_secret)
    if secret in {config.identity_secret, config.confirmation_secret}:
        raise ProductionConfigurationError(
            "platform tool secret must differ from identity and confirmation secrets"
        )
    allowed_hosts = _string_set(
        environment.get("TAI_ALLOWED_PLATFORM_TOOL_HOSTS_JSON"),
        {"localhost"},
    )
    timeout_seconds = _number(
        environment.get("TAI_PLATFORM_TOOL_TIMEOUT_SECONDS"),
        10.0,
    )
    try:
        return dict(
            platform_safe_tool_handlers(
                base_url=raw_base_url,
                secret=secret,
                allowed_hosts=frozenset(allowed_hosts),
                timeout_seconds=timeout_seconds,
                transport=transport,
                clock=clock,
            )
        )
    except (TypeError, ValueError, PlatformToolConfigurationError) as error:
        raise ProductionConfigurationError(
            "TAI platform tool configuration is invalid"
        ) from error


def _decode_secret(encoded: str) -> bytes:
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ProductionConfigurationError(
            "TAI_PLATFORM_TOOL_HMAC_SECRET_B64 must be valid base64"
        ) from error
    if len(decoded) < 32:
        raise ProductionConfigurationError(
            "TAI_PLATFORM_TOOL_HMAC_SECRET_B64 must decode to at least 32 bytes"
        )
    return decoded


def _string_set(raw: str | None, default: set[str]) -> set[str]:
    if raw is None or not raw.strip():
        return set(default)
    try:
        decoded = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ProductionConfigurationError(
            "TAI_ALLOWED_PLATFORM_TOOL_HOSTS_JSON is invalid"
        ) from error
    if (
        not isinstance(decoded, list)
        or not decoded
        or any(not isinstance(item, str) or not item.strip() for item in decoded)
    ):
        raise ProductionConfigurationError(
            "TAI allowed platform tool hosts must be a non-empty string array"
        )
    return {item.strip() for item in decoded}


def _number(raw: str | None, default: float) -> float:
    if raw is None or not raw.strip():
        return default
    try:
        value = float(raw)
    except ValueError as error:
        raise ProductionConfigurationError(
            "TAI_PLATFORM_TOOL_TIMEOUT_SECONDS must be numeric"
        ) from error
    if value != value or value in {float("inf"), float("-inf")}:
        raise ProductionConfigurationError(
            "TAI_PLATFORM_TOOL_TIMEOUT_SECONDS must be finite"
        )
    return value
