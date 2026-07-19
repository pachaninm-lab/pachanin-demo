from __future__ import annotations

import ssl
from datetime import UTC, datetime, timedelta

from tai.managed_loader import FetchDisposition, FetchRequest
from tai.official_source_diagnostics import (
    DiagnosticOfficialSourceHTTPFetcher,
    diagnostic_live_definitions,
)
from tai.official_source_fetcher import (
    OfficialFetchPolicy,
    ResolvedAddress,
    TransportRequest,
    TransportResponse,
)
from tai.source_coverage import (
    CoverageRequirement,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceDefinition,
    SourceFormat,
)

HOST = "data.example.gov"
NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


class _Resolver:
    def __init__(self, addresses: tuple[str, ...]) -> None:
        self._addresses = addresses

    def resolve(self, host: str, port: int) -> tuple[ResolvedAddress, ...]:
        return tuple(
            ResolvedAddress(host=host, port=port, ip_address=address)
            for address in self._addresses
        )


class _BindingMismatchResolver:
    def resolve(self, host: str, port: int) -> tuple[ResolvedAddress, ...]:
        del host
        return (
            ResolvedAddress(
                host="other.example.gov",
                port=port,
                ip_address="8.8.8.8",
            ),
        )


class _AddressAwareTransport:
    def __init__(self, outcomes: dict[str, Exception | TransportResponse]) -> None:
        self._outcomes = outcomes
        self.requests: list[TransportRequest] = []

    def exchange(self, request: TransportRequest) -> TransportResponse:
        self.requests.append(request)
        outcome = self._outcomes[request.target_ip]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class _Monotonic:
    def __init__(self, values: list[float]) -> None:
        self._values = values

    def __call__(self) -> float:
        if len(self._values) > 1:
            return self._values.pop(0)
        return self._values[0]


class _SequenceTransport:
    def __init__(self, outcomes: list[Exception | TransportResponse]) -> None:
        self._outcomes = outcomes
        self.requests: list[TransportRequest] = []

    def exchange(self, request: TransportRequest) -> TransportResponse:
        self.requests.append(request)
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def _response(status_code: int = 200) -> TransportResponse:
    body = b"<html><body>official data 19.07.2026</body></html>"
    return TransportResponse(
        status_code=status_code,
        headers={
            "content-type": "text/html; charset=utf-8",
            "content-length": str(len(body)),
        },
        body=body,
        received_at=NOW,
    )


def _fetcher(
    addresses: tuple[str, ...],
    outcomes: dict[str, Exception | TransportResponse],
) -> tuple[DiagnosticOfficialSourceHTTPFetcher, _AddressAwareTransport]:
    transport = _AddressAwareTransport(outcomes)
    return (
        DiagnosticOfficialSourceHTTPFetcher(
            policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
            resolver=_Resolver(addresses),
            transport=transport,
        ),
        transport,
    )


def test_certificate_failure_on_one_public_address_fails_over_with_same_host() -> None:
    fetcher, transport = _fetcher(
        ("8.8.8.8", "8.8.4.4"),
        {
            "8.8.4.4": ssl.SSLCertVerificationError(1, "invalid chain"),
            "8.8.8.8": _response(),
        },
    )

    result = fetcher.fetch(
        FetchRequest(source_id="official.example", source_uri=f"https://{HOST}/")
    )

    assert result.disposition is FetchDisposition.FETCHED
    assert [request.target_ip for request in transport.requests] == [
        "8.8.4.4",
        "8.8.8.8",
    ]
    assert all(request.host == HOST for request in transport.requests)


def test_timeout_on_one_public_address_fails_over_to_next_address() -> None:
    fetcher, transport = _fetcher(
        ("9.9.9.9", "8.8.8.8"),
        {
            "8.8.8.8": TimeoutError("slow edge"),
            "9.9.9.9": _response(),
        },
    )

    result = fetcher.fetch(
        FetchRequest(source_id="official.example", source_uri=f"https://{HOST}/")
    )

    assert result.disposition is FetchDisposition.FETCHED
    assert [request.target_ip for request in transport.requests] == [
        "8.8.8.8",
        "9.9.9.9",
    ]


def test_all_certificate_failures_remain_permanent_and_fail_closed() -> None:
    fetcher, _ = _fetcher(
        ("8.8.8.8", "9.9.9.9"),
        {
            "8.8.8.8": ssl.SSLCertVerificationError(1, "invalid chain one"),
            "9.9.9.9": ssl.SSLCertVerificationError(1, "invalid chain two"),
        },
    )

    result = fetcher.fetch(
        FetchRequest(source_id="official.example", source_uri=f"https://{HOST}/")
    )

    assert result.disposition is FetchDisposition.PERMANENT_FAILURE
    assert result.error_code == "source_tls_certificate_verification_failed"


def test_address_attempts_are_bounded_to_four_verified_addresses() -> None:
    addresses = ("1.1.1.1", "8.8.4.4", "8.8.8.8", "9.9.9.9", "93.184.216.34")
    outcomes: dict[str, Exception | TransportResponse] = {
        address: TimeoutError("slow edge") for address in addresses
    }
    outcomes["93.184.216.34"] = _response()
    fetcher, transport = _fetcher(addresses, outcomes)

    result = fetcher.fetch(
        FetchRequest(source_id="official.example", source_uri=f"https://{HOST}/")
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_transport_timeout"
    assert len(transport.requests) == 4
    assert "93.184.216.34" not in {
        request.target_ip for request in transport.requests
    }


def test_addresses_share_one_monotonic_timeout_budget() -> None:
    fetcher, transport = _fetcher(
        ("1.1.1.1", "8.8.8.8", "9.9.9.9"),
        {
            "1.1.1.1": TimeoutError("slow edge one"),
            "8.8.8.8": TimeoutError("slow edge two"),
            "9.9.9.9": _response(),
        },
    )
    fetcher.policy = OfficialFetchPolicy(
        allowed_hosts=frozenset({HOST}),
        timeout_seconds=45,
    )
    fetcher.monotonic = _Monotonic([0.0, 0.0, 20.0, 44.95])

    result = fetcher.fetch(
        FetchRequest(source_id="official.example", source_uri=f"https://{HOST}/")
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_transport_timeout"
    assert [request.timeout_seconds for request in transport.requests] == [45.0, 25.0]
    assert len(transport.requests) == 2


def test_redirect_does_not_restart_monotonic_timeout_budget() -> None:
    redirect = TransportResponse(
        status_code=302,
        headers={"location": "/next"},
        body=b"",
        received_at=NOW,
    )
    transport = _SequenceTransport([redirect, TimeoutError("redirect edge slow")])
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(
            allowed_hosts=frozenset({HOST}),
            timeout_seconds=45,
        ),
        resolver=_Resolver(("8.8.8.8",)),
        transport=transport,
        monotonic=_Monotonic([0.0, 0.0, 44.0]),
    )

    result = fetcher.fetch(
        FetchRequest(source_id="official.example", source_uri=f"https://{HOST}/")
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_transport_timeout"
    assert [request.timeout_seconds for request in transport.requests] == [45.0, 1.0]


def test_resolver_binding_mismatch_fails_closed_before_transport() -> None:
    transport = _AddressAwareTransport({"8.8.8.8": _response()})
    fetcher = DiagnosticOfficialSourceHTTPFetcher(
        policy=OfficialFetchPolicy(allowed_hosts=frozenset({HOST})),
        resolver=_BindingMismatchResolver(),
        transport=transport,
    )

    result = fetcher.fetch(
        FetchRequest(source_id="official.example", source_uri=f"https://{HOST}/")
    )

    assert result.disposition is FetchDisposition.PERMANENT_FAILURE
    assert result.error_code == "source_resolver_binding_mismatch"
    assert transport.requests == []


def test_http_response_is_not_hidden_by_address_failover() -> None:
    fetcher, transport = _fetcher(
        ("8.8.4.4", "8.8.8.8"),
        {
            "8.8.4.4": _response(503),
            "8.8.8.8": _response(),
        },
    )

    result = fetcher.fetch(
        FetchRequest(source_id="official.example", source_uri=f"https://{HOST}/")
    )

    assert result.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert result.error_code == "source_http_503"
    assert [request.target_ip for request in transport.requests] == ["8.8.4.4"]


def test_specagro_live_definition_uses_requested_bounded_timeout() -> None:
    source = OfficialSourceDefinition(
        source_id="official.specagro.fgis-grain",
        owner="ФГБУ «Центр Агроаналитики» — оператор ФГИС «Зерно»",
        entrypoint_uri="https://specagro.ru/fgis/ok",
        allowed_hosts=frozenset({"specagro.ru"}),
        topics=frozenset({CoverageTopic.GRAIN_TRACEABILITY}),
        formats=frozenset({SourceFormat.HTML}),
        expected_update_interval=timedelta(days=31),
        maximum_publication_age=timedelta(days=365),
        verified_at=NOW,
    )
    catalog = OfficialSourceCatalog(
        sources=(source,),
        requirements=(
            CoverageRequirement(
                topic=CoverageTopic.GRAIN_TRACEABILITY,
                minimum_official_sources=1,
                maximum_publication_age=timedelta(days=365),
            ),
        ),
    )

    definitions = diagnostic_live_definitions(
        catalog=catalog,
        timeout_seconds=20,
    )

    fetcher = definitions[0].fetcher
    assert isinstance(fetcher, DiagnosticOfficialSourceHTTPFetcher)
    assert fetcher.policy.timeout_seconds == 20
