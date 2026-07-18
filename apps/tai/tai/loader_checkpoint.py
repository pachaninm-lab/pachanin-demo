from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from tai.postgres_loader_state import ConnectionFactory


@dataclass(frozen=True, slots=True)
class LoaderCheckpoint:
    source_id: str
    cursor: str
    observed_at: datetime
    version: int


class StaleLoaderCheckpointError(RuntimeError):
    pass


class PostgreSQLLoaderCheckpointAuthority:
    """Durable compare-and-swap checkpoint authority for incremental loaders."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def get(self, source_id: str) -> LoaderCheckpoint | None:
        if not source_id.strip():
            raise ValueError("source_id must not be blank")
        query = """
            SELECT source_id, cursor_value, observed_at, version
            FROM tai_loader_checkpoints
            WHERE source_id = %s
        """
        row = self._execute_returning(query, (source_id,))
        return None if row is None else self._checkpoint_from_row(row)

    def advance(
        self,
        *,
        source_id: str,
        cursor: str,
        observed_at: datetime,
        expected_version: int | None,
    ) -> LoaderCheckpoint:
        if not source_id.strip():
            raise ValueError("source_id must not be blank")
        if not cursor.strip():
            raise ValueError("cursor must not be blank")
        if expected_version is not None and expected_version < 1:
            raise ValueError("expected_version must be positive")
        if expected_version is None:
            query = """
                INSERT INTO tai_loader_checkpoints (
                    source_id,
                    cursor_value,
                    observed_at,
                    version
                )
                VALUES (%s, %s, %s, 1)
                ON CONFLICT (source_id) DO NOTHING
                RETURNING source_id, cursor_value, observed_at, version
            """
            parameters: Sequence[Any] = (source_id, cursor.strip(), observed_at)
        else:
            query = """
                UPDATE tai_loader_checkpoints
                SET cursor_value = %s,
                    observed_at = %s,
                    version = version + 1,
                    updated_at = clock_timestamp()
                WHERE source_id = %s
                  AND version = %s
                  AND observed_at <= %s
                RETURNING source_id, cursor_value, observed_at, version
            """
            parameters = (
                cursor.strip(),
                observed_at,
                source_id,
                expected_version,
                observed_at,
            )
        row = self._execute_returning(query, parameters)
        if row is None:
            raise StaleLoaderCheckpointError(
                "checkpoint compare-and-swap rejected stale or duplicate writer"
            )
        return self._checkpoint_from_row(row)

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
    def _checkpoint_from_row(row: Mapping[str, Any]) -> LoaderCheckpoint:
        return LoaderCheckpoint(
            source_id=str(row["source_id"]),
            cursor=str(row["cursor_value"]),
            observed_at=row["observed_at"],
            version=int(row["version"]),
        )
