from __future__ import annotations

from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from typing import Any

from tai.loader_recovery import (
    LoaderRecoveryCommand,
    PostgreSQLLoaderRecoveryAuthority,
)

NOW = datetime(2026, 7, 18, 21, tzinfo=UTC)


class FakeCursor(AbstractContextManager["FakeCursor"]):
    def __init__(self, row: dict[str, Any] | None) -> None:
        self.row = row
        self.executions: list[tuple[str, tuple[Any, ...]]] = []

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> None:
        self.executions.append((query, parameters))

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


def command() -> LoaderRecoveryCommand:
    return LoaderRecoveryCommand(
        source_id="official.minselhoz",
        requested_by="operator-42",
        reason="Источник проверен и снова доступен",
        next_run_at=NOW + timedelta(minutes=5),
    )


def test_recovery_is_atomic_audited_and_resets_failure_budget() -> None:
    factory = FakeFactory({"version": 12})
    authority = PostgreSQLLoaderRecoveryAuthority(factory)

    receipt = authority.recover(command(), recovered_at=NOW)

    assert receipt is not None
    assert receipt.state_version == 12
    assert receipt.requested_by == "operator-42"
    executions = factory.connection.cursor_instance.executions
    assert len(executions) == 2
    update_query, update_parameters = executions[0]
    assert "status = 'SCHEDULED'" in update_query
    assert "status = 'PERMANENT_FAILURE'" in update_query
    assert "consecutive_failures = 0" in update_query
    assert "lease_token IS NULL" in update_query
    assert update_parameters == (command().next_run_at, command().source_id)
    audit_query, audit_parameters = executions[1]
    assert "INSERT INTO tai_loader_recovery_events" in audit_query
    assert audit_parameters[1] == command().source_id
    assert audit_parameters[2] == command().requested_by
    assert factory.connection.committed is True
    assert factory.connection.rolled_back is False


def test_recovery_rejects_non_permanent_or_missing_source() -> None:
    factory = FakeFactory(None)
    authority = PostgreSQLLoaderRecoveryAuthority(factory)

    receipt = authority.recover(command(), recovered_at=NOW)

    assert receipt is None
    assert len(factory.connection.cursor_instance.executions) == 1
    assert factory.connection.committed is False
    assert factory.connection.rolled_back is True


def test_recovery_command_requires_operator_and_meaningful_reason() -> None:
    for requested_by, reason in (("", "valid reason"), ("operator", "short")):
        try:
            LoaderRecoveryCommand(
                source_id="official.minselhoz",
                requested_by=requested_by,
                reason=reason,
                next_run_at=NOW,
            )
        except ValueError:
            pass
        else:
            raise AssertionError("invalid recovery command must fail closed")
