from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from tai.loader_state import InMemoryLoaderStateRepository, LoaderRunStatus
from tai.loader_worker import (
    LoaderDefinition,
    LostLoaderLeaseError,
    ManagedLoaderWorker,
)
from tai.managed_loader import (
    DocumentNormalizer,
    FetchRequest,
    LoaderSchedule,
    ManagedSourceLoader,
)
from tai.source_governance import (
    DEFAULT_AGRO_SOURCE_REGISTRY,
    KnowledgeDomain,
    SourceDocument,
)

NOW = datetime(2026, 7, 18, 16, tzinfo=UTC)
LEASE = timedelta(minutes=5)
SOURCE_ID = "official.minselhoz"
SOURCE_URI = "https://mcx.gov.ru/report"


class RaisingFetcher:
    def fetch(self, request: FetchRequest) -> object:
        raise TimeoutError(request.source_uri)


@dataclass
class StubMaterializer:
    documents: list[SourceDocument] = field(default_factory=list)

    def store(self, document: SourceDocument) -> None:
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
    *,
    stop_requested: object | None = None,
) -> ManagedLoaderWorker:
    loader = ManagedSourceLoader(
        fetcher=RaisingFetcher(),  # type: ignore[arg-type]
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
    callback = stop_requested if callable(stop_requested) else None
    return ManagedLoaderWorker(
        repository=repository,
        definitions=StubDefinitions(definition),
        materializer=StubMaterializer(),
        worker_id="worker-a",
        lease_duration=LEASE,
        stop_requested=callback,
    )


def scheduled_repository() -> InMemoryLoaderStateRepository:
    repository = InMemoryLoaderStateRepository()
    repository.schedule(source_id=SOURCE_ID, source_uri=SOURCE_URI, next_run_at=NOW)
    return repository


def test_fetch_exception_is_persisted_as_retryable_failure() -> None:
    repository = scheduled_repository()
    execution = make_worker(repository).run_once(now=NOW)

    assert execution.completed is True
    assert execution.reasons == ("worker_exception:TimeoutError",)
    state = repository.get(SOURCE_ID)
    assert state is not None
    assert state.status is LoaderRunStatus.RETRYABLE_FAILURE
    assert state.next_run_at == NOW + timedelta(hours=1)
    assert state.consecutive_failures == 1
    assert state.lease_token is None


def test_stop_before_claim_returns_without_taking_work() -> None:
    repository = scheduled_repository()
    execution = make_worker(repository, stop_requested=lambda: True).run_once(now=NOW)

    assert execution.completed is False
    assert execution.reasons == ("worker_stopping",)
    state = repository.get(SOURCE_ID)
    assert state is not None
    assert state.status is LoaderRunStatus.SCHEDULED


class RejectingHeartbeatRepository(InMemoryLoaderStateRepository):
    def heartbeat(self, **kwargs: object) -> None:
        return None


def test_heartbeat_fencing_failure_aborts_execution() -> None:
    repository = RejectingHeartbeatRepository()
    repository.schedule(source_id=SOURCE_ID, source_uri=SOURCE_URI, next_run_at=NOW)

    try:
        make_worker(repository).run_once(now=NOW)
    except LostLoaderLeaseError as error:
        assert str(error) == "loader heartbeat rejected by fencing authority"
    else:
        raise AssertionError("rejected heartbeat must stop stale worker")
