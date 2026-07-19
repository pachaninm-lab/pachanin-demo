from __future__ import annotations

import base64
from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime
from typing import Any

import pytest

from tai.local_model_invoker import LocalEndpointPolicy, StaticModelEndpointResolver
from tai.main import ReadinessStatus
from tai.model_runtime import (
    DeterministicModelRouter,
    LocalModelProfile,
    ModelCapability,
    ModelProfileStatus,
    ModelRuntimeClass,
    ModelRuntimeHealth,
    ModelRuntimeStatus,
)
from tai.production_runtime import (
    ModelEndpointBinding,
    ProductionConfigurationError,
    ProductionReadinessProbe,
    ProductionRuntimeConfig,
    build_production_runtime,
)

NOW = datetime(2026, 7, 19, 1, 0, tzinfo=UTC)


def _environment() -> dict[str, str]:
    return {
        "TAI_DATABASE_URL": "postgresql://tai:secret@postgres.internal:5432/tai",
        "TAI_IDENTITY_HMAC_SECRET_B64": base64.b64encode(b"i" * 32).decode(),
        "TAI_CONFIRMATION_HMAC_SECRET_B64": base64.b64encode(b"c" * 32).decode(),
        "TAI_MODEL_ENDPOINTS_JSON": '{"agro@r1":"http://model.svc/v1/chat/completions"}',
    }


def test_production_config_is_strict_and_local_only() -> None:
    config = ProductionRuntimeConfig.from_environment(_environment())
    assert config.model_endpoints == (
        ModelEndpointBinding("agro", "r1", "http://model.svc/v1/chat/completions"),
    )
    assert config.identity_secret != config.confirmation_secret

    missing = _environment()
    del missing["TAI_DATABASE_URL"]
    with pytest.raises(ProductionConfigurationError, match="TAI_DATABASE_URL"):
        ProductionRuntimeConfig.from_environment(missing)

    public = _environment()
    public["TAI_MODEL_ENDPOINTS_JSON"] = '{"agro@r1":"https://api.example.com/v1"}'
    with pytest.raises(ValueError, match="not local"):
        ProductionRuntimeConfig.from_environment(public)

    reused = _environment()
    reused["TAI_CONFIRMATION_HMAC_SECRET_B64"] = reused[
        "TAI_IDENTITY_HMAC_SECRET_B64"
    ]
    with pytest.raises(ProductionConfigurationError, match="must differ"):
        ProductionRuntimeConfig.from_environment(reused)


class _Cursor(AbstractContextManager["_Cursor"]):
    def __init__(self, rows: list[Mapping[str, Any] | None]) -> None:
        self.rows = rows
        self.query = ""

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        del parameters
        self.query = query

    def fetchone(self) -> Mapping[str, Any] | None:
        return self.rows.pop(0) if self.rows else None


class _Connection(AbstractContextManager["_Connection"]):
    def __init__(self, rows: list[Mapping[str, Any] | None]) -> None:
        self.rows = rows
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        return _Cursor(self.rows)

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class _Factory:
    def __init__(self, rows: list[Mapping[str, Any] | None]) -> None:
        self.rows = rows

    def __call__(self) -> _Connection:
        return _Connection(self.rows)


class _Models:
    def __init__(self, ready: bool = True) -> None:
        self.profile = LocalModelProfile(
            model_id="agro",
            revision="r1",
            artifact_locator="file:///models/agro.gguf",
            artifact_sha256="a" * 64,
            license_ref="Apache-2.0",
            capabilities=frozenset(
                {ModelCapability.TEXT_GENERATION, ModelCapability.RUSSIAN}
            ),
            maximum_context_tokens=4096,
            maximum_output_tokens=512,
            runtime_class=ModelRuntimeClass.CPU,
            quantization="Q4_K_M",
            status=ModelProfileStatus.ACTIVE,
        )
        self.health = ModelRuntimeHealth(
            model_id="agro",
            revision="r1",
            status=ModelRuntimeStatus.READY if ready else ModelRuntimeStatus.UNAVAILABLE,
            available_slots=1 if ready else 0,
            queue_depth=0,
            p95_latency_ms=100,
            observed_at=NOW,
        )

    def list_profiles(self) -> tuple[LocalModelProfile, ...]:
        return (self.profile,)

    def list_health(self) -> tuple[ModelRuntimeHealth, ...]:
        return (self.health,)


def _relations() -> dict[str, str]:
    return {
        name: name
        for name in (
            "tai_retrieval_generations",
            "tai_retrieval_chunks",
            "tai_rag_traces",
            "tai_local_model_profiles",
            "tai_local_model_health",
            "tai_agent_tool_events",
            "tai_tool_confirmation_uses",
            "tai_orchestration_idempotency",
            "tai_prepared_actions",
            "tai_orchestration_traces",
            "tai_runtime_evaluation_observations",
        )
    }


def _probe(*, ready_model: bool = True) -> ProductionReadinessProbe:
    models = _Models(ready=ready_model)
    resolver = StaticModelEndpointResolver(
        {("agro", "r1"): "http://model.svc/v1/chat/completions"}
    )
    return ProductionReadinessProbe(
        connection_factory=_Factory([_relations(), {"active_generation": True}]),
        model_repository=models,  # type: ignore[arg-type]
        router=DeterministicModelRouter(models, models),
        endpoint_resolver=resolver,
        endpoint_policy=LocalEndpointPolicy(),
        tools_enabled=False,
        cache_ttl=__import__("datetime").timedelta(seconds=5),
        clock=lambda: NOW,
    )


def test_production_readiness_requires_schema_knowledge_and_local_model() -> None:
    ready = _probe().check()
    assert ready == ReadinessStatus(
        True,
        {
            "billing": "disabled-by-architecture",
            "knowledge": "ready",
            "local_model": "ready",
            "postgresql": "ready",
            "tools": "disabled-safe",
        },
        (),
    )

    unavailable = _probe(ready_model=False).check()
    assert unavailable.ready is False
    assert "LOCAL_MODEL_UNAVAILABLE" in unavailable.reasons


def test_production_builder_uses_durable_repositories_without_connecting_eagerly() -> None:
    config = ProductionRuntimeConfig.from_environment(_environment())
    bundle = build_production_runtime(
        config,
        connection_factory=_Factory([]),
        clock=lambda: NOW,
    )
    assert bundle.runtime is not None
    assert bundle.identity_authority is not None
    assert bundle.readiness_probe is not None
