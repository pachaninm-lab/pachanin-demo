from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest

from tai.model_legal_review import (
    HumanLegalDecision,
    HumanLegalReviewStatus,
    authority_sha256,
    evaluate_all_model_reviews,
    evaluate_model_review,
    intended_use_sha256,
    load_model_legal_review_authority,
    validate_source_acceptance,
)

TAI_ROOT = Path(__file__).parents[1]
AUTHORITY_PATH = TAI_ROOT / "model-artifacts" / "model-legal-review-authority.v1.json"
ACCEPTANCE_PATH = (
    TAI_ROOT / "model-artifacts" / "model-source-acquisition-acceptance.v1.json"
)


def _authority() -> Any:
    return load_model_legal_review_authority(AUTHORITY_PATH)


def _write_pair(
    root: Path,
    *,
    role: str = "PRIMARY",
    decision: str = "APPROVED",
    reviewer_id: str = "legal:reviewer-001",
    reviewed_at: str = "2026-07-20T12:00:00Z",
    record_type: str = "SIGNED_RECORD",
    reference: str = "storage://legal/review/versionId=review-001",
    attestation_mutation: dict[str, object] | None = None,
) -> Any:
    authority = _authority()
    plan = next(item for item in authority.models if item.role.value == role)
    record = {
        "schema_version": "tai.model-legal-review-record.v1",
        "decision": decision,
        "reviewer_type": "HUMAN",
        "reviewer_id": reviewer_id,
        "reviewer_name": "Human Legal Reviewer",
        "reviewed_at": reviewed_at,
        "license_spdx": plan.license_spdx,
        "decision_basis": (
            "Human review of the exact model revision, exact Apache-2.0 text, "
            "accepted source evidence and intended local commercial use."
        ),
        "conditions": [],
        "record_type": record_type,
        "attestation_reference": reference,
        "license_text_sha256": plan.license_text_sha256,
    }
    record_path = root / plan.review_record_path
    record_path.parent.mkdir(parents=True, exist_ok=True)
    record_path.write_text(
        json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    record_bytes = record_path.read_bytes()
    attestation: dict[str, object] = {
        "schema_version": "tai.model-legal-review-attestation.v1",
        "authority_sha256": authority_sha256(authority),
        "model_id": plan.model_id,
        "revision": plan.revision,
        "role": plan.role.value,
        "source_acceptance_exact_main_sha": (
            authority.source_acceptance.accepted_main_sha
        ),
        "source_acceptance_git_blob_sha": authority.source_acceptance.git_blob_sha,
        "model_card_sha256": plan.model_card_sha256,
        "license_text_sha256": plan.license_text_sha256,
        "legal_packet_sha256": plan.legal_packet_sha256,
        "source_manifest_sha256": plan.source_manifest_sha256,
        "source_files_sha256": plan.source_files_sha256,
        "intended_use_sha256": intended_use_sha256(authority),
        "review_record": {
            "path": plan.review_record_path,
            "sha256": hashlib.sha256(record_bytes).hexdigest(),
            "size_bytes": len(record_bytes),
        },
        "decision": decision,
        "reviewer_id": reviewer_id,
        "reviewed_at": reviewed_at,
        "attestation_reference": reference,
    }
    if attestation_mutation:
        attestation.update(attestation_mutation)
    attestation_path = root / plan.attestation_path
    attestation_path.parent.mkdir(parents=True, exist_ok=True)
    attestation_path.write_text(
        json.dumps(attestation, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return plan


def _evaluate(root: Path, plan: Any) -> Any:
    return evaluate_model_review(
        authority=_authority(),
        acceptance_path=ACCEPTANCE_PATH,
        evidence_root=root,
        model_id=plan.model_id,
        revision=plan.revision,
    )


def test_authority_binds_accepted_sources_and_pending_baseline(tmp_path: Path) -> None:
    authority = _authority()
    validate_source_acceptance(authority, ACCEPTANCE_PATH)

    assert len(authority.models) == 2
    assert len(authority_sha256(authority)) == 64
    assert len(intended_use_sha256(authority)) == 64
    evaluation = evaluate_all_model_reviews(
        authority=authority,
        acceptance_path=ACCEPTANCE_PATH,
        evidence_root=tmp_path,
    )
    assert evaluation["status"] == "PENDING_HUMAN_DECISION"
    assert evaluation["conversion_authorized_models"] == []
    assert {
        item["status"] for item in evaluation["models"]
    } == {"PENDING_HUMAN_DECISION"}
    assert evaluation["maturity_boundary"]["production_operational_status"] == (
        "NOT_ATTESTED"
    )


def test_valid_human_approval_authorizes_only_conversion_stage(tmp_path: Path) -> None:
    plan = _write_pair(tmp_path)
    report = _evaluate(tmp_path, plan)

    assert report.status is HumanLegalReviewStatus.APPROVED_FOR_CONVERSION
    assert report.valid_record is True
    assert report.conversion_allowed is True
    assert report.decision is HumanLegalDecision.APPROVED
    assert report.reasons == ()


def test_valid_human_rejection_is_accepted_but_blocks_conversion(tmp_path: Path) -> None:
    plan = _write_pair(tmp_path, decision="REJECTED")
    report = _evaluate(tmp_path, plan)

    assert report.status is HumanLegalReviewStatus.REJECTED
    assert report.valid_record is True
    assert report.conversion_allowed is False
    assert report.decision is HumanLegalDecision.REJECTED
    assert report.reasons == ()


def test_attributed_record_must_bind_issue_2877(tmp_path: Path) -> None:
    plan = _write_pair(
        tmp_path,
        record_type="ATTRIBUTED_RECORD",
        reference="github://pachaninm-lab/pachanin-demo/issues/9999/comments/1#sha256="
        + "a" * 64,
    )
    report = _evaluate(tmp_path, plan)

    assert report.status is HumanLegalReviewStatus.INVALID
    assert "ATTRIBUTED_RECORD_ISSUE_REFERENCE_MISMATCH" in report.reasons


def test_automated_or_stale_reviewer_evidence_is_rejected(tmp_path: Path) -> None:
    plan = _write_pair(
        tmp_path,
        reviewer_id="github:github-actions",
        reviewed_at="2026-07-20T10:00:00Z",
    )
    report = _evaluate(tmp_path, plan)

    assert report.status is HumanLegalReviewStatus.INVALID
    assert "LEGAL_REVIEWER_IDENTITY_IS_AUTOMATED" in report.reasons
    assert "LEGAL_REVIEW_PREDATES_ACCEPTED_SOURCE_EVIDENCE" in report.reasons


def test_incomplete_pair_and_attestation_hash_drift_fail_closed(tmp_path: Path) -> None:
    authority = _authority()
    plan = authority.models[0]
    record_path = tmp_path / plan.review_record_path
    record_path.parent.mkdir(parents=True, exist_ok=True)
    record_path.write_text("{}\n", encoding="utf-8")
    incomplete = _evaluate(tmp_path, plan)
    assert incomplete.status is HumanLegalReviewStatus.INVALID
    assert incomplete.reasons == ("LEGAL_REVIEW_PAIR_INCOMPLETE",)

    tmp_path = tmp_path / "drift"
    plan = _write_pair(
        tmp_path,
        attestation_mutation={"source_files_sha256": "f" * 64},
    )
    drift = _evaluate(tmp_path, plan)
    assert drift.status is HumanLegalReviewStatus.INVALID
    assert "LEGAL_REVIEW_ATTESTATION_MISMATCH:source_files_sha256" in drift.reasons


def test_source_acceptance_tampering_blocks_legal_review(tmp_path: Path) -> None:
    acceptance = json.loads(ACCEPTANCE_PATH.read_text(encoding="utf-8"))
    acceptance["maturity_boundary"]["conversion"] = "DONE"
    tampered = tmp_path / "acceptance.json"
    tampered.write_text(json.dumps(acceptance), encoding="utf-8")

    with pytest.raises(ValueError, match="maturity mismatch: conversion"):
        validate_source_acceptance(_authority(), tampered)
