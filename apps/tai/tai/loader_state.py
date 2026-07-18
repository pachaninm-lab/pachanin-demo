from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Protocol
from uuid import UUID, uuid4


class LoaderRunStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    NOT_MODIFIED = "NOT_MODIFIED"
    RETRYABLE_FAILURE = "RETRYABLE_FAILURE"
    PERMANENT_FAILURE = "PERMANENT_FAILURE"
    REVOKED = "REVOKED"


@dataclass(frozen=True, slots=True)
class LoaderState:
    source_id: str
    source_uri: str
    status: LoaderRunStatus
    next_run_at: datetime | None
    etag: str | None
    last_modified: str | None
    consecutive_failures: int
    lease_token: UUID | None
    lease_owner: str | None
    lease_expires_at: datetime | None
    heartbeat_at: datetime | None
    version: int


@dataclass(frozen=True, slots=True)
class LoaderLease:
    source_id: str
    token: UUID
    owner: str
    expires_at: datetime
    version: int


class LoaderStateRepository(Protocol):
    def schedule(
        self,
        *,
        source_id: str,
        source_uri: str,
        next_run_at: datetime,
    ) -> LoaderState: ...

    def claim_due(
        self,
        *,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
    ) -> LoaderLease | None: ...

    def heartbeat(
        self,
        *,
        lease: LoaderLease,
        now: datetime,
        lease_duration: timedelta,
    ) -> LoaderLease | None: ...

    def complete(
        self,
        *,
        lease: LoaderLease,
        status: LoaderRunStatus,
        next_run_at: datetime | None,
        etag: str | None,
        last_modified: str | None,
        consecutive_failures: int,
    ) -> bool: ...


class LoaderScheduler:
    def __init__(self, repository: LoaderStateRepository) -> None:
        self._repository = repository

    def ensure_scheduled(
        self,
        *,
        source_id: str,
        source_uri: str,
        next_run_at: datetime,
    ) -> LoaderState:
        return self._repository.schedule(
            source_id=source_id,
            source_uri=source_uri,
            next_run_at=next_run_at,
        )

    def acquire(
        self,
        *,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
    ) -> LoaderLease | None:
        if not worker_id.strip():
            raise ValueError("worker_id must not be blank")
        if lease_duration <= timedelta(0):
            raise ValueError("lease_duration must be positive")
        return self._repository.claim_due(
            worker_id=worker_id,
            now=now,
            lease_duration=lease_duration,
        )


class InMemoryLoaderStateRepository:
    """Deterministic test repository. Production authority is PostgreSQL."""

    def __init__(self) -> None:
        self._states: dict[str, LoaderState] = {}

    def schedule(
        self,
        *,
        source_id: str,
        source_uri: str,
        next_run_at: datetime,
    ) -> LoaderState:
        current = self._states.get(source_id)
        if current is not None:
            if current.source_uri != source_uri:
                raise ValueError("source_id is already bound to another URI")
            return current
        state = LoaderState(
            source_id=source_id,
            source_uri=source_uri,
            status=LoaderRunStatus.SCHEDULED,
            next_run_at=next_run_at,
            etag=None,
            last_modified=None,
            consecutive_failures=0,
            lease_token=None,
            lease_owner=None,
            lease_expires_at=None,
            heartbeat_at=None,
            version=1,
        )
        self._states[source_id] = state
        return state

    def claim_due(
        self,
        *,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
    ) -> LoaderLease | None:
        candidates = sorted(
            (
                state
                for state in self._states.values()
                if state.next_run_at is not None
                and state.next_run_at <= now
                and (
                    state.lease_expires_at is None
                    or state.lease_expires_at <= now
                )
                and state.status not in {
                    LoaderRunStatus.PERMANENT_FAILURE,
                    LoaderRunStatus.REVOKED,
                }
            ),
            key=lambda state: (state.next_run_at, state.source_id),
        )
        if not candidates:
            return None
        current = candidates[0]
        token = uuid4()
        expires_at = now + lease_duration
        updated = LoaderState(
            source_id=current.source_id,
            source_uri=current.source_uri,
            status=LoaderRunStatus.RUNNING,
            next_run_at=current.next_run_at,
            etag=current.etag,
            last_modified=current.last_modified,
            consecutive_failures=current.consecutive_failures,
            lease_token=token,
            lease_owner=worker_id,
            lease_expires_at=expires_at,
            heartbeat_at=now,
            version=current.version + 1,
        )
        self._states[current.source_id] = updated
        return LoaderLease(
            source_id=current.source_id,
            token=token,
            owner=worker_id,
            expires_at=expires_at,
            version=updated.version,
        )

    def heartbeat(
        self,
        *,
        lease: LoaderLease,
        now: datetime,
        lease_duration: timedelta,
    ) -> LoaderLease | None:
        current = self._states.get(lease.source_id)
        if not self._matches_active_lease(current, lease, now):
            return None
        if current is None:
            raise RuntimeError("active lease matched without loader state")
        expires_at = now + lease_duration
        updated = LoaderState(
            source_id=current.source_id,
            source_uri=current.source_uri,
            status=current.status,
            next_run_at=current.next_run_at,
            etag=current.etag,
            last_modified=current.last_modified,
            consecutive_failures=current.consecutive_failures,
            lease_token=current.lease_token,
            lease_owner=current.lease_owner,
            lease_expires_at=expires_at,
            heartbeat_at=now,
            version=current.version + 1,
        )
        self._states[current.source_id] = updated
        return LoaderLease(
            source_id=updated.source_id,
            token=lease.token,
            owner=lease.owner,
            expires_at=expires_at,
            version=updated.version,
        )

    def complete(
        self,
        *,
        lease: LoaderLease,
        status: LoaderRunStatus,
        next_run_at: datetime | None,
        etag: str | None,
        last_modified: str | None,
        consecutive_failures: int,
    ) -> bool:
        current = self._states.get(lease.source_id)
        if not self._matches_active_lease(current, lease, None):
            return False
        if current is None:
            raise RuntimeError("active lease matched without loader state")
        self._states[current.source_id] = LoaderState(
            source_id=current.source_id,
            source_uri=current.source_uri,
            status=status,
            next_run_at=next_run_at,
            etag=etag,
            last_modified=last_modified,
            consecutive_failures=consecutive_failures,
            lease_token=None,
            lease_owner=None,
            lease_expires_at=None,
            heartbeat_at=current.heartbeat_at,
            version=current.version + 1,
        )
        return True

    def get(self, source_id: str) -> LoaderState | None:
        return self._states.get(source_id)

    @staticmethod
    def _matches_active_lease(
        current: LoaderState | None,
        lease: LoaderLease,
        now: datetime | None,
    ) -> bool:
        if current is None:
            return False
        if current.lease_token != lease.token or current.lease_owner != lease.owner:
            return False
        if current.version != lease.version:
            return False
        return not (
            now is not None
            and current.lease_expires_at is not None
            and current.lease_expires_at <= now
        )
