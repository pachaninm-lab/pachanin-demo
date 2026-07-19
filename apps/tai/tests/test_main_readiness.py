from __future__ import annotations

from typing import cast

from fastapi.testclient import TestClient

from tai.identity_assertion import HMACPlatformIdentityAuthority
from tai.main import ReadinessStatus, create_app
from tai.orchestration import TAIOrchestrationRuntime


class _Probe:
    def __init__(self, status: ReadinessStatus | Exception) -> None:
        self.status = status
        self.calls = 0

    def check(self) -> ReadinessStatus:
        self.calls += 1
        if isinstance(self.status, Exception):
            raise self.status
        return self.status


def _client(probe: _Probe) -> TestClient:
    return TestClient(
        create_app(
            runtime=cast(TAIOrchestrationRuntime, object()),
            identity_authority=HMACPlatformIdentityAuthority(b"i" * 32),
            readiness_probe=probe,
        )
    )

def test_readiness_uses_live_dependency_probe() -> None:
    probe = _Probe(
        ReadinessStatus(
            True,
            {"postgresql": "ready", "local_model": "ready"},
        )
    )
    response = _client(probe).get("/health/ready")
    assert response.status_code == 200
    assert response.json()["components"] == {
        "local_model": "ready",
        "postgresql": "ready",
    }
    assert response.json()["reasons"] == []
    assert probe.calls == 1

def test_readiness_fails_closed_for_dependency_or_probe_failure() -> None:
    dependency = _client(
        _Probe(
            ReadinessStatus(
                False,
                {"postgresql": "unavailable"},
                ("POSTGRESQL_UNAVAILABLE",),
            )
        )
    ).get("/health/ready")
    assert dependency.status_code == 503
    assert dependency.json()["reasons"] == ["POSTGRESQL_UNAVAILABLE"]

    failure = _client(_Probe(RuntimeError("secret detail"))).get("/health/ready")
    assert failure.status_code == 503
    assert failure.json()["reasons"] == ["READINESS_PROBE_FAILED"]
    assert "secret detail" not in failure.text

def test_configuration_error_is_sanitized_and_not_ready() -> None:
    response = TestClient(
        create_app(configuration_error="TAI_PRODUCTION_CONFIGURATION_INVALID")
    ).get("/health/ready")
    assert response.status_code == 503
    assert response.json()["reasons"] == ["TAI_PRODUCTION_CONFIGURATION_INVALID"]
