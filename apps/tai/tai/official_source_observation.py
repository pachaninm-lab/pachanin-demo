from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Protocol
from uuid import UUID

from tai.loader_state import (
    LoaderLease,
    LoaderRunStatus,
    LoaderScheduler,
    LoaderStateRepository,
)
from tai.managed_loader import (
    FetchDisposition,
    FetchRequest,
    FetchResponse,
    SourceFetcher,
)
from tai.official_source_metadata import (
    HTMLMetadataAdapter,
    MetadataExtractionError,
    OfficialMetadataAdapter,
    OfficialSourceMetadata,
    default_html_metadata_adapters,
)
from tai.source_coverage import (
    OfficialSourceCatalog,
    OfficialSourceDefinition,
    SourceObservation,
)

__all__ = [
    "HTMLMetadataAdapter",
    "LostOfficialObservationLeaseError",
    "MetadataExtractionError",
    "OfficialMetadataAdapter",
    "OfficialObservationCommitAuthority",
    "OfficialObservationDefinition",
    "OfficialObservationDefinitionRegistry",
    "OfficialObservationRunEvidence",
    "OfficialObservationRunStatus",
    "OfficialObservationWorkerExecution",
    "OfficialSourceMetadata",
    "OfficialSourceObservationWorker",
    "default_html_metadata_adapters",
    "definitions_from_catalog",
]


@dataclass(frozen=True, slots=True)
class OfficialObservationDefinition:
    source: OfficialSourceDefinition
    adapter: OfficialMetadataAdapter
    fetcher: SourceFetcher
    retry_interval: timedelta = timedelta(hours=1)
    maximum_failures: int = 5

    def __post_init__(self) -> None:
        if self.adapter.source_id != self.source.source_id:
            raise ValueError("adapter must be bound to the same official source")
        if self.retry_interval <= timedelta(0):
            raise ValueError("retry_interval must be positive")
        if self.maximum_failures < 1:
            raise ValueError("maximum_failures must be positive")


class OfficialObservationDefinitionRegistry:
    def __init__(self, definitions: tuple[OfficialObservationDefinition, ...]) -> None:
        if not definitions:
            raise ValueError("observation definitions must not be empty")
        source_ids = tuple(definition.source.source_id for definition in definitions)
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("observation definition source_ids must be unique")
        self._definitions = {
            definition.source.source_id: definition for definition in definitions
        }

    def resolve(self, source_id: str) -> OfficialObservationDefinition:
        try:
            return self._definitions[source_id]
        except KeyError as error:
            raise LookupError(f"unknown official observation source: {source_id}") from error


class OfficialObservationRunStatus(StrEnum):
    FETCHED = "FETCHED"
    NOT_MODIFIED = "NOT_MODIFIED"
    RETRYABLE_FAILURE = "RETRYABLE_FAILURE"
    PERMANENT_FAILURE = "PERMANENT_FAILURE"


@dataclass(frozen=True, slots=True)
class OfficialObservationRunEvidence:
    source_id: str
    worker_id: str
    lease_token: UUID
    started_at: datetime
    completed_at: datetime
    status: OfficialObservationRunStatus
    reasons: tuple[str, ...]
    observation_sha256: str | None
    content_sha256: str | None

    def __post_init__(self) -> None:
        if not self.source_id.strip() or not self.worker_id.strip():
            raise ValueError("run source_id and worker_id must not be blank")
        _aware(self.started_at, "started_at")
        _aware(self.completed_at, "completed_at")
        if self.completed_at < self.started_at:
            raise ValueError("completed_at must not precede started_at")
        if not self.reasons:
            raise ValueError("run reasons must not be empty")
        if self.observation_sha256 is not None:
            _sha256(self.observation_sha256, "observation_sha256")
        if self.content_sha256 is not None:
            _sha256(self.content_sha256, "content_sha256")

    @property
    def run_sha256(self) -> str:
        payload = {
            "completed_at": self.completed_at.isoformat(),
            "content_sha256": self.content_sha256,
            "lease_token": str(self.lease_token),
            "observation_sha256": self.observation_sha256,
            "reasons": list(self.reasons),
            "schema_version": "tai.official-observation-run.v1",
            "source_id": self.source_id,
            "started_at": self.started_at.isoformat(),
            "status": self.status.value,
            "worker_id": self.worker_id,
        }
        canonical = json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class OfficialObservationCommitAuthority(Protocol):
    def latest_observation(self, source_id: str) -> SourceObservation | None: ...

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
    ) -> bool: ...


@dataclass(frozen=True, slots=True)
class OfficialObservationWorkerExecution:
    source_id: str | None
    status: OfficialObservationRunStatus | None
    committed: bool
    reasons: tuple[str, ...]
    run_sha256: str | None


class LostOfficialObservationLeaseError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class _RunOutcome:
    loader_status: LoaderRunStatus
    run_status: OfficialObservationRunStatus
    next_run_at: datetime | None
    consecutive_failures: int
    reasons: tuple[str, ...]
    observation: SourceObservation | None
    etag: str | None
    last_modified: str | None


class OfficialSourceObservationWorker:
    def __init__(
        self,
        *,
        loader_repository: LoaderStateRepository,
        authority: OfficialObservationCommitAuthority,
        definitions: OfficialObservationDefinitionRegistry,
        worker_id: str,
        lease_duration: timedelta,
    ) -> None:
        if not worker_id.strip():
            raise ValueError("worker_id must not be blank")
        if lease_duration <= timedelta(0):
            raise ValueError("lease_duration must be positive")
        self._loader_repository = loader_repository
        self._authority = authority
        self._definitions = definitions
        self._worker_id = worker_id
        self._lease_duration = lease_duration

    def run_once(self, *, now: datetime) -> OfficialObservationWorkerExecution:
        _aware(now, "now")
        lease = LoaderScheduler(self._loader_repository).acquire(
            worker_id=self._worker_id,
            now=now,
            lease_duration=self._lease_duration,
        )
        if lease is None:
            return OfficialObservationWorkerExecution(
                source_id=None,
                status=None,
                committed=False,
                reasons=("no_due_official_source",),
                run_sha256=None,
            )
        state = self._loader_repository.get(lease.source_id)
        if state is None:
            raise RuntimeError("claimed official loader state disappeared")
        definition = self._definitions.resolve(lease.source_id)
        lease = self._renew_or_raise(lease, now)
        response = definition.fetcher.fetch(
            FetchRequest(
                source_id=state.source_id,
                source_uri=state.source_uri,
                etag=state.etag,
                last_modified=state.last_modified,
            )
        )
        completed_at = response.fetched_at
        _aware(completed_at, "fetched_at")
        if completed_at < now - self._lease_duration:
            raise ValueError("fetch response timestamp predates active lease")
        lease = self._renew_or_raise(lease, completed_at)
        outcome = self._outcome(
            definition=definition,
            current_failures=state.consecutive_failures,
            response=response,
        )
        evidence = OfficialObservationRunEvidence(
            source_id=lease.source_id,
            worker_id=self._worker_id,
            lease_token=lease.token,
            started_at=now,
            completed_at=completed_at,
            status=outcome.run_status,
            reasons=outcome.reasons,
            observation_sha256=(
                outcome.observation.observation_sha256
                if outcome.observation is not None
                else None
            ),
            content_sha256=(
                outcome.observation.content_sha256
                if outcome.observation is not None
                else None
            ),
        )
        committed = self._authority.commit_run(
            lease=lease,
            status=outcome.loader_status,
            next_run_at=outcome.next_run_at,
            etag=outcome.etag,
            last_modified=outcome.last_modified,
            consecutive_failures=outcome.consecutive_failures,
            observation=outcome.observation,
            evidence=evidence,
        )
        if not committed:
            raise LostOfficialObservationLeaseError(
                "official observation commit rejected by fencing authority"
            )
        return OfficialObservationWorkerExecution(
            source_id=lease.source_id,
            status=outcome.run_status,
            committed=True,
            reasons=outcome.reasons,
            run_sha256=evidence.run_sha256,
        )

    def _outcome(
        self,
        *,
        definition: OfficialObservationDefinition,
        current_failures: int,
        response: FetchResponse,
    ) -> _RunOutcome:
        source = definition.source
        if response.disposition is FetchDisposition.FETCHED:
            if response.body is None:
                return self._failure_outcome(
                    definition=definition,
                    current_failures=current_failures,
                    completed_at=response.fetched_at,
                    reason="source_fetched_body_missing",
                    etag=response.etag,
                    last_modified=response.last_modified,
                    permanent=False,
                )
            try:
                metadata = definition.adapter.parse(
                    source=source,
                    body=response.body,
                    fetched_at=response.fetched_at,
                )
            except MetadataExtractionError as error:
                return self._failure_outcome(
                    definition=definition,
                    current_failures=current_failures,
                    completed_at=response.fetched_at,
                    reason=error.error_code,
                    etag=response.etag,
                    last_modified=response.last_modified,
                    permanent=False,
                )
            content_sha256 = hashlib.sha256(response.body.encode("utf-8")).hexdigest()
            observation = SourceObservation(
                source_id=source.source_id,
                observed_at=response.fetched_at,
                latest_publication_at=metadata.latest_publication_at,
                last_success_at=response.fetched_at,
                document_count=metadata.document_count,
                consecutive_failures=0,
                observed_topics=metadata.observed_topics,
                content_sha256=content_sha256,
            )
            return _RunOutcome(
                loader_status=LoaderRunStatus.SUCCEEDED,
                run_status=OfficialObservationRunStatus.FETCHED,
                next_run_at=response.fetched_at + source.expected_update_interval,
                consecutive_failures=0,
                reasons=("official_source_observed",),
                observation=observation,
                etag=response.etag,
                last_modified=response.last_modified,
            )
        if response.disposition is FetchDisposition.NOT_MODIFIED:
            previous = self._authority.latest_observation(source.source_id)
            if previous is None:
                return self._failure_outcome(
                    definition=definition,
                    current_failures=current_failures,
                    completed_at=response.fetched_at,
                    reason="source_not_modified_without_baseline",
                    etag=response.etag,
                    last_modified=response.last_modified,
                    permanent=False,
                )
            observation = SourceObservation(
                source_id=previous.source_id,
                observed_at=response.fetched_at,
                latest_publication_at=previous.latest_publication_at,
                last_success_at=response.fetched_at,
                document_count=previous.document_count,
                consecutive_failures=0,
                observed_topics=previous.observed_topics,
                content_sha256=previous.content_sha256,
            )
            return _RunOutcome(
                loader_status=LoaderRunStatus.NOT_MODIFIED,
                run_status=OfficialObservationRunStatus.NOT_MODIFIED,
                next_run_at=response.fetched_at + source.expected_update_interval,
                consecutive_failures=0,
                reasons=("official_source_not_modified",),
                observation=observation,
                etag=response.etag,
                last_modified=response.last_modified,
            )
        permanent = response.disposition is FetchDisposition.PERMANENT_FAILURE
        return self._failure_outcome(
            definition=definition,
            current_failures=current_failures,
            completed_at=response.fetched_at,
            reason=response.error_code or "official_source_fetch_failed",
            etag=response.etag,
            last_modified=response.last_modified,
            permanent=permanent,
        )

    def _failure_outcome(
        self,
        *,
        definition: OfficialObservationDefinition,
        current_failures: int,
        completed_at: datetime,
        reason: str,
        etag: str | None,
        last_modified: str | None,
        permanent: bool,
    ) -> _RunOutcome:
        failures = current_failures + 1
        exhausted = failures >= definition.maximum_failures
        effective_permanent = permanent or exhausted
        previous = self._authority.latest_observation(definition.source.source_id)
        observation = None
        if previous is not None:
            observation = SourceObservation(
                source_id=previous.source_id,
                observed_at=completed_at,
                latest_publication_at=previous.latest_publication_at,
                last_success_at=previous.last_success_at,
                document_count=previous.document_count,
                consecutive_failures=failures,
                observed_topics=previous.observed_topics,
                content_sha256=previous.content_sha256,
            )
        reasons: tuple[str, ...] = (reason,)
        if exhausted:
            reasons += ("failure_budget_exhausted",)
        if effective_permanent:
            return _RunOutcome(
                loader_status=LoaderRunStatus.PERMANENT_FAILURE,
                run_status=OfficialObservationRunStatus.PERMANENT_FAILURE,
                next_run_at=None,
                consecutive_failures=failures,
                reasons=reasons,
                observation=observation,
                etag=etag,
                last_modified=last_modified,
            )
        return _RunOutcome(
            loader_status=LoaderRunStatus.RETRYABLE_FAILURE,
            run_status=OfficialObservationRunStatus.RETRYABLE_FAILURE,
            next_run_at=completed_at + definition.retry_interval,
            consecutive_failures=failures,
            reasons=reasons,
            observation=observation,
            etag=etag,
            last_modified=last_modified,
        )

    def _renew_or_raise(self, lease: LoaderLease, now: datetime) -> LoaderLease:
        renewed = self._loader_repository.heartbeat(
            lease=lease,
            now=now,
            lease_duration=self._lease_duration,
        )
        if renewed is None:
            raise LostOfficialObservationLeaseError(
                "official observation heartbeat rejected by fencing authority"
            )
        return renewed


def definitions_from_catalog(
    *,
    catalog: OfficialSourceCatalog,
    fetchers: dict[str, SourceFetcher],
) -> tuple[OfficialObservationDefinition, ...]:
    adapters = {adapter.source_id: adapter for adapter in default_html_metadata_adapters()}
    definitions: list[OfficialObservationDefinition] = []
    for source in catalog.sources:
        adapter = adapters.get(source.source_id)
        fetcher = fetchers.get(source.source_id)
        if adapter is None or fetcher is None:
            raise ValueError(f"missing adapter or fetcher for official source {source.source_id}")
        definitions.append(
            OfficialObservationDefinition(
                source=source,
                adapter=adapter,
                fetcher=fetcher,
            )
        )
    return tuple(definitions)


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _sha256(value: str, name: str) -> None:
    if re.fullmatch(r"[0-9a-f]{64}", value) is None:
        raise ValueError(f"{name} must be lowercase SHA-256")
