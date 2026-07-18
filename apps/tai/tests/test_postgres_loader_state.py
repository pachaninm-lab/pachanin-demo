from __future__ import annotations

from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from tai.loader_state import LoaderLease, LoaderRunStatus
from tai.postgres_loader_state import PostgreSQLLoaderStateRepository


NOW = datetime(2026, 7, 18, 14, tzinfo=UTC)
LEASE = timedelta(minutes=5)


class FakeCursor(AbstractContextManager["FakeCursor"]):
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row
        self.query = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> None:
        self.query = query
        self.parameters = parameters

    def fetchone(self) -> dict[str, Any] | None:
        return self.row


class FakeConnection(AbstractContextManager["FakeConnection"]):
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.cursor_instance = FakeCursor(row)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> FakeConnection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class FakeFactory:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.connection = FakeConnection(row)

    def __call__(self) -> FakeConnection:
        return self.connection


def test_claim_uses_skip_locked_and_returns_fencing_lease() -> None:
    factory = FakeFactory({"source_id": "official.mcx", "version": 9})
    repository = PostgreSQLLoaderStateRepository(factory)

    lease = repository.claim_due(worker_id="worker-a", now=NOW, lease_duration=LEASE)

    assert lease is not None
    assert lease.source_id == "official.mcx"
    assert lease.owner == "worker-a"
    assert lease.version == 9
    assert lease.expires_at == NOW + LEASE
    assert isinstance(lease.token, UUID)
    query = factory.connection.cursor_instance.query
    assert "FOR UPDATE SKIP LOCKED" in query
    assert "lease_expires_at IS NULL OR lease_expires_at <= %s" in query
    assert factory.connection.committed is True


def test_heartbeat_is_guarded_by_token_owner_version_and_expiry() -> None:
    factory = FakeFactory({"version": 10})
    repository = PostgreSQLLoaderStateRepository(factory)
    lease = LoaderLease(
        source_id="official.mcx",
        token=UUID("11111111-1111-1111-1111-111111111111"),
        owner="worker-a",
        expires_at=NOW + LEASE,
        version=9,
    )

    renewed = repository.heartbeat(
        lease=lease,
        now=NOW + timedelta(minutes=1),
        lease_duration=LEASE,
    )

    assert renewed is not None
    assert renewed.version == 10
    query = factory.connection.cursor_instance.query
    assert "lease_token = %s" in query
    assert "lease_owner = %s" in query
    assert "version = %s" in query
    assert "lease_expires_at > %s" in query


def test_completion_clears_lease_only_for_current_fencing_version() -> None:
    factory = FakeFactory({"source_id": "official.mcx"})
    repository = PostgreSQLLoaderStateRepository(factory)
    lease = LoaderLease(
        source_id="official.mcx",
        token=UUID("22222222-2222-2222-2222-222222222222"),
        owner="worker-a",
        expires_at=NOW + LEASE,
        version=4,
    )

    accepted = repository.complete(
        lease=lease,
        status=LoaderRunStatus.SUCCEEDED,
        next_run_at=NOW + timedelta(days=1),
        etag='"v5"',
        last_modified=None,
        consecutive_failures=0,
    )

    assert accepted is True
    query = factory.connection.cursor_instance.query
    assert "lease_token = NULL" in query
    assert "lease_owner = NULL" in query
    assert "lease_expires_at = NULL" in query
    assert "version = %s" in query


def test_schedule_fails_closed_when_source_id_is_bound_to_other_uri() -> None:
    repository = PostgreSQLLoaderStateRepository(FakeFactory(None))

    try:
        repository.schedule(
            source_id="official.mcx",
            source_uri="https://mcx.gov.ru/report",
            next_run_at=NOW,
        )
    except ValueError as error:
        assert str(error) == "source_id is already bound to another URI"
    else:
        raise AssertionError("source URI rebinding must fail closed")


def test_schedule_maps_database_row_to_domain_state() -> None:
    factory = FakeFactory(
        {
            "source_id": "official.mcx",
            "source_uri": "https://mcx.gov.ru/report",
            "status": "SCHEDULED",
            "next_run_at": NOW,
            "etag": None,
            "last_modified": None,
            "consecutive_failures": 0,
            "lease_token": None,
            "lease_owner": None,
            "lease_expires_at": None,
            "heartbeat_at": None,
            "version": 1,
        }
    )
    repository = PostgreSQLLoaderStateRepository(factory)

    state = repository.schedule(
        source_id="official.mcx",
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )

    assert state.source_id == "official.mcx"
    assert state.status is LoaderRunStatus.SCHEDULED
    assert state.version == 1
