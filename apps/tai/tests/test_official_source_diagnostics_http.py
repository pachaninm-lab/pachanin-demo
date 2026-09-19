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


class _StatusTransport:
    def __init__(self, status_code: int) -> None:
        self.status_code = status_code

    def exchange(self, request: TransportRequest) -> TransportResponse:
        body = b"status"
        return TransportResponse(
            status_code=self.status_code,
            headers={
                "content-length": str(len(body)),
                "content-type": "text/plain; charset=utf-8",
            },
            body=body,
            received_at=datetime(2026, 7, 19, 12, 0, tzinfo=UTC),
        )


def test_diagnostic_fetcher_preserves_existing_http_status_contract() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_Resolver(),
        transport=_StatusTransport(503),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_http_503"
