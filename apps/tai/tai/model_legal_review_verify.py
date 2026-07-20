from __future__ import annotations

from pathlib import Path

from tai.model_bundle_v2_common import (
    _bounded_regular_file,
    _file_sha256,
    _parse_timestamp,
)
from tai.model_legal_review_authority import (
    LegalReviewModelPlan,
    ModelLegalReviewAuthority,
)
from tai.model_legal_review_authority_parse import (
    authority_sha256,
    intended_use_sha256,
)
from tai.model_legal_review_evidence import (
    HumanLegalDecision,
    HumanLegalRecordType,
    HumanLegalReviewStatus,
    ModelLegalReviewReport,
)
from tai.model_legal_review_evidence_parse import (
    load_human_legal_review_attestation,
    load_human_legal_review_record,
)
from tai.model_legal_review_source import validate_source_acceptance


_AUTOMATED_REVIEWER_IDS = {
    "chatgpt",
    "codex",
    "dependabot",
    "github-actions",
    "renovate",
}


def evaluate_model_review(
    *,
    authority: ModelLegalReviewAuthority,
    acceptance_path: Path,
    evidence_root: Path,
    model_id: str,
    revision: str,
) -> ModelLegalReviewReport:
    validate_source_acceptance(authority, acceptance_path)
    plan = _find_plan(authority, model_id, revision)
    authority_digest = authority_sha256(authority)
    use_digest = intended_use_sha256(authority)
    record_candidate = evidence_root / plan.review_record_path
    attestation_candidate = evidence_root / plan.attestation_path
    record_exists = record_candidate.exists() or record_candidate.is_symlink()
    attestation_exists = attestation_candidate.exists() or attestation_candidate.is_symlink()

    if not record_exists and not attestation_exists:
        return _report(
            plan=plan,
            status=HumanLegalReviewStatus.PENDING_HUMAN_DECISION,
            reasons=("HUMAN_REVIEW_PENDING",),
            authority_digest=authority_digest,
            use_digest=use_digest,
        )
    if record_exists != attestation_exists:
        return _report(
            plan=plan,
            status=HumanLegalReviewStatus.INVALID,
            reasons=("LEGAL_REVIEW_PAIR_INCOMPLETE",),
            authority_digest=authority_digest,
            use_digest=use_digest,
        )

    try:
        record_path = _bounded_regular_file(evidence_root, plan.review_record_path)
        attestation_path = _bounded_regular_file(evidence_root, plan.attestation_path)
        record = load_human_legal_review_record(record_path)
        attestation = load_human_legal_review_attestation(attestation_path)
    except ValueError as error:
        return _report(
            plan=plan,
            status=HumanLegalReviewStatus.INVALID,
            reasons=(f"LEGAL_REVIEW_EVIDENCE_INVALID:{error}",),
            authority_digest=authority_digest,
            use_digest=use_digest,
        )

    reasons: list[str] = []
    if not any(
        record.reviewer_id.startswith(prefix)
        for prefix in authority.reviewer_identity_prefixes
    ):
        reasons.append("LEGAL_REVIEWER_IDENTITY_PREFIX_NOT_AUTHORIZED")
    reviewer_identity = record.reviewer_id.split(":", maxsplit=1)[-1].casefold()
    if reviewer_identity in _AUTOMATED_REVIEWER_IDS or reviewer_identity.endswith("[bot]"):
        reasons.append("LEGAL_REVIEWER_IDENTITY_IS_AUTOMATED")
    if record.license_spdx != plan.license_spdx:
        reasons.append("LEGAL_REVIEW_LICENSE_SPDX_MISMATCH")
    if record.license_text_sha256 != plan.license_text_sha256:
        reasons.append("LEGAL_REVIEW_LICENSE_TEXT_SHA256_MISMATCH")
    if _parse_timestamp(record.reviewed_at, "legal reviewed_at") < _parse_timestamp(
        authority.review_not_before, "legal review not-before timestamp"
    ):
        reasons.append("LEGAL_REVIEW_PREDATES_ACCEPTED_SOURCE_EVIDENCE")
    if (
        record.record_type is HumanLegalRecordType.ATTRIBUTED_RECORD
        and f"issues/{authority.attributed_record_issue}"
        not in record.attestation_reference
    ):
        reasons.append("ATTRIBUTED_RECORD_ISSUE_REFERENCE_MISMATCH")

    expected = {
        "authority_sha256": authority_digest,
        "model_id": plan.model_id,
        "revision": plan.revision,
        "role": plan.role,
        "source_acceptance_exact_main_sha": authority.source_acceptance.accepted_main_sha,
        "source_acceptance_git_blob_sha": authority.source_acceptance.git_blob_sha,
        "model_card_sha256": plan.model_card_sha256,
        "license_text_sha256": plan.license_text_sha256,
        "legal_packet_sha256": plan.legal_packet_sha256,
        "source_manifest_sha256": plan.source_manifest_sha256,
        "source_files_sha256": plan.source_files_sha256,
        "intended_use_sha256": use_digest,
        "decision": record.decision,
        "reviewer_id": record.reviewer_id,
        "reviewed_at": record.reviewed_at,
        "attestation_reference": record.attestation_reference,
    }
    for key, value in expected.items():
        if getattr(attestation, key) != value:
            reasons.append(f"LEGAL_REVIEW_ATTESTATION_MISMATCH:{key}")
    if attestation.review_record.path != plan.review_record_path:
        reasons.append("LEGAL_REVIEW_RECORD_PATH_MISMATCH")
    record_sha256 = _file_sha256(record_path)
    if attestation.review_record.sha256 != record_sha256:
        reasons.append("LEGAL_REVIEW_RECORD_SHA256_MISMATCH")
    if attestation.review_record.size_bytes != record_path.stat().st_size:
        reasons.append("LEGAL_REVIEW_RECORD_SIZE_MISMATCH")

    unique_reasons = tuple(sorted(set(reasons)))
    if unique_reasons:
        return _report(
            plan=plan,
            status=HumanLegalReviewStatus.INVALID,
            reasons=unique_reasons,
            authority_digest=authority_digest,
            use_digest=use_digest,
            decision=record.decision,
            reviewer_id=record.reviewer_id,
            reviewed_at=record.reviewed_at,
            review_record_sha256=record_sha256,
            attestation_sha256=_file_sha256(attestation_path),
        )
    status = (
        HumanLegalReviewStatus.APPROVED_FOR_CONVERSION
        if record.decision is HumanLegalDecision.APPROVED
        else HumanLegalReviewStatus.REJECTED
    )
    return _report(
        plan=plan,
        status=status,
        reasons=(),
        authority_digest=authority_digest,
        use_digest=use_digest,
        decision=record.decision,
        reviewer_id=record.reviewer_id,
        reviewed_at=record.reviewed_at,
        review_record_sha256=record_sha256,
        attestation_sha256=_file_sha256(attestation_path),
    )


def _find_plan(
    authority: ModelLegalReviewAuthority,
    model_id: str,
    revision: str,
) -> LegalReviewModelPlan:
    matches = [
        plan
        for plan in authority.models
        if plan.model_id == model_id and plan.revision == revision
    ]
    if len(matches) != 1:
        raise ValueError("model is not uniquely authorized for legal review")
    return matches[0]


def _report(
    *,
    plan: LegalReviewModelPlan,
    status: HumanLegalReviewStatus,
    reasons: tuple[str, ...],
    authority_digest: str,
    use_digest: str,
    decision: HumanLegalDecision | None = None,
    reviewer_id: str | None = None,
    reviewed_at: str | None = None,
    review_record_sha256: str | None = None,
    attestation_sha256: str | None = None,
) -> ModelLegalReviewReport:
    valid_record = status in {
        HumanLegalReviewStatus.APPROVED_FOR_CONVERSION,
        HumanLegalReviewStatus.REJECTED,
    }
    return ModelLegalReviewReport(
        model_id=plan.model_id,
        revision=plan.revision,
        role=plan.role,
        status=status,
        valid_record=valid_record,
        conversion_allowed=status is HumanLegalReviewStatus.APPROVED_FOR_CONVERSION,
        decision=decision,
        reviewer_id=reviewer_id,
        reviewed_at=reviewed_at,
        review_record_sha256=review_record_sha256,
        attestation_sha256=attestation_sha256,
        reasons=reasons,
        authority_sha256=authority_digest,
        intended_use_sha256=use_digest,
    )
