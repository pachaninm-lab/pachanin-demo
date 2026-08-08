from __future__ import annotations

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

import pytest

from tai.always_on_core import AlwaysOnConfig, AsyncModelAdmissionGate
from tai.local_model_invoker import LocalEndpointPolicy
from tai.model_runtime import ModelRuntimeHealth, ModelRuntimeStatus
from tai.production_model_supervisor import (
    ProductionAlwaysOnModelSupervisor,
    production_warmup_payload,
    validate_production_warmup_response,
)


@dataclass(frozen=True, slots=True)
class FakeBinding:
    model_id: str = "tai-qwen3-8b-q4km"
    revision: str = "artifact-" + "a" * 64
    endpoint: str = "http://127.0.0.1:18080/v1/chat/completions"


class FakeHealthRepository:
    def __init__(self) -> None:
        self.recorded: list[ModelRuntimeHealth] = []

    def record_health(self, health: ModelRuntimeHealth) -> bool:
        self.recorded.append(health)
        return True


class FakeTransport:
    def __init__(self, response: Mapping[str, Any]) -> None:
        self.response = response
        self.payload: Mapping[str, Any] | None = None

    def post_json(
        self,
        endpoint: str,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]:
        assert endpoint == FakeBinding().endpoint
        assert timeout_seconds > 0
        assert maximum_response_bytes > 0
        self.payload = payload
        return self.response


def test_production_warmup_accepts_qwen_reasoning_content() -> None:
    response = {
        "choices": [
            {
                "message": {
                    "content": "",
                    "reasoning_content": "READY",
                }
            }
        ]
    }
    validate_production_warmup_response(response)


@pytest.mark.parametrize(
    "response",
    [
        {},
        {"choices": []},
        {"choices": [{}]},
        {"choices": [{"message": {"content": "", "reasoning_content": " "}}]},
    ],
)
def test_production_warmup_rejects_missing_output(response: Mapping[str, Any]) -> None:
    with pytest.raises(RuntimeError):
        validate_production_warmup_response(response)


def test_production_payload_disables_thinking_and_has_safe_budget() -> None:
    payload = production_warmup_payload("tai-qwen3-8b-q4km")
    assert payload["model"] == "tai-qwen3-8b-q4km"
    assert payload["chat_template_kwargs"] == {"enable_thinking": False}
    assert payload["max_tokens"] == 64
    assert payload["stream"] is False
    assert payload["temperature"] == 0


def test_production_supervisor_promotes_reasoning_only_response_to_ready() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(maximum_inflight=1)
        repository = FakeHealthRepository()
        transport = FakeTransport(
            {
                "choices": [
                    {
                        "message": {
                            "content": "",
                            "reasoning_content": "READY",
                        }
                    }
                ]
            }
        )
        supervisor = ProductionAlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=AsyncModelAdmissionGate(config),
            model_repository=repository,
            endpoint_policy=LocalEndpointPolicy(),
            transport=transport,
        )

        await supervisor.run_once()

        snapshot = await supervisor.snapshot()
        assert snapshot.status is ModelRuntimeStatus.READY
        assert snapshot.warmup_success_total == 1
        assert snapshot.warmup_failure_total == 0
        assert repository.recorded[-1].status is ModelRuntimeStatus.READY
        assert repository.recorded[-1].available_slots == 1
        assert transport.payload is not None
        assert transport.payload["max_tokens"] == 64

    asyncio.run(scenario())


def test_production_supervisor_keeps_empty_response_fail_closed() -> None:
    async def scenario() -> None:
        config = AlwaysOnConfig(maximum_inflight=1)
        repository = FakeHealthRepository()
        supervisor = ProductionAlwaysOnModelSupervisor(
            config=config,
            bindings=(FakeBinding(),),
            gate=AsyncModelAdmissionGate(config),
            model_repository=repository,
            endpoint_policy=LocalEndpointPolicy(),
            transport=FakeTransport(
                {"choices": [{"message": {"content": "", "reasoning_content": ""}}]}
            ),
        )

        await supervisor.run_once()

        snapshot = await supervisor.snapshot()
        assert snapshot.status is ModelRuntimeStatus.WARMING
        assert snapshot.warmup_failure_total == 1
        assert repository.recorded[-1].status is ModelRuntimeStatus.WARMING
        assert repository.recorded[-1].available_slots == 0

    asyncio.run(scenario())
