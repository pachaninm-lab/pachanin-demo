from __future__ import annotations

import http.client

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


class _RemoteDisconnectTransport:
    def exchange(self, request: TransportRequest) -> TransportResponse:
        raise http.client.RemoteDisconnected("remote closed")


def test_remote_disconnect_is_not_collapsed_into_connection_reset() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_Resolver(),
        transport=_RemoteDisconnectTransport(),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_http_remote_disconnected"
