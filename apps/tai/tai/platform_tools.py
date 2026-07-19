from __future__ import annotations

import base64
import hashlib
import hmac
import http.client
import ipaddress
import json
import ssl
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol
from urllib.parse import urlsplit, urlunsplit

from tai.agent_runtime import AuthorizedToolInvocation
from tai.contracts import ToolMode

_PLATFORM_TOOL_MODES: dict[str, ToolMode] = {
    "getDealSummary": ToolMode.READ_ONLY,
    "getRoleNextActions": ToolMode.READ_ONLY,
    "prepareCommandDraft": ToolMode.DRAFT,
    "assignLogistics": ToolMode.CONFIRMED_WRITE,
}
_MAX_ARGUMENT_BYTES = 32_768
_MAX_RESPONSE_BYTES = 262_144


class PlatformToolConfigurationError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class PlatformToolEndpointPolicy:
    allowed_hosts: frozenset[str] = frozenset({"localhost"})
    allowed_dns_suffixes: tuple[str, ...] = (".svc.cluster.local", ".svc")

    def validate_base_url(self, base_url: str) -> str:
        parsed = urlsplit(base_url.strip())
        if parsed.scheme not in {"http", "https"}:
            raise PlatformToolConfigurationError(
                "platform tool endpoint must use HTTP or HTTPS"
            )
        if parsed.username is not None or parsed.password is not None:
            raise PlatformToolConfigurationError(
                "credentials are not allowed in platform tool endpoint"
            )
        if parsed.query or parsed.fragment:
            raise PlatformToolConfigurationError(
                "query and fragment are not allowed in platform tool endpoint"
            )
        if parsed.path not in {"", "/"}:
            raise PlatformToolConfigurationError(
                "platform tool endpoint must be an origin without a path"
            )
        hostname = parsed.hostname
        if hostname is None or not self._host_allowed(hostname.casefold()):
            raise PlatformToolConfigurationError(
                "platform tool endpoint host is not local or explicitly allowed"
            )
        port = parsed.port
        if port is not None and not 1 <= port <= 65_535:
            raise PlatformToolConfigurationError("platform tool endpoint port is invalid")
        return urlunsplit((parsed.scheme, parsed.netloc, "", "", "")).rstrip("/")

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


@dataclass(frozen=True, slots=True)
class SignedPlatformToolAssertion:
    encoded_payload: str
    signature_sha256: str


class PlatformToolAssertionAuthority:
    def __init__(
        self,
        secret: bytes,
        *,
        ttl: timedelta = timedelta(seconds=20),
    ) -> None:
        if len(secret) < 32:
            raise PlatformToolConfigurationError(
                "platform tool assertion secret must contain at least 32 bytes"
            )
        if ttl <= timedelta(0) or ttl > timedelta(seconds=30):
            raise PlatformToolConfigurationError(
                "platform tool assertion TTL must be between 0 and 30 seconds"
            )
        self._secret = bytes(secret)
        self._ttl = ttl

    def issue(
        self,
        invocation: AuthorizedToolInvocation,
        *,
        path: str,
        body: Mapping[str, Any],
        issued_at: datetime,
    ) -> SignedPlatformToolAssertion:
        _aware(issued_at, "issued_at")
        expected_mode = _PLATFORM_TOOL_MODES.get(invocation.tool_name)
        if expected_mode is None or invocation.mode is not expected_mode:
            raise PermissionError("platform tool is not allowed by adapter policy")
        request_sha256 = canonical_platform_tool_request_sha256(
            method="POST",
            path=path,
            payload=body,
            idempotency_key=invocation.idempotency_key,
        )
        payload = {
            "audience": "platform-api",
            "call_id": invocation.call_id,
            "expires_at": _iso(issued_at + self._ttl),
            "idempotency_key": invocation.idempotency_key,
            "issued_at": _iso(issued_at),
            "mode": invocation.mode.value,
            "request_sha256": request_sha256,
            "schema_version": "tai.platform-tool.v1",
            "session_id": str(invocation.session_id),
            "tenant_id": (
                None if invocation.tenant_id is None else str(invocation.tenant_id)
            ),
            "tool_name": invocation.tool_name,
            "trace_id": str(invocation.trace_id),
            "user_id": str(invocation.user_id),
        }
        canonical = canonical_platform_tool_json(payload).encode()
        return SignedPlatformToolAssertion(
            encoded_payload=base64.urlsafe_b64encode(canonical)
            .rstrip(b"=")
            .decode("ascii"),
            signature_sha256=hmac.new(
                self._secret,
                canonical,
                hashlib.sha256,
            ).hexdigest(),
        )


class PlatformToolTransport(Protocol):
    def post_json(
        self,
        *,
        base_url: str,
        path: str,
        payload: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]: ...


class HTTPClientPlatformToolTransport:
    def post_json(
        self,
        *,
        base_url: str,
        path: str,
        payload: Mapping[str, Any],
        headers: Mapping[str, str],
        timeout_seconds: float,
        maximum_response_bytes: int,
    ) -> Mapping[str, Any]:
        parsed = urlsplit(base_url)
        hostname = parsed.hostname
        if hostname is None:
            raise RuntimeError("platform tool endpoint contains no host")
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        connection: http.client.HTTPConnection
        if parsed.scheme == "https":
            connection = http.client.HTTPSConnection(
                hostname,
                port,
                timeout=timeout_seconds,
                context=ssl.create_default_context(),
            )
        else:
            connection = http.client.HTTPConnection(
                hostname,
                port,
                timeout=timeout_seconds,
            )
        encoded = canonical_platform_tool_json(payload).encode()
        try:
            connection.request(
                "POST",
                path,
                body=encoded,
                headers=dict(headers),
            )
            response = connection.getresponse()
            raw = response.read(maximum_response_bytes + 1)
            if response.status < 200 or response.status >= 300:
                raise RuntimeError(
                    f"platform tool gateway returned HTTP {response.status}"
                )
        finally:
            connection.close()
        if len(raw) > maximum_response_bytes:
            raise RuntimeError("platform tool response exceeded the byte budget")
        try:
            decoded = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RuntimeError("platform tool response is not valid JSON") from error
        if not isinstance(decoded, dict):
            raise RuntimeError("platform tool response must be a JSON object")
        return decoded


class PlatformSafeToolHandler:
    def __init__(
        self,
        *,
        base_url: str,
        assertion_authority: PlatformToolAssertionAuthority,
        endpoint_policy: PlatformToolEndpointPolicy | None = None,
        transport: PlatformToolTransport | None = None,
        timeout_seconds: float = 10.0,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        if not 0.1 <= timeout_seconds <= 60:
            raise PlatformToolConfigurationError(
                "platform tool timeout must be between 0.1 and 60 seconds"
            )
        self._endpoint_policy = endpoint_policy or PlatformToolEndpointPolicy()
        self._base_url = self._endpoint_policy.validate_base_url(base_url)
        self._assertion_authority = assertion_authority
        self._transport = transport or HTTPClientPlatformToolTransport()
        self._timeout_seconds = timeout_seconds
        self._clock = clock or (lambda: datetime.now(UTC))

    def execute(self, invocation: AuthorizedToolInvocation) -> Mapping[str, Any]:
        expected_mode = _PLATFORM_TOOL_MODES.get(invocation.tool_name)
        if expected_mode is None or invocation.mode is not expected_mode:
            raise PermissionError("platform tool is not executable by this adapter")
        body = {"arguments": _canonical_value(dict(invocation.arguments))}
        encoded = canonical_platform_tool_json(body).encode()
        if len(encoded) > _MAX_ARGUMENT_BYTES:
            raise ValueError("platform tool arguments exceeded the byte budget")
        path = f"/api/internal/tai/tools/{invocation.tool_name}"
        signed = self._assertion_authority.issue(
            invocation,
            path=path,
            body=body,
            issued_at=self._clock(),
        )
        return self._transport.post_json(
            base_url=self._base_url,
            path=path,
            payload=body,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json; charset=utf-8",
                "User-Agent": "transparent-agro-intelligence/platform-tools",
                "X-Idempotency-Key": invocation.idempotency_key,
                "X-TAI-Tool-Assertion": signed.encoded_payload,
                "X-TAI-Tool-Signature": signed.signature_sha256,
            },
            timeout_seconds=self._timeout_seconds,
            maximum_response_bytes=_MAX_RESPONSE_BYTES,
        )


def platform_safe_tool_handlers(
    *,
    base_url: str,
    secret: bytes,
    allowed_hosts: frozenset[str] = frozenset({"localhost"}),
    timeout_seconds: float = 10.0,
    transport: PlatformToolTransport | None = None,
    clock: Callable[[], datetime] | None = None,
) -> dict[str, PlatformSafeToolHandler]:
    handler = PlatformSafeToolHandler(
        base_url=base_url,
        assertion_authority=PlatformToolAssertionAuthority(secret),
        endpoint_policy=PlatformToolEndpointPolicy(allowed_hosts=allowed_hosts),
        transport=transport,
        timeout_seconds=timeout_seconds,
        clock=clock,
    )
    return {name: handler for name in _PLATFORM_TOOL_MODES}


def canonical_platform_tool_request_sha256(
    *,
    method: str,
    path: str,
    payload: Any,
    idempotency_key: str,
) -> str:
    return hashlib.sha256(
        canonical_platform_tool_json(
            {
                "idempotency_key": idempotency_key,
                "method": method.strip().upper(),
                "path": path,
                "payload": payload,
            }
        ).encode()
    ).hexdigest()


def canonical_platform_tool_json(value: Any) -> str:
    return json.dumps(
        _canonical_value(value),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
        allow_nan=False,
    )


def _canonical_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, bool, int)):
        return value
    if isinstance(value, float):
        raise TypeError("floating point values are not allowed in platform tool contracts")
    if isinstance(value, (list, tuple)):
        return [_canonical_value(item) for item in value]
    if isinstance(value, Mapping):
        normalized: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("platform tool object keys must be strings")
            normalized[key] = _canonical_value(item)
        return normalized
    raise TypeError("unsupported platform tool contract value")


def _iso(value: datetime) -> str:
    return value.astimezone(UTC).isoformat(timespec="milliseconds").replace(
        "+00:00", "Z"
    )


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
