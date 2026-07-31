from __future__ import annotations

import asyncio
from collections import deque
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tai.always_on_core import (
    AlwaysOnCapacityExceeded,
    AlwaysOnConfig,
    AlwaysOnConfigurationError,
    AlwaysOnModelSupervisor,
    AsyncModelAdmissionGate,
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


def test_config_rejects_unsafe_queue_values() -> None:
    with pytest.raises(AlwaysOnConfigurationError):
        AlwaysOnConfig(maximum_inflight=1, maximum_queue=513)

    with pytest.raises(AlwaysOnConfigurationError):
        AlwaysOnConfig(maximum_inflight=0)


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
