from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from tai.postgres_loader_state import ConnectionFactory


@dataclass(frozen=True, slots=True)
class LoaderRecoveryCommand:
    source_id: str
    requested_by: str
    reason: str
    next_run_at: datetime

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise ValueError("source_id must not be blank")
        if not self.requested_by.strip():
            raise ValueError("requested_by must not be blank")
        if len(self.reason.strip()) < 10:
            raise ValueError("recovery reason must contain at least 10 characters")


@dataclass(frozen=True, slots=True)
class LoaderRecoveryReceipt:
    event_id: UUID
    source_id: str
    requested_by: str
    reason: str
    recovered_at: datetime
    state_version: int


class PostgreSQLLoaderRecoveryAuthority:
    """Atomic, audited recovery authority for permanently failed loader sources."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def recover(
        self,
        command: LoaderRecoveryCommand,
        *,
        recovered_at: datetime,
    ) -> LoaderRecoveryReceipt | None:
        event_id = uuid4()
        update_query = """
            UPDATE tai_loader_state
            SET status = 'SCHEDULED',
                next_run_at = %s,
                consecutive_failures = 0,
                lease_token = NULL,
                lease_owner = NULL,
                lease_expires_at = NULL,
                version = version + 1,
                updated_at = clock_timestamp()
            WHERE source_id = %s
              AND status = 'PERMANENT_FAILURE'
              AND lease_token IS NULL
            RETURNING version
        """
        audit_query = """
            INSERT INTO tai_loader_recovery_events (
                event_id,
                source_id,
                requested_by,
                reason,
                recovered_at,
                state_version
            )
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        update_query,
                        (command.next_run_at, command.source_id),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        connection.rollback()
                        return None
                    state_version = int(row["version"])
                    cursor.execute(
                        audit_query,
                        (
                            event_id,
                            command.source_id,
                            command.requested_by,
                            command.reason.strip(),
                            recovered_at,
                            state_version,
                        ),
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        return LoaderRecoveryReceipt(
            event_id=event_id,
            source_id=command.source_id,
            requested_by=command.requested_by,
            reason=command.reason.strip(),
            recovered_at=recovered_at,
            state_version=state_version,
        )
