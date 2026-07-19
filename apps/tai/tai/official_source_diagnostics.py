from __future__ import annotations

import errno
import http.client
import socket
import ssl
from collections.abc import Mapping
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
    StdlibPinnedHTTPSFetchTransport,
    TransportRequest,
)
from tai.official_source_observation import (
    OfficialObservationDefinition,
    definitions_from_catalog,
)
from tai.source_coverage import OfficialSourceCatalog

_REDIRECT_STATUS = frozenset({301, 302, 303, 307, 308})
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


class DiagnosticOfficialSourceHTTPFetcher(OfficialSourceHTTPFetcher):
    """Official fetcher that preserves bounded transport failure categories."""

    def fetch(self, request: FetchRequest) -> FetchResponse:
        current_url = request.source_uri
        try:
            request_headers = self._request_headers(request)
        except FetchSecurityError as error:
            return _security_failure(error)

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
                return _security_failure(error)
            except Exception as error:
                diagnostic = _transport_diagnostic(error)
                if diagnostic is None:
                    raise
                disposition, error_code = diagnostic
                return _failure(disposition, error_code)
        return _failure(
            FetchDisposition.PERMANENT_FAILURE,
            "source_redirect_limit_exceeded",
        )


def diagnostic_live_definitions(
    *,
    catalog: OfficialSourceCatalog,
    timeout_seconds: float,
) -> tuple[OfficialObservationDefinition, ...]:
    fetchers: dict[str, SourceFetcher] = {}
    for source in catalog.sources:
        fetchers[source.source_id] = DiagnosticOfficialSourceHTTPFetcher(
            policy=OfficialFetchPolicy(
                allowed_hosts=source.allowed_hosts,
                timeout_seconds=timeout_seconds,
            ),
            transport=StdlibPinnedHTTPSFetchTransport(),
        )
    return definitions_from_catalog(catalog=catalog, fetchers=fetchers)


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
