from __future__ import annotations

from tai.managed_loader import FetchDisposition, FetchRequest
from tai.official_source_diagnostics import DiagnosticOfficialSourceHTTPFetcher
from tai.official_source_fetcher import OfficialFetchPolicy


def test_diagnostic_fetcher_keeps_host_policy_failure_permanent() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({"allowed.example"})),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri="https://forbidden.example/data",
        )
    )

    assert result.disposition is FetchDisposition.PERMANENT_FAILURE
    assert result.error_code == "source_url_host_not_allowed"
