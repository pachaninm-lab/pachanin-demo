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


class _OversizedTransport:
    def exchange(self, request: TransportRequest) -> TransportResponse:
        body = b"12345"
        return TransportResponse(
            status_code=200,
            headers={
                "content-length": str(len(body)),
                "content-type": "text/plain; charset=utf-8",
            },
            body=body,
            received_at=datetime(2026, 7, 19, 12, 0, tzinfo=UTC),
        )


def test_diagnostic_fetcher_preserves_wire_limit() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(
            allowed_hosts=frozenset({HOST}),
            maximum_wire_bytes=4,
            maximum_decoded_bytes=8,
        ),
        resolver=_Resolver(),
        transport=_OversizedTransport(),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.PERMANENT_FAILURE
    assert result.error_code == "source_response_wire_limit_exceeded"
