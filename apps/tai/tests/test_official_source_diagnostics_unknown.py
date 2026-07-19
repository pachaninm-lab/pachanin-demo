from __future__ import annotations

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


class _UnknownOSErrorTransport:
    def exchange(self, request: TransportRequest) -> TransportResponse:
        raise OSError("vendor-specific failure")


def test_unknown_os_error_is_bounded_without_exception_text() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_Resolver(),
        transport=_UnknownOSErrorTransport(),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_transport_unknown"
    assert "vendor" not in result.error_code
