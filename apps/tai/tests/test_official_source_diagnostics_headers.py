from __future__ import annotations

from datetime import UTC, datetime

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


class _InvalidHeaderTransport:
    def exchange(self, request: TransportRequest) -> TransportResponse:
        return TransportResponse(
            status_code=200,
            headers={"content-type": "text/plain\r\nX-Evil: true"},
            body=b"x",
            received_at=datetime(2026, 7, 19, 12, 0, tzinfo=UTC),
        )


def test_diagnostic_fetcher_keeps_invalid_response_headers_fail_closed() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_Resolver(),
        transport=_InvalidHeaderTransport(),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.PERMANENT_FAILURE
    assert result.error_code == "source_response_header_invalid"
