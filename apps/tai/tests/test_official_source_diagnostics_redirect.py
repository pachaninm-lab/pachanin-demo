from __future__ import annotations

from collections import deque
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


class _RedirectTransport:
    def __init__(self) -> None:
        self.responses = deque(
            [
                TransportResponse(
                    status_code=302,
                    headers={"location": "/next"},
                    body=b"",
                    received_at=datetime(2026, 7, 19, 12, 0, tzinfo=UTC),
                ),
                TransportResponse(
                    status_code=200,
                    headers={
                        "content-length": "2",
                        "content-type": "text/plain; charset=utf-8",
                    },
                    body=b"ok",
                    received_at=datetime(2026, 7, 19, 12, 0, tzinfo=UTC),
                ),
            ]
        )
        self.paths: list[str] = []

    def exchange(self, request: TransportRequest) -> TransportResponse:
        self.paths.append(request.path_and_query)
        return self.responses.popleft()


def test_diagnostic_fetcher_preserves_same_host_redirect_revalidation() -> None:
    transport = _RedirectTransport()
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_Resolver(),
        transport=transport,
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.FETCHED
    assert result.body == "ok"
    assert transport.paths == ["/official", "/next"]
