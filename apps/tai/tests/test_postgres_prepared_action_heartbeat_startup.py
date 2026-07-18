from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import timedelta
from typing import Any, cast
from uuid import UUID

import pytest

from tai.orchestration import (
    PreparedActionClaim,
    PreparedActionClaimStatus,
    StoredPreparedAction,
)
from tai.postgres_orchestration import PostgreSQLPreparedActionRepository
from tai.postgres_prepared_action_heartbeat import (
    HeartbeatingPostgreSQLPreparedActionRepository,
)

CONFIRMATION_ID = UUID("33333333-3333-4333-8333-333333333333")


class _Cursor(AbstractContextManager["_Cursor"]):
    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        del query, parameters

    def fetchone(self) -> Mapping[str, Any] | None:
        return None


class _Connection(AbstractContextManager["_Connection"]):
    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        return _Cursor()

    def commit(self) -> None:
        return None

    def rollback(self) -> None:
        return None


class _Factory:
    def __call__(self) -> _Connection:
        return _Connection()


def test_claim_is_abandoned_when_heartbeat_thread_cannot_start(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repository = HeartbeatingPostgreSQLPreparedActionRepository(
        _Factory(),
        execution_lease=timedelta(seconds=1),
        heartbeat_interval=timedelta(milliseconds=50),
    )
    prepared = cast(StoredPreparedAction, object())
    abandoned: list[UUID] = []

    def claim(
        self: PostgreSQLPreparedActionRepository,
        confirmation_id: UUID,
    ) -> PreparedActionClaim:
        del self, confirmation_id
        return PreparedActionClaim(
            PreparedActionClaimStatus.EXECUTE,
            prepared,
        )

    def abandon(
        self: PostgreSQLPreparedActionRepository,
        confirmation_id: UUID,
    ) -> None:
        del self
        abandoned.append(confirmation_id)

    def fail_to_start(confirmation_id: UUID) -> None:
        raise RuntimeError(f"thread unavailable: {confirmation_id}")

    monkeypatch.setattr(PostgreSQLPreparedActionRepository, "claim", claim)
    monkeypatch.setattr(PostgreSQLPreparedActionRepository, "abandon", abandon)
    monkeypatch.setattr(repository, "_start_heartbeat", fail_to_start)

    with pytest.raises(RuntimeError, match="thread unavailable"):
        repository.claim(CONFIRMATION_ID)

    assert abandoned == [CONFIRMATION_ID]
