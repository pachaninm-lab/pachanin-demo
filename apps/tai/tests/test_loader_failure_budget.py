from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from tai.loader_state import InMemoryLoaderStateRepository, LoaderRunStatus
from tai.loader_worker import LoaderDefinition, ManagedLoaderWorker
from tai.managed_loader import (
    DocumentNormalizer,
    FetchDisposition,
    FetchRequest,
    FetchResponse,
    LoaderSchedule,
    ManagedSourceLoader,
)
from tai.source_governance import (
    DEFAULT_AGRO_SOURCE_REGISTRY,
    KnowledgeDomain,
    SourceDocument,
)

NOW = datetime(2026, 7, 18, 20, tzinfo=UTC)
SOURCE_ID = "official.minselhoz"
SOURCE_URI = "https://mcx.gov.ru/report"
LEASE = timedelta(minutes=5)


@dataclass
class StubFetcher:
    response: FetchResponse

    def fetch(self, request: FetchRequest) -> FetchResponse:
        return self.response


@dataclass
class StubMaterializer:
    fail: bool = False
    documents: list[SourceDocument] = field(default_factory=list)

    def store(self, document: SourceDocument) -> None:
        if self.fail:
            raise TimeoutError("sink unavailable")
        self.documents.append(document)


@dataclass(frozen=True)
class StubDefinitions:
    definition: LoaderDefinition

    def resolve(self, source_id: str) -> LoaderDefinition:
        assert source_id == SOURCE_ID
        return self.definition


def make_worker(
    repository: InMemoryLoaderStateRepository,
    response: FetchResponse,
    materializer: StubMaterializer,
    *,
    maximum_failures: int = 2,
) -> ManagedLoaderWorker:
    loader = ManagedSourceLoader(
        fetcher=StubFetcher(response),
        normalizer=DocumentNormalizer(),
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
        schedule=LoaderSchedule(
            source_id=SOURCE_ID,
            interval=timedelta(days=1),
            retry_interval=timedelta(hours=1),
            maximum_failures=maximum_failures,
        ),
    )
    definition = LoaderDefinition(
        loader=loader,
        title="Рынок зерна",
        published_at=NOW,
        effective_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
        failure_retry_interval=timedelta(hours=1),
        maximum_failures=maximum_failures,
    )
    return ManagedLoaderWorker(
        repository=repository,
        definitions=StubDefinitions(definition),
        materializer=materializer,
        worker_id="worker-a",
        lease_duration=LEASE,
    )


def scheduled_repository() -> InMemoryLoaderStateRepository:
    repository = InMemoryLoaderStateRepository()
    repository.schedule(source_id=SOURCE_ID, source_uri=SOURCE_URI, next_run_at=NOW)
    return repository


def test_retryable_result_exhausts_budget_and_stops_rescheduling() -> None:
    repository = scheduled_repository()
    response = FetchResponse(
        disposition=FetchDisposition.RETRYABLE_FAILURE,
        body=None,
        fetched_at=NOW,
        error_code="upstream_timeout",
    )

    first = make_worker(repository, response, StubMaterializer()).run_once(now=NOW)
    assert first.disposition is FetchDisposition.RETRYABLE_FAILURE

    retry_at = NOW + timedelta(hours=1)
    second_response = FetchResponse(
        disposition=FetchDisposition.RETRYABLE_FAILURE,
        body=None,
        fetched_at=retry_at,
        error_code="upstream_timeout",
    )
    second = make_worker(
        repository,
        second_response,
        StubMaterializer(),
    ).run_once(now=retry_at)

    assert second.disposition is FetchDisposition.PERMANENT_FAILURE
    assert second.reasons == ("upstream_timeout", "failure_budget_exhausted")
    state = repository.get(SOURCE_ID)
    assert state is not None
    assert state.status is LoaderRunStatus.PERMANENT_FAILURE
    assert state.consecutive_failures == 2
    assert state.next_run_at is None
    assert make_worker(repository, response, StubMaterializer()).run_once(
        now=retry_at + timedelta(days=1)
    ).reasons == ("no_due_source",)


def test_materialization_exception_exhausts_budget() -> None:
    repository = scheduled_repository()
    response = FetchResponse(
        disposition=FetchDisposition.FETCHED,
        body="Урожай обновлён",
        fetched_at=NOW,
        etag='"v1"',
    )

    first = make_worker(
        repository,
        response,
        StubMaterializer(fail=True),
    ).run_once(now=NOW)
    assert first.disposition is FetchDisposition.RETRYABLE_FAILURE

    retry_at = NOW + timedelta(hours=1)
    second_response = FetchResponse(
        disposition=FetchDisposition.FETCHED,
        body="Урожай обновлён",
        fetched_at=retry_at,
        etag='"v1"',
    )
    second = make_worker(
        repository,
        second_response,
        StubMaterializer(fail=True),
    ).run_once(now=retry_at)

    assert second.disposition is FetchDisposition.PERMANENT_FAILURE
    assert second.reasons == (
        "worker_exception:TimeoutError",
        "failure_budget_exhausted",
    )
    state = repository.get(SOURCE_ID)
    assert state is not None
    assert state.status is LoaderRunStatus.PERMANENT_FAILURE
    assert state.next_run_at is None


def test_loader_definition_rejects_invalid_failure_policy() -> None:
    repository = scheduled_repository()
    response = FetchResponse(FetchDisposition.NOT_MODIFIED, None, NOW)
    loader = ManagedSourceLoader(
        fetcher=StubFetcher(response),
        normalizer=DocumentNormalizer(),
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
        schedule=LoaderSchedule(
            source_id=SOURCE_ID,
            interval=timedelta(days=1),
            retry_interval=timedelta(hours=1),
            maximum_failures=1,
        ),
    )

    for retry_interval, maximum_failures in (
        (timedelta(0), 1),
        (timedelta(hours=1), 0),
    ):
        try:
            LoaderDefinition(
                loader=loader,
                title="Рынок зерна",
                published_at=NOW,
                effective_at=NOW,
                trust_score=0.99,
                domain=KnowledgeDomain.MARKET,
                failure_retry_interval=retry_interval,
                maximum_failures=maximum_failures,
            )
        except ValueError:
            pass
        else:
            raise AssertionError("invalid failure policy must fail closed")
