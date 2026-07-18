from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from tai.model_runtime import (
    DeterministicModelRouter,
    InMemoryModelHealthRepository,
    InMemoryModelProfileRepository,
    LocalModelProfile,
    ModelAttemptStatus,
    ModelCapability,
    ModelHealthRepository,
    ModelProfileStatus,
    ModelRouteRequest,
    ModelRouteUnavailable,
    ModelRoutingPolicy,
    ModelRuntimeClass,
    ModelRuntimeHealth,
    ModelRuntimeStatus,
    RoutedLocalModelGateway,
)

NOW = datetime(2026, 7, 18, 12, 0, tzinfo=UTC)
CAPABILITIES = frozenset(
    {ModelCapability.TEXT_GENERATION, ModelCapability.RUSSIAN}
)


def _profile(
    model_id: str,
    *,
    revision: str = "r1",
    runtime_class: ModelRuntimeClass = ModelRuntimeClass.CPU,
    priority: int = 100,
    status: ModelProfileStatus = ModelProfileStatus.ACTIVE,
    capabilities: frozenset[ModelCapability] = CAPABILITIES,
    context_tokens: int = 8_192,
    output_tokens: int = 2_048,
) -> LocalModelProfile:
    return LocalModelProfile(
        model_id=model_id,
        revision=revision,
        artifact_locator=f"file:///models/{model_id}.gguf",
        artifact_sha256="a" * 64,
        license_ref="Apache-2.0",
        capabilities=capabilities,
        maximum_context_tokens=context_tokens,
        maximum_output_tokens=output_tokens,
        runtime_class=runtime_class,
        quantization="Q4_K_M",
        routing_priority=priority,
        status=status,
    )


def _health(
    model_id: str,
    *,
    revision: str = "r1",
    status: ModelRuntimeStatus = ModelRuntimeStatus.READY,
    slots: int = 2,
    queue: int = 0,
    latency: int = 100,
    observed_at: datetime = NOW,
    circuit_open_until: datetime | None = None,
) -> ModelRuntimeHealth:
    return ModelRuntimeHealth(
        model_id=model_id,
        revision=revision,
        status=status,
        available_slots=slots,
        queue_depth=queue,
        p95_latency_ms=latency,
        observed_at=observed_at,
        circuit_open_until=circuit_open_until,
    )


def _request(
    *,
    capabilities: frozenset[ModelCapability] = CAPABILITIES,
    prompt_tokens: int = 1_000,
    output_tokens: int = 500,
    allow_degraded: bool = True,
    prefer_cpu: bool = True,
) -> ModelRouteRequest:
    return ModelRouteRequest(
        request_id="request-1",
        required_capabilities=capabilities,
        prompt_tokens=prompt_tokens,
        requested_output_tokens=output_tokens,
        now=NOW,
        allow_degraded=allow_degraded,
        prefer_cpu=prefer_cpu,
    )


def _router(
    profiles: tuple[LocalModelProfile, ...],
    health: tuple[ModelRuntimeHealth, ...],
    policy: ModelRoutingPolicy | None = None,
) -> DeterministicModelRouter:
    return DeterministicModelRouter(
        InMemoryModelProfileRepository(profiles),
        InMemoryModelHealthRepository(health),
        policy,
    )


def test_router_prefers_ready_cpu_then_priority_and_load() -> None:
    cpu = _profile("cpu", runtime_class=ModelRuntimeClass.CPU, priority=200)
    fast_gpu = _profile(
        "gpu-fast",
        runtime_class=ModelRuntimeClass.GPU_DEDICATED,
        priority=1,
    )
    lower_priority_cpu = _profile("cpu-priority", priority=10)
    router = _router(
        (fast_gpu, cpu, lower_priority_cpu),
        (
            _health("gpu-fast", latency=10),
            _health("cpu", latency=20),
            _health("cpu-priority", queue=1, latency=200),
        ),
    )

    decision = router.route(_request())

    assert tuple(item.profile.model_id for item in decision.candidates) == (
        "cpu-priority",
        "cpu",
        "gpu-fast",
    )
    assert decision.primary.profile.model_id == "cpu-priority"
    assert len(decision.route_id) == 64
    assert router.route(_request()) == decision


def test_router_can_prefer_gpu_for_heavy_routes() -> None:
    router = _router(
        (
            _profile("cpu", runtime_class=ModelRuntimeClass.CPU),
            _profile("gpu", runtime_class=ModelRuntimeClass.GPU_DEDICATED),
        ),
        (_health("cpu"), _health("gpu")),
    )

    decision = router.route(_request(prefer_cpu=False))

    assert decision.primary.profile.model_id == "gpu"


def test_router_filters_authority_capacity_health_and_context() -> None:
    profiles = (
        _profile("disabled", status=ModelProfileStatus.DISABLED),
        _profile("wrong-capability", capabilities=frozenset({ModelCapability.TEXT_GENERATION})),
        _profile("small-context", context_tokens=1_200, output_tokens=500),
        _profile("no-health"),
        _profile("warming"),
        _profile("no-slots"),
        _profile("open-circuit"),
        _profile("stale"),
        _profile("future"),
        _profile("overloaded"),
        _profile("eligible"),
    )
    health = (
        _health("disabled"),
        _health("wrong-capability"),
        _health("small-context"),
        _health("warming", status=ModelRuntimeStatus.WARMING),
        _health("no-slots", slots=0),
        _health("open-circuit", circuit_open_until=NOW + timedelta(minutes=1)),
        _health("stale", observed_at=NOW - timedelta(minutes=2)),
        _health("future", observed_at=NOW + timedelta(seconds=10)),
        _health("overloaded", slots=1, queue=5),
        _health("eligible"),
    )

    decision = _router(profiles, health).route(_request())

    assert tuple(item.profile.model_id for item in decision.candidates) == ("eligible",)


def test_degraded_runtime_requires_explicit_policy() -> None:
    router = _router(
        (_profile("degraded"),),
        (_health("degraded", status=ModelRuntimeStatus.DEGRADED),),
    )

    assert router.route(_request(allow_degraded=True)).primary.profile.model_id == "degraded"
    with pytest.raises(ModelRouteUnavailable):
        router.route(_request(allow_degraded=False))


def test_router_respects_candidate_limit_and_output_limit() -> None:
    router = _router(
        (_profile("a"), _profile("b"), _profile("c")),
        (_health("a"), _health("b"), _health("c")),
        ModelRoutingPolicy(maximum_candidates=2),
    )

    decision = router.route(_request())

    assert len(decision.candidates) == 2
    with pytest.raises(ModelRouteUnavailable):
        router.route(_request(output_tokens=4_000))


class _Invoker:
    def __init__(self, outcomes: dict[str, str | Exception]) -> None:
        self.outcomes = outcomes
        self.calls: list[tuple[str, int, float]] = []

    def invoke(
        self,
        profile: LocalModelProfile,
        prompt: str,
        *,
        maximum_output_chars: int,
        timeout_seconds: float,
    ) -> str:
        assert prompt == "grounded prompt"
        self.calls.append((profile.model_id, maximum_output_chars, timeout_seconds))
        outcome = self.outcomes[profile.model_id]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def test_gateway_uses_bounded_fallback_and_reports_actual_model() -> None:
    router = _router(
        (_profile("primary", priority=1), _profile("fallback", priority=2)),
        (_health("primary"), _health("fallback")),
    )
    invoker = _Invoker(
        {"primary": TimeoutError("timeout"), "fallback": " grounded result "}
    )
    gateway = RoutedLocalModelGateway(router=router, invoker=invoker, timeout_seconds=12.0)

    result = gateway.generate(
        " grounded prompt ",
        request_id="request-1",
        now=NOW,
        maximum_output_chars=1_000,
    )

    assert result.text == "grounded result"
    assert result.model_id == "fallback"
    assert result.revision == "r1"
    assert tuple(attempt.status for attempt in result.attempts) == (
        ModelAttemptStatus.FAILED,
        ModelAttemptStatus.SUCCEEDED,
    )
    assert result.attempts[0].reason == "TimeoutError"
    assert invoker.calls == [("primary", 1_000, 12.0), ("fallback", 1_000, 12.0)]


def test_gateway_treats_empty_output_as_failure_and_fails_closed() -> None:
    router = _router(
        (_profile("empty", priority=1), _profile("error", priority=2)),
        (_health("empty"), _health("error")),
    )
    gateway = RoutedLocalModelGateway(
        router=router,
        invoker=_Invoker({"empty": " ", "error": RuntimeError("broken")}),
    )

    with pytest.raises(ModelRouteUnavailable, match="all eligible"):
        gateway.generate(
            "grounded prompt",
            request_id="request-1",
            now=NOW,
            maximum_output_chars=1_000,
        )


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"artifact_locator": "https://cloud.example/model"}, "local file"),
        ({"artifact_locator": "oci://registry/model:latest"}, "pinned"),
        ({"artifact_sha256": "A" * 64}, "artifact_sha256"),
        ({"license_ref": " "}, "license_ref"),
        ({"capabilities": frozenset({ModelCapability.RUSSIAN})}, "text generation"),
        ({"maximum_context_tokens": 511}, "maximum_context_tokens"),
        ({"maximum_output_tokens": 8_193}, "maximum_output_tokens"),
        ({"quantization": " "}, "quantization"),
        ({"routing_priority": 1_001}, "routing_priority"),
    ],
)
def test_profile_validation(change: dict[str, object], message: str) -> None:
    with pytest.raises(ValueError, match=message):
        replace(_profile("model"), **change)


def test_repository_and_request_validation() -> None:
    profile = _profile("model")
    health = _health("model")
    with pytest.raises(ValueError, match="identity"):
        InMemoryModelProfileRepository((profile, profile))
    with pytest.raises(ValueError, match="identity"):
        InMemoryModelHealthRepository((health, health))
    with pytest.raises(ValueError, match="request_id"):
        replace(_request(), request_id=" ")
    with pytest.raises(ValueError, match="capability"):
        replace(_request(), required_capabilities=frozenset())
    with pytest.raises(ValueError, match="text generation"):
        replace(
            _request(),
            required_capabilities=frozenset({ModelCapability.RUSSIAN}),
        )
    with pytest.raises(ValueError, match="prompt_tokens"):
        replace(_request(), prompt_tokens=0)
    with pytest.raises(ValueError, match="requested_output_tokens"):
        replace(_request(), requested_output_tokens=0)


def test_health_and_policy_validation() -> None:
    with pytest.raises(ValueError, match="available_slots"):
        replace(_health("model"), available_slots=-1)
    with pytest.raises(ValueError, match="queue_depth"):
        replace(_health("model"), queue_depth=-1)
    with pytest.raises(ValueError, match="p95_latency_ms"):
        replace(_health("model"), p95_latency_ms=-1)
    with pytest.raises(ValueError, match="maximum_candidates"):
        ModelRoutingPolicy(maximum_candidates=0)
    with pytest.raises(ValueError, match="health_ttl"):
        ModelRoutingPolicy(health_ttl=timedelta(0))
    with pytest.raises(ValueError, match="maximum_queue_per_slot"):
        ModelRoutingPolicy(maximum_queue_per_slot=-1)


def test_gateway_validation() -> None:
    router = _router((_profile("model"),), (_health("model"),))
    invoker = _Invoker({"model": "result"})
    with pytest.raises(ValueError, match="timeout_seconds"):
        RoutedLocalModelGateway(router=router, invoker=invoker, timeout_seconds=0)
    gateway = RoutedLocalModelGateway(router=router, invoker=invoker)
    with pytest.raises(ValueError, match="prompt"):
        gateway.generate(" ", request_id="request", now=NOW, maximum_output_chars=100)
    with pytest.raises(ValueError, match="maximum_output_chars"):
        gateway.generate(
            "prompt",
            request_id="request",
            now=NOW,
            maximum_output_chars=0,
        )
