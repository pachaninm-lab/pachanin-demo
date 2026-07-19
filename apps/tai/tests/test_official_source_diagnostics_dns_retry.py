from __future__ import annotations

from tai.managed_loader import FetchDisposition, FetchRequest
from tai.official_source_diagnostics import DiagnosticOfficialSourceHTTPFetcher
from tai.official_source_fetcher import FetchSecurityError, OfficialFetchPolicy

HOST = "data.example.gov"


class _UnavailableResolver:
    def resolve(self, host: str, port: int) -> tuple[object, ...]:
        raise FetchSecurityError("source_dns_resolution_failed")


def test_dns_resolution_availability_failure_is_retryable() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_UnavailableResolver(),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_dns_resolution_failed"
