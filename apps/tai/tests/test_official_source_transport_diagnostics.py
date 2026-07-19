from __future__ import annotations

import errno
import http.client
import socket
import ssl

import pytest

from tai.managed_loader import FetchDisposition, FetchRequest
from tai.official_source_fetcher import (
    OfficialFetchPolicy,
    OfficialSourceHTTPFetcher,
    ResolvedAddress,
    TransportRequest,
    TransportResponse,
)

HOST = "data.example.gov"
SOURCE_URI = f"https://{HOST}/official"


class _Resolver:
    def resolve(self, host: str, port: int) -> tuple[ResolvedAddress, ...]:
        return (
            ResolvedAddress(
                host=host,
                port=port,
                ip_address="8.8.8.8",
            ),
        )


class _FailingTransport:
    def __init__(self, error: OSError | http.client.HTTPException) -> None:
        self._error = error

    def exchange(self, request: TransportRequest) -> TransportResponse:
        del request
        raise self._error


def _fetch(error: OSError | http.client.HTTPException) -> tuple[FetchDisposition, str]:
    fetcher = OfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_Resolver(),
        transport=_FailingTransport(error),
    )
    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=SOURCE_URI,
        )
    )
    assert result.error_code is not None
    return result.disposition, result.error_code


@pytest.mark.parametrize(
    ("error", "expected_code"),
    [
        (
            ssl.SSLCertVerificationError(1, "secret certificate detail"),
            "source_tls_certificate_invalid",
        ),
        (ssl.SSLError(1, "secret tls detail"), "source_tls_failure"),
        (
            http.client.RemoteDisconnected("secret remote detail"),
            "source_http_connection_closed",
        ),
        (
            http.client.BadStatusLine("secret status line"),
            "source_http_protocol_invalid",
        ),
        (
            http.client.IncompleteRead(b"partial", 10),
            "source_http_response_incomplete",
        ),
        (
            http.client.HTTPException("secret protocol detail"),
            "source_http_protocol_failure",
        ),
        (socket.timeout("secret timeout detail"), "source_transport_timeout"),
        (
            ConnectionRefusedError(errno.ECONNREFUSED, "secret refused detail"),
            "source_connection_refused",
        ),
        (
            ConnectionResetError(errno.ECONNRESET, "secret reset detail"),
            "source_connection_reset",
        ),
        (
            ConnectionAbortedError(errno.ECONNABORTED, "secret aborted detail"),
            "source_connection_aborted",
        ),
        (
            BrokenPipeError(errno.EPIPE, "secret broken detail"),
            "source_connection_broken",
        ),
        (
            socket.gaierror(socket.EAI_AGAIN, "secret dns detail"),
            "source_dns_resolution_failed",
        ),
        (
            OSError(errno.ENETUNREACH, "secret network detail"),
            "source_network_unreachable",
        ),
        (OSError("secret unknown detail"), "source_transport_failure"),
    ],
)
def test_transport_failures_emit_bounded_codes_without_raw_details(
    error: OSError | http.client.HTTPException,
    expected_code: str,
) -> None:
    disposition, error_code = _fetch(error)

    assert disposition is FetchDisposition.RETRYABLE_FAILURE
    assert error_code == expected_code
    assert "secret" not in error_code
    assert len(error_code) <= 64
