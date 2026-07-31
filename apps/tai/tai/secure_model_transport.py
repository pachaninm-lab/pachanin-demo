from __future__ import annotations

import json
from collections.abc import Mapping
from typing import Any
from urllib.parse import urlsplit

from tai.local_model_invoker import (
    HTTPConnectionFactory,
    HTTPConnectionLike,
    JSONTransport,
    StdlibHTTPConnectionFactory,
)


class ModelBearerTokenError(ValueError):
    """Raised when local-model authentication material is unsafe."""


class BearerHTTPClientJSONTransport(JSONTransport):
    """Bounded local JSON transport with a non-disclosing Bearer credential."""

    def __init__(
        self,
        bearer_token: str,
        *,
        connection_factory: HTTPConnectionFactory | None = None,
    ) -> None:
        self._bearer_token = _bearer_token(bearer_token)
        self._connection_factory = connection_factory or StdlibHTTPConnectionFactory()

    def post_json(
        self,
        endpoint: str,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]:
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        if maximum_response_bytes < 1:
            raise ValueError("maximum_response_bytes must be positive")
        parsed = urlsplit(endpoint)
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("local model endpoint must use HTTP or HTTPS")
        if parsed.username is not None or parsed.password is not None:
            raise ValueError("credentials are not allowed in model endpoint URLs")
        if parsed.query or parsed.fragment:
            raise ValueError("query and fragment are not allowed in model endpoint URLs")
        hostname = parsed.hostname
        if hostname is None:
            raise ValueError("local model endpoint must contain a host")
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        path = parsed.path or "/"
        body = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode()
        connection: HTTPConnectionLike = self._connection_factory(
            scheme=parsed.scheme,
            host=hostname,
            port=port,
            timeout_seconds=timeout_seconds,
        )
        try:
            connection.request(
                "POST",
                path,
                body=body,
                headers={
                    "Accept": "application/json",
                    "Authorization": f"Bearer {self._bearer_token}",
                    "Content-Type": "application/json; charset=utf-8",
                    "User-Agent": "transparent-agro-intelligence/local-runtime",
                },
            )
            response = connection.getresponse()
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(
                    f"local model runtime returned HTTP {response.status} {response.reason}"
                )
            raw = response.read(maximum_response_bytes + 1)
        finally:
            connection.close()
        if len(raw) > maximum_response_bytes:
            raise RuntimeError("local model response exceeded the byte budget")
        try:
            decoded = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError("local model response is not valid JSON") from error
        if not isinstance(decoded, dict):
            raise RuntimeError("local model response must be a JSON object")
        return decoded


def _bearer_token(value: str) -> str:
    if not isinstance(value, str):
        raise ModelBearerTokenError("model bearer token must be text")
    if value != value.strip():
        raise ModelBearerTokenError("model bearer token must not contain edge whitespace")
    if not 32 <= len(value) <= 4_096:
        raise ModelBearerTokenError("model bearer token length is outside the safe range")
    if any(character.isspace() or ord(character) < 33 or ord(character) == 127 for character in value):
        raise ModelBearerTokenError("model bearer token contains unsafe characters")
    return value
