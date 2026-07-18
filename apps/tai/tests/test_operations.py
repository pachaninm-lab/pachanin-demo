from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from uuid import UUID

import pytest

from tai.operations import (
    EvidenceKind,
    IncidentEvent,
    IncidentEventKind,
    IncidentSeverity,
    IncidentStatus,
    OperationalEvidence,
    OperationalIndicator,
    OperationalReadinessAuthority,
    OperationalReadinessPolicy,
    RetainedRecord,
    RetentionClass,
    RetentionRule,
    SLOAssessment,
    SLOAssessmentStatus,
    SLODefinition,
    SLOObservation,
    ThresholdDirection,
    assess_slo,
    eligible_for_purge,
    incident_event_sha256,
    replay_incident,
    slo_assessment_sha256,
)

NOW = datetime(2026, 7, 18, 20, 0, tzinfo=UTC)
HEAD = "a" * 64
SOURCE = "b" * 64
INCIDENT_ID = UUID("11111111-1111-1111-1111-111111111111")


def _definition(
    indicator: OperationalIndicator = OperationalIndicator.AVAILABILITY,
    *,
    direction: ThresholdDirection = ThresholdDirection.MINIMUM,
    target: float = 99.9,
    warning_margin: float = 0.05,
) -> SLODefinition:
    return SLODefinition(
        slo_id=f"tai.{indicator.value.casefold()}",
        indicator=indicator,
        direction=direction,
        target=target,
        warning_margin=warning_margin,
        minimum_samples=100,
        maximum_observation_age=timedelta(minutes=10),
        unit="percent",
    )


def _observation(
    definition: SLODefinition,
    *,
    value: float = 99.99,
    samples: int = 1000,
    age: timedelta = timedelta(minutes=1),
    head: str = HEAD,
) -> SLOObservation:
    observed_at = NOW - age
    return SLOObservation(
        observation_id=f"obs.{definition.indicator.value.casefold()}",
        slo_id=definition.slo_id,
        indicator=definition.indicator,
        value=value,
        sample_count=samples,
        window_started_at=observed_at - timedelta(minutes=5),
        window_ended_at=observed_at,
        observed_at=observed_at,
        source_sha256=SOURCE,
        exact_head_sha=head,
    )


def _assessment(
    indicator: OperationalIndicator,
    status: SLOAssessmentStatus = SLOAssessmentStatus.PASS,
) -> SLOAssessment:
    slo_id = f"tai.{indicator.value.casefold()}"
    value = 1.0 if status is not SLOAssessmentStatus.UNKNOWN else None
    reason = None if status is not SLOAssessmentStatus.UNKNOWN else "MISSING_OBSERVATION"
    observation_id = (
        f"obs.{indicator.value.casefold()}" if status is not SLOAssessmentStatus.UNKNOWN else None
    )
    digest = slo_assessment_sha256(
        slo_id=slo_id,
        indicator=indicator,
        exact_head_sha=HEAD,
        status=status,
        value=value,
        target=1.0,
        sample_count=1000,
        reason=reason,
        observation_id=observation_id,
        assessed_at=NOW,
    )
    return SLOAssessment(
        slo_id=slo_id,
        indicator=indicator,
        exact_head_sha=HEAD,
        status=status,
        value=value,
        target=1.0,
        sample_count=1000,
        reason=reason,
        observation_id=observation_id,
        assessed_at=NOW,
        assessment_sha256=digest,
    )


def _evidence(kind: EvidenceKind, *, accepted: bool = True) -> OperationalEvidence:
    return OperationalEvidence(
        evidence_id=f"evidence.{kind.value.casefold()}",
        kind=kind,
        exact_head_sha=HEAD,
        artifact_sha256="c" * 64,
        accepted=accepted,
        observed_at=NOW - timedelta(minutes=5),
        valid_until=NOW + timedelta(hours=1),
        authority=f"tai.{kind.value.casefold()}",
        metadata={"run": 1},
    )


def test_slo_assessment_pass_at_risk_and_breach() -> None:
    definition = _definition()

    passed = assess_slo(
        definition, _observation(definition, value=99.99), exact_head_sha=HEAD, assessed_at=NOW
    )
    at_risk = assess_slo(
        definition, _observation(definition, value=99.92), exact_head_sha=HEAD, assessed_at=NOW
    )
    breached = assess_slo(
        definition, _observation(definition, value=99.8), exact_head_sha=HEAD, assessed_at=NOW
    )

    assert passed.status is SLOAssessmentStatus.PASS
    assert at_risk.status is SLOAssessmentStatus.AT_RISK
    assert breached.status is SLOAssessmentStatus.BREACHED
    assert len(passed.assessment_sha256) == 64


def test_maximum_threshold_direction() -> None:
    definition = _definition(
        OperationalIndicator.ERROR_RATE,
        direction=ThresholdDirection.MAXIMUM,
        target=0.5,
        warning_margin=0.1,
    )

    assert (
        assess_slo(
            definition, _observation(definition, value=0.1), exact_head_sha=HEAD, assessed_at=NOW
        ).status
        is SLOAssessmentStatus.PASS
    )
    assert (
        assess_slo(
            definition, _observation(definition, value=0.45), exact_head_sha=HEAD, assessed_at=NOW
        ).status
        is SLOAssessmentStatus.AT_RISK
    )
    assert (
        assess_slo(
            definition, _observation(definition, value=0.6), exact_head_sha=HEAD, assessed_at=NOW
        ).status
        is SLOAssessmentStatus.BREACHED
    )


@pytest.mark.parametrize(
    ("observation", "reason"),
    [
        (None, "MISSING_OBSERVATION"),
        ("stale", "STALE_OBSERVATION"),
        ("samples", "INSUFFICIENT_SAMPLES"),
        ("head", "EXACT_HEAD_MISMATCH"),
        ("future", "OBSERVATION_FROM_FUTURE"),
    ],
)
def test_slo_unknown_paths_fail_closed(observation: object, reason: str) -> None:
    definition = _definition()
    if observation == "stale":
        value = _observation(definition, age=timedelta(hours=1))
    elif observation == "samples":
        value = _observation(definition, samples=99)
    elif observation == "head":
        value = _observation(definition, head="c" * 64)
    elif observation == "future":
        value = _observation(definition, age=timedelta(minutes=-1))
    else:
        value = None

    result = assess_slo(definition, value, exact_head_sha=HEAD, assessed_at=NOW)

    assert result.status is SLOAssessmentStatus.UNKNOWN
    assert result.reason == reason


def test_readiness_accepts_complete_current_exact_head_evidence() -> None:
    evidence = tuple(_evidence(kind) for kind in EvidenceKind)
    assessments = tuple(_assessment(indicator) for indicator in OperationalIndicator)
    authority = OperationalReadinessAuthority()

    first = authority.decide(
        release_id="tai.release.10",
        exact_head_sha=HEAD,
        evidence=evidence,
        assessments=assessments,
        decided_at=NOW,
    )
    second = authority.decide(
        release_id="tai.release.10",
        exact_head_sha=HEAD,
        evidence=tuple(reversed(evidence)),
        assessments=tuple(reversed(assessments)),
        decided_at=NOW,
    )

    assert first == second
    assert first.accepted is True
    assert first.reasons == ()
    assert len(first.decision_sha256) == 64


def test_readiness_rejects_missing_expired_rejected_and_wrong_head_evidence() -> None:
    evidence = [
        _evidence(kind)
        for kind in EvidenceKind
        if kind not in {EvidenceKind.ROLLBACK, EvidenceKind.CAPACITY}
    ]
    evidence[0] = replace(evidence[0], accepted=False)
    evidence[1] = replace(evidence[1], valid_until=NOW)
    evidence[2] = replace(evidence[2], exact_head_sha="d" * 64)
    assessments = [
        _assessment(indicator)
        for indicator in OperationalIndicator
        if indicator is not OperationalIndicator.MODEL_CAPACITY
    ]
    assessments[0] = _assessment(
        assessments[0].indicator,
        SLOAssessmentStatus.BREACHED,
    )
    assessments[1] = _assessment(
        assessments[1].indicator,
        SLOAssessmentStatus.UNKNOWN,
    )

    decision = OperationalReadinessAuthority().decide(
        release_id="tai.release.failed",
        exact_head_sha=HEAD,
        evidence=evidence,
        assessments=assessments,
        decided_at=NOW,
    )

    assert decision.accepted is False
    assert set(decision.reasons) >= {
        "REQUIRED_EVIDENCE_MISSING",
        "REQUIRED_SLO_MISSING",
        "EVIDENCE_REJECTED",
        "EVIDENCE_EXPIRED",
        "EVIDENCE_EXACT_HEAD_MISMATCH",
        "SLO_BREACH_BUDGET_EXCEEDED",
        "UNKNOWN_SLO_BUDGET_EXCEEDED",
    }


def test_readiness_policy_can_allow_limited_at_risk_state() -> None:
    policy = OperationalReadinessPolicy(
        required_evidence=frozenset({EvidenceKind.EVALUATION}),
        required_indicators=frozenset({OperationalIndicator.AVAILABILITY}),
        maximum_at_risk=1,
    )
    decision = OperationalReadinessAuthority(policy).decide(
        release_id="tai.release.at-risk",
        exact_head_sha=HEAD,
        evidence=(_evidence(EvidenceKind.EVALUATION),),
        assessments=(
            _assessment(
                OperationalIndicator.AVAILABILITY,
                SLOAssessmentStatus.AT_RISK,
            ),
        ),
        decided_at=NOW,
    )

    assert decision.accepted is True


def _event(
    sequence: int,
    kind: IncidentEventKind,
    *,
    previous: IncidentEvent | None = None,
    occurred_at: datetime | None = None,
    severity: IncidentSeverity = IncidentSeverity.SEV1,
) -> IncidentEvent:
    time = occurred_at or NOW + timedelta(minutes=sequence)
    previous_digest = None if previous is None else previous.event_sha256
    digest = incident_event_sha256(
        incident_id=INCIDENT_ID,
        sequence=sequence,
        kind=kind,
        severity=severity,
        actor_id="operator-1",
        occurred_at=time,
        evidence_sha256=(str(sequence)[-1] * 64),
        previous_event_sha256=previous_digest,
    )
    return IncidentEvent(
        incident_id=INCIDENT_ID,
        sequence=sequence,
        kind=kind,
        severity=severity,
        actor_id="operator-1",
        occurred_at=time,
        evidence_sha256=(str(sequence)[-1] * 64),
        previous_event_sha256=previous_digest,
        event_sha256=digest,
    )


def test_incident_hash_chain_reaches_closed_only_after_verified_mitigation_and_postmortem() -> None:
    opened = _event(1, IncidentEventKind.OPENED)
    acknowledged = _event(2, IncidentEventKind.ACKNOWLEDGED, previous=opened)
    started = _event(3, IncidentEventKind.MITIGATION_STARTED, previous=acknowledged)
    verified = _event(4, IncidentEventKind.MITIGATION_VERIFIED, previous=started)
    resolved = _event(5, IncidentEventKind.RESOLVED, previous=verified)
    postmortem = _event(6, IncidentEventKind.POSTMORTEM_ATTACHED, previous=resolved)
    closed = _event(7, IncidentEventKind.CLOSED, previous=postmortem)

    state = replay_incident((opened, acknowledged, started, verified, resolved, postmortem, closed))

    assert state.status is IncidentStatus.CLOSED
    assert state.mitigation_verified is True
    assert state.postmortem_attached is True
    assert state.event_count == 7
    assert state.last_event_sha256 == closed.event_sha256


def test_incident_rejects_resolution_without_verified_mitigation() -> None:
    opened = _event(1, IncidentEventKind.OPENED)
    started = _event(2, IncidentEventKind.MITIGATION_STARTED, previous=opened)
    resolved = _event(3, IncidentEventKind.RESOLVED, previous=started)

    with pytest.raises(ValueError, match="verified mitigation"):
        replay_incident((opened, started, resolved))


def test_incident_rejects_broken_hash_sequence_time_and_severity() -> None:
    opened = _event(1, IncidentEventKind.OPENED)
    acknowledged = _event(2, IncidentEventKind.ACKNOWLEDGED, previous=opened)
    broken_hash = replace(acknowledged, previous_event_sha256="f" * 64)
    with pytest.raises(ValueError, match="digest does not match"):
        replace(broken_hash, event_sha256=acknowledged.event_sha256)

    skipped = _event(3, IncidentEventKind.ACKNOWLEDGED, previous=opened)
    with pytest.raises(ValueError, match="contiguous"):
        replay_incident((opened, skipped))

    backwards = _event(
        2,
        IncidentEventKind.ACKNOWLEDGED,
        previous=opened,
        occurred_at=NOW,
    )
    with pytest.raises(ValueError, match="time moved backwards"):
        replay_incident((opened, backwards))

    changed_severity = _event(
        2,
        IncidentEventKind.ACKNOWLEDGED,
        previous=opened,
        severity=IncidentSeverity.SEV2,
    )
    with pytest.raises(ValueError, match="severity"):
        replay_incident((opened, changed_severity))


def test_retention_planner_respects_age_legal_hold_and_batch_limit() -> None:
    rules = {
        RetentionClass.REQUEST_TRACE: RetentionRule(
            retention_class=RetentionClass.REQUEST_TRACE,
            retain_for=timedelta(days=30),
            purge_batch_limit=1,
        ),
        RetentionClass.INCIDENT: RetentionRule(
            retention_class=RetentionClass.INCIDENT,
            retain_for=timedelta(days=365),
            purge_batch_limit=10,
        ),
    }
    records = (
        RetainedRecord(
            record_id="trace-old-1",
            retention_class=RetentionClass.REQUEST_TRACE,
            created_at=NOW - timedelta(days=40),
            legal_hold=False,
            record_sha256="1" * 64,
        ),
        RetainedRecord(
            record_id="trace-old-2",
            retention_class=RetentionClass.REQUEST_TRACE,
            created_at=NOW - timedelta(days=35),
            legal_hold=False,
            record_sha256="2" * 64,
        ),
        RetainedRecord(
            record_id="trace-hold",
            retention_class=RetentionClass.REQUEST_TRACE,
            created_at=NOW - timedelta(days=50),
            legal_hold=True,
            record_sha256="3" * 64,
        ),
        RetainedRecord(
            record_id="incident-recent",
            retention_class=RetentionClass.INCIDENT,
            created_at=NOW - timedelta(days=100),
            legal_hold=False,
            record_sha256="4" * 64,
        ),
    )

    eligible = eligible_for_purge(records, rules, now=NOW)

    assert tuple(item.record_id for item in eligible) == ("trace-old-1",)


def test_duplicate_evidence_and_assessment_authority_fails_closed() -> None:
    authority = OperationalReadinessAuthority(
        OperationalReadinessPolicy(
            required_evidence=frozenset(),
            required_indicators=frozenset(),
        )
    )
    with pytest.raises(ValueError, match="one evidence"):
        authority.decide(
            release_id="duplicate-evidence",
            exact_head_sha=HEAD,
            evidence=(_evidence(EvidenceKind.SECURITY), _evidence(EvidenceKind.SECURITY)),
            assessments=(),
            decided_at=NOW,
        )
    with pytest.raises(ValueError, match="one SLO"):
        authority.decide(
            release_id="duplicate-assessment",
            exact_head_sha=HEAD,
            evidence=(),
            assessments=(
                _assessment(OperationalIndicator.AVAILABILITY),
                _assessment(OperationalIndicator.AVAILABILITY),
            ),
            decided_at=NOW,
        )
