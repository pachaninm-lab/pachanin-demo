from __future__ import annotations

import asyncio
import time
from collections.abc import Mapping
from typing import Any

from tai.always_on_core import AlwaysOnModelSupervisor, ModelEndpointBinding
from tai.model_runtime import ModelRuntimeHealth, ModelRuntimeStatus


class ProductionAlwaysOnModelSupervisor(AlwaysOnModelSupervisor):
    """Qwen-compatible production warm-up without weakening runtime authority.

    Qwen/llama.cpp deployments may place bounded reasoning tokens in
    ``reasoning_content`` while leaving ``content`` empty. The generic stage-1
    supervisor intentionally validates a narrow response shape. Production uses
    this exact subclass so a valid authenticated OpenAI-compatible response can
    promote the persisted runtime from WARMING to READY before FastAPI startup
    completes, while network, authentication, JSON and empty-output failures
    still fail closed.
    """

    async def _observe_binding(self, binding: ModelEndpointBinding) -> None:
        model_id = str(binding.model_id)
        revision = str(binding.revision)
        endpoint_value = str(binding.endpoint)
        now = self._clock()
        identity = (model_id, revision)
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
            endpoint = self._endpoint_policy.validate(endpoint_value)
            response = await asyncio.to_thread(
                self._transport.post_json,
                endpoint,
                production_warmup_payload(model_id),
                timeout_seconds=self._config.warmup_timeout_seconds,
                maximum_response_bytes=self._endpoint_policy.maximum_response_bytes,
            )
            validate_production_warmup_response(response)
        except Exception:
            await self._record_failure(binding, pressure, now)
            return
        latency_ms = max(0, round((time.perf_counter() - started) * 1_000))
        await self._record_success(binding, pressure, now, latency_ms)


def production_warmup_payload(model_id: str) -> dict[str, object]:
    return {
        "chat_template_kwargs": {"enable_thinking": False},
        "max_tokens": 64,
        "messages": [
            {
                "content": "Return exactly READY without explanation.",
                "role": "user",
            }
        ],
        "model": model_id,
        "seed": 0,
        "stream": False,
        "temperature": 0,
    }


def validate_production_warmup_response(response: Mapping[str, Any]) -> None:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("local model warm-up response contains no choices")
    first = choices[0]
    if not isinstance(first, dict):
        raise RuntimeError("local model warm-up choice must be an object")
    message = first.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("local model warm-up response contains no message")
    for key in ("content", "reasoning_content", "reasoning"):
        value = message.get(key)
        if isinstance(value, str) and value.strip():
            return
    raise RuntimeError("local model warm-up response is empty")
