from __future__ import annotations

from pathlib import Path

from tai.model_bundle_v2_common import _canonical_json, _sha256_text
from tai.model_legal_review_authority import ModelLegalReviewAuthority
from tai.model_legal_review_authority_parse import (
    authority_sha256,
    authority_to_canonical_json,
    intended_use_sha256,
    load_model_legal_review_authority,
)
from tai.model_legal_review_evidence import (
    HumanLegalDecision,
    HumanLegalRecordType,
    HumanLegalReviewAttestation,
    HumanLegalReviewRecord,
    HumanLegalReviewStatus,
    ModelLegalReviewReport,
)
from tai.model_legal_review_evidence_parse import (
    load_human_legal_review_attestation,
    load_human_legal_review_record,
)
from tai.model_legal_review_source import validate_source_acceptance
from tai.model_legal_review_verify import evaluate_model_review


def evaluate_all_model_reviews(
    *,
    authority: ModelLegalReviewAuthority,
    acceptance_path: Path,
    evidence_root: Path,
) -> dict[str, object]:
    reports = [
        evaluate_model_review(
            authority=authority,
            acceptance_path=acceptance_path,
            evidence_root=evidence_root,
            model_id=plan.model_id,
            revision=plan.revision,
        )
        for plan in authority.models
    ]
    statuses = {report.status for report in reports}
    if HumanLegalReviewStatus.INVALID in statuses:
        overall = "INVALID"
    elif HumanLegalReviewStatus.PENDING_HUMAN_DECISION in statuses:
        overall = "PENDING_HUMAN_DECISION"
    elif HumanLegalReviewStatus.REJECTED in statuses:
        overall = "COMPLETE_WITH_REJECTION"
    else:
        overall = "ALL_APPROVED_FOR_CONVERSION"
    payload: dict[str, object] = {
        "schema_version": "tai.model-legal-review-evaluation.v1",
        "status": overall,
        "authority_sha256": authority_sha256(authority),
        "intended_use_sha256": intended_use_sha256(authority),
        "models": [report_payload(report) for report in reports],
        "conversion_authorized_models": sorted(
            report.model_id for report in reports if report.conversion_allowed
        ),
        "maturity_boundary": {
            "conversion": "NOT_RUN",
            "quantization": "NOT_RUN",
            "benchmarks": "NOT_RUN",
            "model_admission": "NOT_DONE",
            "production_operational_status": "NOT_ATTESTED",
        },
    }
    payload["evaluation_sha256"] = _sha256_text(_canonical_json(payload))
    return payload


def report_payload(report: ModelLegalReviewReport) -> dict[str, object]:
    return {
        "model_id": report.model_id,
        "revision": report.revision,
        "role": report.role.value,
        "status": report.status.value,
        "valid_record": report.valid_record,
        "conversion_allowed": report.conversion_allowed,
        "decision": report.decision.value if report.decision is not None else None,
        "reviewer_id": report.reviewer_id,
        "reviewed_at": report.reviewed_at,
        "review_record_sha256": report.review_record_sha256,
        "attestation_sha256": report.attestation_sha256,
        "reasons": list(report.reasons),
        "authority_sha256": report.authority_sha256,
        "intended_use_sha256": report.intended_use_sha256,
    }


__all__ = [
    "HumanLegalDecision",
    "HumanLegalRecordType",
    "HumanLegalReviewAttestation",
    "HumanLegalReviewRecord",
    "HumanLegalReviewStatus",
    "ModelLegalReviewAuthority",
    "ModelLegalReviewReport",
    "authority_sha256",
    "authority_to_canonical_json",
    "evaluate_all_model_reviews",
    "evaluate_model_review",
    "intended_use_sha256",
    "load_human_legal_review_attestation",
    "load_human_legal_review_record",
    "load_model_legal_review_authority",
    "report_payload",
    "validate_source_acceptance",
]
