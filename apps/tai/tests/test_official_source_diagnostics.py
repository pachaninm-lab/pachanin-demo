from __future__ import annotations

import errno
import http.client
import socket
import ssl
from datetime import UTC, datetime
from pathlib import Path

import pytest

from tai.managed_loader import FetchDisposition, FetchRequest
from tai.official_source_diagnostics import (
    DiagnosticOfficialSourceHTTPFetcher,
    diagnostic_live_definitions,
)
from tai.official_source_fetcher import (
    FetchSecurityError,
    OfficialFetchPolicy,
    ResolvedAddress,
    TransportRequest,
    TransportResponse,
)
from tai.source_coverage import load_official_source_catalog

HOST = "data.example.gov"
URL = f"https://{HOST}/official"


class _Resolver:
    def resolve(self, host: str, port: int) -> tuple[ResolvedAddress, ...]:
        return (
            ResolvedAddress(
                host=host,
                port=port,
                ip_address="8.8.8.8",
            ),
        )


class _SecurityFailingResolver:
    def __init__(self, error_code: str) -> None:
        self.error_code = error_code

    def resolve(self, host: str, port: int) -> tuple[ResolvedAddress, ...]:
        raise FetchSecurityError(self.error_code)


class _FailingTransport:
    def __init__(self, error: Exception) -> None:
        self.error = error

    def exchange(self, request: TransportRequest) -> TransportResponse:
        raise self.error


class _SuccessTransport:
    def exchange(self, request: TransportRequest) -> TransportResponse:
        body = b"official content"
        return TransportResponse(
            status_code=200,
            headers={
                "content-length": str(len(body)),
                "content-type": "text/html; charset=utf-8",
            },
            body=body,
            received_at=datetime(2026, 7, 19, 12, 0, tzinfo=UTC),
        )


def _fetcher(error: Exception) -> DiagnosticOfficialSourceHTTPFetcher:
    return DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_Resolver(),
        transport=_FailingTransport(error),
    )


def _request() -> FetchRequest:
    return FetchRequest(
        source_id="official.example",
        source_uri=URL,
    )


@pytest.mark.parametrize(
    ("error", "disposition", "error_code"),
    [
        (
            ssl.SSLCertVerificationError(1, "certificate rejected"),
            FetchDisposition.PERMANENT_FAILURE,
            "source_tls_certificate_verification_failed",
        ),
        (
            ssl.SSLError(1, "handshake failed"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_tls_handshake_failed",
        ),
        (
            socket.gaierror(-2, "resolver failed inside transport"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_dns_transport_failure",
        ),
        (
            http.client.RemoteDisconnected("remote closed"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_http_remote_disconnected",
        ),
        (
            http.client.BadStatusLine("broken"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_http_bad_status_line",
        ),
        (
            http.client.IncompleteRead(b"x", 2),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_http_incomplete_read",
        ),
        (
            http.client.HTTPException("protocol failed"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_http_protocol_failure",
        ),
        (
            TimeoutError("timed out"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_transport_timeout",
        ),
        (
            OSError(errno.ECONNREFUSED, "refused"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_connection_refused",
        ),
        (
            OSError(errno.ECONNRESET, "reset"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_connection_reset",
        ),
        (
            OSError(errno.ENETUNREACH, "network unreachable"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_network_unreachable",
        ),
        (
            OSError("unclassified transport failure"),
            FetchDisposition.RETRYABLE_FAILURE,
            "source_transport_unknown",
        ),
    ],
)
def test_transport_failures_preserve_bounded_diagnostic_codes(
    error: Exception,
    disposition: FetchDisposition,
    error_code: str,
) -> None:
    result = _fetcher(error).fetch(_request())

    assert result.disposition is disposition
    assert result.error_code == error_code
    assert result.body is None


@pytest.mark.parametrize(
    "error_code",
    [
        "source_dns_resolution_failed",
        "source_dns_resolution_empty",
    ],
)
def test_transient_dns_security_failures_remain_retryable(error_code: str) -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_SecurityFailingResolver(error_code),
        transport=_SuccessTransport(),
    )

    result = fetcher.fetch(_request())

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == error_code


def test_unknown_programming_exception_is_not_hidden_as_network_failure() -> None:
    fetcher = _fetcher(RuntimeError("programming defect"))

    with pytest.raises(RuntimeError, match="programming defect"):
        fetcher.fetch(_request())


def test_repository_live_definitions_use_diagnostic_fetchers_in_catalog_order() -> None:
    catalog_path = (
        Path(__file__).resolve().parents[1]
        / "knowledge-sources"
        / "official-sources.v1.json"
    )
    catalog = load_official_source_catalog(catalog_path)

    definitions = diagnostic_live_definitions(
        catalog=catalog,
        timeout_seconds=20.0,
    )

    assert tuple(definition.source.source_id for definition in definitions) == tuple(
        source.source_id for source in catalog.sources
    )
    assert all(
        isinstance(definition.fetcher, DiagnosticOfficialSourceHTTPFetcher)
        for definition in definitions
    )
