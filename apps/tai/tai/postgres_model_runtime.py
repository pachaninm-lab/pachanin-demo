from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from tai.model_runtime import (
    LocalModelProfile,
    ModelCapability,
    ModelProfileStatus,
    ModelRuntimeClass,
    ModelRuntimeHealth,
    ModelRuntimeStatus,
)
from tai.postgres_loader_state import ConnectionFactory


class PostgreSQLModelRuntimeRepository:
    """Durable model profile and observed runtime-health authority."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def register_profile(self, profile: LocalModelProfile) -> None:
        query = """
            INSERT INTO tai_local_model_profiles (
                model_id,
                revision,
                artifact_locator,
                artifact_sha256,
                license_ref,
                capabilities,
                maximum_context_tokens,
                maximum_output_tokens,
                runtime_class,
                quantization,
                routing_priority,
                status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (model_id, revision) DO UPDATE
            SET model_id = EXCLUDED.model_id
            WHERE tai_local_model_profiles.artifact_locator = EXCLUDED.artifact_locator
              AND tai_local_model_profiles.artifact_sha256 = EXCLUDED.artifact_sha256
              AND tai_local_model_profiles.license_ref = EXCLUDED.license_ref
              AND tai_local_model_profiles.capabilities = EXCLUDED.capabilities
              AND tai_local_model_profiles.maximum_context_tokens = EXCLUDED.maximum_context_tokens
              AND tai_local_model_profiles.maximum_output_tokens = EXCLUDED.maximum_output_tokens
              AND tai_local_model_profiles.runtime_class = EXCLUDED.runtime_class
              AND tai_local_model_profiles.quantization = EXCLUDED.quantization
              AND tai_local_model_profiles.routing_priority = EXCLUDED.routing_priority
              AND tai_local_model_profiles.status = EXCLUDED.status
            RETURNING model_id
        """
        row = self._execute_returning(
            query,
            (
                profile.model_id,
                profile.revision,
                profile.artifact_locator,
                profile.artifact_sha256,
                profile.license_ref,
                sorted(capability.value for capability in profile.capabilities),
                profile.maximum_context_tokens,
                profile.maximum_output_tokens,
                profile.runtime_class.value,
                profile.quantization,
                profile.routing_priority,
                profile.status.value,
            ),
        )
        if row is None:
            raise RuntimeError(
                "model identity is already bound to different artifact or policy metadata"
            )

    def update_profile_status(
        self,
        *,
        model_id: str,
        revision: str,
        expected_version: int,
        status: ModelProfileStatus,
    ) -> bool:
        if not model_id.strip() or not revision.strip():
            raise ValueError("model_id and revision must not be blank")
        if expected_version < 1:
            raise ValueError("expected_version must be positive")
        query = """
            UPDATE tai_local_model_profiles
            SET status = %s,
                version = version + 1,
                updated_at = clock_timestamp()
            WHERE model_id = %s
              AND revision = %s
              AND version = %s
            RETURNING version
        """
        row = self._execute_returning(
            query,
            (status.value, model_id, revision, expected_version),
        )
        return row is not None

    def record_health(self, health: ModelRuntimeHealth) -> bool:
        query = """
            INSERT INTO tai_local_model_health (
                model_id,
                revision,
                status,
                available_slots,
                queue_depth,
                p95_latency_ms,
                observed_at,
                circuit_open_until
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (model_id, revision) DO UPDATE
            SET status = EXCLUDED.status,
                available_slots = EXCLUDED.available_slots,
                queue_depth = EXCLUDED.queue_depth,
                p95_latency_ms = EXCLUDED.p95_latency_ms,
                observed_at = EXCLUDED.observed_at,
                circuit_open_until = EXCLUDED.circuit_open_until,
                updated_at = clock_timestamp()
            WHERE tai_local_model_health.observed_at <= EXCLUDED.observed_at
            RETURNING model_id
        """
        row = self._execute_returning(
            query,
            (
                health.model_id,
                health.revision,
                health.status.value,
                health.available_slots,
                health.queue_depth,
                health.p95_latency_ms,
                health.observed_at,
                health.circuit_open_until,
            ),
        )
        return row is not None

    def list_profiles(self) -> tuple[LocalModelProfile, ...]:
        query = """
            SELECT
                model_id,
                revision,
                artifact_locator,
                artifact_sha256,
                license_ref,
                capabilities,
                maximum_context_tokens,
                maximum_output_tokens,
                runtime_class,
                quantization,
                routing_priority,
                status
            FROM tai_local_model_profiles
            ORDER BY routing_priority, model_id, revision
        """
        return tuple(
            self._profile_from_row(row) for row in self._execute_all(query, ())
        )

    def list_health(self) -> tuple[ModelRuntimeHealth, ...]:
        query = """
            SELECT
                model_id,
                revision,
                status,
                available_slots,
                queue_depth,
                p95_latency_ms,
                observed_at,
                circuit_open_until
            FROM tai_local_model_health
            ORDER BY model_id, revision
        """
        return tuple(self._health_from_row(row) for row in self._execute_all(query, ()))

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

    def _execute_all(
        self,
        query: str,
        parameters: Sequence[Any],
    ) -> tuple[Mapping[str, Any], ...]:
        with self._connection_factory() as connection:
            try:
                rows: list[Mapping[str, Any]] = []
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    while True:
                        row = cursor.fetchone()
                        if row is None:
                            break
                        rows.append(row)
                connection.commit()
                return tuple(rows)
            except Exception:
                connection.rollback()
                raise

    @staticmethod
    def _profile_from_row(row: Mapping[str, Any]) -> LocalModelProfile:
        raw_capabilities = row["capabilities"]
        if not isinstance(raw_capabilities, (list, tuple)):
            raise TypeError("model capabilities must be returned as an array")
        return LocalModelProfile(
            model_id=str(row["model_id"]),
            revision=str(row["revision"]),
            artifact_locator=str(row["artifact_locator"]),
            artifact_sha256=str(row["artifact_sha256"]),
            license_ref=str(row["license_ref"]),
            capabilities=frozenset(
                ModelCapability(str(capability)) for capability in raw_capabilities
            ),
            maximum_context_tokens=int(row["maximum_context_tokens"]),
            maximum_output_tokens=int(row["maximum_output_tokens"]),
            runtime_class=ModelRuntimeClass(str(row["runtime_class"])),
            quantization=str(row["quantization"]),
            routing_priority=int(row["routing_priority"]),
            status=ModelProfileStatus(str(row["status"])),
        )

    @staticmethod
    def _health_from_row(row: Mapping[str, Any]) -> ModelRuntimeHealth:
        return ModelRuntimeHealth(
            model_id=str(row["model_id"]),
            revision=str(row["revision"]),
            status=ModelRuntimeStatus(str(row["status"])),
            available_slots=int(row["available_slots"]),
            queue_depth=int(row["queue_depth"]),
            p95_latency_ms=int(row["p95_latency_ms"]),
            observed_at=row["observed_at"],
            circuit_open_until=row["circuit_open_until"],
        )
