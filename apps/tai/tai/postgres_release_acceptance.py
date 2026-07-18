from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from typing import Any, Protocol

from tai.release_acceptance import (
    ApplicationReleaseAttestation,
    ProductionReleaseAttestation,
)


class ReleaseCursor(Protocol):
    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None: ...

    def fetchone(self) -> Mapping[str, Any] | None: ...


class ReleaseConnection(Protocol):
    def cursor(self) -> AbstractContextManager[ReleaseCursor]: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


class ReleaseConnectionFactory(Protocol):
    def __call__(self) -> AbstractContextManager[ReleaseConnection]: ...


class PostgreSQLReleaseAttestationRepository:
    """Append-only, idempotent authority for application and production attestations."""

    def __init__(self, connection_factory: ReleaseConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record_application(self, attestation: ApplicationReleaseAttestation) -> None:
        query = """
            INSERT INTO tai_application_release_attestations (
                release_id,
                repository,
                exact_main_sha,
                accepted,
                reasons,
                source_tree_sha256,
                migration_inventory_sha256,
                workflow_evidence_sha256s,
                previous_attestation_sha256,
                created_at,
                production_operational_status,
                attestation_sha256
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (release_id) DO UPDATE
            SET release_id = EXCLUDED.release_id
            WHERE tai_application_release_attestations.attestation_sha256 =
                  EXCLUDED.attestation_sha256
            RETURNING release_id, attestation_sha256
        """
        row = self._execute_returning(
            query,
            (
                attestation.release_id,
                attestation.repository,
                attestation.exact_main_sha,
                attestation.accepted,
                list(attestation.reasons),
                attestation.source_tree_sha256,
                attestation.migration_inventory_sha256,
                list(attestation.workflow_evidence_sha256s),
                attestation.previous_attestation_sha256,
                attestation.created_at,
                attestation.production_operational_status.value,
                attestation.attestation_sha256,
            ),
        )
        if row is None:
            raise RuntimeError("release_id is already bound to another application attestation")
        if str(row["attestation_sha256"]) != attestation.attestation_sha256:
            raise RuntimeError("persisted application attestation digest does not match")

    def record_production(self, attestation: ProductionReleaseAttestation) -> None:
        query = """
            INSERT INTO tai_production_release_attestations (
                release_id,
                exact_main_sha,
                application_attestation_sha256,
                evaluation_report_sha256,
                operational_decision_sha256,
                status,
                reasons,
                attested_at,
                attestation_sha256
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (release_id) DO UPDATE
            SET release_id = EXCLUDED.release_id
            WHERE tai_production_release_attestations.attestation_sha256 =
                  EXCLUDED.attestation_sha256
            RETURNING release_id, attestation_sha256
        """
        row = self._execute_returning(
            query,
            (
                attestation.release_id,
                attestation.exact_main_sha,
                attestation.application_attestation_sha256,
                attestation.evaluation_report_sha256,
                attestation.operational_decision_sha256,
                attestation.status.value,
                list(attestation.reasons),
                attestation.attested_at,
                attestation.attestation_sha256,
            ),
        )
        if row is None:
            raise RuntimeError("release_id is already bound to another production attestation")
        if str(row["attestation_sha256"]) != attestation.attestation_sha256:
            raise RuntimeError("persisted production attestation digest does not match")

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
