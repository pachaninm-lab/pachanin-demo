from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pytest

from tai.local_model_invoker import (
    HTTPClientJSONTransport,
    HTTPConnectionLike,
    HTTPResponseLike,
    LocalEndpointPolicy,
    OpenAICompatibleLocalInvoker,
    StaticModelEndpointResolver,
    StdlibHTTPConnectionFactory,
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
        (
            "http://127.0.0.1:8080/v1/chat/completions",
            "http://127.0.0.1:8080/v1/chat/completions",
        ),
        ("http://10.20.0.5:8080/infer", "http://10.20.0.5:8080/infer"),
        (
            "https://model.tai.svc.cluster.local/infer",
            "https://model.tai.svc.cluster.local/infer",
        ),
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


class _Response:
    def __init__(
        self,
        payload: bytes,
        *,
        status: int = 200,
        reason: str = "OK",
    ) -> None:
        self.payload = payload
        self.status = status
        self.reason = reason
        self.read_limits: list[int | None] = []

    def read(self, amount: int | None = None) -> bytes:
        self.read_limits.append(amount)
        return self.payload


class _Connection:
    def __init__(self, response: HTTPResponseLike) -> None:
        self.response = response
        self.requests: list[
            tuple[str, str, bytes | None, Mapping[str, str]]
        ] = []
        self.closed = False

    def request(
        self,
        method: str,
        url: str,
        body: bytes | None,
        headers: Mapping[str, str],
    ) -> None:
        self.requests.append((method, url, body, headers))

    def getresponse(self) -> HTTPResponseLike:
        return self.response

    def close(self) -> None:
        self.closed = True


class _ConnectionFactory:
    def __init__(self, connection: HTTPConnectionLike) -> None:
        self.connection = connection
        self.calls: list[tuple[str, str, int, float]] = []

    def __call__(
        self,
        *,
        scheme: str,
        host: str,
        port: int,
        timeout_seconds: float,
    ) -> HTTPConnectionLike:
        self.calls.append((scheme, host, port, timeout_seconds))
        return self.connection


def test_http_client_transport_enforces_request_and_response_budgets() -> None:
    response = _Response(b'{"choices":[]}')
    connection = _Connection(response)
    factory = _ConnectionFactory(connection)

    result = HTTPClientJSONTransport(factory).post_json(
        "http://localhost:8080/infer",
        {"model": "local"},
        timeout_seconds=5.0,
        maximum_response_bytes=1_024,
    )

    assert result == {"choices": []}
    assert factory.calls == [("http", "localhost", 8080, 5.0)]
    assert response.read_limits == [1_025]
    assert connection.closed is True
    method, path, body, headers = connection.requests[0]
    assert method == "POST"
    assert path == "/infer"
    assert body == b'{"model":"local"}'
    assert headers["Content-Type"] == "application/json; charset=utf-8"


def test_http_client_transport_defaults_ports_and_path() -> None:
    http_factory = _ConnectionFactory(_Connection(_Response(b"{}")))
    https_factory = _ConnectionFactory(_Connection(_Response(b"{}")))

    HTTPClientJSONTransport(http_factory).post_json(
        "http://localhost",
        {},
        timeout_seconds=1.0,
        maximum_response_bytes=1_024,
    )
    HTTPClientJSONTransport(https_factory).post_json(
        "https://model.tai.svc",
        {},
        timeout_seconds=2.0,
        maximum_response_bytes=1_024,
    )

    assert http_factory.calls == [("http", "localhost", 80, 1.0)]
    assert https_factory.calls == [("https", "model.tai.svc", 443, 2.0)]
    assert http_factory.connection.requests[0][1] == "/"


def test_http_client_transport_fails_closed_and_always_closes() -> None:
    too_large_connection = _Connection(_Response(b"x" * 1_025))
    bad_status_connection = _Connection(
        _Response(b"{}", status=503, reason="Unavailable")
    )
    bad_json_connection = _Connection(_Response(b"not-json"))
    list_json_connection = _Connection(_Response(b"[]"))

    with pytest.raises(RuntimeError, match="byte budget"):
        HTTPClientJSONTransport(
            _ConnectionFactory(too_large_connection)
        ).post_json(
            "http://localhost/infer",
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )
    with pytest.raises(RuntimeError, match="HTTP 503"):
        HTTPClientJSONTransport(
            _ConnectionFactory(bad_status_connection)
        ).post_json(
            "http://localhost/infer",
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )
    with pytest.raises(RuntimeError, match="valid JSON"):
        HTTPClientJSONTransport(
            _ConnectionFactory(bad_json_connection)
        ).post_json(
            "http://localhost/infer",
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )
    with pytest.raises(RuntimeError, match="JSON object"):
        HTTPClientJSONTransport(
            _ConnectionFactory(list_json_connection)
        ).post_json(
            "http://localhost/infer",
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )

    assert too_large_connection.closed is True
    assert bad_status_connection.closed is True
    assert bad_json_connection.closed is True
    assert list_json_connection.closed is True


@pytest.mark.parametrize(
    ("endpoint", "message"),
    [
        ("ftp://localhost/infer", "HTTP"),
        ("http://user:secret@localhost/infer", "credentials"),
        ("http://localhost/infer?token=x", "query"),
        ("http:///infer", "host"),
    ],
)
def test_transport_revalidates_endpoint_shape(
    endpoint: str,
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        HTTPClientJSONTransport(
            _ConnectionFactory(_Connection(_Response(b"{}")))
        ).post_json(
            endpoint,
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )


def test_transport_validates_runtime_budgets() -> None:
    transport = HTTPClientJSONTransport(
        _ConnectionFactory(_Connection(_Response(b"{}")))
    )

    with pytest.raises(ValueError, match="timeout_seconds"):
        transport.post_json(
            "http://localhost/infer",
            {},
            timeout_seconds=0,
            maximum_response_bytes=1_024,
        )
    with pytest.raises(ValueError, match="maximum_response_bytes"):
        transport.post_json(
            "http://localhost/infer",
            {},
            timeout_seconds=1.0,
            maximum_response_bytes=0,
        )


def test_stdlib_connection_factory_selects_http_and_https(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, str, int, float, object | None]] = []
    connection = _Connection(_Response(b"{}"))

    def fake_http(host: str, port: int, *, timeout: float) -> HTTPConnectionLike:
        calls.append(("http", host, port, timeout, None))
        return connection

    def fake_https(
        host: str,
        port: int,
        *,
        timeout: float,
        context: object,
    ) -> HTTPConnectionLike:
        calls.append(("https", host, port, timeout, context))
        return connection

    tls_context = object()
    monkeypatch.setattr("tai.local_model_invoker.http.client.HTTPConnection", fake_http)
    monkeypatch.setattr("tai.local_model_invoker.http.client.HTTPSConnection", fake_https)
    monkeypatch.setattr(
        "tai.local_model_invoker.ssl.create_default_context",
        lambda: tls_context,
    )

    factory = StdlibHTTPConnectionFactory()
    assert factory(
        scheme="http",
        host="localhost",
        port=8080,
        timeout_seconds=3.0,
    ) is connection
    assert factory(
        scheme="https",
        host="model.tai.svc",
        port=443,
        timeout_seconds=4.0,
    ) is connection
    with pytest.raises(ValueError, match="HTTP"):
        factory(
            scheme="ftp",
            host="localhost",
            port=21,
            timeout_seconds=1.0,
        )

    assert calls == [
        ("http", "localhost", 8080, 3.0, None),
        ("https", "model.tai.svc", 443, 4.0, tls_context),
    ]


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
