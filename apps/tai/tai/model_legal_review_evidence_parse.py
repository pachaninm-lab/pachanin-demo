from __future__ import annotations

from pathlib import Path
from typing import Any

from tai.model_bundle_v2_common import (
    _array,
    _expect_keys,
    _integer,
    _load_json_strict,
    _object,
    _string,
)
from tai.model_bundle_v2_types import CandidateRole, DeclaredFile
from tai.model_legal_review_evidence import (
    HumanLegalDecision,
    HumanLegalRecordType,
    HumanLegalReviewAttestation,
    HumanLegalReviewRecord,
)


def load_human_legal_review_record(path: Path) -> HumanLegalReviewRecord:
    payload = _load_json_strict(path)
    _expect_keys(
        payload,
        {
            "schema_version",
            "decision",
            "reviewer_type",
            "reviewer_id",
            "reviewer_name",
            "reviewed_at",
            "license_spdx",
            "decision_basis",
            "conditions",
            "record_type",
            "attestation_reference",
            "license_text_sha256",
        },
        set(),
        "human legal review record",
    )
    if _string(payload, "schema_version") != "tai.model-legal-review-record.v1":
        raise ValueError("unsupported human legal review record schema")
    return HumanLegalReviewRecord(
        decision=HumanLegalDecision(_string(payload, "decision")),
        reviewer_type=_string(payload, "reviewer_type"),
        reviewer_id=_string(payload, "reviewer_id"),
        reviewer_name=_string(payload, "reviewer_name"),
        reviewed_at=_string(payload, "reviewed_at"),
        license_spdx=_string(payload, "license_spdx"),
        decision_basis=_string(payload, "decision_basis"),
        conditions=tuple(_string_array_allow_empty(payload, "conditions")),
        record_type=HumanLegalRecordType(_string(payload, "record_type")),
        attestation_reference=_string(payload, "attestation_reference"),
        license_text_sha256=_string(payload, "license_text_sha256"),
    )


def load_human_legal_review_attestation(path: Path) -> HumanLegalReviewAttestation:
    payload = _load_json_strict(path)
    _expect_keys(
        payload,
        {
            "schema_version",
            "authority_sha256",
            "model_id",
            "revision",
            "role",
            "source_acceptance_exact_main_sha",
            "source_acceptance_git_blob_sha",
            "model_card_sha256",
            "license_text_sha256",
            "legal_packet_sha256",
            "source_manifest_sha256",
            "source_files_sha256",
            "intended_use_sha256",
            "review_record",
            "decision",
            "reviewer_id",
            "reviewed_at",
            "attestation_reference",
        },
        set(),
        "human legal review attestation",
    )
    if _string(payload, "schema_version") != "tai.model-legal-review-attestation.v1":
        raise ValueError("unsupported human legal review attestation schema")
    return HumanLegalReviewAttestation(
        authority_sha256=_string(payload, "authority_sha256"),
        model_id=_string(payload, "model_id"),
        revision=_string(payload, "revision"),
        role=CandidateRole(_string(payload, "role")),
        source_acceptance_exact_main_sha=_string(
            payload, "source_acceptance_exact_main_sha"
        ),
        source_acceptance_git_blob_sha=_string(
            payload, "source_acceptance_git_blob_sha"
        ),
        model_card_sha256=_string(payload, "model_card_sha256"),
        license_text_sha256=_string(payload, "license_text_sha256"),
        legal_packet_sha256=_string(payload, "legal_packet_sha256"),
        source_manifest_sha256=_string(payload, "source_manifest_sha256"),
        source_files_sha256=_string(payload, "source_files_sha256"),
        intended_use_sha256=_string(payload, "intended_use_sha256"),
        review_record=_parse_declared_file(payload.get("review_record")),
        decision=HumanLegalDecision(_string(payload, "decision")),
        reviewer_id=_string(payload, "reviewer_id"),
        reviewed_at=_string(payload, "reviewed_at"),
        attestation_reference=_string(payload, "attestation_reference"),
    )


def _parse_declared_file(value: object) -> DeclaredFile:
    payload = _object(value, "declared review record file")
    _expect_keys(
        payload,
        {"path", "sha256", "size_bytes"},
        set(),
        "declared review record file",
    )
    return DeclaredFile(
        path=_string(payload, "path"),
        sha256=_string(payload, "sha256"),
        size_bytes=_integer(payload, "size_bytes"),
    )


def _string_array_allow_empty(payload: dict[str, Any], key: str) -> list[str]:
    values = _array(payload, key)
    if any(not isinstance(item, str) or not item.strip() for item in values):
        raise ValueError(f"{key} must contain only non-empty strings")
    return [str(item) for item in values]
