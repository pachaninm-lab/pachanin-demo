from __future__ import annotations

import errno
import http.client
import socket
import ssl
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from urllib.parse import urljoin

from tai.managed_loader import (
    FetchDisposition,
    FetchRequest,
    FetchResponse,
    SourceFetcher,
)
from tai.official_source_fetcher import (
    FetchSecurityError,
    OfficialFetchPolicy,
    OfficialSourceHTTPFetcher,
    ResolvedAddress,
    StdlibPinnedHTTPSFetchTransport,
    TransportRequest,
)
from tai.official_source_observation import (
    OfficialObservationDefinition,
    definitions_from_catalog,
)
from tai.source_coverage import OfficialSourceCatalog

_REDIRECT_STATUS = frozenset({301, 302, 303, 307, 308})
_MAXIMUM_ADDRESS_ATTEMPTS = 4
_SOURCE_MINIMUM_TIMEOUT_SECONDS = {
    "official.mcx.opendata": 45.0,
}
_RETRYABLE_SECURITY_CODES = frozenset(
    {
        "source_dns_resolution_empty",
        "source_dns_resolution_failed",
    }
)
_OS_ERROR_CODES = {
    errno.ECONNABORTED: "source_connection_aborted",
    errno.ECONNREFUSED: "source_connection_refused",
    errno.ECONNRESET: "source_connection_reset",
    errno.EHOSTUNREACH: "source_host_unreachable",
    errno.ENETDOWN: "source_network_down",
    errno.ENETUNREACH: "source_network_unreachable",
    errno.EPIPE: "source_connection_broken",
    errno.ETIMEDOUT: "source_transport_timeout",
}


@dataclass(frozen=True, slots=True)
class _AddressTarget:
    host: str
    port: int
    ip_address: str
    path_and_query: str


@dataclass(slots=True)
class DiagnosticOfficialSourceHTTPFetcher(OfficialSourceHTTPFetcher):
    """Official fetcher with bounded diagnostics and public-IP failover."""

    monotonic: Callable[[], float] = time.monotonic

    def fetch(self, request: FetchRequest) -> FetchResponse:
        deadline = self.monotonic() + self.policy.timeout_seconds
        current_url = request.source_uri
        try:
            request_headers = self._request_headers(request)
        except FetchSecurityError as error:
            return _security_failure(error)

        for redirect_count in range(self.policy.maximum_redirects + 1):
            try:
                targets = self._address_targets(current_url)
            except FetchSecurityError as error:
                return _security_failure(error)

            diagnostics: list[tuple[FetchDisposition, str]] = []
            redirected = False
            for target in targets:
                remaining_seconds = deadline - self.monotonic()
                if remaining_seconds < 0.1:
                    diagnostics.append(
                        (
                            FetchDisposition.RETRYABLE_FAILURE,
                            "source_transport_timeout",
                        )
                    )
                    break
                try:
                    raw = self.transport.exchange(
                        TransportRequest(
                            url=current_url,
                            host=target.host,
                            port=target.port,
                            target_ip=target.ip_address,
                            path_and_query=target.path_and_query,
                            headers=request_headers,
                            timeout_seconds=remaining_seconds,
                            maximum_wire_bytes=self.policy.maximum_wire_bytes,
                        )
                    )
                    response_headers = _normalize_headers(raw.headers)
                    if raw.status_code in _REDIRECT_STATUS:
                        location = response_headers.get("location")
                        if not location:
                            raise FetchSecurityError(
                                "source_redirect_location_missing"
                            )
                        if redirect_count >= self.policy.maximum_redirects:
                            raise FetchSecurityError(
                                "source_redirect_limit_exceeded"
                            )
                        current_url = urljoin(current_url, location)
                        self._validate_url(current_url)
                        redirected = True
                        break
                    return self._non_redirect_response(raw, response_headers)
                except FetchSecurityError as error:
                    return _security_failure(error)
                except Exception as error:
                    diagnostic = _transport_diagnostic(error)
                    if diagnostic is None:
                        raise
                    diagnostics.append(diagnostic)

            if redirected:
                continue
            if diagnostics:
                disposition, error_code = _aggregate_diagnostics(diagnostics)
                return _failure(disposition, error_code)
            return _failure(
                FetchDisposition.RETRYABLE_FAILURE,
                "source_dns_resolution_empty",
            )
        return _failure(
            FetchDisposition.PERMANENT_FAILURE,
            "source_redirect_limit_exceeded",
        )

    def _address_targets(self, url: str) -> tuple[_AddressTarget, ...]:
        parsed = self._validate_url(url)
        host = parsed.hostname
        if host is None:
            raise FetchSecurityError("source_url_host_missing")
        port = parsed.port or 443
        addresses = self.resolver.resolve(host, port)
        if not addresses:
            raise FetchSecurityError("source_dns_resolution_empty")
        ordered = sorted(addresses, key=lambda address: address.ip_address)
        unique: list[ResolvedAddress] = []
        seen: set[str] = set()
        for address in ordered:
            if address.host != host or address.port != port:
                raise FetchSecurityError("source_resolver_binding_mismatch")
            if address.ip_address in seen:
                continue
            seen.add(address.ip_address)
            unique.append(address)
            if len(unique) >= _MAXIMUM_ADDRESS_ATTEMPTS:
                break
        path_and_query = parsed.path or "/"
        if parsed.query:
            path_and_query = f"{path_and_query}?{parsed.query}"
        return tuple(
            _AddressTarget(
                host=host,
                port=port,
                ip_address=address.ip_address,
                path_and_query=path_and_query,
            )
            for address in unique
        )


def diagnostic_live_definitions(
    *,
    catalog: OfficialSourceCatalog,
    timeout_seconds: float,
) -> tuple[OfficialObservationDefinition, ...]:
    fetchers: dict[str, SourceFetcher] = {}
    for source in catalog.sources:
        effective_timeout = max(
            timeout_seconds,
            _SOURCE_MINIMUM_TIMEOUT_SECONDS.get(
                source.source_id,
                timeout_seconds,
            ),
        )
        fetchers[source.source_id] = DiagnosticOfficialSourceHTTPFetcher(
            policy=OfficialFetchPolicy(
                allowed_hosts=source.allowed_hosts,
                timeout_seconds=effective_timeout,
            ),
            transport=StdlibPinnedHTTPSFetchTransport(),
        )
    return definitions_from_catalog(catalog=catalog, fetchers=fetchers)


def _aggregate_diagnostics(
    diagnostics: list[tuple[FetchDisposition, str]],
) -> tuple[FetchDisposition, str]:
    retryable = next(
        (
            diagnostic
            for diagnostic in diagnostics
            if diagnostic[0] is FetchDisposition.RETRYABLE_FAILURE
        ),
        None,
    )
    return retryable or diagnostics[0]


def _security_failure(error: FetchSecurityError) -> FetchResponse:
    disposition = (
        FetchDisposition.RETRYABLE_FAILURE
        if error.error_code in _RETRYABLE_SECURITY_CODES
        else FetchDisposition.PERMANENT_FAILURE
    )
    return _failure(disposition, error.error_code)


def _transport_diagnostic(
    error: Exception,
) -> tuple[FetchDisposition, str] | None:
    if isinstance(error, ssl.SSLCertVerificationError):
        return (
            FetchDisposition.PERMANENT_FAILURE,
            "source_tls_certificate_verification_failed",
        )
    if isinstance(error, ssl.SSLError):
        return FetchDisposition.RETRYABLE_FAILURE, "source_tls_handshake_failed"
    if isinstance(error, socket.gaierror):
        return FetchDisposition.RETRYABLE_FAILURE, "source_dns_transport_failure"
    if isinstance(error, http.client.RemoteDisconnected):
        return FetchDisposition.RETRYABLE_FAILURE, "source_http_remote_disconnected"
    if isinstance(error, http.client.BadStatusLine):
        return FetchDisposition.RETRYABLE_FAILURE, "source_http_bad_status_line"
    if isinstance(error, http.client.IncompleteRead):
        return FetchDisposition.RETRYABLE_FAILURE, "source_http_incomplete_read"
    if isinstance(error, http.client.HTTPException):
        return FetchDisposition.RETRYABLE_FAILURE, "source_http_protocol_failure"
    if isinstance(error, (socket.timeout, TimeoutError)):
        return FetchDisposition.RETRYABLE_FAILURE, "source_transport_timeout"
    if isinstance(error, OSError):
        errno_value = error.errno
        error_code = (
            _OS_ERROR_CODES.get(errno_value, "source_transport_unknown")
            if errno_value is not None
            else "source_transport_unknown"
        )
        return FetchDisposition.RETRYABLE_FAILURE, error_code
    return None


def _failure(disposition: FetchDisposition, error_code: str) -> FetchResponse:
    return FetchResponse(
        disposition=disposition,
        body=None,
        fetched_at=datetime.now(UTC),
        error_code=error_code,
    )


def _normalize_headers(headers: Mapping[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for raw_name, raw_value in headers.items():
        name = raw_name.casefold().strip()
        if not name or "\r" in raw_value or "\n" in raw_value:
            raise FetchSecurityError("source_response_header_invalid")
        normalized[name] = raw_value.strip()
    return normalized
