from __future__ import annotations

import asyncio
import json
from collections import deque
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, cast

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from tai.always_on_core import (
    AlwaysOnBackpressureMiddleware,
    AlwaysOnCapacityExceeded,
    AlwaysOnConfig,
    AlwaysOnConfigurationError,
    AlwaysOnModelSupervisor,
    AsyncModelAdmissionGate,
    RuntimePressureSnapshot,
    _aggregate_status,
    _p95,
    _validate_warmup_response,
    install_always_on_core,
)
from tai.local_model_invoker import LocalEndpointPolicy
from tai.model_runtime import ModelRuntimeHealth, ModelRuntimeStatus


@dataclass(frozen=True, slots=True)
class FakeBinding:
    model_id: str = "tai-qwen3-8b"
    revision: str = "q4-k-m"
    endpoint: str = "http://127.0.0.1:8081/v1/chat/completions"


class FakeHealthRepository:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.recorded: list[ModelRuntimeHealth] = []

    def record_health(self, health: ModelRuntimeHealth) -> bool:
        if self.fail:
            raise RuntimeError("database unavailable")
        self.recorded.append(health)
        return True


class FakeTransport:
    def __init__(self, outcomes: list[Mapping[str, Any] | Exception]) -> None:
        self.outcomes = deque(outcomes)
        self.calls = 0

    def post_json(
        self,
        endpoint: str,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]:
        del endpoint, payload, timeout_seconds, maximum_response_bytes
        self.calls += 1
        outcome = self.outcomes.popleft()
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class MutableClock:
    def __init__(self, value: datetime) -> None:
        self.value = value

    def __call__(self) -> datetime:
        return self.value

    def advance(self, seconds: float) -> None:
        self.value += timedelta(seconds=seconds)


def _success_response() -> Mapping[str, Any]:
    return {"choices": [{"message": {"content": "READY"}}]}


def _http_scope(method: str, path: str) -> Scope:
    return cast(
        Scope,
        {
            "type": "http",
            "asgi": {"version": "3.0", "spec_version": "2.3"},
            "http_version": "1.1",
            "server": ("testserver", 80),
            "client": ("testclient", 123),
            "scheme": "http",
            "method": method,
            "root_path": "",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "state": {},
        },
    )


def test_config_rejects_unsafe_queue_values() -> None:
    with pytest.raises(AlwaysOnConfigurationError):
        AlwaysOnConfig(maximum_inflight=1, maximum_queue=513)

    with pytest.raises(AlwaysOnConfigurationError):
        AlwaysOnConfig(maximum_inflight=0)


@pytest.mark.parametrize(
    "overrides",
    [
        {"maximum_inflight": True},
        {"maximum_inflight": 5},
        {"maximum_queue": True},
        {"queue_timeout_seconds": 0.09},
        {"supervisor_interval_seconds": 4},
        {"warmup_timeout_seconds": 0.9},
        {"circuit_failure_threshold": 0},
        {"circuit_open_seconds": 4},
        {"latency_window": 4},
    ],
)
def test_config_rejects_every_unsafe_operational_bound(
    overrides: dict[str, int | float | bool],
) -> None:
    values: dict[str, int | float | bool] = {"maximum_inflight": 1}
    values.update(overrides)
    with pytest.raises(AlwaysOnConfigurationError):
        AlwaysOnConfig(**values)  # type: ignore[arg-type]


def test_config_environment_parsing_is_bounded_and_fail_closed() -> None:
    defaults = AlwaysOnConfig.from_environment({}, maximum_inflight=2)
    assert defaults.maximum_queue == 16
    assert defaults.queue_timeout_seconds == 10

    configured = AlwaysOnConfig.from_environment(
        {
            "TAI_MODEL_MAX_QUEUE": "7",
            "TAI_MODEL_QUEUE_TIMEOUT_SECONDS": "3.5",
            "TAI_MODEL_SUPERVISOR_INTERVAL_SECONDS": "6",
            "TAI_MODEL_WARMUP_TIMEOUT_SECONDS": "2",
            "TAI_MODEL_CIRCUIT_FAILURE_THRESHOLD": "4",
            "TAI_MODEL_CIRCUIT_OPEN_SECONDS": "8",
            "TAI_MODEL_LATENCY_WINDOW": "9",
        },
        maximum_inflight=2,
    )
    assert configured.maximum_queue == 7
    assert configured.queue_timeout_seconds == 3.5
    assert configured.supervisor_interval_seconds == 6
    assert configured.warmup_timeout_seconds == 2
    assert configured.circuit_failure_threshold == 4
    assert configured.circuit_open_seconds == 8
    assert configured.latency_window == 9

    with pytest.raises(AlwaysOnConfigurationError, match="TAI_MODEL_MAX_QUEUE"):
        AlwaysOnConfig.from_environment(
            {"TAI_MODEL_MAX_QUEUE": "not-an-integer"},
            maximum_inflight=1,
        )
    with pytest.raises(AlwaysOnConfigurationError, match="TAI_MODEL_QUEUE_TIMEOUT_SECONDS"):
        AlwaysOnConfig.from_environment(
            {"TAI_MODEL_QUEUE_TIMEOUT_SECONDS": "not-a-number"},
            maximum_inflight=1,
        )


def test_pressure_and_supervisor_helpers_are_stable() -> None:
    pressure = RuntimePressureSnapshot(
        active=1,
        queued=2,
        maximum_inflight=3,
        maximum_queue=4,
        admitted_total=5,
        rejected_total=6,
        timed_out_total=7,
    )
    assert pressure.to_json_object() == {
        "active": 1,
        "admitted_total": 5,
        "maximum_inflight": 3,
        "maximum_queue": 4,
        "queued": 2,
        "rejected_total": 6,
        "timed_out_total": 7,
    }
    assert _p95(()) == 0
    assert _p95((10, 50, 20, 40, 30)) == 50

    empty_counts = {status: 0 for status in ModelRuntimeStatus}
    assert _aggregate_status(empty_counts) is ModelRuntimeStatus.UNAVAILABLE
    assert (
        _aggregate_status({**empty_counts, ModelRuntimeStatus.WARMING: 1})
        is ModelRuntimeStatus.WARMING
    )
    assert (
        _aggregate_status({**empty_counts, ModelRuntimeStatus.DEGRADED: 1})
        is ModelRuntimeStatus.DEGRADED
    )
    assert (
        _aggregate_status({**empty_counts, ModelRuntimeStatus.READY: 1})
        is ModelRuntimeStatus.READY
    )


@pytest.mark.parametrize(
    "response",
    [
        {},
        {"choices": []},
        {"choices": ["not-an-object"]},
        {"choices": [{}]},
        {"choices": [{"message": {}}]},
        {"choices": [{"message": {"content": " "}}]},
    ],
)
def test_warmup_response_validation_fails_closed(response: Mapping[str, Any]) -> None:
    with pytest.raises(RuntimeError):
        _validate_warmup_response(response)


def test_admission_gate_is_fifo_and_bounded() -> None:
    async def scenario() -> None:
        gate = AsyncModelAdmissionGate(
            AlwaysOnConfig(
                maximum_inflight=1,
                maximum_queue=2,
                queue_timeout_seconds=1,
            )
        )
        release = asyncio.Event()
        order: list[str] = []

        async def first() -> None:
            async with gate.admit():
                order.append("first")
                release.set()
                await asyncio.sleep(0.05)

        async def queued(name: str) -> None:
            async with gate.admit():
                order.append(name)

        first_task = asyncio.create_task(first())
        await release.wait()
        second_task = asyncio.create_task(queued("second"))
        await asyncio.sleep(0)
        third_task = asyncio.create_task(queued("third"))
        await asyncio.gather(first_task, second_task, third_task)

        assert order == ["first", "second", "third"]
        snapshot = await gate.snapshot()
        assert snapshot.active == 0
        assert snapshot.queued == 0
        assert snapshot.admitted_total == 3
        assert snapshot.rejected_total == 0

    asyncio.run(scenario())


def test_admission_gate_rejects_when_queue_is_full() -> None:
    async def scenario() -> None:
        gate = AsyncModelAdmissionGate(
            AlwaysOnConfig(
                maximum_inflight=1,
                maximum_queue=1,
                queue_timeout_seconds=1,
            )
        )
        release = asyncio.Event()
        entered = asyncio.Event()

        async def holder() -> None:
            async with gate.admit():
                entered.set()
                await release.wait()

        async def waiter() -> None:
            async with gate.admit():
                return

        holder_task = asyncio.create_task(holder())
        await entered.wait()
        waiter_task = asyncio.create_task(waiter())
        while (await gate.snapshot()).queued != 1:
            await asyncio.sleep(0)

        with pytest.raises(AlwaysOnCapacityExceeded) as raised:
            async with gate.admit():
                pytest.fail("full queue must not admit another request")
        assert raised.value.reason == "QUEUE_FULL"

        release.set()
        await asyncio.gather(holder_task, waiter_task)
        snapshot = await gate.snapshot()
        assert snapshot.rejected_total == 1

    asyncio.run(scenario())


def test_admission_gate_times_out_without_leaking_waiter() -> None:
    async def scenario() -> None:
        gate = AsyncModelAdmissionGate(
            AlwaysOnConfig(
                maximum_inflight=1,
                maximum_queue=1,
                queue_timeout_seconds=0.1,
            )
        )
        release = asyncio.Event()
        entered = asyncio.Event()

        async def holder() -> None:
            async with gate.admit():
                entered.set()
                await release.wait()

        holder_task = asyncio.create_task(holder())
        await entered.wait()
        with pytest.raises(AlwaysOnCapacityExceeded) as raised:
            async with gate.admit():
                pytest.fail("timed-out request must not be admitted")
        assert raised.value.reason == "QUEUE_TIMEOUT"
        snapshot = await gate.snapshot()
        assert snapshot.queued == 0
        assert snapshot.timed_out_total == 1
        release.set()
        await holder_task

    asyncio.run(scenario())


def test_admission_gate_cancellation_and_release_guard_do_not_leak() -> None:
    async def scenario() -> None:
        gate = AsyncModelAdmissionGate(
            AlwaysOnConfig(maximum_inflight=1, maximum_queue=1, queue_timeout_seconds=1)
        )
        await gate._acquire()
        waiter = asyncio.create_task(gate._acquire())
        while (await gate.snapshot()).queued != 1:
            await asyncio.sleep(0)
        waiter.cancel()
        with pytest.raises(asyncio.CancelledError):
            await waiter
        assert (await gate.snapshot()).queued == 0

        gate._remove_waiter_locked(999)
        await gate._release()
        with pytest.raises(RuntimeError, match="released without an active permit"):
            await gate._release()

    asyncio.run(scenario())


def test_backpressure_middleware_bypasses_safe_routes_and_serializes_overload() -> None:
    async def scenario() -> None:
        calls: list[tuple[str, str]] = []
        messages: list[Message] = []

        async def downstream(scope: Scope, receive: Receive, send: Send) -> None:
            del receive
            calls.append((scope.get("method", ""), scope.get("path", "")))
            await send({"type": "http.response.start", "status": 204, "headers": []})
            await send({"type": "http.response.body", "body": b""})

        async def receive() -> Message:
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message: Message) -> None:
            messages.append(message)

        gate = AsyncModelAdmissionGate(
            AlwaysOnConfig(maximum_inflight=1, maximum_queue=0, queue_timeout_seconds=1)
        )
        middleware = AlwaysOnBackpressureMiddleware(cast(ASGIApp, downstream), gate=gate)

        await middleware(_http_scope("GET", "/health/live"), receive, send)
        assert calls == [("GET", "/health/live")]
        assert messages[0]["status"] == 204

        messages.clear()
        await gate._acquire()
        try:
            await middleware(_http_scope("POST", "/v1/platform/answer"), receive, send)
        finally:
            await gate._release()
        assert calls == [("GET", "/health/live")]
        start = cast(dict[str, Any], messages[0])
        body = cast(dict[str, Any], messages[1])
        assert start["status"] == 503
        headers = dict(start["headers"])
        assert headers[b"retry-after"] == b"1"
        payload = json.loads(cast(bytes, body["body"]))
        assert payload["schema_version"] == "tai.error.v1"
        assert payload["code"] == "TAI_CAPACITY_BUSY"
        assert payload["retryable"] is True
        assert payload["retry_after_seconds"] == 1

    asyncio.run(scenario())


def test_supervisor_warms_model_and_persists_ready_health() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(maximum_inflight=2)
        gate = AsyncModelAdmissionGate(config)
        repository = FakeHealthRepository()
        transport = FakeTransport([_success_response()])
        supervisor = AlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=gate,
            model_repository=repository,
            endpoint_policy=LocalEndpointPolicy(),
            transport=transport,
        )

        await supervisor.run_once()

        snapshot = await supervisor.snapshot()
        assert snapshot.status is ModelRuntimeStatus.READY
        assert snapshot.ready_count == 1
        assert snapshot.warmup_total == 1
        assert snapshot.warmup_success_total == 1
        assert repository.recorded[-1].status is ModelRuntimeStatus.READY
        assert repository.recorded[-1].available_slots == 2
        assert repository.recorded[-1].queue_depth == 0

    asyncio.run(scenario())


def test_supervisor_rejects_missing_or_duplicate_bindings() -> None:
    config = AlwaysOnConfig(maximum_inflight=1)
    gate = AsyncModelAdmissionGate(config)
    repository = FakeHealthRepository()

    with pytest.raises(AlwaysOnConfigurationError, match="at least one"):
        AlwaysOnModelSupervisor(
            config=config,
            bindings=(),
            gate=gate,
            model_repository=repository,
            endpoint_policy=LocalEndpointPolicy(),
        )
    with pytest.raises(AlwaysOnConfigurationError, match="unique"):
        AlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(), FakeBinding()),
            gate=gate,
            model_repository=repository,
            endpoint_policy=LocalEndpointPolicy(),
        )


def test_supervisor_skips_probe_under_user_pressure_then_recovers() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(maximum_inflight=1)
        gate = AsyncModelAdmissionGate(config)
        repository = FakeHealthRepository()
        transport = FakeTransport([_success_response()])
        supervisor = AlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=gate,
            model_repository=repository,
            endpoint_policy=LocalEndpointPolicy(),
            transport=transport,
        )

        await gate._acquire()
        try:
            await supervisor.run_once()
        finally:
            await gate._release()
        assert transport.calls == 0
        assert repository.recorded[-1].status is ModelRuntimeStatus.WARMING
        assert repository.recorded[-1].available_slots == 0

        await supervisor.run_once()
        assert transport.calls == 1
        assert (await supervisor.snapshot()).status is ModelRuntimeStatus.READY

    asyncio.run(scenario())


def test_supervisor_reports_degraded_after_failure_following_success() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(maximum_inflight=1, circuit_failure_threshold=3)
        repository = FakeHealthRepository()
        supervisor = AlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=AsyncModelAdmissionGate(config),
            model_repository=repository,
            endpoint_policy=LocalEndpointPolicy(),
            transport=FakeTransport([_success_response(), RuntimeError("transient")]),
        )

        await supervisor.run_once()
        await supervisor.run_once()
        snapshot = await supervisor.snapshot()
        assert snapshot.status is ModelRuntimeStatus.DEGRADED
        assert snapshot.degraded_count == 1
        assert repository.recorded[-1].status is ModelRuntimeStatus.DEGRADED
        assert repository.recorded[-1].available_slots == 1

    asyncio.run(scenario())


def test_supervisor_opens_circuit_and_recovers_after_cooldown() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(
            maximum_inflight=1,
            circuit_failure_threshold=2,
            circuit_open_seconds=5,
        )
        gate = AsyncModelAdmissionGate(config)
        repository = FakeHealthRepository()
        transport = FakeTransport(
            [RuntimeError("down"), RuntimeError("down"), _success_response()]
        )
        clock = MutableClock(datetime(2026, 7, 31, 12, 0, tzinfo=UTC))
        supervisor = AlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=gate,
            model_repository=repository,
            endpoint_policy=LocalEndpointPolicy(),
            transport=transport,
            clock=clock,
        )

        await supervisor.run_once()
        await supervisor.run_once()
        assert transport.calls == 2
        assert (await supervisor.snapshot()).status is ModelRuntimeStatus.UNAVAILABLE
        assert repository.recorded[-1].circuit_open_until is not None

        await supervisor.run_once()
        assert transport.calls == 2

        clock.advance(6)
        await supervisor.run_once()
        assert transport.calls == 3
        snapshot = await supervisor.snapshot()
        assert snapshot.status is ModelRuntimeStatus.READY
        assert snapshot.warmup_failure_total == 2
        assert snapshot.warmup_success_total == 1
        assert repository.recorded[-1].circuit_open_until is None

    asyncio.run(scenario())


def test_supervisor_start_is_idempotent_and_stop_joins_loop() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(maximum_inflight=1, supervisor_interval_seconds=5)
        transport = FakeTransport([_success_response()])
        supervisor = AlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=AsyncModelAdmissionGate(config),
            model_repository=FakeHealthRepository(),
            endpoint_policy=LocalEndpointPolicy(),
            transport=transport,
        )

        await supervisor.start()
        await supervisor.start()
        assert transport.calls == 1
        await supervisor.stop()
        await supervisor.stop()

    asyncio.run(scenario())


def test_runtime_health_route_reports_warming_then_ready_without_secrets() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(maximum_inflight=1)
        gate = AsyncModelAdmissionGate(config)
        supervisor = AlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=gate,
            model_repository=FakeHealthRepository(),
            endpoint_policy=LocalEndpointPolicy(),
            transport=FakeTransport([_success_response()]),
        )
        app = FastAPI()
        install_always_on_core(app, gate=gate, supervisor=supervisor)
        route = next(
            route
            for route in app.routes
            if isinstance(route, APIRoute) and route.path == "/health/runtime"
        )
        endpoint = cast(Callable[[], Awaitable[JSONResponse]], route.endpoint)

        warming = await endpoint()
        warming_payload = json.loads(warming.body)
        assert warming.status_code == 503
        assert warming_payload["status"] == "not_ready"
        assert warming_payload["supervisor"]["status"] == "warming"

        await supervisor.run_once()
        ready = await endpoint()
        ready_payload = json.loads(ready.body)
        assert ready.status_code == 200
        assert ready_payload["status"] == "ready"
        assert ready_payload["supervisor"]["status"] == "ready"
        assert ready.headers["cache-control"] == "no-store"
        serialized = ready.body.decode()
        assert "endpoint" not in serialized
        assert "secret" not in serialized

    asyncio.run(scenario())


def test_repository_failure_is_observable_without_deadlock() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(maximum_inflight=1)
        supervisor = AlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=AsyncModelAdmissionGate(config),
            model_repository=FakeHealthRepository(fail=True),
            endpoint_policy=LocalEndpointPolicy(),
            transport=FakeTransport([_success_response()]),
        )

        await asyncio.wait_for(supervisor.run_once(), timeout=1)
        snapshot = await supervisor.snapshot()
        assert snapshot.status is ModelRuntimeStatus.READY
        assert snapshot.repository_failure_total == 1

    asyncio.run(scenario())
