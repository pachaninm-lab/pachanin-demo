from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from tai.loader_state import LoaderLease, LoaderRunStatus
from tai.official_source_observation import OfficialObservationRunEvidence
from tai.postgres_loader_state import ConnectionFactory
from tai.source_coverage import CoverageTopic, SourceObservation


class PostgreSQLOfficialObservationAuthority:
    """Atomically fence a loader run, persist its observation, and append evidence."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def latest_observation(self, source_id: str) -> SourceObservation | None:
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
            WHERE source_id = %s
        """
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, (source_id,))
                    row = cursor.fetchone()
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        return _observation_from_row(row) if row is not None else None

    def commit_run(
        self,
        *,
        lease: LoaderLease,
        status: LoaderRunStatus,
        next_run_at: datetime | None,
        etag: str | None,
        last_modified: str | None,
        consecutive_failures: int,
        observation: SourceObservation | None,
        evidence: OfficialObservationRunEvidence,
    ) -> bool:
        if evidence.source_id != lease.source_id:
            raise ValueError("run evidence source must match loader lease")
        if evidence.lease_token != lease.token:
            raise ValueError("run evidence token must match loader lease")
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        _COMPLETE_LOADER_STATE,
                        (
                            status.value,
                            next_run_at,
                            etag,
                            last_modified,
                            consecutive_failures,
                            lease.source_id,
                            lease.token,
                            lease.owner,
                            lease.version,
                        ),
                    )
                    if cursor.fetchone() is None:
                        connection.rollback()
                        return False
                    if observation is not None:
                        _insert_observation(cursor, observation)
                    _insert_run_evidence(cursor, evidence)
                connection.commit()
                return True
            except Exception:
                connection.rollback()
                raise


_COMPLETE_LOADER_STATE = """
    UPDATE tai_loader_state
    SET
        status = %s,
        next_run_at = %s,
        etag = %s,
        last_modified = %s,
        consecutive_failures = %s,
        lease_token = NULL,
        lease_owner = NULL,
        lease_expires_at = NULL,
        updated_at = clock_timestamp(),
        version = version + 1
    WHERE source_id = %s
      AND lease_token = %s
      AND lease_owner = %s
      AND version = %s
      AND status = 'RUNNING'
    RETURNING version
"""


_INSERT_OBSERVATION = """
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
      AND tai_official_source_observations.document_count = EXCLUDED.document_count
      AND tai_official_source_observations.consecutive_failures
        = EXCLUDED.consecutive_failures
      AND tai_official_source_observations.observed_topics = EXCLUDED.observed_topics
      AND tai_official_source_observations.content_sha256 = EXCLUDED.content_sha256
    RETURNING observation_sha256
"""


_INSERT_RUN_EVIDENCE = """
    INSERT INTO tai_official_source_run_evidence (
        run_sha256,
        source_id,
        worker_id,
        lease_token,
        started_at,
        completed_at,
        status,
        reasons,
        observation_sha256,
        content_sha256
    )
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
    ON CONFLICT (run_sha256) DO UPDATE
    SET run_sha256 = EXCLUDED.run_sha256
    WHERE tai_official_source_run_evidence.source_id = EXCLUDED.source_id
      AND tai_official_source_run_evidence.worker_id = EXCLUDED.worker_id
      AND tai_official_source_run_evidence.lease_token = EXCLUDED.lease_token
      AND tai_official_source_run_evidence.started_at = EXCLUDED.started_at
      AND tai_official_source_run_evidence.completed_at = EXCLUDED.completed_at
      AND tai_official_source_run_evidence.status = EXCLUDED.status
      AND tai_official_source_run_evidence.reasons = EXCLUDED.reasons
      AND tai_official_source_run_evidence.observation_sha256
        IS NOT DISTINCT FROM EXCLUDED.observation_sha256
      AND tai_official_source_run_evidence.content_sha256
        IS NOT DISTINCT FROM EXCLUDED.content_sha256
    RETURNING run_sha256
"""


def _insert_observation(cursor: Any, observation: SourceObservation) -> None:
    cursor.execute(
        _INSERT_OBSERVATION,
        (
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
        ),
    )
    if cursor.fetchone() is None:
        raise RuntimeError("observation digest conflicts with different evidence")


def _insert_run_evidence(cursor: Any, evidence: OfficialObservationRunEvidence) -> None:
    cursor.execute(
        _INSERT_RUN_EVIDENCE,
        (
            evidence.run_sha256,
            evidence.source_id,
            evidence.worker_id,
            evidence.lease_token,
            evidence.started_at,
            evidence.completed_at,
            evidence.status.value,
            json.dumps(list(evidence.reasons), ensure_ascii=False, separators=(",", ":")),
            evidence.observation_sha256,
            evidence.content_sha256,
        ),
    )
    if cursor.fetchone() is None:
        raise RuntimeError("run digest conflicts with different evidence")


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


def _parameters(value: Sequence[Any]) -> Sequence[Any]:
    return value
