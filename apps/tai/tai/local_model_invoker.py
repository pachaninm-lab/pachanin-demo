from __future__ import annotations

import http.client
import ipaddress
import json
import ssl
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.parse import urlsplit, urlunsplit

from tai.model_runtime import LocalModelInvoker, LocalModelProfile


@dataclass(frozen=True, slots=True)
class LocalEndpointPolicy:
    allowed_hosts: frozenset[str] = frozenset({"localhost"})
    allowed_dns_suffixes: tuple[str, ...] = (".svc.cluster.local", ".svc")
    maximum_response_bytes: int = 1_048_576

    def __post_init__(self) -> None:
        if self.maximum_response_bytes < 1_024 or self.maximum_response_bytes > 16_777_216:
            raise ValueError("maximum_response_bytes must be between 1024 and 16777216")
        if any(not host.strip() for host in self.allowed_hosts):
            raise ValueError("allowed_hosts must not contain blank values")
        if any(not suffix.startswith(".") for suffix in self.allowed_dns_suffixes):
            raise ValueError("allowed DNS suffixes must start with a dot")

    def validate(self, endpoint: str) -> str:
        parsed = urlsplit(endpoint.strip())
        if parsed.scheme not in {"http", "https"}:
            raise ValueError("local model endpoint must use HTTP or HTTPS")
        if parsed.username is not None or parsed.password is not None:
            raise ValueError("credentials are not allowed in model endpoint URLs")
        if parsed.query or parsed.fragment:
            raise ValueError("query and fragment are not allowed in model endpoint URLs")
        hostname = parsed.hostname
        if hostname is None or not self._host_allowed(hostname.casefold()):
            raise ValueError("model endpoint host is not local or explicitly allowed")
        if parsed.port is not None and not 1 <= parsed.port <= 65_535:
            raise ValueError("model endpoint port is invalid")
        path = parsed.path or "/v1/chat/completions"
        return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))

    def _host_allowed(self, hostname: str) -> bool:
        if hostname in {host.casefold() for host in self.allowed_hosts}:
            return True
        if any(hostname.endswith(suffix.casefold()) for suffix in self.allowed_dns_suffixes):
            return True
        try:
            address = ipaddress.ip_address(hostname)
        except ValueError:
            return False
        return address.is_loopback or address.is_private or address.is_link_local


class ModelEndpointResolver(Protocol):
    def resolve(self, profile: LocalModelProfile) -> str: ...


class JSONTransport(Protocol):
    def post_json(
        self,
        endpoint: str,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]: ...


class HTTPResponseLike(Protocol):
    status: int
    reason: str

    def read(self, amount: int | None = None) -> bytes: ...


class HTTPConnectionLike(Protocol):
    def request(
        self,
        method: str,
        url: str,
        body: bytes | None,
        headers: Mapping[str, str],
    ) -> None: ...

    def getresponse(self) -> HTTPResponseLike: ...

    def close(self) -> None: ...


class HTTPConnectionFactory(Protocol):
    def __call__(
        self,
        *,
        scheme: str,
        host: str,
        port: int,
        timeout_seconds: float,
    ) -> HTTPConnectionLike: ...


class StaticModelEndpointResolver:
    def __init__(self, endpoints: Mapping[tuple[str, str], str]) -> None:
        self._endpoints = dict(endpoints)

    def resolve(self, profile: LocalModelProfile) -> str:
        endpoint = self._endpoints.get((profile.model_id, profile.revision))
        if endpoint is None:
            raise RuntimeError("no local endpoint is registered for model revision")
        return endpoint


class StdlibHTTPConnectionFactory:
    def __call__(
        self,
        *,
        scheme: str,
        host: str,
        port: int,
        timeout_seconds: float,
    ) -> HTTPConnectionLike:
        if scheme == "http":
            return http.client.HTTPConnection(
                host,
                port,
                timeout=timeout_seconds,
            )
        if scheme == "https":
            return http.client.HTTPSConnection(
                host,
                port,
                timeout=timeout_seconds,
                context=ssl.create_default_context(),
            )
        raise ValueError("local model endpoint must use HTTP or HTTPS")


class HTTPClientJSONTransport:
    """Dependency-free bounded JSON transport for already validated local endpoints."""

    def __init__(
        self,
        connection_factory: HTTPConnectionFactory | None = None,
    ) -> None:
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
        connection = self._connection_factory(
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


class OpenAICompatibleLocalInvoker(LocalModelInvoker):
    """Invoke an internal OpenAI-compatible model server with deterministic sampling."""

    def __init__(
        self,
        *,
        endpoint_resolver: ModelEndpointResolver,
        endpoint_policy: LocalEndpointPolicy | None = None,
        transport: JSONTransport | None = None,
    ) -> None:
        self._endpoint_resolver = endpoint_resolver
        self._endpoint_policy = endpoint_policy or LocalEndpointPolicy()
        self._transport = transport or HTTPClientJSONTransport()

    def invoke(
        self,
        profile: LocalModelProfile,
        prompt: str,
        *,
        maximum_output_chars: int,
        timeout_seconds: float,
    ) -> str:
        normalized_prompt = prompt.strip()
        if not normalized_prompt:
            raise ValueError("prompt must not be blank")
        if maximum_output_chars < 1:
            raise ValueError("maximum_output_chars must be positive")
        endpoint = self._endpoint_policy.validate(
            self._endpoint_resolver.resolve(profile)
        )
        maximum_tokens = min(
            profile.maximum_output_tokens,
            max(1, (maximum_output_chars + 3) // 4),
        )
        response = self._transport.post_json(
            endpoint,
            {
                "max_tokens": maximum_tokens,
                "messages": [{"content": normalized_prompt, "role": "user"}],
                "model": profile.model_id,
                "seed": 0,
                "stream": False,
                "temperature": 0,
            },
            timeout_seconds=timeout_seconds,
            maximum_response_bytes=self._endpoint_policy.maximum_response_bytes,
        )
        text = _extract_content(response).strip()
        if len(text) > maximum_output_chars:
            raise RuntimeError("local model output exceeded the character budget")
        return text


def _extract_content(response: Mapping[str, Any]) -> str:
    choices = response.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("local model response contains no choices")
    first = choices[0]
    if not isinstance(first, dict):
        raise RuntimeError("local model choice must be an object")
    message = first.get("message")
    if not isinstance(message, dict):
        raise RuntimeError("local model choice contains no message")
    content = message.get("content")
    if not isinstance(content, str):
        raise RuntimeError("local model message content must be text")
    return content
