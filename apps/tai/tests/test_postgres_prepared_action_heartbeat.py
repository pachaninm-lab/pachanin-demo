from __future__ import annotations

import threading
import time
from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import timedelta
from typing import Any, cast
from uuid import UUID

import pytest

from tai.agent_runtime import AgentExecutionResult
from tai.orchestration import (
    PreparedActionClaim,
    PreparedActionClaimStatus,
    StoredPreparedAction,
)
from tai.postgres_orchestration import PostgreSQLPreparedActionRepository
from tai.postgres_prepared_action_heartbeat import (
    HeartbeatingPostgreSQLPreparedActionRepository,
    PreparedActionHeartbeatError,
)

CONFIRMATION_ID = UUID("11111111-1111-4111-8111-111111111111")
EXECUTION_TOKEN = UUID("22222222-2222-4222-8222-222222222222")


class _Cursor(AbstractContextManager["_Cursor"]):
    def __init__(self, row: Mapping[str, Any] | None) -> None:
        self.row = row
        self.query = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        self.query = query
        self.parameters = tuple(parameters)

    def fetchone(self) -> Mapping[str, Any] | None:
        return self.row


class _Connection(AbstractContextManager["_Connection"]):
    def __init__(self, row: Mapping[str, Any] | None) -> None:
        self.cursor_instance = _Cursor(row)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class _Factory:
    def __init__(self, row: Mapping[str, Any] | None) -> None:
        self.connection = _Connection(row)

    def __call__(self) -> _Connection:
        return self.connection


def _repository(
    factory: _Factory | None = None,
    *,
    lease_seconds: float = 1.0,
    heartbeat_seconds: float = 0.05,
    stop_timeout_seconds: float = 0.1,
) -> HeartbeatingPostgreSQLPreparedActionRepository:
    return HeartbeatingPostgreSQLPreparedActionRepository(
        factory or _Factory({"confirmation_id": CONFIRMATION_ID}),
        execution_lease=timedelta(seconds=lease_seconds),
        heartbeat_interval=timedelta(seconds=heartbeat_seconds),
        heartbeat_stop_timeout=timedelta(seconds=stop_timeout_seconds),
    )


def test_heartbeat_policy_requires_safe_interval_and_bounded_stop() -> None:
    with pytest.raises(ValueError, match="at least 50 milliseconds"):
        _repository(heartbeat_seconds=0.01)
    with pytest.raises(ValueError, match="effective execution lease"):
        _repository(lease_seconds=1.9, heartbeat_seconds=1.1)
    with pytest.raises(ValueError, match="between 50 milliseconds and 30 seconds"):
        _repository(stop_timeout_seconds=31)


def test_renew_execution_lease_uses_current_fencing_token() -> None:
    factory = _Factory({"confirmation_id": CONFIRMATION_ID})
    repository = _repository(factory)
    repository._remember_execution_token(CONFIRMATION_ID, EXECUTION_TOKEN)

    assert repository._renew_execution_lease(CONFIRMATION_ID) is True

    cursor = factory.connection.cursor_instance
    assert "execution_expires_at > clock_timestamp()" in cursor.query
    assert cursor.parameters == (1, CONFIRMATION_ID, EXECUTION_TOKEN)
    assert factory.connection.committed is True
    assert factory.connection.rolled_back is False


def test_renew_execution_lease_fails_without_token_or_database_row() -> None:
    repository = _repository(_Factory(None))
    assert repository._renew_execution_lease(CONFIRMATION_ID) is False

    repository._remember_execution_token(CONFIRMATION_ID, EXECUTION_TOKEN)
    assert repository._renew_execution_lease(CONFIRMATION_ID) is False


def test_heartbeat_runs_in_copied_fencing_context(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = _repository()
    repository._remember_execution_token(CONFIRMATION_ID, EXECUTION_TOKEN)
    renewals: list[UUID | None] = []
    renewed = threading.Event()

    def renew(confirmation_id: UUID) -> bool:
        renewals.append(repository._execution_token(confirmation_id))
        renewed.set()
        return True

    monkeypatch.setattr(repository, "_renew_execution_lease", renew)
    repository._start_heartbeat(CONFIRMATION_ID)
    assert renewed.wait(0.5) is True
    repository._stop_heartbeat(CONFIRMATION_ID, raise_on_failure=True)

    assert renewals
    assert set(renewals) == {EXECUTION_TOKEN}
    assert repository._handles() == {}


def test_duplicate_heartbeat_is_rejected_and_abandon_discards_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = _repository()
    repository._remember_execution_token(CONFIRMATION_ID, EXECUTION_TOKEN)
    failed = threading.Event()

    def reject(_: UUID) -> bool:
        failed.set()
        return False

    monkeypatch.setattr(repository, "_renew_execution_lease", reject)
    repository._start_heartbeat(CONFIRMATION_ID)
    with pytest.raises(RuntimeError, match="already active"):
        repository._start_heartbeat(CONFIRMATION_ID)
    assert failed.wait(0.5) is True
    repository._stop_heartbeat(CONFIRMATION_ID, raise_on_failure=False)
    assert repository._handles() == {}


def test_heartbeat_loss_blocks_completion(monkeypatch: pytest.MonkeyPatch) -> None:
    repository = _repository()
    repository._remember_execution_token(CONFIRMATION_ID, EXECUTION_TOKEN)
    failed = threading.Event()

    def reject(_: UUID) -> bool:
        failed.set()
        return False

    monkeypatch.setattr(repository, "_renew_execution_lease", reject)
    repository._start_heartbeat(CONFIRMATION_ID)
    assert failed.wait(0.5) is True

    with pytest.raises(PreparedActionHeartbeatError, match="lost before completion"):
        repository._stop_heartbeat(CONFIRMATION_ID, raise_on_failure=True)


def test_heartbeat_exception_blocks_completion(monkeypatch: pytest.MonkeyPatch) -> None:
    repository = _repository()
    repository._remember_execution_token(CONFIRMATION_ID, EXECUTION_TOKEN)
    failed = threading.Event()

    def explode(_: UUID) -> bool:
        failed.set()
        raise RuntimeError("database unavailable")

    monkeypatch.setattr(repository, "_renew_execution_lease", explode)
    repository._start_heartbeat(CONFIRMATION_ID)
    assert failed.wait(0.5) is True

    with pytest.raises(PreparedActionHeartbeatError) as error:
        repository._stop_heartbeat(CONFIRMATION_ID, raise_on_failure=True)
    assert isinstance(error.value.__cause__, RuntimeError)


def test_unresponsive_heartbeat_thread_blocks_completion_within_timeout(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = _repository(stop_timeout_seconds=0.05)
    repository._remember_execution_token(CONFIRMATION_ID, EXECUTION_TOKEN)
    entered = threading.Event()
    release = threading.Event()

    def block(_: UUID) -> bool:
        entered.set()
        release.wait(1)
        return True

    monkeypatch.setattr(repository, "_renew_execution_lease", block)
    repository._start_heartbeat(CONFIRMATION_ID)
    assert entered.wait(0.5) is True

    started = time.monotonic()
    with pytest.raises(PreparedActionHeartbeatError, match="bounded timeout"):
        repository._stop_heartbeat(CONFIRMATION_ID, raise_on_failure=True)
    assert time.monotonic() - started < 0.5
    release.set()


def test_claim_starts_heartbeat_only_for_executor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = _repository()
    prepared = cast(StoredPreparedAction, object())
    started: list[UUID] = []

    monkeypatch.setattr(
        PostgreSQLPreparedActionRepository,
        "claim",
        lambda self, confirmation_id: PreparedActionClaim(
            PreparedActionClaimStatus.EXECUTE,
            prepared,
        ),
    )
    monkeypatch.setattr(repository, "_start_heartbeat", started.append)
    claim = repository.claim(CONFIRMATION_ID)
    assert claim.status is PreparedActionClaimStatus.EXECUTE
    assert started == [CONFIRMATION_ID]

    monkeypatch.setattr(
        PostgreSQLPreparedActionRepository,
        "claim",
        lambda self, confirmation_id: PreparedActionClaim(
            PreparedActionClaimStatus.IN_PROGRESS,
            prepared,
        ),
    )
    claim = repository.claim(CONFIRMATION_ID)
    assert claim.status is PreparedActionClaimStatus.IN_PROGRESS
    assert started == [CONFIRMATION_ID]


def test_complete_stops_heartbeat_before_database_completion(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = _repository()
    result = cast(AgentExecutionResult, object())
    prepared = cast(StoredPreparedAction, object())
    order: list[str] = []

    monkeypatch.setattr(
        repository,
        "_stop_heartbeat",
        lambda confirmation_id, *, raise_on_failure: order.append(
            f"stop:{confirmation_id}:{raise_on_failure}"
        ),
    )

    def complete(
        self: PostgreSQLPreparedActionRepository,
        confirmation_id: UUID,
        execution: AgentExecutionResult,
    ) -> StoredPreparedAction:
        del self, confirmation_id, execution
        order.append("complete")
        return prepared

    monkeypatch.setattr(PostgreSQLPreparedActionRepository, "complete", complete)
    assert repository.complete(CONFIRMATION_ID, result) is prepared
    assert order == [f"stop:{CONFIRMATION_ID}:True", "complete"]


def test_abandon_stops_heartbeat_without_masking_original_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = _repository()
    order: list[str] = []

    monkeypatch.setattr(
        repository,
        "_stop_heartbeat",
        lambda confirmation_id, *, raise_on_failure: order.append(
            f"stop:{confirmation_id}:{raise_on_failure}"
        ),
    )

    def abandon(
        self: PostgreSQLPreparedActionRepository,
        confirmation_id: UUID,
    ) -> None:
        del self, confirmation_id
        order.append("abandon")

    monkeypatch.setattr(PostgreSQLPreparedActionRepository, "abandon", abandon)
    repository.abandon(CONFIRMATION_ID)
    assert order == [f"stop:{CONFIRMATION_ID}:False", "abandon"]


def test_stop_without_active_heartbeat_is_a_noop() -> None:
    repository = _repository()
    repository._stop_heartbeat(CONFIRMATION_ID, raise_on_failure=True)
    time.sleep(0)
