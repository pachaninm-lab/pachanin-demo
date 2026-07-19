from __future__ import annotations

from tai.managed_loader import FetchDisposition, FetchRequest
from tai.official_source_diagnostics import DiagnosticOfficialSourceHTTPFetcher
from tai.official_source_fetcher import FetchSecurityError, OfficialFetchPolicy

HOST = "data.example.gov"


class _PrivateDNSResolver:
    def resolve(self, host: str, port: int) -> tuple[object, ...]:
        raise FetchSecurityError("source_dns_address_not_public")


def test_private_dns_answer_remains_a_permanent_policy_failure() -> None:
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_PrivateDNSResolver(),
    )

    result = fetcher.fetch(
        FetchRequest(
            source_id="official.example",
            source_uri=f"https://{HOST}/official",
        )
    )

    assert result.disposition is FetchDisposition.PERMANENT_FAILURE
    assert result.error_code == "source_dns_address_not_public"
