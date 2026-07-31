from __future__ import annotations

import base64

from fastapi.testclient import TestClient

from tai.production_entrypoint import create_production_app


def _configured_environment() -> dict[str, str]:
    """A production environment with the platform tool bridge switched on."""
    return {
        "TAI_RUNTIME_MODE": "production",
        "TAI_DATABASE_URL": "postgresql://tai:secret@postgres.internal:5432/tai",
        "TAI_IDENTITY_HMAC_SECRET_B64": base64.b64encode(b"i" * 32).decode(),
        "TAI_CONFIRMATION_HMAC_SECRET_B64": base64.b64encode(b"c" * 32).decode(),
        "TAI_MODEL_ENDPOINTS_JSON": (
            '{"agro@r1":"http://model.svc/v1/chat/completions"}'
        ),
        "TAI_MODEL_BEARER_TOKEN": "t" * 48,
        "TAI_PLATFORM_TOOL_BASE_URL": "http://platform-api.svc",
        "TAI_PLATFORM_TOOL_HMAC_SECRET_B64": base64.b64encode(b"p" * 32).decode(),
    }


def test_production_entrypoint_requires_explicit_mode() -> None:
    response = TestClient(create_production_app({})).get("/health/ready")
    assert response.status_code == 503
    assert response.json()["reasons"] == ["TAI_RUNTIME_MODE_PRODUCTION_REQUIRED"]


def test_production_entrypoint_sanitizes_invalid_environment() -> None:
    response = TestClient(
        create_production_app({"TAI_RUNTIME_MODE": "production"})
    ).get("/health/ready")
    assert response.status_code == 503
    assert response.json()["reasons"] == ["TAI_PRODUCTION_CONFIGURATION_INVALID"]
    assert "TAI_DATABASE_URL" not in response.text


def test_production_entrypoint_rejects_missing_model_access_secret() -> None:
    environment = _configured_environment()
    del environment["TAI_MODEL_BEARER_TOKEN"]

    response = TestClient(create_production_app(environment)).get("/health/ready")

    assert response.status_code == 503
    assert response.json()["reasons"] == ["TAI_PRODUCTION_CONFIGURATION_INVALID"]
    assert "BEARER" not in response.text


def test_production_entrypoint_composes_with_the_platform_bridge_configured() -> None:
    response = TestClient(create_production_app(_configured_environment())).get(
        "/health/ready"
    )

    reasons = response.json()["reasons"]
    assert "TAI_PRODUCTION_COMPOSITION_FAILED" not in reasons
    assert "TAI_PRODUCTION_CONFIGURATION_INVALID" not in reasons
