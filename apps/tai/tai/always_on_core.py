"""TAI Agro OS stage-1 always-on runtime controls.

The module adds bounded FIFO admission, explicit backpressure, local-model warm-up,
health observation, circuit recovery and operational health reporting. It does not grant
new tool authority, bypass model admission, or turn model output into authoritative state.
"""

from __future__ import annotations

import asyncio
import math
import time
from collections import deque
from collections.abc import AsyncIterator, Callable, Mapping, Sequence
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol
from uuid import uuid4

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from tai.local_model_invoker import (
    HTTPClientJSONTransport,
    JSONTransport,
    LocalEndpointPolicy,
)
from tai.model_runtime import ModelRuntimeHealth, ModelRuntimeStatus


class AlwaysOnConfigurationError(ValueError):
    """Raised when production always-on controls are configured unsafely."""


class ModelEndpointBinding(Protocol):
    @property
    def model_id(self) -> str: ...

    @property
    def revision(self) -> str: ...

    @property
    def endpoint(self) -> str: ...


class ModelHealthWriter(Protocol):
    def record_health(self, health: ModelRuntimeHealth) -> bool: ...


@dataclass(frozen=True, slots=True)
class AlwaysOnConfig:
    """Bounded operational policy for one TAI process."""

    maximum_inflight: int
    maximum_queue: int = 16
    queue_timeout_seconds: float = 10.0
    supervisor_interval_seconds: float = 30.0
    warmup_timeout_seconds: float = 15.0
    circuit_failure_threshold: int = 3
    circuit_open_seconds: float = 30.0
    latency_window: int = 50

    def __post_init__(self) -> None:
        if isinstance(self.maximum_inflight, bool) or not 1 <= self.maximum_inflight <= 4:
            raise AlwaysOnConfigurationError("maximum_inflight must be between 1 and 4")
        if isinstance(self.maximum_queue, bool) or not 0 <= self.maximum_queue <= 512:
            raise AlwaysOnConfigurationError("maximum_queue must be between 0 and 512")
        if not 0.1 <= self.queue_timeout_seconds <= 120:
            raise AlwaysOnConfigurationError("queue timeout must be between 0.1 and 120 seconds")
        if not 5 <= self.supervisor_interval_seconds <= 300:
            raise AlwaysOnConfigurationError(
                "supervisor interval must be between 5 and 300 seconds"
            )
        if not 1 <= self.warmup_timeout_seconds <= 120:
            raise AlwaysOnConfigurationError("warm-up timeout must be between 1 and 120 seconds")
        if not 1 <= self.circuit_failure_threshold <= 20:
            raise AlwaysOnConfigurationError(
                "circuit failure threshold must be between 1 and 20"
            )
        if not 5 <= self.circuit_open_seconds <= 600:
            raise AlwaysOnConfigurationError(
                "circuit open period must be between 5 and 600 seconds"
            )
        if not 5 <= self.latency_window <= 500:
            raise AlwaysOnConfigurationError("latency window must be between 5 and 500")

    @classmethod
    def from_environment(
        cls,
        source: Mapping[str, str],
        *,
        maximum_inflight: int,
    ) -> AlwaysOnConfig:
        return cls(
            maximum_inflight=maximum_inflight,
            maximum_queue=_integer(source, "TAI_MODEL_MAX_QUEUE", 16),
            queue_timeout_seconds=_number(
                source,
                "TAI_MODEL_QUEUE_TIMEOUT_SECONDS",
                10.0,
            ),
            supervisor_interval_seconds=_number(
                source,
                "TAI_MODEL_SUPERVISOR_INTERVAL_SECONDS",
                30.0,
            ),
            warmup_timeout_seconds=_number(
                source,
                "TAI_MODEL_WARMUP_TIMEOUT_SECONDS",
                15.0,
            ),
            circuit_failure_threshold=_integer(
                source,
                "TAI_MODEL_CIRCUIT_FAILURE_THRESHOLD",
                3,
            ),
            circuit_open_seconds=_number(source, "TAI_MODEL_CIRCUIT_OPEN_SECONDS", 30.0),
            latency_window=_integer(source, "TAI_MODEL_LATENCY_WINDOW", 50),
        )


@dataclass(frozen=True, slots=True)
class RuntimePressureSnapshot:
    active: int
    queued: int
    maximum_inflight: int
    maximum_queue: int
    admitted_total: int
    rejected_total: int
    timed_out_total: int

    def to_json_object(self) -> dict[str, int]:
        return {
            "active": self.active,
            "admitted_total": self.admitted_total,
            "maximum_inflight": self.maximum_inflight,
            "maximum_queue": self.maximum_queue,
            "queued": self.queued,
            "rejected_total": self.rejected_total,
            "timed_out_total": self.timed_out_total,
        }


class AlwaysOnCapacityExceeded(RuntimeError):
    def __init__(self, *, reason: str, retry_after_seconds: int) -> None:
        super().__init__("TAI model admission capacity is exhausted")
        self.reason = reason
        self.retry_after_seconds = retry_after_seconds


class AsyncModelAdmissionGate:
    """FIFO process-local admission with a bounded wait queue and explicit overload."""

    def __init__(self, config: AlwaysOnConfig) -> None:
        self._config = config
        self._condition = asyncio.Condition()
        self._active = 0
        self._waiters: deque[int] = deque()
        self._next_ticket = 1
        self._admitted_total = 0
        self._rejected_total = 0
        self._timed_out_total = 0

    @asynccontextmanager
    async def admit(self) -> AsyncIterator[None]:
        await self._acquire()
        try:
            yield
        finally:
            await self._release()

    async def snapshot(self) -> RuntimePressureSnapshot:
        async with self._condition:
            return self._snapshot_locked()

    async def _acquire(self) -> None:
        loop = asyncio.get_running_loop()
        deadline = loop.time() + self._config.queue_timeout_seconds
        ticket: int | None = None
        async with self._condition:
            if self._active < self._config.maximum_inflight and not self._waiters:
                self._active += 1
                self._admitted_total += 1
                return
            if len(self._waiters) >= self._config.maximum_queue:
                self._rejected_total += 1
                raise AlwaysOnCapacityExceeded(
                    reason="QUEUE_FULL",
                    retry_after_seconds=max(1, math.ceil(self._config.queue_timeout_seconds)),
                )
            ticket = self._next_ticket
            self._next_ticket += 1
            self._waiters.append(ticket)
            try:
                while True:
                    remaining = deadline - loop.time()
                    if remaining <= 0:
                        self._remove_waiter_locked(ticket)
                        self._timed_out_total += 1
                        self._condition.notify_all()
                        raise AlwaysOnCapacityExceeded(
                            reason="QUEUE_TIMEOUT",
                            retry_after_seconds=1,
                        )
                    try:
                        await asyncio.wait_for(self._condition.wait(), timeout=remaining)
                    except TimeoutError as error:
                        self._remove_waiter_locked(ticket)
                        self._timed_out_total += 1
                        self._condition.notify_all()
                        raise AlwaysOnCapacityExceeded(
                            reason="QUEUE_TIMEOUT",
                            retry_after_seconds=1,
                        ) from error
                    if (
                        self._waiters
                        and self._waiters[0] == ticket
                        and self._active < self._config.maximum_inflight
                    ):
                        self._waiters.popleft()
                        self._active += 1
                        self._admitted_total += 1
                        return
            except asyncio.CancelledError:
                self._remove_waiter_locked(ticket)
                self._condition.notify_all()
                raise

    async def _release(self) -> None:
        async with self._condition:
            if self._active < 1:
                raise RuntimeError("TAI model admission gate released without an active permit")
            self._active -= 1
            self._condition.notify_all()

    def _remove_waiter_locked(self, ticket: int) -> None:
        try:
            self._waiters.remove(ticket)
        except ValueError:
            return

    def _snapshot_locked(self) -> RuntimePressureSnapshot:
        return RuntimePressureSnapshot(
            active=self._active,
            queued=len(self._waiters),
            maximum_inflight=self._config.maximum_inflight,
            maximum_queue=self._config.maximum_queue,
            admitted_total=self._admitted_total,
            rejected_total=self._rejected_total,
            timed_out_total=self._timed_out_total,
        )


class AlwaysOnBackpressureMiddleware:
    """Apply the bounded model queue only to the answer-generation route."""

    def __init__(self, app: ASGIApp, *, gate: AsyncModelAdmissionGate) -> None:
        self._app = app
        self._gate = gate

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or scope.get("path") != "/v1/platform/answer"
        ):
            await self._app(scope, receive, send)
            return
        try:
            async with self._gate.admit():
                await self._app(scope, receive, send)
        except AlwaysOnCapacityExceeded as error:
            response = JSONResponse(
                status_code=503,
                content={
                    "schema_version": "tai.error.v1",
                    "error_id": str(uuid4()),
                    "request_id": None,
                    "code": "TAI_CAPACITY_BUSY",
                    "message": "TAI is processing the maximum safe workload. Retry shortly.",
                    "retryable": True,
                    "retry_after_seconds": error.retry_after_seconds,
                },
                headers={
                    "Cache-Control": "no-store",
                    "Retry-After": str(error.retry_after_seconds),
                },
            )
            await response(scope, receive, send)


@dataclass(slots=True)
class _ModelState:
    status: ModelRuntimeStatus = ModelRuntimeStatus.WARMING
    consecutive_failures: int = 0
    circuit_open_until: datetime | None = None
    last_probe_at: datetime | None = None
    last_success_at: datetime | None = None
    latencies_ms: deque[int] = field(default_factory=deque)


@dataclass(frozen=True, slots=True)
class AlwaysOnSupervisorSnapshot:
    status: ModelRuntimeStatus
    runtime_count: int
    ready_count: int
    degraded_count: int
    warming_count: int
    unavailable_count: int
    warmup_total: int
    warmup_success_total: int
    warmup_failure_total: int
    repository_failure_total: int
    last_probe_at: datetime | None

    def to_json_object(self) -> dict[str, object]:
        return {
            "degraded_count": self.degraded_count,
            "last_probe_at": (
                None if self.last_probe_at is None else self.last_probe_at.isoformat()
            ),
            "ready_count": self.ready_count,
            "repository_failure_total": self.repository_failure_total,
            "runtime_count": self.runtime_count,
            "status": self.status.value.lower(),
            "unavailable_count": self.unavailable_count,
            "warming_count": self.warming_count,
            "warmup_failure_total": self.warmup_failure_total,
            "warmup_success_total": self.warmup_success_total,
            "warmup_total": self.warmup_total,
        }


class AlwaysOnModelSupervisor:
    """Warm local models, persist live health and recover open circuits automatically."""

    def __init__(
        self,
        *,
        config: AlwaysOnConfig,
        bindings: Sequence[ModelEndpointBinding],
        gate: AsyncModelAdmissionGate,
        model_repository: ModelHealthWriter,
        endpoint_policy: LocalEndpointPolicy,
        transport: JSONTransport | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        if not bindings:
            raise AlwaysOnConfigurationError("at least one model endpoint binding is required")
        identities = {(item.model_id, item.revision) for item in bindings}
        if len(identities) != len(bindings):
            raise AlwaysOnConfigurationError("model endpoint bindings must be unique")
        self._config = config
        self._bindings = tuple(bindings)
        self._gate = gate
        self._model_repository = model_repository
        self._endpoint_policy = endpoint_policy
        self._transport = transport or HTTPClientJSONTransport()
        self._clock = clock or (lambda: datetime.now(UTC))
        self._states = {identity: _ModelState() for identity in identities}
        self._run_lock = asyncio.Lock()
        self._state_lock = asyncio.Lock()
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task[None] | None = None
        self._warmup_total = 0
        self._warmup_success_total = 0
        self._warmup_failure_total = 0
        self._repository_failure_total = 0

    async def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stop_event.clear()
        await self.run_once()
        self._task = asyncio.create_task(self._run_loop(), name="tai-model-supervisor")

    async def stop(self) -> None:
        self._stop_event.set()
        task = self._task
        self._task = None
        if task is not None:
            await task

    async def run_once(self) -> None:
        async with self._run_lock:
            for binding in self._bindings:
                await self._observe_binding(binding)

    async def snapshot(self) -> AlwaysOnSupervisorSnapshot:
        async with self._state_lock:
            states = tuple(self._states.values())
            counts = {status: 0 for status in ModelRuntimeStatus}
            last_probe_at: datetime | None = None
            for state in states:
                counts[state.status] += 1
                if state.last_probe_at is not None and (
                    last_probe_at is None or state.last_probe_at > last_probe_at
                ):
                    last_probe_at = state.last_probe_at
            aggregate = _aggregate_status(counts)
            return AlwaysOnSupervisorSnapshot(
                status=aggregate,
                runtime_count=len(states),
                ready_count=counts[ModelRuntimeStatus.READY],
                degraded_count=counts[ModelRuntimeStatus.DEGRADED],
                warming_count=counts[ModelRuntimeStatus.WARMING],
                unavailable_count=counts[ModelRuntimeStatus.UNAVAILABLE],
                warmup_total=self._warmup_total,
                warmup_success_total=self._warmup_success_total,
                warmup_failure_total=self._warmup_failure_total,
                repository_failure_total=self._repository_failure_total,
                last_probe_at=last_probe_at,
            )

    async def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(),
                    timeout=self._config.supervisor_interval_seconds,
                )
            except TimeoutError:
                await self.run_once()

    async def _observe_binding(self, binding: ModelEndpointBinding) -> None:
        now = self._clock()
        identity = (binding.model_id, binding.revision)
        pressure = await self._gate.snapshot()
        health_without_probe: ModelRuntimeHealth | None = None
        async with self._state_lock:
            state = self._states[identity]
            if state.circuit_open_until is not None and state.circuit_open_until > now:
                state.status = ModelRuntimeStatus.UNAVAILABLE
                state.last_probe_at = now
                health_without_probe = self._health(binding, state, pressure, now)
            elif pressure.active > 0 or pressure.queued > 0:
                state.last_probe_at = now
                if state.last_success_at is None:
                    state.status = ModelRuntimeStatus.WARMING
                elif state.consecutive_failures > 0:
                    state.status = ModelRuntimeStatus.DEGRADED
                else:
                    state.status = ModelRuntimeStatus.READY
                health_without_probe = self._health(binding, state, pressure, now)
        if health_without_probe is not None:
            await self._record_health(health_without_probe)
            return

        started = time.perf_counter()
        self._warmup_total += 1
        try:
            endpoint = self._endpoint_policy.validate(binding.endpoint)
            response = await asyncio.to_thread(
                self._transport.post_json,
                endpoint,
                _warmup_payload(binding.model_id),
                timeout_seconds=self._config.warmup_timeout_seconds,
                maximum_response_bytes=self._endpoint_policy.maximum_response_bytes,
            )
            _validate_warmup_response(response)
        except Exception:
            await self._record_failure(binding, pressure, now)
            return
        latency_ms = max(0, round((time.perf_counter() - started) * 1_000))
        await self._record_success(binding, pressure, now, latency_ms)

    async def _record_success(
        self,
        binding: ModelEndpointBinding,
        pressure: RuntimePressureSnapshot,
        now: datetime,
        latency_ms: int,
    ) -> None:
        identity = (binding.model_id, binding.revision)
        async with self._state_lock:
            state = self._states[identity]
            state.status = ModelRuntimeStatus.READY
            state.consecutive_failures = 0
            state.circuit_open_until = None
            state.last_probe_at = now
            state.last_success_at = now
            state.latencies_ms.append(latency_ms)
            while len(state.latencies_ms) > self._config.latency_window:
                state.latencies_ms.popleft()
            self._warmup_success_total += 1
            health = self._health(binding, state, pressure, now)
        await self._record_health(health)

    async def _record_failure(
        self,
        binding: ModelEndpointBinding,
        pressure: RuntimePressureSnapshot,
        now: datetime,
    ) -> None:
        identity = (binding.model_id, binding.revision)
        async with self._state_lock:
            state = self._states[identity]
            state.consecutive_failures += 1
            state.last_probe_at = now
            self._warmup_failure_total += 1
            if state.consecutive_failures >= self._config.circuit_failure_threshold:
                state.status = ModelRuntimeStatus.UNAVAILABLE
                state.circuit_open_until = now + timedelta(
                    seconds=self._config.circuit_open_seconds
                )
            elif state.last_success_at is not None:
                state.status = ModelRuntimeStatus.DEGRADED
            else:
                state.status = ModelRuntimeStatus.WARMING
            health = self._health(binding, state, pressure, now)
        await self._record_health(health)

    def _health(
        self,
        binding: ModelEndpointBinding,
        state: _ModelState,
        pressure: RuntimePressureSnapshot,
        observed_at: datetime,
    ) -> ModelRuntimeHealth:
        routable = state.status in {ModelRuntimeStatus.READY, ModelRuntimeStatus.DEGRADED}
        return ModelRuntimeHealth(
            model_id=binding.model_id,
            revision=binding.revision,
            status=state.status,
            available_slots=self._config.maximum_inflight if routable else 0,
            queue_depth=pressure.queued,
            p95_latency_ms=_p95(tuple(state.latencies_ms)),
            observed_at=observed_at,
            circuit_open_until=state.circuit_open_until,
        )

    async def _record_health(self, health: ModelRuntimeHealth) -> None:
        try:
            await asyncio.to_thread(self._model_repository.record_health, health)
        except Exception:
            async with self._state_lock:
                self._repository_failure_total += 1


def install_always_on_core(
    app: FastAPI,
    *,
    gate: AsyncModelAdmissionGate,
    supervisor: AlwaysOnModelSupervisor,
) -> None:
    """Install middleware, lifecycle hooks and a non-secret operational endpoint."""

    app.add_middleware(AlwaysOnBackpressureMiddleware, gate=gate)
    app.add_event_handler("startup", supervisor.start)
    app.add_event_handler("shutdown", supervisor.stop)

    async def runtime_health() -> JSONResponse:
        pressure = await gate.snapshot()
        supervised = await supervisor.snapshot()
        healthy = supervised.status in {
            ModelRuntimeStatus.READY,
            ModelRuntimeStatus.DEGRADED,
        }
        return JSONResponse(
            status_code=200 if healthy else 503,
            content={
                "status": "ready" if healthy else "not_ready",
                "pressure": pressure.to_json_object(),
                "supervisor": supervised.to_json_object(),
            },
            headers={"Cache-Control": "no-store"},
        )

    app.add_api_route(
        "/health/runtime",
        runtime_health,
        methods=["GET"],
        include_in_schema=False,
    )


def _warmup_payload(model_id: str) -> dict[str, object]:
    return {
        "chat_template_kwargs": {"enable_thinking": False},
        "max_tokens": 8,
        "messages": [
            {
                "content": "Return exactly READY.",
                "role": "user",
            }
        ],
        "model": model_id,
        "seed": 0,
        "stream": False,
        "temperature": 0,
    }


def _validate_warmup_response(response: Mapping[str, Any]) -> None:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("local model warm-up response contains no choices")
    first = choices[0]
    if not isinstance(first, dict):
        raise RuntimeError("local model warm-up choice must be an object")
    message = first.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("local model warm-up response contains no message")
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("local model warm-up response is empty")


def _p95(values: tuple[int, ...]) -> int:
    if not values:
        return 0
    ordered = sorted(values)
    index = max(0, math.ceil(len(ordered) * 0.95) - 1)
    return ordered[index]


def _aggregate_status(counts: Mapping[ModelRuntimeStatus, int]) -> ModelRuntimeStatus:
    if counts[ModelRuntimeStatus.READY] > 0:
        return ModelRuntimeStatus.READY
    if counts[ModelRuntimeStatus.DEGRADED] > 0:
        return ModelRuntimeStatus.DEGRADED
    if counts[ModelRuntimeStatus.WARMING] > 0:
        return ModelRuntimeStatus.WARMING
    return ModelRuntimeStatus.UNAVAILABLE


def _integer(source: Mapping[str, str], name: str, default: int) -> int:
    raw = source.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError as error:
        raise AlwaysOnConfigurationError(f"{name} must be an integer") from error


def _number(source: Mapping[str, str], name: str, default: float) -> float:
    raw = source.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError as error:
        raise AlwaysOnConfigurationError(f"{name} must be a number") from error
