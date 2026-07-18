from __future__ import annotations

from collections.abc import Mapping
from contextlib import AbstractContextManager
from typing import Any
from urllib.request import Request

import pytest

from tai.local_model_invoker import (
    LocalEndpointPolicy,
    OpenAICompatibleLocalInvoker,
    StaticModelEndpointResolver,
    UrllibJSONTransport,
)
from tai.model_runtime import (
    LocalModelProfile,
    ModelCapability,
    ModelRuntimeClass,
)


def _profile() -> LocalModelProfile:
    return LocalModelProfile(
        model_id="tai-russian-8b",
        revision="q4-r1",
        artifact_locator="file:///models/tai-russian-8b.gguf",
        artifact_sha256="a" * 64,
        license_ref="Apache-2.0",
        capabilities=frozenset(
            {ModelCapability.TEXT_GENERATION, ModelCapability.RUSSIAN}
        ),
        maximum_context_tokens=8_192,
        maximum_output_tokens=2_048,
        runtime_class=ModelRuntimeClass.CPU,
        quantization="Q4_K_M",
    )


@pytest.mark.parametrize(
    ("endpoint", "expected"),
    [
        ("http://localhost:8080", "http://localhost:8080/v1/chat/completions"),
        ("http://127.0.0.1:8080/v1/chat/completions", "http://127.0.0.1:8080/v1/chat/completions"),
        ("http://10.20.0.5:8080/infer", "http://10.20.0.5:8080/infer"),
        ("https://model.tai.svc.cluster.local/infer", "https://model.tai.svc.cluster.local/infer"),
    ],
)
def test_endpoint_policy_allows_only_internal_destinations(
    endpoint: str,
    expected: str,
) -> None:
    assert LocalEndpointPolicy().validate(endpoint) == expected


@pytest.mark.parametrize(
    ("endpoint", "message"),
    [
        ("ftp://localhost/model", "HTTP"),
        ("http://user:secret@localhost/model", "credentials"),
        ("http://localhost/model?token=secret", "query"),
        ("http://localhost/model#fragment", "query"),
        ("http://8.8.8.8/model", "not local"),
        ("https://api.openai.com/v1/chat/completions", "not local"),
    ],
)
def test_endpoint_policy_rejects_remote_or_ambiguous_destinations(
    endpoint: str,
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        LocalEndpointPolicy().validate(endpoint)


class _Transport:
    def __init__(self, response: Mapping[str, Any]) -> None:
        self.response = response
        self.calls: list[tuple[str, Mapping[str, Any], float, int]] = []

    def post_json(
        self,
        endpoint: str,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]:
        self.calls.append(
            (endpoint, payload, timeout_seconds, maximum_response_bytes)
        )
        return self.response


def test_invoker_uses_deterministic_openai_compatible_payload() -> None:
    transport = _Transport(
        {"choices": [{"message": {"content": " grounded answer [S1] "}}]}
    )
    invoker = OpenAICompatibleLocalInvoker(
        endpoint_resolver=StaticModelEndpointResolver(
            {("tai-russian-8b", "q4-r1"): "http://model.tai.svc:8080/infer"}
        ),
        transport=transport,
    )

    result = invoker.invoke(
        _profile(),
        " grounded prompt ",
        maximum_output_chars=1_000,
        timeout_seconds=30.0,
    )

    assert result == "grounded answer [S1]"
    endpoint, payload, timeout, response_budget = transport.calls[0]
    assert endpoint == "http://model.tai.svc:8080/infer"
    assert payload == {
        "max_tokens": 250,
        "messages": [{"content": "grounded prompt", "role": "user"}],
        "model": "tai-russian-8b",
        "seed": 0,
        "stream": False,
        "temperature": 0,
    }
    assert timeout == 30.0
    assert response_budget == 1_048_576


@pytest.mark.parametrize(
    "response",
    [
        {},
        {"choices": []},
        {"choices": ["invalid"]},
        {"choices": [{}]},
        {"choices": [{"message": {}}]},
        {"choices": [{"message": {"content": 42}}]},
    ],
)
def test_invoker_rejects_malformed_runtime_responses(
    response: Mapping[str, Any],
) -> None:
    invoker = OpenAICompatibleLocalInvoker(
        endpoint_resolver=StaticModelEndpointResolver(
            {("tai-russian-8b", "q4-r1"): "http://127.0.0.1:8080/infer"}
        ),
        transport=_Transport(response),
    )

    with pytest.raises(RuntimeError, match="local model"):
        invoker.invoke(
            _profile(),
            "prompt",
            maximum_output_chars=1_000,
            timeout_seconds=30.0,
        )


def test_invoker_rejects_missing_endpoint_and_output_over_budget() -> None:
    missing = OpenAICompatibleLocalInvoker(
        endpoint_resolver=StaticModelEndpointResolver({}),
        transport=_Transport({}),
    )
    oversized = OpenAICompatibleLocalInvoker(
        endpoint_resolver=StaticModelEndpointResolver(
            {("tai-russian-8b", "q4-r1"): "http://localhost:8080/infer"}
        ),
        transport=_Transport(
            {"choices": [{"message": {"content": "x" * 101}}]}
        ),
    )

    with pytest.raises(RuntimeError, match="no local endpoint"):
        missing.invoke(
            _profile(),
            "prompt",
            maximum_output_chars=100,
            timeout_seconds=30.0,
        )
    with pytest.raises(RuntimeError, match="character budget"):
        oversized.invoke(
            _profile(),
            "prompt",
            maximum_output_chars=100,
            timeout_seconds=30.0,
        )


class _Response(AbstractContextManager["_Response"]):
    def __init__(self, payload: bytes) -> None:
        self.payload = payload
        self.read_limits: list[int] = []

    def __enter__(self) -> _Response:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self, limit: int) -> bytes:
        self.read_limits.append(limit)
        return self.payload


def test_urllib_transport_enforces_response_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    response = _Response(b'{"choices":[]}')
    captured: list[tuple[Request, float]] = []

    def fake_urlopen(request: Request, timeout: float) -> _Response:
        captured.append((request, timeout))
        return response

    monkeypatch.setattr("tai.local_model_invoker.urlopen", fake_urlopen)
    result = UrllibJSONTransport().post_json(
        "http://localhost:8080/infer",
        {"model": "local"},
        timeout_seconds=5.0,
        maximum_response_bytes=1_024,
    )

    assert result == {"choices": []}
    assert response.read_limits == [1_025]
    assert captured[0][0].get_method() == "POST"
    assert captured[0][1] == 5.0

    too_large = _Response(b"x" * 1_025)
    monkeypatch.setattr(
        "tai.local_model_invoker.urlopen",
        lambda request, timeout: too_large,
    )
    with pytest.raises(RuntimeError, match="byte budget"):
        UrllibJSONTransport().post_json(
            "http://localhost:8080/infer",
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )


def test_endpoint_policy_and_invoker_validation() -> None:
    with pytest.raises(ValueError, match="maximum_response_bytes"):
        LocalEndpointPolicy(maximum_response_bytes=100)
    with pytest.raises(ValueError, match="allowed_hosts"):
        LocalEndpointPolicy(allowed_hosts=frozenset({" "}))
    with pytest.raises(ValueError, match="suffixes"):
        LocalEndpointPolicy(allowed_dns_suffixes=("svc",))

    invoker = OpenAICompatibleLocalInvoker(
        endpoint_resolver=StaticModelEndpointResolver(
            {("tai-russian-8b", "q4-r1"): "http://localhost:8080/infer"}
        ),
        transport=_Transport(
            {"choices": [{"message": {"content": "answer"}}]}
        ),
    )
    with pytest.raises(ValueError, match="prompt"):
        invoker.invoke(
            _profile(),
            " ",
            maximum_output_chars=100,
            timeout_seconds=5.0,
        )
    with pytest.raises(ValueError, match="maximum_output_chars"):
        invoker.invoke(
            _profile(),
            "prompt",
            maximum_output_chars=0,
            timeout_seconds=5.0,
        )
