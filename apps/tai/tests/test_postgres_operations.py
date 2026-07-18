from __future__ import annotations

from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import pytest

from tai.operations import (
    EvidenceKind,
    IncidentEvent,
    IncidentEventKind,
    IncidentSeverity,
    OperationalEvidence,
    OperationalIndicator,
    OperationalReadinessDecision,
    RetentionClass,
    SLOObservation,
    incident_event_sha256,
)
from tai.postgres_operations import PostgreSQLOperationsRepository

NOW = datetime(2026, 7, 18, 21, 0, tzinfo=UTC)
HEAD = "a" * 64
INCIDENT_ID = UUID("22222222-2222-2222-2222-222222222222")


class _Cursor(AbstractContextManager["_Cursor"]):
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.rows = rows
        self.fail = fail
        self.executions: list[tuple[str, tuple[Any, ...]]] = []

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        if self.fail:
            raise RuntimeError("database unavailable")
        self.executions.append((query, tuple(parameters)))

    def fetchone(self) -> Mapping[str, Any] | None:
        if not self.rows:
            raise AssertionError("unexpected fetchone call")
        return self.rows.pop(0)


class _Connection(AbstractContextManager["_Connection"]):
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.cursor_instance = _Cursor(rows, fail=fail)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class _Factory:
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.connection = _Connection(rows, fail=fail)

    def __call__(self) -> _Connection:
        return self.connection


def _observation() -> SLOObservation:
    return SLOObservation(
        observation_id="obs.availability",
        slo_id="tai.availability",
        indicator=OperationalIndicator.AVAILABILITY,
        value=99.99,
        sample_count=1000,
        window_started_at=NOW - timedelta(minutes=6),
        window_ended_at=NOW - timedelta(minutes=1),
        observed_at=NOW,
        source_sha256="b" * 64,
        exact_head_sha=HEAD,
    )


def _evidence() -> OperationalEvidence:
    return OperationalEvidence(
        evidence_id="evidence.security",
        kind=EvidenceKind.SECURITY,
        exact_head_sha=HEAD,
        artifact_sha256="c" * 64,
        accepted=True,
        observed_at=NOW,
        valid_until=NOW + timedelta(hours=1),
        authority="security.quality",
        metadata={"run_id": 42},
    )


def _decision() -> OperationalReadinessDecision:
    return OperationalReadinessDecision(
        release_id="tai.release.10",
        exact_head_sha=HEAD,
        accepted=True,
        reasons=(),
        evidence_ids=("evidence.security",),
        assessment_sha256s=("d" * 64,),
        decided_at=NOW,
        decision_sha256="e" * 64,
    )


def _incident_event(
    *,
    sequence: int = 1,
    previous_sha256: str | None = None,
    severity: IncidentSeverity = IncidentSeverity.SEV1,
    occurred_at: datetime = NOW,
) -> IncidentEvent:
    kind = IncidentEventKind.OPENED if sequence == 1 else IncidentEventKind.ACKNOWLEDGED
    digest = incident_event_sha256(
        incident_id=INCIDENT_ID,
        sequence=sequence,
        kind=kind,
        severity=severity,
        actor_id="operator-1",
        occurred_at=occurred_at,
        evidence_sha256="f" * 64,
        previous_event_sha256=previous_sha256,
    )
    return IncidentEvent(
        incident_id=INCIDENT_ID,
        sequence=sequence,
        kind=kind,
        severity=severity,
        actor_id="operator-1",
        occurred_at=occurred_at,
        evidence_sha256="f" * 64,
        previous_event_sha256=previous_sha256,
        event_sha256=digest,
    )


def test_observation_evidence_and_decision_are_idempotent() -> None:
    observation_factory = _Factory([{"observation_id": "obs.availability"}])
    evidence_factory = _Factory([{"evidence_id": "evidence.security"}])
    decision_factory = _Factory([{"release_id": "tai.release.10", "decision_sha256": "e" * 64}])

    PostgreSQLOperationsRepository(observation_factory).record_observation(_observation())
    PostgreSQLOperationsRepository(evidence_factory).record_evidence(_evidence())
    PostgreSQLOperationsRepository(decision_factory).record_decision(_decision())

    observation_query = observation_factory.connection.cursor_instance.executions[0][0]
    evidence_query = evidence_factory.connection.cursor_instance.executions[0][0]
    decision_query = decision_factory.connection.cursor_instance.executions[0][0]
    assert "ON CONFLICT (observation_id) DO UPDATE" in observation_query
    assert "ON CONFLICT (evidence_id) DO UPDATE" in evidence_query
    assert "decision_sha256 = EXCLUDED.decision_sha256" in decision_query
    assert observation_factory.connection.committed is True
    assert evidence_factory.connection.committed is True
    assert decision_factory.connection.committed is True


@pytest.mark.parametrize(
    ("method", "argument", "message"),
    [
        ("record_observation", _observation(), "observation_id"),
        ("record_evidence", _evidence(), "evidence_id"),
        ("record_decision", _decision(), "release_id"),
    ],
)
def test_conflicting_id_fails_closed(
    method: str,
    argument: object,
    message: str,
) -> None:
    repository = PostgreSQLOperationsRepository(_Factory([None]))

    with pytest.raises(RuntimeError, match=message):
        getattr(repository, method)(argument)


def test_incident_first_event_is_appended_under_lock() -> None:
    event = _incident_event()
    factory = _Factory(
        [
            None,
            {"sequence": 1, "event_sha256": event.event_sha256},
        ]
    )

    PostgreSQLOperationsRepository(factory).append_incident_event(event)

    queries = factory.connection.cursor_instance.executions
    assert "FOR UPDATE" in queries[0][0]
    assert "INSERT INTO tai_incident_events" in queries[1][0]
    assert factory.connection.committed is True


def test_incident_append_validates_tail_sequence_hash_severity_and_time() -> None:
    first = _incident_event()
    valid_second = _incident_event(sequence=2, previous_sha256=first.event_sha256)
    previous = {
        "sequence": 1,
        "event_sha256": first.event_sha256,
        "severity": "SEV1",
        "occurred_at": NOW,
    }
    accepted_factory = _Factory(
        [previous, {"sequence": 2, "event_sha256": valid_second.event_sha256}]
    )
    PostgreSQLOperationsRepository(accepted_factory).append_incident_event(valid_second)

    cases = (
        (_incident_event(sequence=3, previous_sha256=first.event_sha256), "contiguously"),
        (_incident_event(sequence=2, previous_sha256="0" * 64), "previous digest"),
        (
            _incident_event(
                sequence=2,
                previous_sha256=first.event_sha256,
                severity=IncidentSeverity.SEV2,
            ),
            "severity",
        ),
        (
            _incident_event(
                sequence=2,
                previous_sha256=first.event_sha256,
                occurred_at=NOW - timedelta(minutes=1),
            ),
            "time moved backwards",
        ),
    )
    for event, message in cases:
        factory = _Factory([previous])
        with pytest.raises(RuntimeError, match=message):
            PostgreSQLOperationsRepository(factory).append_incident_event(event)
        assert factory.connection.rolled_back is True


def test_incident_conflicting_sequence_and_digest_fails_closed() -> None:
    event = _incident_event()
    factory = _Factory(
        [
            {
                "sequence": 1,
                "event_sha256": "0" * 64,
                "severity": "SEV1",
                "occurred_at": NOW,
            }
        ]
    )

    with pytest.raises(RuntimeError, match="different event"):
        PostgreSQLOperationsRepository(factory).append_incident_event(event)


def test_legal_hold_create_update_and_validation() -> None:
    create_factory = _Factory([{"version": 1}])
    update_factory = _Factory([{"version": 2}])

    created = PostgreSQLOperationsRepository(create_factory).set_legal_hold(
        record_id="trace-1",
        retention_class=RetentionClass.REQUEST_TRACE,
        legal_hold=True,
        hold_reason="active dispute",
        expected_version=None,
    )
    updated = PostgreSQLOperationsRepository(update_factory).set_legal_hold(
        record_id="trace-1",
        retention_class=RetentionClass.REQUEST_TRACE,
        legal_hold=False,
        hold_reason=None,
        expected_version=1,
    )

    assert created == 1
    assert updated == 2
    assert (
        "INSERT INTO tai_retention_holds"
        in create_factory.connection.cursor_instance.executions[0][0]
    )
    assert "version = version + 1" in update_factory.connection.cursor_instance.executions[0][0]
    with pytest.raises(ValueError, match="requires a reason"):
        PostgreSQLOperationsRepository(_Factory([])).set_legal_hold(
            record_id="trace-2",
            retention_class=RetentionClass.REQUEST_TRACE,
            legal_hold=True,
            hold_reason=None,
            expected_version=None,
        )
    with pytest.raises(ValueError, match="must not retain"):
        PostgreSQLOperationsRepository(_Factory([])).set_legal_hold(
            record_id="trace-2",
            retention_class=RetentionClass.REQUEST_TRACE,
            legal_hold=False,
            hold_reason="stale",
            expected_version=1,
        )


def test_database_error_rolls_back() -> None:
    factory = _Factory([], fail=True)

    with pytest.raises(RuntimeError, match="database unavailable"):
        PostgreSQLOperationsRepository(factory).record_evidence(_evidence())

    assert factory.connection.rolled_back is True
