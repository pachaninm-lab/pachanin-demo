from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from tai.operations import (
    OperationalIndicator,
    OperationalReadinessAuthority,
    OperationalReadinessPolicy,
    SLOAssessment,
    SLOAssessmentStatus,
    slo_assessment_sha256,
)

NOW = datetime(2026, 7, 18, 22, 0, tzinfo=UTC)
HEAD = "a" * 64
OTHER_HEAD = "b" * 64


def _assessment(*, head: str = HEAD, assessed_at: datetime = NOW) -> SLOAssessment:
    digest = slo_assessment_sha256(
        slo_id="tai.availability",
        indicator=OperationalIndicator.AVAILABILITY,
        exact_head_sha=head,
        status=SLOAssessmentStatus.PASS,
        value=99.99,
        target=99.9,
        sample_count=1000,
        reason=None,
        observation_id="obs.availability",
        assessed_at=assessed_at,
    )
    return SLOAssessment(
        slo_id="tai.availability",
        indicator=OperationalIndicator.AVAILABILITY,
        exact_head_sha=head,
        status=SLOAssessmentStatus.PASS,
        value=99.99,
        target=99.9,
        sample_count=1000,
        reason=None,
        observation_id="obs.availability",
        assessed_at=assessed_at,
        assessment_sha256=digest,
    )


def _authority() -> OperationalReadinessAuthority:
    return OperationalReadinessAuthority(
        OperationalReadinessPolicy(
            required_evidence=frozenset(),
            required_indicators=frozenset({OperationalIndicator.AVAILABILITY}),
        )
    )


def test_readiness_rejects_slo_assessment_from_other_exact_head() -> None:
    decision = _authority().decide(
        release_id="tai.release.head-fencing",
        exact_head_sha=HEAD,
        evidence=(),
        assessments=(_assessment(head=OTHER_HEAD),),
        decided_at=NOW,
    )

    assert decision.accepted is False
    assert decision.reasons == ("SLO_EXACT_HEAD_MISMATCH",)


def test_readiness_rejects_slo_assessment_from_future() -> None:
    decision = _authority().decide(
        release_id="tai.release.future-assessment",
        exact_head_sha=HEAD,
        evidence=(),
        assessments=(_assessment(assessed_at=NOW + timedelta(seconds=1)),),
        decided_at=NOW,
    )

    assert decision.accepted is False
    assert decision.reasons == ("SLO_ASSESSMENT_FROM_FUTURE",)


def test_slo_assessment_digest_detects_field_tampering() -> None:
    assessment = _assessment()

    with pytest.raises(ValueError, match="digest does not match"):
        replace(assessment, exact_head_sha=OTHER_HEAD)
