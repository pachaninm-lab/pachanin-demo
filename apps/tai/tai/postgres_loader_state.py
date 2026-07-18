from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import datetime, timedelta
from typing import Any, Protocol
from uuid import UUID, uuid4

from tai.loader_state import LoaderLease, LoaderRunStatus, LoaderState


class DatabaseCursor(Protocol):
    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None: ...

    def fetchone(self) -> Mapping[str, Any] | None: ...


class DatabaseConnection(Protocol):
    def cursor(self) -> AbstractContextManager[DatabaseCursor]: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


class ConnectionFactory(Protocol):
    def __call__(self) -> AbstractContextManager[DatabaseConnection]: ...


class PostgreSQLLoaderStateRepository:
    """PostgreSQL authority for managed loader scheduling and fenced execution."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def schedule(
        self,
        *,
        source_id: str,
        source_uri: str,
        next_run_at: datetime,
    ) -> LoaderState:
        query = """
            INSERT INTO tai_loader_state (
                source_id,
                source_uri,
                status,
                next_run_at
            )
            VALUES (%s, %s, 'SCHEDULED', %s)
            ON CONFLICT (source_id) DO UPDATE
            SET source_id = EXCLUDED.source_id
            WHERE tai_loader_state.source_uri = EXCLUDED.source_uri
            RETURNING *
        """
        row = self._execute_returning(query, (source_id, source_uri, next_run_at))
        if row is None:
            raise ValueError("source_id is already bound to another URI")
        return self._state_from_row(row)

    def claim_due(
        self,
        *,
        worker_id: str,
        now: datetime,
        lease_duration: timedelta,
    ) -> LoaderLease | None:
        token = uuid4()
        expires_at = now + lease_duration
        query = """
            WITH candidate AS (
                SELECT source_id
                FROM tai_loader_state
                WHERE next_run_at IS NOT NULL
                  AND next_run_at <= %s
                  AND status NOT IN ('PERMANENT_FAILURE', 'REVOKED')
                  AND (lease_expires_at IS NULL OR lease_expires_at <= %s)
                ORDER BY next_run_at, source_id
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE tai_loader_state AS state
            SET status = 'RUNNING',
                lease_token = %s,
                lease_owner = %s,
                lease_expires_at = %s,
                heartbeat_at = %s,
                version = state.version + 1,
                updated_at = clock_timestamp()
            FROM candidate
            WHERE state.source_id = candidate.source_id
            RETURNING state.source_id, state.version
        """
        row = self._execute_returning(
            query,
            (now, now, token, worker_id, expires_at, now),
        )
        if row is None:
            return None
        return LoaderLease(
            source_id=str(row["source_id"]),
            token=token,
            owner=worker_id,
            expires_at=expires_at,
            version=int(row["version"]),
        )

    def heartbeat(
        self,
        *,
        lease: LoaderLease,
        now: datetime,
        lease_duration: timedelta,
    ) -> LoaderLease | None:
        expires_at = now + lease_duration
        query = """
            UPDATE tai_loader_state
            SET lease_expires_at = %s,
                heartbeat_at = %s,
                version = version + 1,
                updated_at = clock_timestamp()
            WHERE source_id = %s
              AND status = 'RUNNING'
              AND lease_token = %s
              AND lease_owner = %s
              AND version = %s
              AND lease_expires_at > %s
            RETURNING version
        """
        row = self._execute_returning(
            query,
            (
                expires_at,
                now,
                lease.source_id,
                lease.token,
                lease.owner,
                lease.version,
                now,
            ),
        )
        if row is None:
            return None
        return LoaderLease(
            source_id=lease.source_id,
            token=lease.token,
            owner=lease.owner,
            expires_at=expires_at,
            version=int(row["version"]),
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
        query = """
            UPDATE tai_loader_state
            SET status = %s,
                next_run_at = %s,
                etag = %s,
                last_modified = %s,
                consecutive_failures = %s,
                lease_token = NULL,
                lease_owner = NULL,
                lease_expires_at = NULL,
                version = version + 1,
                updated_at = clock_timestamp()
            WHERE source_id = %s
              AND status = 'RUNNING'
              AND lease_token = %s
              AND lease_owner = %s
              AND version = %s
            RETURNING source_id
        """
        row = self._execute_returning(
            query,
            (
                status.value,
                next_run_at,
                etag,
                last_modified,
                consecutive_failures,
                lease.source_id,
                lease.token,
                lease.owner,
                lease.version,
            ),
        )
        return row is not None

    def _execute_returning(
        self,
        query: str,
        parameters: Sequence[Any],
    ) -> Mapping[str, Any] | None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    row = cursor.fetchone()
                connection.commit()
                return row
            except Exception:
                connection.rollback()
                raise

    @staticmethod
    def _state_from_row(row: Mapping[str, Any]) -> LoaderState:
        return LoaderState(
            source_id=str(row["source_id"]),
            source_uri=str(row["source_uri"]),
            status=LoaderRunStatus(str(row["status"])),
            next_run_at=row["next_run_at"],
            etag=row["etag"],
            last_modified=row["last_modified"],
            consecutive_failures=int(row["consecutive_failures"]),
            lease_token=PostgreSQLLoaderStateRepository._optional_uuid(row["lease_token"]),
            lease_owner=row["lease_owner"],
            lease_expires_at=row["lease_expires_at"],
            heartbeat_at=row["heartbeat_at"],
            version=int(row["version"]),
        )

    @staticmethod
    def _optional_uuid(value: object) -> UUID | None:
        if value is None:
            return None
        if isinstance(value, UUID):
            return value
        return UUID(str(value))
