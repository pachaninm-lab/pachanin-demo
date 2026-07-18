from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Protocol


class ModelCapability(StrEnum):
    TEXT_GENERATION = "TEXT_GENERATION"
    RUSSIAN = "RUSSIAN"
    STRUCTURED_OUTPUT = "STRUCTURED_OUTPUT"
    LONG_CONTEXT = "LONG_CONTEXT"
    TOOL_PLANNING = "TOOL_PLANNING"
    VISION = "VISION"


class ModelRuntimeClass(StrEnum):
    CPU = "CPU"
    GPU_SHARED = "GPU_SHARED"
    GPU_DEDICATED = "GPU_DEDICATED"


class ModelProfileStatus(StrEnum):
    ACTIVE = "ACTIVE"
    DRAINING = "DRAINING"
    DISABLED = "DISABLED"
    QUARANTINED = "QUARANTINED"


class ModelRuntimeStatus(StrEnum):
    READY = "READY"
    DEGRADED = "DEGRADED"
    WARMING = "WARMING"
    UNAVAILABLE = "UNAVAILABLE"


class ModelAttemptStatus(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


@dataclass(frozen=True, slots=True)
class LocalModelProfile:
    model_id: str
    revision: str
    artifact_locator: str
    artifact_sha256: str
    license_ref: str
    capabilities: frozenset[ModelCapability]
    maximum_context_tokens: int
    maximum_output_tokens: int
    runtime_class: ModelRuntimeClass
    quantization: str
    routing_priority: int = 100
    status: ModelProfileStatus = ModelProfileStatus.ACTIVE

    def __post_init__(self) -> None:
        if not self.model_id.strip():
            raise ValueError("model_id must not be blank")
        if not self.revision.strip():
            raise ValueError("revision must not be blank")
        if not self.artifact_locator.startswith(("file://", "oci://")):
            raise ValueError("model artifact must use a local file or pinned OCI locator")
        if self.artifact_locator.startswith("oci://") and "@sha256:" not in self.artifact_locator:
            raise ValueError("OCI model artifact must be pinned by digest")
        digest = self.artifact_sha256
        if len(digest) != 64 or digest != digest.lower() or any(
            character not in "0123456789abcdef" for character in digest
        ):
            raise ValueError("artifact_sha256 must be a lowercase SHA-256 digest")
        if not self.license_ref.strip():
            raise ValueError("license_ref must not be blank")
        if ModelCapability.TEXT_GENERATION not in self.capabilities:
            raise ValueError("text generation capability is required")
        if self.maximum_context_tokens < 512:
            raise ValueError("maximum_context_tokens must be at least 512")
        if not 16 <= self.maximum_output_tokens <= self.maximum_context_tokens:
            raise ValueError(
                "maximum_output_tokens must be between 16 and maximum_context_tokens"
            )
        if not self.quantization.strip():
            raise ValueError("quantization must not be blank")
        if not 0 <= self.routing_priority <= 1_000:
            raise ValueError("routing_priority must be between 0 and 1000")


@dataclass(frozen=True, slots=True)
class ModelRuntimeHealth:
    model_id: str
    revision: str
    status: ModelRuntimeStatus
    available_slots: int
    queue_depth: int
    p95_latency_ms: int
    observed_at: datetime
    circuit_open_until: datetime | None = None

    def __post_init__(self) -> None:
        if not self.model_id.strip() or not self.revision.strip():
            raise ValueError("model_id and revision must not be blank")
        if self.available_slots < 0:
            raise ValueError("available_slots must not be negative")
        if self.queue_depth < 0:
            raise ValueError("queue_depth must not be negative")
        if self.p95_latency_ms < 0:
            raise ValueError("p95_latency_ms must not be negative")
        if self.observed_at.utcoffset() is None:
            raise ValueError("observed_at must be timezone-aware")
        if self.circuit_open_until is not None and self.circuit_open_until.utcoffset() is None:
            raise ValueError("circuit_open_until must be timezone-aware")


@dataclass(frozen=True, slots=True)
class ModelRouteRequest:
    request_id: str
    required_capabilities: frozenset[ModelCapability]
    prompt_tokens: int
    requested_output_tokens: int
    now: datetime
    allow_degraded: bool = True
    prefer_cpu: bool = True

    def __post_init__(self) -> None:
        if not self.request_id.strip():
            raise ValueError("request_id must not be blank")
        if not self.required_capabilities:
            raise ValueError("at least one model capability is required")
        if ModelCapability.TEXT_GENERATION not in self.required_capabilities:
            raise ValueError("text generation capability is required")
        if self.prompt_tokens < 1:
            raise ValueError("prompt_tokens must be positive")
        if self.requested_output_tokens < 1:
            raise ValueError("requested_output_tokens must be positive")
        if self.now.utcoffset() is None:
            raise ValueError("now must be timezone-aware")


@dataclass(frozen=True, slots=True)
class ModelRoutingPolicy:
    maximum_candidates: int = 3
    health_ttl: timedelta = timedelta(seconds=45)
    maximum_queue_per_slot: int = 4
    maximum_clock_skew: timedelta = timedelta(seconds=5)

    def __post_init__(self) -> None:
        if not 1 <= self.maximum_candidates <= 10:
            raise ValueError("maximum_candidates must be between 1 and 10")
        if self.health_ttl <= timedelta(0):
            raise ValueError("health_ttl must be positive")
        if self.maximum_queue_per_slot < 0:
            raise ValueError("maximum_queue_per_slot must not be negative")
        if self.maximum_clock_skew < timedelta(0):
            raise ValueError("maximum_clock_skew must not be negative")


@dataclass(frozen=True, slots=True)
class ModelRouteCandidate:
    profile: LocalModelProfile
    health: ModelRuntimeHealth


@dataclass(frozen=True, slots=True)
class ModelRouteDecision:
    route_id: str
    request_id: str
    candidates: tuple[ModelRouteCandidate, ...]
    decided_at: datetime

    @property
    def primary(self) -> ModelRouteCandidate:
        if not self.candidates:
            raise RuntimeError("route decision contains no candidates")
        return self.candidates[0]


@dataclass(frozen=True, slots=True)
class ModelInvocationAttempt:
    model_id: str
    revision: str
    status: ModelAttemptStatus
    reason: str | None


@dataclass(frozen=True, slots=True)
class ModelGenerationResult:
    text: str
    model_id: str
    revision: str
    route_id: str
    attempts: tuple[ModelInvocationAttempt, ...]


class ModelProfileRepository(Protocol):
    def list_profiles(self) -> tuple[LocalModelProfile, ...]: ...


class ModelHealthRepository(Protocol):
    def list_health(self) -> tuple[ModelRuntimeHealth, ...]: ...


class LocalModelInvoker(Protocol):
    def invoke(
        self,
        profile: LocalModelProfile,
        prompt: str,
        *,
        maximum_output_chars: int,
        timeout_seconds: float,
    ) -> str: ...


class ModelRouteUnavailable(RuntimeError):
    pass


class InMemoryModelProfileRepository:
    def __init__(self, profiles: tuple[LocalModelProfile, ...]) -> None:
        identities = {(profile.model_id, profile.revision) for profile in profiles}
        if len(identities) != len(profiles):
            raise ValueError("model profile identity must be unique")
        self._profiles = profiles

    def list_profiles(self) -> tuple[LocalModelProfile, ...]:
        return self._profiles


class InMemoryModelHealthRepository:
    def __init__(self, health: tuple[ModelRuntimeHealth, ...]) -> None:
        identities = {(item.model_id, item.revision) for item in health}
        if len(identities) != len(health):
            raise ValueError("model health identity must be unique")
        self._health = health

    def list_health(self) -> tuple[ModelRuntimeHealth, ...]:
        return self._health


class DeterministicModelRouter:
    """Select only healthy, licensed, local and capability-compatible model runtimes."""

    def __init__(
        self,
        profile_repository: ModelProfileRepository,
        health_repository: ModelHealthRepository,
        policy: ModelRoutingPolicy | None = None,
    ) -> None:
        self._profile_repository = profile_repository
        self._health_repository = health_repository
        self._policy = policy or ModelRoutingPolicy()

    def route(self, request: ModelRouteRequest) -> ModelRouteDecision:
        health = {
            (item.model_id, item.revision): item
            for item in self._health_repository.list_health()
        }
        eligible: list[ModelRouteCandidate] = []
        for profile in self._profile_repository.list_profiles():
            runtime_health = health.get((profile.model_id, profile.revision))
            if runtime_health is None or not self._eligible(profile, runtime_health, request):
                continue
            eligible.append(ModelRouteCandidate(profile=profile, health=runtime_health))
        eligible.sort(key=lambda item: self._sort_key(item, request))
        candidates = tuple(eligible[: self._policy.maximum_candidates])
        if not candidates:
            raise ModelRouteUnavailable("no eligible local model runtime is available")
        route_id = _route_id(request, candidates)
        return ModelRouteDecision(
            route_id=route_id,
            request_id=request.request_id.strip(),
            candidates=candidates,
            decided_at=request.now,
        )

    def _eligible(
        self,
        profile: LocalModelProfile,
        health: ModelRuntimeHealth,
        request: ModelRouteRequest,
    ) -> bool:
        if profile.status is not ModelProfileStatus.ACTIVE:
            return False
        if not request.required_capabilities.issubset(profile.capabilities):
            return False
        if request.requested_output_tokens > profile.maximum_output_tokens:
            return False
        if request.prompt_tokens + request.requested_output_tokens > profile.maximum_context_tokens:
            return False
        if health.status not in {ModelRuntimeStatus.READY, ModelRuntimeStatus.DEGRADED}:
            return False
        if health.status is ModelRuntimeStatus.DEGRADED and not request.allow_degraded:
            return False
        if health.available_slots < 1:
            return False
        if health.circuit_open_until is not None and health.circuit_open_until > request.now:
            return False
        age = request.now - health.observed_at
        if age > self._policy.health_ttl or age < -self._policy.maximum_clock_skew:
            return False
        return not (
            health.queue_depth
            > health.available_slots * self._policy.maximum_queue_per_slot
        )

    @staticmethod
    def _sort_key(
        candidate: ModelRouteCandidate,
        request: ModelRouteRequest,
    ) -> tuple[int, int, int, float, int, str, str]:
        status_rank = 0 if candidate.health.status is ModelRuntimeStatus.READY else 1
        runtime_rank = _runtime_rank(candidate.profile.runtime_class, request.prefer_cpu)
        queue_ratio = candidate.health.queue_depth / candidate.health.available_slots
        return (
            status_rank,
            runtime_rank,
            candidate.profile.routing_priority,
            queue_ratio,
            candidate.health.p95_latency_ms,
            candidate.profile.model_id,
            candidate.profile.revision,
        )


class RoutedLocalModelGateway:
    """Invoke a deterministic local route with bounded fallback and no cloud dependency."""

    def __init__(
        self,
        *,
        router: DeterministicModelRouter,
        invoker: LocalModelInvoker,
        required_capabilities: frozenset[ModelCapability] | None = None,
        timeout_seconds: float = 60.0,
    ) -> None:
        if timeout_seconds <= 0 or timeout_seconds > 600:
            raise ValueError("timeout_seconds must be between 0 and 600")
        self._router = router
        self._invoker = invoker
        self._required_capabilities = required_capabilities or frozenset(
            {ModelCapability.TEXT_GENERATION, ModelCapability.RUSSIAN}
        )
        self._timeout_seconds = timeout_seconds

    def generate(
        self,
        prompt: str,
        *,
        request_id: str,
        now: datetime,
        maximum_output_chars: int,
    ) -> ModelGenerationResult:
        normalized_prompt = prompt.strip()
        if not normalized_prompt:
            raise ValueError("prompt must not be blank")
        if maximum_output_chars < 1:
            raise ValueError("maximum_output_chars must be positive")
        route = self._router.route(
            ModelRouteRequest(
                request_id=request_id,
                required_capabilities=self._required_capabilities,
                prompt_tokens=_token_estimate(normalized_prompt),
                requested_output_tokens=_token_estimate_from_chars(maximum_output_chars),
                now=now,
            )
        )
        attempts: list[ModelInvocationAttempt] = []
        for candidate in route.candidates:
            profile = candidate.profile
            try:
                text = self._invoker.invoke(
                    profile,
                    normalized_prompt,
                    maximum_output_chars=maximum_output_chars,
                    timeout_seconds=self._timeout_seconds,
                ).strip()
            except Exception as error:
                attempts.append(
                    ModelInvocationAttempt(
                        model_id=profile.model_id,
                        revision=profile.revision,
                        status=ModelAttemptStatus.FAILED,
                        reason=type(error).__name__,
                    )
                )
                continue
            if not text:
                attempts.append(
                    ModelInvocationAttempt(
                        model_id=profile.model_id,
                        revision=profile.revision,
                        status=ModelAttemptStatus.FAILED,
                        reason="EMPTY_OUTPUT",
                    )
                )
                continue
            attempts.append(
                ModelInvocationAttempt(
                    model_id=profile.model_id,
                    revision=profile.revision,
                    status=ModelAttemptStatus.SUCCEEDED,
                    reason=None,
                )
            )
            return ModelGenerationResult(
                text=text,
                model_id=profile.model_id,
                revision=profile.revision,
                route_id=route.route_id,
                attempts=tuple(attempts),
            )
        raise ModelRouteUnavailable("all eligible local model runtimes failed")


def _runtime_rank(runtime_class: ModelRuntimeClass, prefer_cpu: bool) -> int:
    if prefer_cpu:
        order = {
            ModelRuntimeClass.CPU: 0,
            ModelRuntimeClass.GPU_SHARED: 1,
            ModelRuntimeClass.GPU_DEDICATED: 2,
        }
    else:
        order = {
            ModelRuntimeClass.GPU_DEDICATED: 0,
            ModelRuntimeClass.GPU_SHARED: 1,
            ModelRuntimeClass.CPU: 2,
        }
    return order[runtime_class]


def _token_estimate(text: str) -> int:
    return max(1, (len(text) + 3) // 4)


def _token_estimate_from_chars(characters: int) -> int:
    return max(1, (characters + 3) // 4)


def _route_id(
    request: ModelRouteRequest,
    candidates: tuple[ModelRouteCandidate, ...],
) -> str:
    payload = {
        "candidates": [
            {
                "model_id": candidate.profile.model_id,
                "revision": candidate.profile.revision,
            }
            for candidate in candidates
        ],
        "prompt_tokens": request.prompt_tokens,
        "request_id": request.request_id.strip(),
        "requested_output_tokens": request.requested_output_tokens,
        "required_capabilities": sorted(
            capability.value for capability in request.required_capabilities
        ),
    }
    canonical = json.dumps(payload, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()
