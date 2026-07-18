from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from tai.idempotent_materializer import (
    IdempotentLoaderMaterializer,
    InMemoryMaterializationClaimRepository,
)
from tai.loader_state import InMemoryLoaderStateRepository, LoaderRunStatus
from tai.loader_worker import (
    LoaderDefinition,
    LoaderMaterializer,
    LostLoaderLeaseError,
    ManagedLoaderWorker,
)
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

NOW = datetime(2026, 7, 18, 15, tzinfo=UTC)
LEASE = timedelta(minutes=5)
SOURCE_ID = "official.minselhoz"
SOURCE_URI = "https://mcx.gov.ru/report"


@dataclass
class StubFetcher:
    response: FetchResponse
    requests: list[FetchRequest] = field(default_factory=list)

    def fetch(self, request: FetchRequest) -> FetchResponse:
        self.requests.append(request)
        return self.response


@dataclass
class StubMaterializer:
    documents: list[SourceDocument] = field(default_factory=list)

    def store(self, document: SourceDocument) -> None:
        self.documents.append(document)


@dataclass
class FlakySink:
    attempts: int = 0
    documents: list[SourceDocument] = field(default_factory=list)

    def store(self, document: SourceDocument) -> None:
        self.attempts += 1
        if self.attempts == 1:
            raise TimeoutError("materialization sink unavailable")
        self.documents.append(document)


@dataclass(frozen=True)
class StubDefinitions:
    definition: LoaderDefinition

    def resolve(self, source_id: str) -> LoaderDefinition:
        if source_id != SOURCE_ID:
            raise KeyError(source_id)
        return self.definition


def make_worker(
    repository: InMemoryLoaderStateRepository,
    response: FetchResponse,
    materializer: LoaderMaterializer,
) -> ManagedLoaderWorker:
    fetcher = StubFetcher(response)
    loader = ManagedSourceLoader(
        fetcher=fetcher,
        normalizer=DocumentNormalizer(),
        registry=DEFAULT_AGRO_SOURCE_REGISTRY,
        schedule=LoaderSchedule(
            source_id=SOURCE_ID,
            interval=timedelta(days=1),
            retry_interval=timedelta(hours=1),
            maximum_failures=3,
        ),
    )
    definition = LoaderDefinition(
        loader=loader,
        title="Рынок зерна",
        published_at=NOW,
        effective_at=NOW,
        trust_score=0.99,
        domain=KnowledgeDomain.MARKET,
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


def test_worker_materializes_and_completes_successful_fetch() -> None:
    repository = scheduled_repository()
    materializer = StubMaterializer()
    worker = make_worker(
        repository,
        FetchResponse(
            disposition=FetchDisposition.FETCHED,
            body=" Урожай обновлён ",
            fetched_at=NOW,
            etag='"v1"',
        ),
        materializer,
    )

    execution = worker.run_once(now=NOW)

    assert execution.completed is True
    assert execution.disposition is FetchDisposition.FETCHED
    assert len(materializer.documents) == 1
    state = repository.get(SOURCE_ID)
    assert state is not None
    assert state.status is LoaderRunStatus.SUCCEEDED
    assert state.etag == '"v1"'
    assert state.consecutive_failures == 0
    assert state.lease_token is None


def test_sink_failure_releases_claim_and_retry_materializes_once() -> None:
    repository = scheduled_repository()
    sink = FlakySink()
    materializer = IdempotentLoaderMaterializer(
        claims=InMemoryMaterializationClaimRepository(),
        sink=sink,
    )
    first_response = FetchResponse(
        disposition=FetchDisposition.FETCHED,
        body=" Урожай обновлён ",
        fetched_at=NOW,
        etag='"v1"',
    )

    first = make_worker(repository, first_response, materializer).run_once(now=NOW)

    assert first.disposition is FetchDisposition.RETRYABLE_FAILURE
    assert first.reasons == ("worker_exception:TimeoutError",)
    assert sink.attempts == 1
    assert sink.documents == []
    failed_state = repository.get(SOURCE_ID)
    assert failed_state is not None
    assert failed_state.status is LoaderRunStatus.RETRYABLE_FAILURE
    retry_at = NOW + timedelta(hours=1)
    assert failed_state.next_run_at == retry_at

    retry_response = FetchResponse(
        disposition=FetchDisposition.FETCHED,
        body=" Урожай обновлён ",
        fetched_at=retry_at,
        etag='"v1"',
    )
    second = make_worker(repository, retry_response, materializer).run_once(now=retry_at)

    assert second.disposition is FetchDisposition.FETCHED
    assert second.completed is True
    assert sink.attempts == 2
    assert len(sink.documents) == 1
    completed_state = repository.get(SOURCE_ID)
    assert completed_state is not None
    assert completed_state.status is LoaderRunStatus.SUCCEEDED
    assert completed_state.consecutive_failures == 0


def test_retryable_failure_increments_budget_without_materialization() -> None:
    repository = scheduled_repository()
    materializer = StubMaterializer()
    worker = make_worker(
        repository,
        FetchResponse(
            disposition=FetchDisposition.RETRYABLE_FAILURE,
            body=None,
            fetched_at=NOW,
            error_code="upstream_timeout",
        ),
        materializer,
    )

    execution = worker.run_once(now=NOW)

    assert execution.reasons == ("upstream_timeout",)
    assert materializer.documents == []
    state = repository.get(SOURCE_ID)
    assert state is not None
    assert state.status is LoaderRunStatus.RETRYABLE_FAILURE
    assert state.consecutive_failures == 1
    assert state.next_run_at == NOW + timedelta(hours=1)


def test_worker_returns_no_work_when_nothing_is_due() -> None:
    repository = InMemoryLoaderStateRepository()
    worker = make_worker(
        repository,
        FetchResponse(FetchDisposition.NOT_MODIFIED, None, NOW),
        StubMaterializer(),
    )

    execution = worker.run_once(now=NOW)

    assert execution.completed is False
    assert execution.source_id is None
    assert execution.reasons == ("no_due_source",)


class RejectingCompletionRepository(InMemoryLoaderStateRepository):
    def complete(self, **kwargs: object) -> bool:
        return False


def test_worker_fails_closed_when_fencing_rejects_completion() -> None:
    repository = RejectingCompletionRepository()
    repository.schedule(source_id=SOURCE_ID, source_uri=SOURCE_URI, next_run_at=NOW)
    worker = make_worker(
        repository,
        FetchResponse(FetchDisposition.NOT_MODIFIED, None, NOW),
        StubMaterializer(),
    )

    try:
        worker.run_once(now=NOW)
    except LostLoaderLeaseError as error:
        assert str(error) == "loader completion rejected by fencing authority"
    else:
        raise AssertionError("stale loader completion must fail closed")
