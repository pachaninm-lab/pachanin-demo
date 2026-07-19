from __future__ import annotations

from fastapi.testclient import TestClient

from tai.production_entrypoint import create_production_app


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
