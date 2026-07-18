from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from typing import Any, Protocol

from tai.operations import (
    IncidentEvent,
    OperationalEvidence,
    OperationalReadinessDecision,
    RetentionClass,
    SLOObservation,
)


class OperationsCursor(Protocol):
    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None: ...

    def fetchone(self) -> Mapping[str, Any] | None: ...


class OperationsConnection(Protocol):
    def cursor(self) -> AbstractContextManager[OperationsCursor]: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


class OperationsConnectionFactory(Protocol):
    def __call__(self) -> AbstractContextManager[OperationsConnection]: ...


class PostgreSQLOperationsRepository:
    """PostgreSQL authority for operational evidence and hash-chained incidents."""

    def __init__(self, connection_factory: OperationsConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record_observation(self, observation: SLOObservation) -> None:
        query = """
            INSERT INTO tai_slo_observations (
                observation_id,
                slo_id,
                indicator,
                value,
                sample_count,
                window_started_at,
                window_ended_at,
                observed_at,
                source_sha256,
                exact_head_sha
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (observation_id) DO UPDATE
            SET observation_id = EXCLUDED.observation_id
            WHERE tai_slo_observations.slo_id = EXCLUDED.slo_id
              AND tai_slo_observations.indicator = EXCLUDED.indicator
              AND tai_slo_observations.value = EXCLUDED.value
              AND tai_slo_observations.sample_count = EXCLUDED.sample_count
              AND tai_slo_observations.window_started_at = EXCLUDED.window_started_at
              AND tai_slo_observations.window_ended_at = EXCLUDED.window_ended_at
              AND tai_slo_observations.observed_at = EXCLUDED.observed_at
              AND tai_slo_observations.source_sha256 = EXCLUDED.source_sha256
              AND tai_slo_observations.exact_head_sha = EXCLUDED.exact_head_sha
            RETURNING observation_id
        """
        row = self._execute_returning(
            query,
            (
                observation.observation_id,
                observation.slo_id,
                observation.indicator.value,
                observation.value,
                observation.sample_count,
                observation.window_started_at,
                observation.window_ended_at,
                observation.observed_at,
                observation.source_sha256,
                observation.exact_head_sha,
            ),
        )
        if row is None:
            raise RuntimeError("observation_id is already bound to different evidence")

    def record_evidence(self, evidence: OperationalEvidence) -> None:
        query = """
            INSERT INTO tai_operational_evidence (
                evidence_id,
                kind,
                exact_head_sha,
                artifact_sha256,
                accepted,
                observed_at,
                valid_until,
                authority,
                metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::JSONB)
            ON CONFLICT (evidence_id) DO UPDATE
            SET evidence_id = EXCLUDED.evidence_id
            WHERE tai_operational_evidence.kind = EXCLUDED.kind
              AND tai_operational_evidence.exact_head_sha = EXCLUDED.exact_head_sha
              AND tai_operational_evidence.artifact_sha256 = EXCLUDED.artifact_sha256
              AND tai_operational_evidence.accepted = EXCLUDED.accepted
              AND tai_operational_evidence.observed_at = EXCLUDED.observed_at
              AND tai_operational_evidence.valid_until = EXCLUDED.valid_until
              AND tai_operational_evidence.authority = EXCLUDED.authority
              AND tai_operational_evidence.metadata = EXCLUDED.metadata
            RETURNING evidence_id
        """
        row = self._execute_returning(
            query,
            (
                evidence.evidence_id,
                evidence.kind.value,
                evidence.exact_head_sha,
                evidence.artifact_sha256,
                evidence.accepted,
                evidence.observed_at,
                evidence.valid_until,
                evidence.authority,
                json.dumps(
                    evidence.metadata,
                    ensure_ascii=False,
                    allow_nan=False,
                    separators=(",", ":"),
                    sort_keys=True,
                ),
            ),
        )
        if row is None:
            raise RuntimeError("evidence_id is already bound to different evidence")

    def record_decision(self, decision: OperationalReadinessDecision) -> None:
        query = """
            INSERT INTO tai_operational_readiness_decisions (
                release_id,
                exact_head_sha,
                accepted,
                reasons,
                evidence_ids,
                assessment_sha256s,
                decided_at,
                decision_sha256
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (release_id) DO UPDATE
            SET release_id = EXCLUDED.release_id
            WHERE tai_operational_readiness_decisions.decision_sha256 = EXCLUDED.decision_sha256
            RETURNING release_id, decision_sha256
        """
        row = self._execute_returning(
            query,
            (
                decision.release_id,
                decision.exact_head_sha,
                decision.accepted,
                list(decision.reasons),
                list(decision.evidence_ids),
                list(decision.assessment_sha256s),
                decision.decided_at,
                decision.decision_sha256,
            ),
        )
        if row is None:
            raise RuntimeError("release_id is already bound to a different readiness decision")
        if str(row["decision_sha256"]) != decision.decision_sha256:
            raise RuntimeError("persisted readiness decision digest does not match")

    def append_incident_event(self, event: IncidentEvent) -> None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                            SELECT sequence, event_sha256, severity, occurred_at
                            FROM tai_incident_events
                            WHERE incident_id = %s
                            ORDER BY sequence DESC
                            LIMIT 1
                            FOR UPDATE
                        """,
                        (event.incident_id,),
                    )
                    previous = cursor.fetchone()
                    _validate_incident_append(previous, event)
                    cursor.execute(
                        """
                            INSERT INTO tai_incident_events (
                                incident_id,
                                sequence,
                                kind,
                                severity,
                                actor_id,
                                occurred_at,
                                evidence_sha256,
                                previous_event_sha256,
                                event_sha256
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (incident_id, sequence) DO UPDATE
                            SET incident_id = EXCLUDED.incident_id
                            WHERE tai_incident_events.event_sha256 = EXCLUDED.event_sha256
                            RETURNING sequence, event_sha256
                        """,
                        (
                            event.incident_id,
                            event.sequence,
                            event.kind.value,
                            event.severity.value,
                            event.actor_id,
                            event.occurred_at,
                            event.evidence_sha256,
                            event.previous_event_sha256,
                            event.event_sha256,
                        ),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        raise RuntimeError(
                            "incident sequence is already bound to a different event"
                        )
                    if str(row["event_sha256"]) != event.event_sha256:
                        raise RuntimeError("persisted incident event digest does not match")
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def set_legal_hold(
        self,
        *,
        record_id: str,
        retention_class: RetentionClass,
        legal_hold: bool,
        hold_reason: str | None,
        expected_version: int | None,
    ) -> int:
        if legal_hold and (hold_reason is None or not hold_reason.strip()):
            raise ValueError("legal hold requires a reason")
        if not legal_hold and hold_reason is not None:
            raise ValueError("released legal hold must not retain a reason")
        if expected_version is None:
            query = """
                INSERT INTO tai_retention_holds (
                    record_id,
                    retention_class,
                    legal_hold,
                    hold_reason
                )
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (retention_class, record_id) DO NOTHING
                RETURNING version
            """
            parameters: tuple[Any, ...] = (
                record_id,
                retention_class.value,
                legal_hold,
                hold_reason,
            )
        else:
            if expected_version < 1:
                raise ValueError("expected_version must be positive")
            query = """
                UPDATE tai_retention_holds
                SET legal_hold = %s,
                    hold_reason = %s,
                    version = version + 1,
                    updated_at = clock_timestamp()
                WHERE retention_class = %s
                  AND record_id = %s
                  AND version = %s
                RETURNING version
            """
            parameters = (
                legal_hold,
                hold_reason,
                retention_class.value,
                record_id,
                expected_version,
            )
        row = self._execute_returning(query, parameters)
        if row is None:
            raise RuntimeError("retention hold optimistic concurrency conflict")
        return int(row["version"])

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


def _validate_incident_append(
    previous: Mapping[str, Any] | None,
    event: IncidentEvent,
) -> None:
    if previous is None:
        if event.sequence != 1 or event.previous_event_sha256 is not None:
            raise RuntimeError("first incident event must be sequence 1 without previous digest")
        return
    expected_sequence = int(previous["sequence"]) + 1
    if event.sequence == int(previous["sequence"]):
        if str(previous["event_sha256"]) != event.event_sha256:
            raise RuntimeError("incident sequence is already bound to a different event")
        return
    if event.sequence != expected_sequence:
        raise RuntimeError("incident event sequence must append contiguously")
    if event.previous_event_sha256 != str(previous["event_sha256"]):
        raise RuntimeError("incident event previous digest does not match current tail")
    if event.severity.value != str(previous["severity"]):
        raise RuntimeError("incident severity is immutable")
    if event.occurred_at < previous["occurred_at"]:
        raise RuntimeError("incident event time moved backwards")
