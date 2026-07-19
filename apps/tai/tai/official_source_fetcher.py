from __future__ import annotations

import errno
import http.client
import ipaddress
import socket
import ssl
import unicodedata
import zlib
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Protocol
from urllib.parse import SplitResult, urljoin, urlsplit

from tai.managed_loader import FetchDisposition, FetchRequest, FetchResponse

_REDIRECT_STATUS = frozenset({301, 302, 303, 307, 308})
_RETRYABLE_STATUS = frozenset({408, 425, 429})
_ALLOWED_CHARSETS = frozenset({"utf-8", "utf8", "windows-1251", "cp1251"})
_DEFAULT_MEDIA_TYPES = frozenset(
    {
        "application/json",
        "application/xml",
        "text/csv",
        "text/html",
        "text/plain",
        "text/xml",
    }
)
_BIDI_CONTROL_CHARACTERS = frozenset(
    {
        "\u061c",
        "\u200e",
        "\u200f",
        "\u202a",
        "\u202b",
        "\u202c",
        "\u202d",
        "\u202e",
        "\u2066",
        "\u2067",
        "\u2068",
        "\u2069",
    }
)
_INJECTION_MARKERS = (
    "ignore all previous instructions",
    "ignore previous instructions",
    "disregard previous instructions",
    "disregard prior instructions",
    "reveal the system prompt",
    "system prompt:",
    "<|system|>",
    "<|assistant|>",
    "tool_call",
    "function_call",
    "assistant to=",
)


class FetchSecurityError(ValueError):
    def __init__(self, error_code: str) -> None:
        super().__init__(error_code)
        self.error_code = error_code


@dataclass(frozen=True, slots=True)
class OfficialFetchPolicy:
    allowed_hosts: frozenset[str]
    allowed_media_types: frozenset[str] = _DEFAULT_MEDIA_TYPES
    timeout_seconds: float = 15.0
    maximum_redirects: int = 3
    maximum_wire_bytes: int = 2_000_000
    maximum_decoded_bytes: int = 5_000_000
    user_agent: str = "TAI-Official-Source-Loader/1.0"

    def __post_init__(self) -> None:
        if not self.allowed_hosts:
            raise ValueError("allowed_hosts must not be empty")
        if any(not _valid_hostname(host) for host in self.allowed_hosts):
            raise ValueError("allowed_hosts must contain lowercase DNS hostnames")
        if not self.allowed_media_types:
            raise ValueError("allowed_media_types must not be empty")
        if any(media_type != media_type.lower() for media_type in self.allowed_media_types):
            raise ValueError("allowed_media_types must be lowercase")
        if not 0.1 <= self.timeout_seconds <= 120:
            raise ValueError("timeout_seconds must be between 0.1 and 120")
        if not 0 <= self.maximum_redirects <= 10:
            raise ValueError("maximum_redirects must be between 0 and 10")
        if self.maximum_wire_bytes < 1:
            raise ValueError("maximum_wire_bytes must be positive")
        if self.maximum_decoded_bytes < self.maximum_wire_bytes:
            raise ValueError("maximum_decoded_bytes must cover maximum_wire_bytes")
        if (
            not self.user_agent.strip()
            or "\r" in self.user_agent
            or "\n" in self.user_agent
        ):
            raise ValueError("user_agent must be a safe non-empty value")


@dataclass(frozen=True, slots=True)
class ResolvedAddress:
    host: str
    port: int
    ip_address: str

    def __post_init__(self) -> None:
        if not _valid_hostname(self.host):
            raise ValueError("resolved host must be a lowercase DNS hostname")
        if not 1 <= self.port <= 65535:
            raise ValueError("resolved port is invalid")
        address = ipaddress.ip_address(self.ip_address)
        if not _is_public_address(address):
            raise ValueError("resolved address must be globally routable")


class HostResolver(Protocol):
    def resolve(self, host: str, port: int) -> tuple[ResolvedAddress, ...]: ...


@dataclass(frozen=True, slots=True)
class TransportRequest:
    url: str
    host: str
    port: int
    target_ip: str
    path_and_query: str
    headers: Mapping[str, str]
    timeout_seconds: float
    maximum_wire_bytes: int


@dataclass(frozen=True, slots=True)
class TransportResponse:
    status_code: int
    headers: Mapping[str, str]
    body: bytes
    received_at: datetime

    def __post_init__(self) -> None:
        if not 100 <= self.status_code <= 599:
            raise ValueError("status_code is invalid")
        if self.received_at.utcoffset() is None:
            raise ValueError("received_at must be timezone-aware")


class HTTPSFetchTransport(Protocol):
    def exchange(self, request: TransportRequest) -> TransportResponse: ...


class SystemHostResolver:
    def resolve(self, host: str, port: int) -> tuple[ResolvedAddress, ...]:
        try:
            records = socket.getaddrinfo(
                host,
                port,
                family=socket.AF_UNSPEC,
                type=socket.SOCK_STREAM,
                proto=socket.IPPROTO_TCP,
            )
        except socket.gaierror as error:
            raise FetchSecurityError("source_dns_resolution_failed") from error
        addresses = sorted({record[4][0] for record in records})
        if not addresses:
            raise FetchSecurityError("source_dns_resolution_empty")
        resolved: list[ResolvedAddress] = []
        for raw_address in addresses:
            try:
                address = ipaddress.ip_address(raw_address)
            except ValueError as error:
                raise FetchSecurityError("source_dns_address_invalid") from error
            if not _is_public_address(address):
                raise FetchSecurityError("source_dns_address_not_public")
            resolved.append(
                ResolvedAddress(
                    host=host,
                    port=port,
                    ip_address=address.compressed,
                )
            )
        return tuple(resolved)


class _PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(
        self,
        *,
        host: str,
        port: int,
        target_ip: str,
        timeout: float,
        context: ssl.SSLContext,
    ) -> None:
        super().__init__(host=host, port=port, timeout=timeout, context=context)
        self._target_ip = target_ip
        self._tls_context = context
        self._source_address: tuple[str, int] | None = None

    def connect(self) -> None:
        raw_socket = socket.create_connection(
            (self._target_ip, self.port),
            timeout=self.timeout,
            source_address=self._source_address,
        )
        try:
            self.sock = self._tls_context.wrap_socket(
                raw_socket,
                server_hostname=self.host,
            )
        except Exception:
            raw_socket.close()
            raise


class StdlibPinnedHTTPSFetchTransport:
    """HTTPS transport pinned to a resolver-approved IP with normal TLS SNI."""

    def __init__(self, context: ssl.SSLContext | None = None) -> None:
        self._context = context or ssl.create_default_context()

    def exchange(self, request: TransportRequest) -> TransportResponse:
        connection = _PinnedHTTPSConnection(
            host=request.host,
            port=request.port,
            target_ip=request.target_ip,
            timeout=request.timeout_seconds,
            context=self._context,
        )
        try:
            connection.request(
                "GET",
                request.path_and_query,
                headers=dict(request.headers),
            )
            response = connection.getresponse()
            body = response.read(request.maximum_wire_bytes + 1)
            if len(body) > request.maximum_wire_bytes:
                raise FetchSecurityError("source_response_wire_limit_exceeded")
            headers = _normalize_headers(dict(response.getheaders()))
            return TransportResponse(
                status_code=response.status,
                headers=headers,
                body=body,
                received_at=datetime.now(UTC),
            )
        finally:
            connection.close()


@dataclass(frozen=True, slots=True)
class UntrustedContentGuard:
    injection_markers: tuple[str, ...] = _INJECTION_MARKERS
    reject_bidi_controls: bool = True

    def reasons(self, content: str) -> tuple[str, ...]:
        normalized = unicodedata.normalize("NFKC", content).casefold()
        reasons: list[str] = []
        if self.reject_bidi_controls and any(
            character in content for character in _BIDI_CONTROL_CHARACTERS
        ):
            reasons.append("source_content_bidi_control_detected")
        if any(marker in normalized for marker in self.injection_markers):
            reasons.append("source_content_prompt_injection_detected")
        return tuple(sorted(set(reasons)))


@dataclass(slots=True)
class OfficialSourceHTTPFetcher:
    policy: OfficialFetchPolicy
    resolver: HostResolver = field(default_factory=SystemHostResolver)
    transport: HTTPSFetchTransport = field(
        default_factory=StdlibPinnedHTTPSFetchTransport
    )
    content_guard: UntrustedContentGuard = field(default_factory=UntrustedContentGuard)

    def fetch(self, request: FetchRequest) -> FetchResponse:
        current_url = request.source_uri
        try:
            request_headers = self._request_headers(request)
        except FetchSecurityError as error:
            return _failure(FetchDisposition.PERMANENT_FAILURE, error.error_code)

        for redirect_count in range(self.policy.maximum_redirects + 1):
            try:
                target = self._target(current_url)
                raw = self.transport.exchange(
                    TransportRequest(
                        url=current_url,
                        host=target.host,
                        port=target.port,
                        target_ip=target.ip_address,
                        path_and_query=target.path_and_query,
                        headers=request_headers,
                        timeout_seconds=self.policy.timeout_seconds,
                        maximum_wire_bytes=self.policy.maximum_wire_bytes,
                    )
                )
                response_headers = _normalize_headers(raw.headers)
                if raw.status_code in _REDIRECT_STATUS:
                    location = response_headers.get("location")
                    if not location:
                        raise FetchSecurityError("source_redirect_location_missing")
                    if redirect_count >= self.policy.maximum_redirects:
                        raise FetchSecurityError("source_redirect_limit_exceeded")
                    current_url = urljoin(current_url, location)
                    self._validate_url(current_url)
                    continue
                return self._non_redirect_response(raw, response_headers)
            except FetchSecurityError as error:
                return _failure(
                    FetchDisposition.PERMANENT_FAILURE,
                    error.error_code,
                )
            except (OSError, http.client.HTTPException) as error:
                return _failure(
                    FetchDisposition.RETRYABLE_FAILURE,
                    _transport_error_code(error),
                )
        return _failure(
            FetchDisposition.PERMANENT_FAILURE,
            "source_redirect_limit_exceeded",
        )

    def _non_redirect_response(
        self,
        raw: TransportResponse,
        response_headers: Mapping[str, str],
    ) -> FetchResponse:
        if raw.status_code == 304:
            return FetchResponse(
                disposition=FetchDisposition.NOT_MODIFIED,
                body=None,
                fetched_at=raw.received_at,
                etag=response_headers.get("etag"),
                last_modified=response_headers.get("last-modified"),
            )
        if raw.status_code in _RETRYABLE_STATUS or 500 <= raw.status_code <= 599:
            return FetchResponse(
                disposition=FetchDisposition.RETRYABLE_FAILURE,
                body=None,
                fetched_at=raw.received_at,
                error_code=f"source_http_{raw.status_code}",
            )
        if raw.status_code != 200:
            return FetchResponse(
                disposition=FetchDisposition.PERMANENT_FAILURE,
                body=None,
                fetched_at=raw.received_at,
                error_code=f"source_http_{raw.status_code}",
            )
        body = self._decode_body(raw.body, response_headers)
        guard_reasons = self.content_guard.reasons(body)
        if guard_reasons:
            return FetchResponse(
                disposition=FetchDisposition.PERMANENT_FAILURE,
                body=None,
                fetched_at=raw.received_at,
                error_code=guard_reasons[0],
            )
        return FetchResponse(
            disposition=FetchDisposition.FETCHED,
            body=body,
            fetched_at=raw.received_at,
            etag=response_headers.get("etag"),
            last_modified=response_headers.get("last-modified"),
        )

    def _target(self, url: str) -> _ResolvedTarget:
        parsed = self._validate_url(url)
        host = parsed.hostname
        if host is None:
            raise FetchSecurityError("source_url_host_missing")
        port = parsed.port or 443
        addresses = self.resolver.resolve(host, port)
        if not addresses:
            raise FetchSecurityError("source_dns_resolution_empty")
        selected = sorted(addresses, key=lambda item: item.ip_address)[0]
        if selected.host != host or selected.port != port:
            raise FetchSecurityError("source_resolver_binding_mismatch")
        path = parsed.path or "/"
        if parsed.query:
            path = f"{path}?{parsed.query}"
        return _ResolvedTarget(
            host=host,
            port=port,
            ip_address=selected.ip_address,
            path_and_query=path,
        )

    def _validate_url(self, url: str) -> SplitResult:
        try:
            parsed = urlsplit(url)
            port = parsed.port
        except ValueError as error:
            raise FetchSecurityError("source_url_invalid") from error
        host = parsed.hostname
        if parsed.scheme != "https":
            raise FetchSecurityError("source_url_https_required")
        if not host or not _valid_hostname(host):
            raise FetchSecurityError("source_url_host_invalid")
        if host not in self.policy.allowed_hosts:
            raise FetchSecurityError("source_url_host_not_allowed")
        if parsed.username or parsed.password:
            raise FetchSecurityError("source_url_credentials_forbidden")
        if parsed.fragment:
            raise FetchSecurityError("source_url_fragment_forbidden")
        if port not in {None, 443}:
            raise FetchSecurityError("source_url_port_forbidden")
        if "\\" in parsed.path or any(ord(character) < 32 for character in url):
            raise FetchSecurityError("source_url_path_invalid")
        return parsed

    def _decode_body(
        self,
        wire_body: bytes,
        headers: Mapping[str, str],
    ) -> str:
        if len(wire_body) > self.policy.maximum_wire_bytes:
            raise FetchSecurityError("source_response_wire_limit_exceeded")
        content_length = headers.get("content-length")
        if content_length is not None:
            try:
                declared_length = int(content_length)
            except ValueError as error:
                raise FetchSecurityError("source_content_length_invalid") from error
            if declared_length != len(wire_body):
                raise FetchSecurityError("source_content_length_mismatch")
        media_type, charset = _content_type(headers.get("content-type"))
        if media_type not in self.policy.allowed_media_types:
            raise FetchSecurityError("source_content_type_not_allowed")
        encoding = headers.get("content-encoding", "identity").casefold().strip()
        if encoding in {"", "identity"}:
            decoded_bytes = wire_body
        elif encoding == "gzip":
            decoded_bytes = _bounded_gzip_decode(
                wire_body,
                maximum_bytes=self.policy.maximum_decoded_bytes,
            )
        else:
            raise FetchSecurityError("source_content_encoding_not_allowed")
        if len(decoded_bytes) > self.policy.maximum_decoded_bytes:
            raise FetchSecurityError("source_response_decoded_limit_exceeded")
        if charset not in _ALLOWED_CHARSETS:
            raise FetchSecurityError("source_charset_not_allowed")
        try:
            return decoded_bytes.decode(charset, errors="strict")
        except UnicodeDecodeError as error:
            raise FetchSecurityError("source_content_decode_failed") from error

    def _request_headers(self, request: FetchRequest) -> dict[str, str]:
        headers = {
            "Accept": ", ".join(sorted(self.policy.allowed_media_types)),
            "Accept-Encoding": "gzip, identity",
            "Connection": "close",
            "User-Agent": self.policy.user_agent,
        }
        if request.etag:
            _safe_header_value(request.etag, "etag")
            headers["If-None-Match"] = request.etag
        if request.last_modified:
            _safe_header_value(request.last_modified, "last_modified")
            headers["If-Modified-Since"] = request.last_modified
        return headers


@dataclass(frozen=True, slots=True)
class _ResolvedTarget:
    host: str
    port: int
    ip_address: str
    path_and_query: str


def _failure(disposition: FetchDisposition, error_code: str) -> FetchResponse:
    return FetchResponse(
        disposition=disposition,
        body=None,
        fetched_at=datetime.now(UTC),
        error_code=error_code,
    )


def _transport_error_code(error: OSError | http.client.HTTPException) -> str:
    if isinstance(error, ssl.SSLCertVerificationError):
        return "source_tls_certificate_invalid"
    if isinstance(error, ssl.SSLError):
        return "source_tls_failure"
    if isinstance(error, http.client.RemoteDisconnected):
        return "source_http_connection_closed"
    if isinstance(error, http.client.BadStatusLine):
        return "source_http_protocol_invalid"
    if isinstance(error, http.client.IncompleteRead):
        return "source_http_response_incomplete"
    if isinstance(error, http.client.HTTPException):
        return "source_http_protocol_failure"
    if isinstance(error, TimeoutError):
        return "source_transport_timeout"
    if isinstance(error, ConnectionRefusedError):
        return "source_connection_refused"
    if isinstance(error, ConnectionResetError):
        return "source_connection_reset"
    if isinstance(error, ConnectionAbortedError):
        return "source_connection_aborted"
    if isinstance(error, BrokenPipeError):
        return "source_connection_broken"
    if isinstance(error, socket.gaierror):
        return "source_dns_resolution_failed"
    if error.errno == errno.ETIMEDOUT:
        return "source_transport_timeout"
    if error.errno == errno.ECONNREFUSED:
        return "source_connection_refused"
    if error.errno == errno.ECONNRESET:
        return "source_connection_reset"
    if error.errno == errno.ECONNABORTED:
        return "source_connection_aborted"
    if error.errno in {errno.ENETUNREACH, errno.EHOSTUNREACH}:
        return "source_network_unreachable"
    return "source_transport_failure"


def _content_type(raw_value: str | None) -> tuple[str, str]:
    if raw_value is None:
        raise FetchSecurityError("source_content_type_missing")
    parts = [part.strip() for part in raw_value.split(";")]
    media_type = parts[0].casefold()
    charset = "utf-8"
    for parameter in parts[1:]:
        name, separator, value = parameter.partition("=")
        if separator and name.casefold().strip() == "charset":
            charset = value.strip().strip('"').casefold()
    return media_type, charset


def _bounded_gzip_decode(payload: bytes, *, maximum_bytes: int) -> bytes:
    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
    try:
        decoded = decoder.decompress(payload, maximum_bytes + 1)
        if decoder.unconsumed_tail or len(decoded) > maximum_bytes:
            raise FetchSecurityError("source_response_decoded_limit_exceeded")
        decoded += decoder.flush(maximum_bytes + 1 - len(decoded))
    except zlib.error as error:
        raise FetchSecurityError("source_gzip_invalid") from error
    if len(decoded) > maximum_bytes:
        raise FetchSecurityError("source_response_decoded_limit_exceeded")
    if not decoder.eof or decoder.unused_data:
        raise FetchSecurityError("source_gzip_incomplete_or_trailing_data")
    return decoded


def _normalize_headers(headers: Mapping[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for name, value in headers.items():
        lowered = name.casefold().strip()
        if not lowered or "\r" in value or "\n" in value:
            raise FetchSecurityError("source_response_header_invalid")
        normalized[lowered] = value.strip()
    return normalized


def _safe_header_value(value: str, name: str) -> None:
    if not value.strip() or "\r" in value or "\n" in value:
        raise FetchSecurityError(f"source_request_{name}_invalid")


def _valid_hostname(host: str) -> bool:
    if not host or host != host.casefold() or len(host) > 253:
        return False
    try:
        host.encode("ascii")
    except UnicodeEncodeError:
        return False
    labels = host.split(".")
    return all(
        label
        and len(label) <= 63
        and label[0].isalnum()
        and label[-1].isalnum()
        and all(character.isalnum() or character == "-" for character in label)
        for label in labels
    )


def _is_public_address(address: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped is not None:
        return address.ipv4_mapped.is_global
    return address.is_global
