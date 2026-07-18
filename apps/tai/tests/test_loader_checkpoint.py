from __future__ import annotations

from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from typing import Any

from tai.loader_checkpoint import (
    PostgreSQLLoaderCheckpointAuthority,
    StaleLoaderCheckpointError,
)

NOW = datetime(2026, 7, 18, 22, tzinfo=UTC)
SOURCE_ID = "official.minselhoz"


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


def checkpoint_row(*, cursor: str, observed_at: datetime, version: int) -> dict[str, Any]:
    return {
        "source_id": SOURCE_ID,
        "cursor_value": cursor,
        "observed_at": observed_at,
        "version": version,
    }


def test_initial_checkpoint_is_insert_only() -> None:
    factory = FakeFactory(checkpoint_row(cursor="page:10", observed_at=NOW, version=1))
    authority = PostgreSQLLoaderCheckpointAuthority(factory)

    checkpoint = authority.advance(
        source_id=SOURCE_ID,
        cursor="page:10",
        observed_at=NOW,
        expected_version=None,
    )

    assert checkpoint.version == 1
    assert "ON CONFLICT (source_id) DO NOTHING" in factory.connection.cursor_instance.query
    assert factory.connection.committed is True


def test_checkpoint_advance_uses_version_and_monotonic_time_fencing() -> None:
    next_time = NOW + timedelta(minutes=10)
    factory = FakeFactory(
        checkpoint_row(cursor="page:20", observed_at=next_time, version=2)
    )
    authority = PostgreSQLLoaderCheckpointAuthority(factory)

    checkpoint = authority.advance(
        source_id=SOURCE_ID,
        cursor="page:20",
        observed_at=next_time,
        expected_version=1,
    )

    assert checkpoint.cursor == "page:20"
    assert checkpoint.version == 2
    query = factory.connection.cursor_instance.query
    assert "version = %s" in query
    assert "observed_at <= %s" in query
    assert factory.connection.cursor_instance.parameters[-2:] == (1, next_time)


def test_stale_checkpoint_writer_fails_closed() -> None:
    authority = PostgreSQLLoaderCheckpointAuthority(FakeFactory(None))

    try:
        authority.advance(
            source_id=SOURCE_ID,
            cursor="page:15",
            observed_at=NOW,
            expected_version=1,
        )
    except StaleLoaderCheckpointError as error:
        assert "compare-and-swap rejected" in str(error)
    else:
        raise AssertionError("stale checkpoint writer must fail closed")


def test_checkpoint_can_be_loaded_after_restart() -> None:
    factory = FakeFactory(checkpoint_row(cursor="page:20", observed_at=NOW, version=7))
    authority = PostgreSQLLoaderCheckpointAuthority(factory)

    checkpoint = authority.get(SOURCE_ID)

    assert checkpoint is not None
    assert checkpoint.cursor == "page:20"
    assert checkpoint.version == 7
    assert "FROM tai_loader_checkpoints" in factory.connection.cursor_instance.query
