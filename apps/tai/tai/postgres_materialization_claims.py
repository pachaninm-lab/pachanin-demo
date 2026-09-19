from __future__ import annotations

from collections.abc import Sequence
from contextlib import AbstractContextManager
from typing import Any, Protocol

from tai.idempotent_materializer import MaterializationKey


class DatabaseCursor(Protocol):
    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None: ...

    def fetchone(self) -> object | None: ...


class DatabaseConnection(Protocol):
    def cursor(self) -> AbstractContextManager[DatabaseCursor]: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


class ConnectionFactory(Protocol):
    def __call__(self) -> AbstractContextManager[DatabaseConnection]: ...


class PostgreSQLMaterializationClaimRepository:
    """PostgreSQL authority for content-addressed materialization claims."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def claim(self, key: MaterializationKey) -> bool:
        query = """
            INSERT INTO tai_materialization_claims (
                source_id,
                checksum_sha256
            )
            VALUES (%s, %s)
            ON CONFLICT (source_id, checksum_sha256) DO NOTHING
            RETURNING source_id
        """
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, (key.source_id, key.checksum_sha256))
                    claimed = cursor.fetchone() is not None
                connection.commit()
                return claimed
            except Exception:
                connection.rollback()
                raise

    def release(self, key: MaterializationKey) -> None:
        query = """
            DELETE FROM tai_materialization_claims
            WHERE source_id = %s
              AND checksum_sha256 = %s
        """
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, (key.source_id, key.checksum_sha256))
                connection.commit()
            except Exception:
                connection.rollback()
                raise
