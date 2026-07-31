from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import pytest

from tai.local_model_invoker import HTTPConnectionLike, HTTPResponseLike
from tai.secure_model_transport import (
    BearerHTTPClientJSONTransport,
    ModelBearerTokenError,
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


class _Factory:
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


def test_bearer_transport_sends_secret_only_in_authorization_header() -> None:
    token = "t" * 48
    response = _Response(b'{"choices":[]}')
    connection = _Connection(response)
    factory = _Factory(connection)
    transport = BearerHTTPClientJSONTransport(
        token,
        connection_factory=factory,
    )

    result = transport.post_json(
        "http://192.168.0.206:18080/v1/chat/completions",
        {"model": "tai-qwen3-8b-q4km"},
        timeout_seconds=15.0,
        maximum_response_bytes=1_024,
    )

    assert result == {"choices": []}
    assert factory.calls == [("http", "192.168.0.206", 18080, 15.0)]
    method, path, body, headers = connection.requests[0]
    assert method == "POST"
    assert path == "/v1/chat/completions"
    assert headers["Authorization"] == f"Bearer {token}"
    assert token.encode() not in (body or b"")
    assert token not in path
    assert response.read_limits == [1_025]
    assert connection.closed is True


@pytest.mark.parametrize(
    "token",
    [
        "short",
        " " + "t" * 32,
        "t" * 32 + " ",
        "t" * 16 + "\n" + "t" * 16,
        "t" * 4_097,
    ],
)
def test_bearer_transport_rejects_unsafe_tokens(token: str) -> None:
    with pytest.raises(ModelBearerTokenError, match="model bearer token"):
        BearerHTTPClientJSONTransport(token)


@pytest.mark.parametrize(
    ("endpoint", "message"),
    [
        ("ftp://localhost/infer", "HTTP"),
        ("http://user:secret@localhost/infer", "credentials"),
        ("http://localhost/infer?token=x", "query"),
        ("http:///infer", "host"),
    ],
)
def test_bearer_transport_revalidates_endpoint_shape(
    endpoint: str,
    message: str,
) -> None:
    transport = BearerHTTPClientJSONTransport(
        "t" * 32,
        connection_factory=_Factory(_Connection(_Response(b"{}"))),
    )
    with pytest.raises(ValueError, match=message):
        transport.post_json(
            endpoint,
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )


def test_bearer_transport_fails_closed_and_closes_connection() -> None:
    connection = _Connection(_Response(b"{}", status=401, reason="Unauthorized"))
    transport = BearerHTTPClientJSONTransport(
        "t" * 32,
        connection_factory=_Factory(connection),
    )

    with pytest.raises(RuntimeError, match="HTTP 401 Unauthorized"):
        transport.post_json(
            "http://localhost/infer",
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )

    assert connection.closed is True


@pytest.mark.parametrize(
    "payload",
    [
        b"not-json",
        b"[]",
        b"x" * 1_025,
    ],
)
def test_bearer_transport_rejects_invalid_or_oversized_response(
    payload: bytes,
) -> None:
    connection = _Connection(_Response(payload))
    transport = BearerHTTPClientJSONTransport(
        "t" * 32,
        connection_factory=_Factory(connection),
    )

    with pytest.raises(RuntimeError):
        transport.post_json(
            "https://model.tai.svc/infer",
            {},
            timeout_seconds=5.0,
            maximum_response_bytes=1_024,
        )

    assert connection.closed is True


@pytest.mark.parametrize(
    ("timeout", "budget", "message"),
    [
        (0.0, 1_024, "timeout_seconds"),
        (1.0, 0, "maximum_response_bytes"),
    ],
)
def test_bearer_transport_validates_budgets(
    timeout: float,
    budget: int,
    message: str,
) -> None:
    transport = BearerHTTPClientJSONTransport("t" * 32)
    with pytest.raises(ValueError, match=message):
        transport.post_json(
            "http://localhost/infer",
            {},
            timeout_seconds=timeout,
            maximum_response_bytes=budget,
        )
