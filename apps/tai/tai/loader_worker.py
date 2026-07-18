from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

from tai.loader_state import LoaderRunStatus, LoaderScheduler, LoaderStateRepository
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

    def run_once(self, *, now: datetime) -> WorkerExecution:
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
        result = definition.loader.run(
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
        if result.document is not None:
            self._materializer.store(result.document)

        failures = self._failure_count(state.consecutive_failures, result.disposition)
        accepted = self._repository.complete(
            lease=lease,
            status=self._status(result),
            next_run_at=result.next_run_at,
            etag=result.etag,
            last_modified=result.last_modified,
            consecutive_failures=failures,
        )
        if not accepted:
            raise LostLoaderLeaseError("loader completion rejected by fencing authority")
        return WorkerExecution(
            source_id=lease.source_id,
            disposition=result.disposition,
            completed=True,
            reasons=result.reasons,
        )

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
