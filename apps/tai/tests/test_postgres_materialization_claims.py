from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any

from tai.idempotent_materializer import MaterializationKey
from tai.postgres_materialization_claims import PostgreSQLMaterializationClaimRepository


class FakeCursor(AbstractContextManager["FakeCursor"]):
    def __init__(self, row: object | None = None, *, fail: bool = False) -> None:
        self.row = row
        self.fail = fail
        self.query = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: tuple[Any, ...] = ()) -> None:
        self.query = query
        self.parameters = parameters
        if self.fail:
            raise RuntimeError("database unavailable")

    def fetchone(self) -> object | None:
        return self.row


class FakeConnection(AbstractContextManager["FakeConnection"]):
    def __init__(self, row: object | None = None, *, fail: bool = False) -> None:
        self.cursor_instance = FakeCursor(row, fail=fail)
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
    def __init__(self, row: object | None = None, *, fail: bool = False) -> None:
        self.connection = FakeConnection(row, fail=fail)

    def __call__(self) -> FakeConnection:
        return self.connection


KEY = MaterializationKey("official.minselhoz", "a" * 64)


def test_claim_uses_atomic_on_conflict_authority() -> None:
    factory = FakeFactory({"source_id": KEY.source_id})
    repository = PostgreSQLMaterializationClaimRepository(factory)

    assert repository.claim(KEY) is True
    assert "ON CONFLICT (source_id, checksum_sha256) DO NOTHING" in (
        factory.connection.cursor_instance.query
    )
    assert factory.connection.cursor_instance.parameters == (
        KEY.source_id,
        KEY.checksum_sha256,
    )
    assert factory.connection.committed is True


def test_duplicate_claim_is_rejected_without_error() -> None:
    factory = FakeFactory(None)
    repository = PostgreSQLMaterializationClaimRepository(factory)

    assert repository.claim(KEY) is False
    assert factory.connection.committed is True


def test_release_deletes_exact_content_address() -> None:
    factory = FakeFactory()
    repository = PostgreSQLMaterializationClaimRepository(factory)

    repository.release(KEY)

    query = factory.connection.cursor_instance.query
    assert "DELETE FROM tai_materialization_claims" in query
    assert "source_id = %s" in query
    assert "checksum_sha256 = %s" in query
    assert factory.connection.committed is True


def test_claim_rolls_back_on_database_error() -> None:
    factory = FakeFactory(fail=True)
    repository = PostgreSQLMaterializationClaimRepository(factory)

    try:
        repository.claim(KEY)
    except RuntimeError as error:
        assert str(error) == "database unavailable"
    else:
        raise AssertionError("database failure must propagate")

    assert factory.connection.rolled_back is True


def test_release_rolls_back_on_database_error() -> None:
    factory = FakeFactory(fail=True)
    repository = PostgreSQLMaterializationClaimRepository(factory)

    try:
        repository.release(KEY)
    except RuntimeError as error:
        assert str(error) == "database unavailable"
    else:
        raise AssertionError("database failure must propagate")

    assert factory.connection.rolled_back is True
