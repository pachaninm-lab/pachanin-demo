from __future__ import annotations

import ipaddress
import json
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Protocol
from urllib.parse import urlsplit, urlunsplit
from urllib.request import Request, urlopen

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


class StaticModelEndpointResolver:
    def __init__(self, endpoints: Mapping[tuple[str, str], str]) -> None:
        self._endpoints = dict(endpoints)

    def resolve(self, profile: LocalModelProfile) -> str:
        endpoint = self._endpoints.get((profile.model_id, profile.revision))
        if endpoint is None:
            raise RuntimeError("no local endpoint is registered for model revision")
        return endpoint


class UrllibJSONTransport:
    """Small dependency-free JSON transport used only after endpoint policy validation."""

    def post_json(
        self,
        endpoint: str,
        payload: Mapping[str, Any],
        *,
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]:
        body = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode()
        request = Request(
            endpoint,
            data=body,
            method="POST",
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "transparent-agro-intelligence/local-runtime",
            },
        )
        response_handle = urlopen(request, timeout=timeout_seconds)  # noqa: S310
        with response_handle as response:
            raw = response.read(maximum_response_bytes + 1)
        if len(raw) > maximum_response_bytes:
            raise RuntimeError("local model response exceeded the byte budget")
        decoded = json.loads(raw)
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
        self._transport = transport or UrllibJSONTransport()

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
