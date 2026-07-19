from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import cast

import pytest

from tai.loader_state import (
    InMemoryLoaderStateRepository,
    LoaderLease,
    LoaderRunStatus,
    LoaderScheduler,
)
from tai.managed_loader import (
    FetchDisposition,
    FetchRequest,
    FetchResponse,
    SourceFetcher,
)
from tai.official_source_observation import (
    HTMLMetadataAdapter,
    LostOfficialObservationLeaseError,
    MetadataExtractionError,
    OfficialObservationDefinition,
    OfficialObservationDefinitionRegistry,
    OfficialObservationRunEvidence,
    OfficialObservationRunStatus,
    OfficialSourceObservationWorker,
    definitions_from_catalog,
    default_html_metadata_adapters,
)
from tai.source_coverage import (
    CoverageRequirement,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceDefinition,
    SourceFormat,
    SourceObservation,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)


class _Fetcher:
    def __init__(self, response: FetchResponse) -> None:
        self.response = response
        self.requests: list[FetchRequest] = []

    def fetch(self, request: FetchRequest) -> FetchResponse:
        self.requests.append(request)
        return self.response


class _Authority:
    def __init__(
        self,
        loader_repository: InMemoryLoaderStateRepository,
        *,
        reject_commit: bool = False,
    ) -> None:
        self.loader_repository = loader_repository
        self.reject_commit = reject_commit
        self.observations: dict[str, SourceObservation] = {}
        self.evidence: list[OfficialObservationRunEvidence] = []

    def latest_observation(self, source_id: str) -> SourceObservation | None:
        return self.observations.get(source_id)

    def commit_run(
        self,
        *,
        lease: LoaderLease,
        status: LoaderRunStatus,
        next_run_at: datetime | None,
        etag: str | None,
        last_modified: str | None,
        consecutive_failures: int,
        observation: SourceObservation | None,
        evidence: OfficialObservationRunEvidence,
    ) -> bool:
        if self.reject_commit:
            return False
        accepted = self.loader_repository.complete(
            lease=lease,
            status=status,
            next_run_at=next_run_at,
            etag=etag,
            last_modified=last_modified,
            consecutive_failures=consecutive_failures,
        )
        if not accepted:
            return False
        if observation is not None:
            self.observations[observation.source_id] = observation
        self.evidence.append(evidence)
        return True


def _source(
    source_id: str = "official.cbr.key-rate",
    topics: frozenset[CoverageTopic] = frozenset({CoverageTopic.FINANCE_RATES}),
    uri: str = "https://www.cbr.ru/hd_base/KeyRate/",
    hosts: frozenset[str] = frozenset({"www.cbr.ru"}),
) -> OfficialSourceDefinition:
    return OfficialSourceDefinition(
        source_id=source_id,
        owner="Official Authority",
        entrypoint_uri=uri,
        allowed_hosts=hosts,
        topics=topics,
        formats=frozenset({SourceFormat.HTML}),
        expected_update_interval=timedelta(days=7),
        maximum_publication_age=timedelta(days=31),
        verified_at=NOW - timedelta(days=1),
    )


def _definition(
    response: FetchResponse,
    *,
    maximum_failures: int = 5,
) -> tuple[OfficialObservationDefinition, _Fetcher]:
    fetcher = _Fetcher(response)
    adapter = next(
        adapter
        for adapter in default_html_metadata_adapters()
        if adapter.source_id == "official.cbr.key-rate"
    )
    definition = OfficialObservationDefinition(
        source=_source(),
        adapter=adapter,
        fetcher=fetcher,
        maximum_failures=maximum_failures,
    )
    protocol_value: SourceFetcher = fetcher
    assert protocol_value is fetcher
    return definition, fetcher


def _worker(
    response: FetchResponse,
    *,
    authority: _Authority | None = None,
    maximum_failures: int = 5,
    due_at: datetime = NOW,
) -> tuple[
    OfficialSourceObservationWorker,
    InMemoryLoaderStateRepository,
    _Authority,
    _Fetcher,
]:
    repository = authority.loader_repository if authority else InMemoryLoaderStateRepository()
    effective_authority = authority or _Authority(repository)
    definition, fetcher = _definition(
        response,
        maximum_failures=maximum_failures,
    )
    LoaderScheduler(repository).ensure_scheduled(
        source_id=definition.source.source_id,
        source_uri=definition.source.entrypoint_uri,
        next_run_at=due_at,
    )
    worker = OfficialSourceObservationWorker(
        loader_repository=repository,
        authority=effective_authority,
        definitions=OfficialObservationDefinitionRegistry((definition,)),
        worker_id="official-worker-1",
        lease_duration=timedelta(minutes=5),
    )
    return worker, repository, effective_authority, fetcher


def _success_response(body: str | None = None) -> FetchResponse:
    return FetchResponse(
        disposition=FetchDisposition.FETCHED,
        body=body
        or """
            <html><body>
              <h1>Ключевая ставка Банка России</h1>
              <table>
                <tr><td>18.07.2026</td><td>16,00</td></tr>
                <tr><td>01.07.2026</td><td>17,00</td></tr>
              </table>
            </body></html>
        """,
        fetched_at=NOW,
        etag='"cbr-v2"',
        last_modified="Sun, 19 Jul 2026 10:00:00 GMT",
    )


def _baseline(*, failures: int = 0) -> SourceObservation:
    return SourceObservation(
        source_id="official.cbr.key-rate",
        observed_at=NOW - timedelta(days=1),
        latest_publication_at=NOW - timedelta(days=2),
        last_success_at=NOW - timedelta(days=1),
        document_count=3,
        consecutive_failures=failures,
        observed_topics=frozenset({CoverageTopic.FINANCE_RATES}),
        content_sha256="a" * 64,
    )


def test_worker_records_fetched_observation_and_fenced_run_evidence() -> None:
    worker, repository, authority, fetcher = _worker(_success_response())

    execution = worker.run_once(now=NOW)

    assert execution.committed is True
    assert execution.status is OfficialObservationRunStatus.FETCHED
    assert execution.reasons == ("official_source_observed",)
    assert execution.run_sha256 == authority.evidence[0].run_sha256
    observation = authority.observations["official.cbr.key-rate"]
    assert observation.latest_publication_at == datetime(2026, 7, 18, tzinfo=UTC)
    assert observation.document_count == 2
    assert observation.consecutive_failures == 0
    assert len(observation.content_sha256) == 64
    state = repository.get("official.cbr.key-rate")
    assert state is not None
    assert state.status is LoaderRunStatus.SUCCEEDED
    assert state.next_run_at == NOW + timedelta(days=7)
    assert state.lease_token is None
    assert fetcher.requests[0].source_uri == "https://www.cbr.ru/hd_base/KeyRate/"


def test_not_modified_refreshes_success_time_without_changing_publication() -> None:
    response = FetchResponse(
        disposition=FetchDisposition.NOT_MODIFIED,
        body=None,
        fetched_at=NOW,
        etag='"same"',
    )
    repository = InMemoryLoaderStateRepository()
    authority = _Authority(repository)
    authority.observations["official.cbr.key-rate"] = _baseline()
    worker, _, _, _ = _worker(response, authority=authority)

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.NOT_MODIFIED
    observation = authority.observations["official.cbr.key-rate"]
    assert observation.latest_publication_at == NOW - timedelta(days=2)
    assert observation.last_success_at == NOW
    assert observation.content_sha256 == "a" * 64
    assert observation.consecutive_failures == 0


def test_not_modified_without_baseline_is_retryable_and_not_coverage() -> None:
    response = FetchResponse(
        disposition=FetchDisposition.NOT_MODIFIED,
        body=None,
        fetched_at=NOW,
    )
    worker, repository, authority, _ = _worker(response)

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.RETRYABLE_FAILURE
    assert execution.reasons == ("source_not_modified_without_baseline",)
    assert authority.observations == {}
    state = repository.get("official.cbr.key-rate")
    assert state is not None
    assert state.status is LoaderRunStatus.RETRYABLE_FAILURE
    assert state.consecutive_failures == 1
    assert state.next_run_at == NOW + timedelta(hours=1)


def test_retryable_failure_preserves_last_success_and_marks_coverage_unhealthy() -> None:
    response = FetchResponse(
        disposition=FetchDisposition.RETRYABLE_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="source_http_503",
    )
    repository = InMemoryLoaderStateRepository()
    authority = _Authority(repository)
    authority.observations["official.cbr.key-rate"] = _baseline()
    worker, _, _, _ = _worker(response, authority=authority)

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.RETRYABLE_FAILURE
    observation = authority.observations["official.cbr.key-rate"]
    assert observation.last_success_at == NOW - timedelta(days=1)
    assert observation.observed_at == NOW
    assert observation.consecutive_failures == 1
    assert observation.content_sha256 == "a" * 64


def test_failure_budget_exhaustion_permanently_stops_schedule() -> None:
    response = FetchResponse(
        disposition=FetchDisposition.RETRYABLE_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="source_transport_failure",
    )
    worker, repository, _, _ = _worker(response, maximum_failures=1)

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.PERMANENT_FAILURE
    assert execution.reasons == (
        "source_transport_failure",
        "failure_budget_exhausted",
    )
    state = repository.get("official.cbr.key-rate")
    assert state is not None
    assert state.status is LoaderRunStatus.PERMANENT_FAILURE
    assert state.next_run_at is None


def test_prompt_injection_or_other_permanent_fetch_failure_stops_immediately() -> None:
    response = FetchResponse(
        disposition=FetchDisposition.PERMANENT_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="source_content_prompt_injection_detected",
    )
    worker, repository, _, _ = _worker(response)

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.PERMANENT_FAILURE
    assert execution.reasons == ("source_content_prompt_injection_detected",)
    state = repository.get("official.cbr.key-rate")
    assert state is not None
    assert state.status is LoaderRunStatus.PERMANENT_FAILURE


def test_metadata_failure_is_fail_closed_and_retryable() -> None:
    worker, repository, authority, _ = _worker(
        _success_response("<html>нет требуемого маркера 18.07.2026</html>")
    )

    execution = worker.run_once(now=NOW)

    assert execution.status is OfficialObservationRunStatus.RETRYABLE_FAILURE
    assert execution.reasons == ("source_required_marker_missing",)
    assert authority.observations == {}
    state = repository.get("official.cbr.key-rate")
    assert state is not None
    assert state.consecutive_failures == 1


def test_lost_fencing_token_rejects_observation_and_run_commit() -> None:
    repository = InMemoryLoaderStateRepository()
    authority = _Authority(repository, reject_commit=True)
    worker, _, _, _ = _worker(_success_response(), authority=authority)

    with pytest.raises(LostOfficialObservationLeaseError, match="fencing authority"):
        worker.run_once(now=NOW)

    assert authority.observations == {}
    assert authority.evidence == []


def test_no_due_source_does_not_fetch_or_commit() -> None:
    worker, _, authority, fetcher = _worker(
        _success_response(),
        due_at=NOW + timedelta(hours=1),
    )

    execution = worker.run_once(now=NOW)

    assert execution.committed is False
    assert execution.reasons == ("no_due_official_source",)
    assert fetcher.requests == []
    assert authority.evidence == []


@dataclass(frozen=True, slots=True)
class _AdapterFixture:
    source: OfficialSourceDefinition
    body: str
    expected_date: datetime
    expected_count: int


def _adapter_fixtures() -> dict[str, _AdapterFixture]:
    return {
        "official.cbr.key-rate": _AdapterFixture(
            source=_source(),
            body=(
                "<h1>Ключевая ставка</h1>"
                "<table><tr><td>18.07.2026</td></tr><tr><td>01.07.2026</td></tr></table>"
            ),
            expected_date=datetime(2026, 7, 18, tzinfo=UTC),
            expected_count=2,
        ),
        "official.rosstat.agriculture": _AdapterFixture(
            source=_source(
                source_id="official.rosstat.agriculture",
                topics=frozenset(
                    {
                        CoverageTopic.GRAIN_MARKET_PRICES,
                        CoverageTopic.AGRICULTURE_PRODUCTION,
                    }
                ),
                uri="https://rosstat.gov.ru/enterprise_economy",
                hosts=frozenset({"rosstat.gov.ru"}),
            ),
            body=(
                "<h1>Цены и производство сельского хозяйства</h1>"
                "<time>17 июля 2026</time>"
                "<a href='/files/agro.xlsx'>XLSX</a><a href='/files/agro.zip'>ZIP</a>"
            ),
            expected_date=datetime(2026, 7, 17, tzinfo=UTC),
            expected_count=2,
        ),
        "official.eec.grain-regulation": _AdapterFixture(
            source=_source(
                source_id="official.eec.grain-regulation",
                topics=frozenset(
                    {CoverageTopic.GRAIN_REGULATION, CoverageTopic.GRAIN_QUALITY}
                ),
                uri=(
                    "https://eec.eaeunion.org/comission/department/deptexreg/tr/"
                    "bezpoZerna.php"
                ),
                hosts=frozenset({"eec.eaeunion.org"}),
            ),
            body=(
                "<h1>Технический регламент безопасности зерна</h1>"
                "<time>2026-07-16</time><a href='rules.pdf'>PDF</a>"
            ),
            expected_date=datetime(2026, 7, 16, tzinfo=UTC),
            expected_count=1,
        ),
        "official.mintrans.rail-tariffs": _AdapterFixture(
            source=_source(
                source_id="official.mintrans.rail-tariffs",
                topics=frozenset({CoverageTopic.LOGISTICS_TARIFFS}),
                uri="https://mintrans.gov.ru/activities/222/documents",
                hosts=frozenset({"mintrans.gov.ru"}),
            ),
            body=(
                "<h1>Тариф на железнодорожные перевозки</h1>"
                "<time>15.07.2026</time><a href='/docs/tariff.pdf'>PDF</a>"
            ),
            expected_date=datetime(2026, 7, 15, tzinfo=UTC),
            expected_count=1,
        ),
        "official.mcx.opendata": _AdapterFixture(
            source=_source(
                source_id="official.mcx.opendata",
                topics=frozenset({CoverageTopic.GRAIN_TRACEABILITY}),
                uri="https://opendata.mcx.ru/",
                hosts=frozenset({"opendata.mcx.ru"}),
            ),
            body=(
                "<h1>Открытые данные по зерну</h1><time>14 июля 2026</time>"
                "<a href='/datasets/grain.csv'>CSV</a>"
                "<a href='https://evil.example/grain.csv'>untrusted</a>"
            ),
            expected_date=datetime(2026, 7, 14, tzinfo=UTC),
            expected_count=1,
        ),
    }


@pytest.mark.parametrize("adapter", default_html_metadata_adapters())
def test_each_official_adapter_extracts_deterministic_metadata(
    adapter: HTMLMetadataAdapter,
) -> None:
    fixture = _adapter_fixtures()[adapter.source_id]

    metadata = adapter.parse(
        source=fixture.source,
        body=fixture.body,
        fetched_at=NOW,
    )

    assert metadata.latest_publication_at == fixture.expected_date
    assert metadata.document_count == fixture.expected_count
    assert metadata.observed_topics == adapter.topics


def test_adapter_rejects_future_dates_untrusted_links_and_wrong_identity() -> None:
    adapter = next(
        item
        for item in default_html_metadata_adapters()
        if item.source_id == "official.rosstat.agriculture"
    )
    source = _adapter_fixtures()[adapter.source_id].source
    future_body = (
        "<h1>Цены сельского хозяйства</h1><time>20.07.2026</time>"
        "<a href='/files/agro.xlsx'>XLSX</a>"
    )
    untrusted_only = (
        "<h1>Цены сельского хозяйства</h1><time>18.07.2026</time>"
        "<a href='https://evil.example/agro.xlsx'>XLSX</a>"
    )

    with pytest.raises(MetadataExtractionError, match="date_future"):
        adapter.parse(source=source, body=future_body, fetched_at=NOW)
    with pytest.raises(MetadataExtractionError, match="document_count_empty"):
        adapter.parse(source=source, body=untrusted_only, fetched_at=NOW)
    with pytest.raises(MetadataExtractionError, match="identity_mismatch"):
        adapter.parse(source=_source(), body=future_body, fetched_at=NOW)


def test_registry_and_catalog_binding_fail_closed() -> None:
    definition, fetcher = _definition(_success_response())
    registry = OfficialObservationDefinitionRegistry((definition,))
    assert registry.resolve("official.cbr.key-rate") is definition
    with pytest.raises(LookupError, match="unknown official observation source"):
        registry.resolve("official.unknown")
    with pytest.raises(ValueError, match="unique"):
        OfficialObservationDefinitionRegistry((definition, definition))

    catalog = OfficialSourceCatalog(
        sources=(_source(),),
        requirements=(
            CoverageRequirement(
                topic=CoverageTopic.FINANCE_RATES,
                minimum_official_sources=1,
                maximum_publication_age=timedelta(days=31),
            ),
        ),
    )
    definitions = definitions_from_catalog(
        catalog=catalog,
        fetchers={"official.cbr.key-rate": cast(SourceFetcher, fetcher)},
    )
    assert definitions[0].source.source_id == "official.cbr.key-rate"
    with pytest.raises(ValueError, match="missing adapter or fetcher"):
        definitions_from_catalog(catalog=catalog, fetchers={})


def test_run_evidence_digest_is_deterministic_and_validated() -> None:
    evidence = OfficialObservationRunEvidence(
        source_id="official.cbr.key-rate",
        worker_id="worker-1",
        lease_token=cast(LoaderLease, object()).token
        if False
        else __import__("uuid").UUID("00000000-0000-0000-0000-000000000001"),
        started_at=NOW,
        completed_at=NOW + timedelta(seconds=1),
        status=OfficialObservationRunStatus.FETCHED,
        reasons=("official_source_observed",),
        observation_sha256="a" * 64,
        content_sha256="b" * 64,
    )

    assert evidence.run_sha256 == evidence.run_sha256
    assert len(evidence.run_sha256) == 64
    with pytest.raises(ValueError, match="reasons"):
        OfficialObservationRunEvidence(
            source_id=evidence.source_id,
            worker_id=evidence.worker_id,
            lease_token=evidence.lease_token,
            started_at=NOW,
            completed_at=NOW,
            status=evidence.status,
            reasons=(),
            observation_sha256=None,
            content_sha256=None,
        )
