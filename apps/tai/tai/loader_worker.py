from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from tai.loader_state import (
    LoaderLease,
    LoaderRunStatus,
    LoaderScheduler,
    LoaderState,
    LoaderStateRepository,
)
from tai.managed_loader import (
    FetchDisposition,
    FetchRequest,
    LoaderResult,
    ManagedSourceLoader,
)
from tai.source_governance import KnowledgeDomain, SourceDocument


class LoaderMaterializer(Protocol):
    def store(self, document: SourceDocument) -> None: ...


@dataclass(frozen=True, slots=True)
class LoaderDefinition:
    loader: ManagedSourceLoader
    title: str
    published_at: datetime | None
    effective_at: datetime | None
    trust_score: float
    domain: KnowledgeDomain
    failure_retry_interval: timedelta = timedelta(hours=1)


class LoaderDefinitionRegistry(Protocol):
    def resolve(self, source_id: str) -> LoaderDefinition: ...


@dataclass(frozen=True, slots=True)
class WorkerExecution:
    source_id: str | None
    disposition: FetchDisposition | None
    completed: bool
    reasons: tuple[str, ...]


class LostLoaderLeaseError(RuntimeError):
    pass


class ManagedLoaderWorker:
    def __init__(
        self,
        *,
        repository: LoaderStateRepository,
        definitions: LoaderDefinitionRegistry,
        materializer: LoaderMaterializer,
        worker_id: str,
        lease_duration: timedelta,
        stop_requested: Callable[[], bool] | None = None,
    ) -> None:
        if not worker_id.strip():
            raise ValueError("worker_id must not be blank")
        if lease_duration <= timedelta(0):
            raise ValueError("lease_duration must be positive")
        self._repository = repository
        self._definitions = definitions
        self._materializer = materializer
        self._worker_id = worker_id
        self._lease_duration = lease_duration
        self._stop_requested = stop_requested or (lambda: False)

    def run_once(self, *, now: datetime) -> WorkerExecution:
        if self._stop_requested():
            return WorkerExecution(None, None, False, ("worker_stopping",))

        lease = LoaderScheduler(self._repository).acquire(
            worker_id=self._worker_id,
            now=now,
            lease_duration=self._lease_duration,
        )
        if lease is None:
            return WorkerExecution(None, None, False, ("no_due_source",))

        state = self._repository.get(lease.source_id)
        if state is None:
            raise RuntimeError("claimed loader state disappeared")
        definition = self._definitions.resolve(lease.source_id)

        if self._stop_requested():
            self._complete_or_raise(
                lease=lease,
                status=LoaderRunStatus.RETRYABLE_FAILURE,
                next_run_at=now,
                etag=state.etag,
                last_modified=state.last_modified,
                consecutive_failures=state.consecutive_failures,
            )
            return WorkerExecution(
                lease.source_id,
                FetchDisposition.RETRYABLE_FAILURE,
                True,
                ("worker_stopping",),
            )

        lease = self._renew_or_raise(lease, now)
        try:
            result = self._run_loader(definition, state)
            lease = self._renew_or_raise(lease, result.document.fetched_at if result.document else now)
            if result.document is not None:
                self._materializer.store(result.document)
            lease = self._renew_or_raise(lease, now)
        except LostLoaderLeaseError:
            raise
        except Exception as error:
            self._complete_or_raise(
                lease=lease,
                status=LoaderRunStatus.RETRYABLE_FAILURE,
                next_run_at=now + definition.failure_retry_interval,
                etag=state.etag,
                last_modified=state.last_modified,
                consecutive_failures=state.consecutive_failures + 1,
            )
            return WorkerExecution(
                lease.source_id,
                FetchDisposition.RETRYABLE_FAILURE,
                True,
                (f"worker_exception:{type(error).__name__}",),
            )

        failures = self._failure_count(state.consecutive_failures, result.disposition)
        self._complete_or_raise(
            lease=lease,
            status=self._status(result),
            next_run_at=result.next_run_at,
            etag=result.etag,
            last_modified=result.last_modified,
            consecutive_failures=failures,
        )
        return WorkerExecution(
            source_id=lease.source_id,
            disposition=result.disposition,
            completed=True,
            reasons=result.reasons,
        )

    def _run_loader(self, definition: LoaderDefinition, state: LoaderState) -> LoaderResult:
        return definition.loader.run(
            request=FetchRequest(
                source_id=state.source_id,
                source_uri=state.source_uri,
                etag=state.etag,
                last_modified=state.last_modified,
            ),
            title=definition.title,
            published_at=definition.published_at,
            effective_at=definition.effective_at,
            trust_score=definition.trust_score,
            domain=definition.domain,
            consecutive_failures=state.consecutive_failures,
        )

    def _renew_or_raise(self, lease: LoaderLease, now: datetime) -> LoaderLease:
        renewed = self._repository.heartbeat(
            lease=lease,
            now=now,
            lease_duration=self._lease_duration,
        )
        if renewed is None:
            raise LostLoaderLeaseError("loader heartbeat rejected by fencing authority")
        return renewed

    def _complete_or_raise(
        self,
        *,
        lease: LoaderLease,
        status: LoaderRunStatus,
        next_run_at: datetime | None,
        etag: str | None,
        last_modified: str | None,
        consecutive_failures: int,
    ) -> None:
        accepted = self._repository.complete(
            lease=lease,
            status=status,
            next_run_at=next_run_at,
            etag=etag,
            last_modified=last_modified,
            consecutive_failures=consecutive_failures,
        )
        if not accepted:
            raise LostLoaderLeaseError("loader completion rejected by fencing authority")

    @staticmethod
    def _failure_count(current: int, disposition: FetchDisposition) -> int:
        if disposition in {
            FetchDisposition.RETRYABLE_FAILURE,
            FetchDisposition.PERMANENT_FAILURE,
        }:
            return current + 1
        return 0

    @staticmethod
    def _status(result: LoaderResult) -> LoaderRunStatus:
        mapping = {
            FetchDisposition.FETCHED: LoaderRunStatus.SUCCEEDED,
            FetchDisposition.NOT_MODIFIED: LoaderRunStatus.NOT_MODIFIED,
            FetchDisposition.RETRYABLE_FAILURE: LoaderRunStatus.RETRYABLE_FAILURE,
            FetchDisposition.PERMANENT_FAILURE: LoaderRunStatus.PERMANENT_FAILURE,
        }
        return mapping[result.disposition]
