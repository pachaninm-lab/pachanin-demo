from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

from tai.git_oid import validate_git_oid

_IDENTIFIER = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_LANGUAGE_VALUES = frozenset({"ru", "en", "zh"})
_ALLOWED_STATUSES = frozenset({"ANSWERED", "ABSTAINED", "REJECTED"})


class GoldDomain(StrEnum):
    PLATFORM = "PLATFORM"
    AGRO = "AGRO"


class GoldLanguage(StrEnum):
    RU = "ru"
    EN = "en"
    ZH = "zh"


class ExpectedDisposition(StrEnum):
    ANSWER = "ANSWER"
    ABSTAIN = "ABSTAIN"


class ReviewDecision(StrEnum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CHANGES_REQUIRED = "CHANGES_REQUIRED"


class AuthorityKind(StrEnum):
    PLATFORM_RECORD = "PLATFORM_RECORD"
    OFFICIAL_SOURCE = "OFFICIAL_SOURCE"
    FORMAL_GAP = "FORMAL_GAP"


@dataclass(frozen=True, slots=True)
class GoldAuthorityReference:
    authority_id: str
    kind: AuthorityKind
    version: str
    source_uri: str
    evidence_sha256: str
    effective_at: datetime
    maximum_age_seconds: int | None
    status: str

    def __post_init__(self) -> None:
        _portable(self.authority_id, "authority_id")
        _portable(self.version, "authority version")
        _non_blank(self.source_uri, "authority source_uri")
        _digest(self.evidence_sha256, "authority evidence_sha256")
        _aware(self.effective_at, "authority effective_at")
        if self.maximum_age_seconds is not None and self.maximum_age_seconds < 1:
            raise ValueError("maximum_age_seconds must be positive")
        _portable(self.status, "authority status")
        if self.kind is AuthorityKind.FORMAL_GAP and self.status != "GAP":
            raise ValueError("formal gap authority must have GAP status")


@dataclass(frozen=True, slots=True)
class GoldQuestion:
    question_id: str
    variant_group: str
    domain: GoldDomain
    topic: str
    language: GoldLanguage
    prompt: str
    prompt_sha256: str
    expected_disposition: ExpectedDisposition
    allowed_statuses: frozenset[str]
    required_authority_ids: tuple[str, ...]
    minimum_citations: int
    required_answer_concepts: tuple[str, ...]
    forbidden_answer_fragments: tuple[str, ...]
    critical: bool
    tags: frozenset[str] = frozenset()

    def __post_init__(self) -> None:
        _portable(self.question_id, "question_id")
        _portable(self.variant_group, "variant_group")
        _portable(self.topic, "question topic")
        _non_blank(self.prompt, "question prompt")
        expected_prompt_digest = hashlib.sha256(self.prompt.encode("utf-8")).hexdigest()
        if self.prompt_sha256 != expected_prompt_digest:
            raise ValueError("question prompt_sha256 does not match prompt")
        if not self.allowed_statuses or not self.allowed_statuses <= _ALLOWED_STATUSES:
            raise ValueError("question allowed_statuses are invalid")
        if self.minimum_citations < 0 or self.minimum_citations > 20:
            raise ValueError("minimum_citations must be between 0 and 20")
        if len(self.required_authority_ids) != len(set(self.required_authority_ids)):
            raise ValueError("required authority IDs must be unique")
        for authority_id in self.required_authority_ids:
            _portable(authority_id, "required authority_id")
        for concept in self.required_answer_concepts:
            _non_blank(concept, "required answer concept")
        for fragment in self.forbidden_answer_fragments:
            _non_blank(fragment, "forbidden answer fragment")
        for tag in self.tags:
            _portable(tag, "question tag")
        if self.expected_disposition is ExpectedDisposition.ANSWER:
            if "ANSWERED" not in self.allowed_statuses:
                raise ValueError("answer question must allow ANSWERED")
            if not self.required_authority_ids:
                raise ValueError("answer question must require authority")
            if self.minimum_citations < 1:
                raise ValueError("answer question must require a citation")
        if self.expected_disposition is ExpectedDisposition.ABSTAIN:
            if "ABSTAINED" not in self.allowed_statuses:
                raise ValueError("abstention question must allow ABSTAINED")
            if self.minimum_citations != 0:
                raise ValueError("abstention question cannot require citations")


@dataclass(frozen=True, slots=True)
class ExpertReview:
    review_id: str
    question_id: str
    reviewer_id: str
    reviewer_role: str
    reviewed_at: datetime
    decision: ReviewDecision
    criteria_sha256: str
    evidence_uri: str
    comment_sha256: str

    def __post_init__(self) -> None:
        _portable(self.review_id, "review_id")
        _portable(self.question_id, "review question_id")
        _portable(self.reviewer_id, "reviewer_id")
        _portable(self.reviewer_role, "reviewer_role")
        _aware(self.reviewed_at, "reviewed_at")
        _digest(self.criteria_sha256, "criteria_sha256")
        _non_blank(self.evidence_uri, "review evidence_uri")
        _digest(self.comment_sha256, "comment_sha256")
        normalized_reviewer = f"{self.reviewer_id} {self.reviewer_role}".casefold()
        if any(marker in normalized_reviewer for marker in ("ai", "bot", "assistant")):
            raise ValueError("expert review must be attributable to a human reviewer")
        if self.decision is ReviewDecision.APPROVED and not self.evidence_uri.startswith(
            ("repo://", "https://")
        ):
            raise ValueError("approved review requires durable evidence URI")


@dataclass(frozen=True, slots=True)
class GoldSetManifest:
    manifest_id: str
    version: str
    exact_head_sha: str
    created_at: datetime
    authorities: tuple[GoldAuthorityReference, ...]
    questions: tuple[GoldQuestion, ...]
    reviews: tuple[ExpertReview, ...]
    schema_version: str = "tai.gold-set-manifest.v1"

    def __post_init__(self) -> None:
        _portable(self.manifest_id, "manifest_id")
        _portable(self.version, "manifest version")
        validate_git_oid(self.exact_head_sha, "exact_head_sha")
        _aware(self.created_at, "created_at")
        if self.schema_version != "tai.gold-set-manifest.v1":
            raise ValueError("unsupported gold-set schema version")
        if not self.authorities or not self.questions:
            raise ValueError("gold-set manifest requires authorities and questions")
        authority_ids = [item.authority_id for item in self.authorities]
        question_ids = [item.question_id for item in self.questions]
        review_ids = [item.review_id for item in self.reviews]
        _unique(authority_ids, "authority IDs")
        _unique(question_ids, "question IDs")
        _unique(review_ids, "review IDs")
        authority_id_set = set(authority_ids)
        question_id_set = set(question_ids)
        for question in self.questions:
            unknown = set(question.required_authority_ids) - authority_id_set
            if unknown:
                raise ValueError(
                    f"question {question.question_id} references unknown authorities"
                )
        for review in self.reviews:
            if review.question_id not in question_id_set:
                raise ValueError("review references unknown question")
        review_pairs = [(item.question_id, item.reviewer_id) for item in self.reviews]
        _unique(review_pairs, "question/reviewer review pairs")

    @property
    def manifest_sha256(self) -> str:
        return _sha256_json(manifest_payload(self, include_manifest_sha=False))


@dataclass(frozen=True, slots=True)
class GoldSetPolicy:
    minimum_platform_questions: int = 20
    minimum_agro_questions: int = 20
    required_languages: frozenset[GoldLanguage] = field(
        default_factory=lambda: frozenset(GoldLanguage)
    )
    minimum_approved_reviews_per_question: int = 1
    require_all_critical_approved: bool = True
    require_current_answer_authorities: bool = True

    def __post_init__(self) -> None:
        if self.minimum_platform_questions < 1 or self.minimum_agro_questions < 1:
            raise ValueError("minimum question counts must be positive")
        if not self.required_languages:
            raise ValueError("required_languages must not be empty")
        if self.minimum_approved_reviews_per_question < 1:
            raise ValueError("minimum approved review count must be positive")


@dataclass(frozen=True, slots=True)
class GoldSetAssessment:
    manifest_sha256: str
    assessed_at: datetime
    platform_question_count: int
    agro_question_count: int
    variant_group_count: int
    approved_question_count: int
    unapproved_critical_question_ids: tuple[str, ...]
    incomplete_language_variant_groups: tuple[str, ...]
    unusable_authority_ids: tuple[str, ...]
    accepted: bool
    rejection_reasons: tuple[str, ...]
    assessment_sha256: str


class GoldSetAuthority:
    def __init__(self, policy: GoldSetPolicy | None = None) -> None:
        self._policy = policy or GoldSetPolicy()

    def assess(
        self,
        *,
        manifest: GoldSetManifest,
        assessed_at: datetime,
    ) -> GoldSetAssessment:
        _aware(assessed_at, "assessed_at")
        reviews_by_question: dict[str, list[ExpertReview]] = {}
        for review in manifest.reviews:
            reviews_by_question.setdefault(review.question_id, []).append(review)
        approved_question_ids = {
            question.question_id
            for question in manifest.questions
            if sum(
                review.decision is ReviewDecision.APPROVED
                for review in reviews_by_question.get(question.question_id, [])
            )
            >= self._policy.minimum_approved_reviews_per_question
            and not any(
                review.decision in {ReviewDecision.REJECTED, ReviewDecision.CHANGES_REQUIRED}
                for review in reviews_by_question.get(question.question_id, [])
            )
        }
        unapproved_critical = tuple(
            sorted(
                question.question_id
                for question in manifest.questions
                if question.critical and question.question_id not in approved_question_ids
            )
        )
        languages_by_group: dict[str, set[GoldLanguage]] = {}
        for question in manifest.questions:
            languages_by_group.setdefault(question.variant_group, set()).add(
                question.language
            )
        incomplete_groups = tuple(
            sorted(
                group
                for group, languages in languages_by_group.items()
                if not self._policy.required_languages <= languages
            )
        )
        authorities = {item.authority_id: item for item in manifest.authorities}
        answer_authority_ids = {
            authority_id
            for question in manifest.questions
            if question.expected_disposition is ExpectedDisposition.ANSWER
            for authority_id in question.required_authority_ids
        }
        unusable_authorities = tuple(
            sorted(
                authority_id
                for authority_id in answer_authority_ids
                if not _authority_usable(
                    authorities[authority_id],
                    assessed_at=assessed_at,
                    require_current=self._policy.require_current_answer_authorities,
                )
            )
        )
        platform_count = sum(
            question.domain is GoldDomain.PLATFORM for question in manifest.questions
        )
        agro_count = sum(
            question.domain is GoldDomain.AGRO for question in manifest.questions
        )
        reasons: list[str] = []
        if platform_count < self._policy.minimum_platform_questions:
            reasons.append("INSUFFICIENT_PLATFORM_QUESTIONS")
        if agro_count < self._policy.minimum_agro_questions:
            reasons.append("INSUFFICIENT_AGRO_QUESTIONS")
        if incomplete_groups:
            reasons.append("INCOMPLETE_LANGUAGE_VARIANTS")
        if self._policy.require_all_critical_approved and unapproved_critical:
            reasons.append("CRITICAL_QUESTIONS_NOT_HUMAN_APPROVED")
        if len(approved_question_ids) != len(manifest.questions):
            reasons.append("QUESTIONS_NOT_HUMAN_APPROVED")
        if unusable_authorities:
            reasons.append("ANSWER_AUTHORITY_NOT_CURRENT_OR_USABLE")
        rejection_reasons = tuple(dict.fromkeys(reasons))
        base_payload = {
            "agro_question_count": agro_count,
            "approved_question_count": len(approved_question_ids),
            "assessed_at": assessed_at.isoformat(),
            "incomplete_language_variant_groups": list(incomplete_groups),
            "manifest_sha256": manifest.manifest_sha256,
            "platform_question_count": platform_count,
            "rejection_reasons": list(rejection_reasons),
            "unapproved_critical_question_ids": list(unapproved_critical),
            "unusable_authority_ids": list(unusable_authorities),
            "variant_group_count": len(languages_by_group),
        }
        return GoldSetAssessment(
            manifest_sha256=manifest.manifest_sha256,
            assessed_at=assessed_at,
            platform_question_count=platform_count,
            agro_question_count=agro_count,
            variant_group_count=len(languages_by_group),
            approved_question_count=len(approved_question_ids),
            unapproved_critical_question_ids=unapproved_critical,
            incomplete_language_variant_groups=incomplete_groups,
            unusable_authority_ids=unusable_authorities,
            accepted=not rejection_reasons,
            rejection_reasons=rejection_reasons,
            assessment_sha256=_sha256_json(base_payload),
        )


def load_gold_set_manifest(path: Path) -> GoldSetManifest:
    payload = _mapping(json.loads(path.read_text(encoding="utf-8")), "manifest")
    authorities = tuple(
        _authority_from_payload(_mapping(item, "authority"))
        for item in _sequence(payload.get("authorities"), "authorities")
    )
    questions = tuple(
        _question_from_payload(_mapping(item, "question"))
        for item in _sequence(payload.get("questions"), "questions")
    )
    reviews = tuple(
        _review_from_payload(_mapping(item, "review"))
        for item in _sequence(payload.get("reviews", []), "reviews")
    )
    return GoldSetManifest(
        manifest_id=_string(payload.get("manifest_id"), "manifest_id"),
        version=_string(payload.get("version"), "version"),
        exact_head_sha=_string(payload.get("exact_head_sha"), "exact_head_sha"),
        created_at=_datetime(payload.get("created_at"), "created_at"),
        authorities=authorities,
        questions=questions,
        reviews=reviews,
        schema_version=_string(payload.get("schema_version"), "schema_version"),
    )


def manifest_payload(
    manifest: GoldSetManifest,
    *,
    include_manifest_sha: bool = True,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "authorities": [
            {
                "authority_id": item.authority_id,
                "effective_at": item.effective_at.isoformat(),
                "evidence_sha256": item.evidence_sha256,
                "kind": item.kind.value,
                "maximum_age_seconds": item.maximum_age_seconds,
                "source_uri": item.source_uri,
                "status": item.status,
                "version": item.version,
            }
            for item in sorted(manifest.authorities, key=lambda item: item.authority_id)
        ],
        "created_at": manifest.created_at.isoformat(),
        "exact_head_sha": manifest.exact_head_sha,
        "manifest_id": manifest.manifest_id,
        "questions": [
            {
                "allowed_statuses": sorted(item.allowed_statuses),
                "critical": item.critical,
                "domain": item.domain.value,
                "expected_disposition": item.expected_disposition.value,
                "forbidden_answer_fragments": list(item.forbidden_answer_fragments),
                "language": item.language.value,
                "minimum_citations": item.minimum_citations,
                "prompt": item.prompt,
                "prompt_sha256": item.prompt_sha256,
                "question_id": item.question_id,
                "required_answer_concepts": list(item.required_answer_concepts),
                "required_authority_ids": list(item.required_authority_ids),
                "tags": sorted(item.tags),
                "topic": item.topic,
                "variant_group": item.variant_group,
            }
            for item in sorted(manifest.questions, key=lambda item: item.question_id)
        ],
        "reviews": [
            {
                "comment_sha256": item.comment_sha256,
                "criteria_sha256": item.criteria_sha256,
                "decision": item.decision.value,
                "evidence_uri": item.evidence_uri,
                "question_id": item.question_id,
                "review_id": item.review_id,
                "reviewed_at": item.reviewed_at.isoformat(),
                "reviewer_id": item.reviewer_id,
                "reviewer_role": item.reviewer_role,
            }
            for item in sorted(manifest.reviews, key=lambda item: item.review_id)
        ],
        "schema_version": manifest.schema_version,
        "version": manifest.version,
    }
    if include_manifest_sha:
        payload["manifest_sha256"] = manifest.manifest_sha256
    return payload


def assessment_payload(assessment: GoldSetAssessment) -> dict[str, object]:
    return {
        "accepted": assessment.accepted,
        "agro_question_count": assessment.agro_question_count,
        "approved_question_count": assessment.approved_question_count,
        "assessed_at": assessment.assessed_at.isoformat(),
        "assessment_sha256": assessment.assessment_sha256,
        "incomplete_language_variant_groups": list(
            assessment.incomplete_language_variant_groups
        ),
        "manifest_sha256": assessment.manifest_sha256,
        "platform_question_count": assessment.platform_question_count,
        "rejection_reasons": list(assessment.rejection_reasons),
        "schema_version": "tai.gold-set-assessment.v1",
        "unapproved_critical_question_ids": list(
            assessment.unapproved_critical_question_ids
        ),
        "unusable_authority_ids": list(assessment.unusable_authority_ids),
        "variant_group_count": assessment.variant_group_count,
    }


def _authority_usable(
    authority: GoldAuthorityReference,
    *,
    assessed_at: datetime,
    require_current: bool,
) -> bool:
    if authority.kind is AuthorityKind.FORMAL_GAP:
        return False
    if authority.status not in {"COVERED", "CURRENT", "VERIFIED"}:
        return False
    if not require_current or authority.maximum_age_seconds is None:
        return True
    age_seconds = (assessed_at - authority.effective_at).total_seconds()
    return 0 <= age_seconds <= authority.maximum_age_seconds


def _authority_from_payload(payload: Mapping[str, Any]) -> GoldAuthorityReference:
    maximum_age = payload.get("maximum_age_seconds")
    if maximum_age is not None and not isinstance(maximum_age, int):
        raise ValueError("maximum_age_seconds must be an integer or null")
    return GoldAuthorityReference(
        authority_id=_string(payload.get("authority_id"), "authority_id"),
        kind=AuthorityKind(_string(payload.get("kind"), "authority kind")),
        version=_string(payload.get("version"), "authority version"),
        source_uri=_string(payload.get("source_uri"), "authority source_uri"),
        evidence_sha256=_string(
            payload.get("evidence_sha256"), "authority evidence_sha256"
        ),
        effective_at=_datetime(payload.get("effective_at"), "authority effective_at"),
        maximum_age_seconds=maximum_age,
        status=_string(payload.get("status"), "authority status"),
    )


def _question_from_payload(payload: Mapping[str, Any]) -> GoldQuestion:
    prompt = _string(payload.get("prompt"), "question prompt")
    prompt_sha = payload.get("prompt_sha256")
    if prompt_sha is None:
        prompt_sha = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    return GoldQuestion(
        question_id=_string(payload.get("question_id"), "question_id"),
        variant_group=_string(payload.get("variant_group"), "variant_group"),
        domain=GoldDomain(_string(payload.get("domain"), "question domain")),
        topic=_string(payload.get("topic"), "question topic"),
        language=GoldLanguage(_string(payload.get("language"), "question language")),
        prompt=prompt,
        prompt_sha256=_string(prompt_sha, "prompt_sha256"),
        expected_disposition=ExpectedDisposition(
            _string(payload.get("expected_disposition"), "expected disposition")
        ),
        allowed_statuses=frozenset(
            _string(item, "allowed status")
            for item in _sequence(payload.get("allowed_statuses"), "allowed_statuses")
        ),
        required_authority_ids=tuple(
            _string(item, "required authority_id")
            for item in _sequence(
                payload.get("required_authority_ids", []),
                "required_authority_ids",
            )
        ),
        minimum_citations=_integer(payload.get("minimum_citations"), "minimum_citations"),
        required_answer_concepts=tuple(
            _string(item, "required answer concept")
            for item in _sequence(
                payload.get("required_answer_concepts", []),
                "required_answer_concepts",
            )
        ),
        forbidden_answer_fragments=tuple(
            _string(item, "forbidden answer fragment")
            for item in _sequence(
                payload.get("forbidden_answer_fragments", []),
                "forbidden_answer_fragments",
            )
        ),
        critical=_boolean(payload.get("critical"), "critical"),
        tags=frozenset(
            _string(item, "question tag")
            for item in _sequence(payload.get("tags", []), "tags")
        ),
    )


def _review_from_payload(payload: Mapping[str, Any]) -> ExpertReview:
    return ExpertReview(
        review_id=_string(payload.get("review_id"), "review_id"),
        question_id=_string(payload.get("question_id"), "review question_id"),
        reviewer_id=_string(payload.get("reviewer_id"), "reviewer_id"),
        reviewer_role=_string(payload.get("reviewer_role"), "reviewer_role"),
        reviewed_at=_datetime(payload.get("reviewed_at"), "reviewed_at"),
        decision=ReviewDecision(_string(payload.get("decision"), "review decision")),
        criteria_sha256=_string(payload.get("criteria_sha256"), "criteria_sha256"),
        evidence_uri=_string(payload.get("evidence_uri"), "review evidence_uri"),
        comment_sha256=_string(payload.get("comment_sha256"), "comment_sha256"),
    )


def _sha256_json(payload: Mapping[str, object]) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _mapping(value: object, name: str) -> Mapping[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    return value


def _sequence(value: object, name: str) -> Sequence[object]:
    if not isinstance(value, list):
        raise ValueError(f"{name} must be an array")
    return value


def _string(value: object, name: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string")
    return value


def _integer(value: object, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{name} must be an integer")
    return value


def _boolean(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise ValueError(f"{name} must be a boolean")
    return value


def _datetime(value: object, name: str) -> datetime:
    raw = _string(value, name)
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{name} must be an ISO-8601 datetime") from error
    _aware(parsed, name)
    return parsed


def _portable(value: str, name: str) -> None:
    if _IDENTIFIER.fullmatch(value) is None:
        raise ValueError(f"{name} must be a portable identifier")


def _non_blank(value: str, name: str) -> None:
    if not value.strip():
        raise ValueError(f"{name} must not be blank")


def _digest(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be lowercase SHA-256")


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _unique(values: Sequence[object], name: str) -> None:
    if len(values) != len(set(values)):
        raise ValueError(f"{name} must be unique")


assert {item.value for item in GoldLanguage} == _LANGUAGE_VALUES
