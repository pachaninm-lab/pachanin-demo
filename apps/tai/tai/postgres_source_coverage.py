from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from tai.postgres_loader_state import ConnectionFactory
from tai.source_coverage import (
    CoverageAssessment,
    CoverageTopic,
    SourceObservation,
    assessment_payload,
)


class PostgreSQLOfficialSourceCoverageRepository:
    """Append-only PostgreSQL authority for observations and assessments."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record_observation(self, observation: SourceObservation) -> None:
        query = """
            INSERT INTO tai_official_source_observations (
                observation_sha256,
                source_id,
                observed_at,
                latest_publication_at,
                last_success_at,
                document_count,
                consecutive_failures,
                observed_topics,
                content_sha256
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            ON CONFLICT (observation_sha256) DO UPDATE
            SET observation_sha256 = EXCLUDED.observation_sha256
            WHERE tai_official_source_observations.source_id = EXCLUDED.source_id
              AND tai_official_source_observations.observed_at = EXCLUDED.observed_at
              AND tai_official_source_observations.latest_publication_at
                = EXCLUDED.latest_publication_at
              AND tai_official_source_observations.last_success_at
                = EXCLUDED.last_success_at
              AND tai_official_source_observations.document_count
                = EXCLUDED.document_count
              AND tai_official_source_observations.consecutive_failures
                = EXCLUDED.consecutive_failures
              AND tai_official_source_observations.observed_topics
                = EXCLUDED.observed_topics
              AND tai_official_source_observations.content_sha256
                = EXCLUDED.content_sha256
            RETURNING observation_sha256
        """
        parameters = (
            observation.observation_sha256,
            observation.source_id,
            observation.observed_at,
            observation.latest_publication_at,
            observation.last_success_at,
            observation.document_count,
            observation.consecutive_failures,
            json.dumps(
                sorted(topic.value for topic in observation.observed_topics),
                separators=(",", ":"),
            ),
            observation.content_sha256,
        )
        self._execute_immutable(
            query,
            parameters,
            conflict_message=(
                "observation digest is already bound to different evidence"
            ),
        )

    def record_assessment(self, assessment: CoverageAssessment) -> None:
        payload = assessment_payload(assessment)
        query = """
            INSERT INTO tai_official_source_coverage_assessments (
                assessment_sha256,
                generated_at,
                coverage_basis_points,
                critical_coverage_basis_points,
                all_critical_covered,
                topics
            )
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (assessment_sha256) DO UPDATE
            SET assessment_sha256 = EXCLUDED.assessment_sha256
            WHERE tai_official_source_coverage_assessments.generated_at
                = EXCLUDED.generated_at
              AND tai_official_source_coverage_assessments.coverage_basis_points
                = EXCLUDED.coverage_basis_points
              AND tai_official_source_coverage_assessments
                    .critical_coverage_basis_points
                = EXCLUDED.critical_coverage_basis_points
              AND tai_official_source_coverage_assessments.all_critical_covered
                = EXCLUDED.all_critical_covered
              AND tai_official_source_coverage_assessments.topics
                = EXCLUDED.topics
            RETURNING assessment_sha256
        """
        parameters = (
            assessment.assessment_sha256,
            assessment.generated_at,
            assessment.coverage_basis_points,
            assessment.critical_coverage_basis_points,
            assessment.all_critical_covered,
            json.dumps(payload["topics"], ensure_ascii=False, separators=(",", ":")),
        )
        self._execute_immutable(
            query,
            parameters,
            conflict_message=(
                "assessment digest is already bound to different evidence"
            ),
        )

    def list_latest_observations(self) -> tuple[SourceObservation, ...]:
        query = """
            SELECT
                source_id,
                observed_at,
                latest_publication_at,
                last_success_at,
                document_count,
                consecutive_failures,
                observed_topics,
                content_sha256
            FROM tai_latest_official_source_observations_v1
            ORDER BY source_id
        """
        rows = self._execute_all(query, ())
        return tuple(_observation_from_row(row) for row in rows)

    def current_assessment_metadata(self) -> Mapping[str, Any] | None:
        query = """
            SELECT
                assessment_sha256,
                generated_at,
                coverage_basis_points,
                critical_coverage_basis_points,
                all_critical_covered
            FROM tai_current_official_source_coverage_v1
        """
        rows = self._execute_all(query, ())
        return rows[0] if rows else None

    def _execute_immutable(
        self,
        query: str,
        parameters: Sequence[Any],
        *,
        conflict_message: str,
    ) -> None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    row = cursor.fetchone()
                if row is None:
                    raise RuntimeError(conflict_message)
                connection.commit()
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


def _observation_from_row(row: Mapping[str, Any]) -> SourceObservation:
    topics = row["observed_topics"]
    if isinstance(topics, str):
        topics = json.loads(topics)
    if not isinstance(topics, list) or any(not isinstance(item, str) for item in topics):
        raise ValueError("stored observed_topics must be a string array")
    return SourceObservation(
        source_id=str(row["source_id"]),
        observed_at=_datetime(row["observed_at"], "observed_at"),
        latest_publication_at=_datetime(
            row["latest_publication_at"],
            "latest_publication_at",
        ),
        last_success_at=_datetime(row["last_success_at"], "last_success_at"),
        document_count=int(row["document_count"]),
        consecutive_failures=int(row["consecutive_failures"]),
        observed_topics=frozenset(CoverageTopic(item) for item in topics),
        content_sha256=str(row["content_sha256"]),
    )


def _datetime(value: object, name: str) -> datetime:
    if not isinstance(value, datetime):
        raise ValueError(f"stored {name} must be a datetime")
    return value
