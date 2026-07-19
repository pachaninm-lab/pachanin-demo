from __future__ import annotations

import hashlib
from dataclasses import replace
from datetime import UTC, datetime

import pytest

from tai.gold_set import (
    ExpertReview,
    GoldDomain,
    GoldLanguage,
    GoldSetAuthority,
    GoldSetManifest,
    GoldSetPolicy,
    ReviewDecision,
)
from tai.gold_set_candidate import build_platform_agro_candidate

NOW = datetime(2026, 7, 19, 14, 0, tzinfo=UTC)
HEAD = "7be7489fc22840da1f41ed70cdf4c2877f2847e2"


def _candidate() -> GoldSetManifest:
    return build_platform_agro_candidate(
        exact_head_sha=HEAD,
        created_at=NOW,
    )


def _review(question_id: str) -> ExpertReview:
    return ExpertReview(
        review_id=f"review.{question_id}",
        question_id=question_id,
        reviewer_id="human-reviewer-1",
        reviewer_role="HUMAN_DOMAIN_EXPERT",
        reviewed_at=NOW,
        decision=ReviewDecision.APPROVED,
        criteria_sha256=hashlib.sha256(
            f"{question_id}:criteria-v1".encode()
        ).hexdigest(),
        evidence_uri=f"repo://apps/tai/gold-reviews/{question_id}.json",
        comment_sha256=hashlib.sha256(b"approved").hexdigest(),
    )


def test_candidate_has_42_questions_and_complete_language_variants() -> None:
    manifest = _candidate()

    assert len(manifest.questions) == 42
    assert sum(
        question.domain is GoldDomain.PLATFORM for question in manifest.questions
    ) == 21
    assert sum(question.domain is GoldDomain.AGRO for question in manifest.questions) == 21
    groups = {question.variant_group for question in manifest.questions}
    assert len(groups) == 14
    for group in groups:
        languages = {
            question.language
            for question in manifest.questions
            if question.variant_group == group
        }
        assert languages == set(GoldLanguage)
    assert len(manifest.manifest_sha256) == 64
    assert manifest.manifest_sha256 == manifest.manifest_sha256


def test_candidate_is_not_accepted_without_human_review_or_current_authority() -> None:
    assessment = GoldSetAuthority().assess(
        manifest=_candidate(),
        assessed_at=NOW,
    )

    assert assessment.accepted is False
    assert assessment.platform_question_count == 21
    assert assessment.agro_question_count == 21
    assert assessment.variant_group_count == 14
    assert assessment.approved_question_count == 0
    assert assessment.incomplete_language_variant_groups == ()
    assert "CRITICAL_QUESTIONS_NOT_HUMAN_APPROVED" in assessment.rejection_reasons
    assert "QUESTIONS_NOT_HUMAN_APPROVED" in assessment.rejection_reasons
    assert "ANSWER_AUTHORITY_NOT_CURRENT_OR_USABLE" in assessment.rejection_reasons
    assert set(assessment.unusable_authority_ids) == {
        "official.eec.grain-regulation",
        "official.mintrans.rail-tariffs",
        "official.rosstat.agriculture",
    }


def test_complete_human_reviews_can_pass_only_when_authority_gate_is_relaxed() -> None:
    candidate = _candidate()
    reviewed = replace(
        candidate,
        reviews=tuple(_review(question.question_id) for question in candidate.questions),
    )
    assessment = GoldSetAuthority(
        GoldSetPolicy(require_current_answer_authorities=False)
    ).assess(manifest=reviewed, assessed_at=NOW)

    assert assessment.accepted is True
    assert assessment.approved_question_count == 42
    assert assessment.rejection_reasons == ()
    assert assessment.unapproved_critical_question_ids == ()


def test_ai_or_bot_cannot_sign_expert_review() -> None:
    with pytest.raises(ValueError, match="human reviewer"):
        ExpertReview(
            review_id="review.invalid",
            question_id="platform.role-authority.ru",
            reviewer_id="ai-reviewer",
            reviewer_role="DOMAIN_EXPERT",
            reviewed_at=NOW,
            decision=ReviewDecision.APPROVED,
            criteria_sha256="a" * 64,
            evidence_uri="repo://review/invalid.json",
            comment_sha256="b" * 64,
        )


def test_manifest_rejects_unknown_authority_and_duplicate_reviews() -> None:
    candidate = _candidate()
    invalid_question = replace(
        candidate.questions[0],
        required_authority_ids=("authority.unknown",),
    )
    with pytest.raises(ValueError, match="unknown authorities"):
        replace(
            candidate,
            questions=(invalid_question, *candidate.questions[1:]),
        )

    review = _review(candidate.questions[0].question_id)
    with pytest.raises(ValueError, match="review IDs must be unique"):
        replace(candidate, reviews=(review, review))
