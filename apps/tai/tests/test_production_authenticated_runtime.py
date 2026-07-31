from __future__ import annotations

import base64

import pytest

from tai.production_authenticated_runtime import (
    ProductionModelAccess,
    ProductionModelAccessError,
    build_authenticated_production_runtime,
)
from tai.production_runtime import ProductionRuntimeConfig
from tai.secure_model_transport import BearerHTTPClientJSONTransport


def _environment() -> dict[str, str]:
    return {
        "TAI_DATABASE_URL": "postgresql://tai:secret@postgres.internal:5432/tai",
        "TAI_IDENTITY_HMAC_SECRET_B64": base64.b64encode(b"i" * 32).decode(),
        "TAI_CONFIRMATION_HMAC_SECRET_B64": base64.b64encode(b"c" * 32).decode(),
        "TAI_MODEL_ENDPOINTS_JSON": (
            '{"tai-qwen3-8b-q4km@q4km-r1":'
            '"http://192.168.0.206:18080/v1/chat/completions"}'
        ),
        "TAI_ALLOWED_MODEL_HOSTS_JSON": '["192.168.0.206"]',
        "TAI_MODEL_BEARER_TOKEN": "t" * 48,
    }


class _NoConnectFactory:
    def __call__(self) -> object:
        raise AssertionError("production composition must not connect eagerly")


def test_production_model_access_requires_protected_token() -> None:
    access = ProductionModelAccess.from_environment(_environment())
    assert isinstance(access.transport(), BearerHTTPClientJSONTransport)

    missing = _environment()
    del missing["TAI_MODEL_BEARER_TOKEN"]
    with pytest.raises(ProductionModelAccessError, match="required"):
        ProductionModelAccess.from_environment(missing)

    malformed = _environment()
    malformed["TAI_MODEL_BEARER_TOKEN"] = "short"
    with pytest.raises(ProductionModelAccessError, match="invalid"):
        ProductionModelAccess.from_environment(malformed)


def test_authenticated_builder_composes_without_network_or_database_access() -> None:
    environment = _environment()
    config = ProductionRuntimeConfig.from_environment(environment)
    access = ProductionModelAccess.from_environment(environment)

    bundle = build_authenticated_production_runtime(
        config,
        model_access=access,
        connection_factory=_NoConnectFactory(),  # type: ignore[arg-type]
    )

    assert bundle.runtime is not None
    assert bundle.identity_authority is not None
    assert bundle.readiness_probe is not None


def test_authenticated_builder_preserves_optional_tool_handlers() -> None:
    environment = _environment()
    config = ProductionRuntimeConfig.from_environment(environment)
    access = ProductionModelAccess.from_environment(environment)

    bundle = build_authenticated_production_runtime(
        config,
        model_access=access,
        connection_factory=_NoConnectFactory(),  # type: ignore[arg-type]
        tool_handlers={},
    )

    assert bundle.runtime is not None
