from __future__ import annotations

import errno

from tai.managed_loader import FetchDisposition, FetchRequest
from tai.official_source_diagnostics import DiagnosticOfficialSourceHTTPFetcher
from tai.official_source_fetcher import (
    OfficialFetchPolicy,
    ResolvedAddress,
    TransportRequest,
    TransportResponse,
)

HOST = "data.example.gov"


class _Resolver:
    def resolve(self, host: str, port: int) -> tuple[ResolvedAddress, ...]:
        return (ResolvedAddress(host=host, port=port, ip_address="8.8.8.8"),)


class _SensitiveFailingTransport:
    def exchange(self, request: TransportRequest) -> TransportResponse:
        raise OSError(
            errno.ECONNREFUSED,
            "sensitive-hostname.example 203.0.113.7 token=secret",
        )


def test_diagnostic_result_never_copies_sensitive_exception_text() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_Resolver(),
        transport=_SensitiveFailingTransport(),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_connection_refused"
    assert "secret" not in result.error_code
    assert "203.0.113.7" not in result.error_code
