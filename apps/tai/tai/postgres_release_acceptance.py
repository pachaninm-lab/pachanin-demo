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
                attestation_sha256,
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
                production_operational_status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (attestation_sha256) DO UPDATE
            SET attestation_sha256 = EXCLUDED.attestation_sha256
            WHERE tai_application_release_attestations.release_id = EXCLUDED.release_id
              AND tai_application_release_attestations.repository = EXCLUDED.repository
              AND tai_application_release_attestations.exact_main_sha =
                  EXCLUDED.exact_main_sha
              AND tai_application_release_attestations.accepted = EXCLUDED.accepted
              AND tai_application_release_attestations.reasons = EXCLUDED.reasons
              AND tai_application_release_attestations.source_tree_sha256 =
                  EXCLUDED.source_tree_sha256
              AND tai_application_release_attestations.migration_inventory_sha256 =
                  EXCLUDED.migration_inventory_sha256
              AND tai_application_release_attestations.workflow_evidence_sha256s =
                  EXCLUDED.workflow_evidence_sha256s
              AND tai_application_release_attestations.previous_attestation_sha256
                  IS NOT DISTINCT FROM EXCLUDED.previous_attestation_sha256
              AND tai_application_release_attestations.created_at = EXCLUDED.created_at
              AND tai_application_release_attestations.production_operational_status =
                  EXCLUDED.production_operational_status
            RETURNING release_id, attestation_sha256
        """
        row = self._execute_returning(
            query,
            (
                attestation.attestation_sha256,
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
            ),
        )
        if row is None:
            raise RuntimeError(
                "application attestation digest is bound to different evidence"
            )
        if str(row["attestation_sha256"]) != attestation.attestation_sha256:
            raise RuntimeError("persisted application attestation digest does not match")

    def record_production(self, attestation: ProductionReleaseAttestation) -> None:
        query = """
            INSERT INTO tai_production_release_attestations (
                attestation_sha256,
                release_id,
                exact_main_sha,
                application_attestation_sha256,
                evaluation_report_sha256,
                operational_decision_sha256,
                status,
                reasons,
                attested_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (attestation_sha256) DO UPDATE
            SET attestation_sha256 = EXCLUDED.attestation_sha256
            WHERE tai_production_release_attestations.release_id = EXCLUDED.release_id
              AND tai_production_release_attestations.exact_main_sha =
                  EXCLUDED.exact_main_sha
              AND tai_production_release_attestations.application_attestation_sha256 =
                  EXCLUDED.application_attestation_sha256
              AND tai_production_release_attestations.evaluation_report_sha256 =
                  EXCLUDED.evaluation_report_sha256
              AND tai_production_release_attestations.operational_decision_sha256 =
                  EXCLUDED.operational_decision_sha256
              AND tai_production_release_attestations.status = EXCLUDED.status
              AND tai_production_release_attestations.reasons = EXCLUDED.reasons
              AND tai_production_release_attestations.attested_at = EXCLUDED.attested_at
            RETURNING release_id, attestation_sha256
        """
        row = self._execute_returning(
            query,
            (
                attestation.attestation_sha256,
                attestation.release_id,
                attestation.exact_main_sha,
                attestation.application_attestation_sha256,
                attestation.evaluation_report_sha256,
                attestation.operational_decision_sha256,
                attestation.status.value,
                list(attestation.reasons),
                attestation.attested_at,
            ),
        )
        if row is None:
            raise RuntimeError(
                "production attestation digest is bound to different evidence"
            )
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
