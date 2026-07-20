from __future__ import annotations

from pathlib import Path
from typing import Any

from tai.model_bundle_v2_common import (
    _array,
    _canonical_json,
    _expect_keys,
    _integer,
    _load_json_strict,
    _object,
    _sha256_text,
    _string,
    _strings,
)
from tai.model_bundle_v2_types import CandidateRole
from tai.model_legal_review_authority import (
    IntendedUse,
    LegalReviewModelPlan,
    LegalReviewToolchain,
    ModelLegalReviewAuthority,
    SourceAcceptanceReference,
)


def load_model_legal_review_authority(path: Path) -> ModelLegalReviewAuthority:
    payload = _load_json_strict(path)
    _expect_keys(
        payload,
        {
            "schema_version",
            "program_issue",
            "parent_issue",
            "issue",
            "source_acceptance",
            "review_not_before",
            "intended_use",
            "reviewer_type",
            "reviewer_identity_prefixes",
            "attributed_record_issue",
            "accepted_decisions",
            "accepted_record_types",
            "models",
            "maturity_boundary",
        },
        set(),
        "model legal review authority",
    )
    if _string(payload, "schema_version") != "tai.model-legal-review-authority.v1":
        raise ValueError("unsupported model legal review authority schema")
    return ModelLegalReviewAuthority(
        program_issue=_integer(payload, "program_issue"),
        parent_issue=_integer(payload, "parent_issue"),
        issue=_integer(payload, "issue"),
        source_acceptance=_parse_source_acceptance(payload.get("source_acceptance")),
        review_not_before=_string(payload, "review_not_before"),
        intended_use=_parse_intended_use(payload.get("intended_use")),
        reviewer_type=_string(payload, "reviewer_type"),
        reviewer_identity_prefixes=tuple(_strings(payload, "reviewer_identity_prefixes")),
        attributed_record_issue=_integer(payload, "attributed_record_issue"),
        accepted_decisions=tuple(_strings(payload, "accepted_decisions")),
        accepted_record_types=tuple(_strings(payload, "accepted_record_types")),
        models=tuple(_parse_model_plan(item) for item in _array(payload, "models")),
        maturity_boundary=_string_map(payload.get("maturity_boundary"), "maturity boundary"),
    )


def authority_to_canonical_json(authority: ModelLegalReviewAuthority) -> str:
    return _canonical_json(authority_payload(authority))


def authority_sha256(authority: ModelLegalReviewAuthority) -> str:
    return _sha256_text(authority_to_canonical_json(authority))


def intended_use_sha256(authority: ModelLegalReviewAuthority) -> str:
    return _sha256_text(_canonical_json(intended_use_payload(authority.intended_use)))


def authority_payload(authority: ModelLegalReviewAuthority) -> dict[str, object]:
    return {
        "schema_version": "tai.model-legal-review-authority.v1",
        "program_issue": authority.program_issue,
        "parent_issue": authority.parent_issue,
        "issue": authority.issue,
        "source_acceptance": {
            "path": authority.source_acceptance.path,
            "git_blob_sha": authority.source_acceptance.git_blob_sha,
            "accepted_main_sha": authority.source_acceptance.accepted_main_sha,
            "source_exact_main_sha": authority.source_acceptance.source_exact_main_sha,
            "model_bundle_authority_sha256": (
                authority.source_acceptance.model_bundle_authority_sha256
            ),
            "status": authority.source_acceptance.status,
        },
        "review_not_before": authority.review_not_before,
        "intended_use": intended_use_payload(authority.intended_use),
        "reviewer_type": authority.reviewer_type,
        "reviewer_identity_prefixes": list(authority.reviewer_identity_prefixes),
        "attributed_record_issue": authority.attributed_record_issue,
        "accepted_decisions": list(authority.accepted_decisions),
        "accepted_record_types": list(authority.accepted_record_types),
        "models": [
            {
                "role": model.role.value,
                "model_id": model.model_id,
                "revision": model.revision,
                "license_spdx": model.license_spdx,
                "model_card_sha256": model.model_card_sha256,
                "license_text_sha256": model.license_text_sha256,
                "legal_packet_sha256": model.legal_packet_sha256,
                "source_manifest_sha256": model.source_manifest_sha256,
                "source_files_sha256": model.source_files_sha256,
                "review_record_path": model.review_record_path,
                "attestation_path": model.attestation_path,
            }
            for model in authority.models
        ],
        "maturity_boundary": authority.maturity_boundary,
    }


def intended_use_payload(intended_use: IntendedUse) -> dict[str, object]:
    return {
        "product": intended_use.product,
        "platform": intended_use.platform,
        "use_class": intended_use.use_class,
        "operation_scope": intended_use.operation_scope,
        "conversion_toolchain": {
            "name": intended_use.conversion_toolchain.name,
            "release": intended_use.conversion_toolchain.release,
            "commit": intended_use.conversion_toolchain.commit,
            "authority_sha256": intended_use.conversion_toolchain.authority_sha256,
        },
        "source_weight_redistribution": intended_use.source_weight_redistribution,
        "community_prebuilt_artifacts": intended_use.community_prebuilt_artifacts,
        "benchmark_or_admission_claim": intended_use.benchmark_or_admission_claim,
        "production_readiness_claim": intended_use.production_readiness_claim,
    }


def _parse_source_acceptance(value: object) -> SourceAcceptanceReference:
    payload = _object(value, "source acceptance reference")
    _expect_keys(
        payload,
        {
            "path",
            "git_blob_sha",
            "accepted_main_sha",
            "source_exact_main_sha",
            "model_bundle_authority_sha256",
            "status",
        },
        set(),
        "source acceptance reference",
    )
    return SourceAcceptanceReference(
        path=_string(payload, "path"),
        git_blob_sha=_string(payload, "git_blob_sha"),
        accepted_main_sha=_string(payload, "accepted_main_sha"),
        source_exact_main_sha=_string(payload, "source_exact_main_sha"),
        model_bundle_authority_sha256=_string(
            payload, "model_bundle_authority_sha256"
        ),
        status=_string(payload, "status"),
    )


def _parse_intended_use(value: object) -> IntendedUse:
    payload = _object(value, "intended use")
    _expect_keys(
        payload,
        {
            "product",
            "platform",
            "use_class",
            "operation_scope",
            "conversion_toolchain",
            "source_weight_redistribution",
            "community_prebuilt_artifacts",
            "benchmark_or_admission_claim",
            "production_readiness_claim",
        },
        set(),
        "intended use",
    )
    toolchain = _object(payload.get("conversion_toolchain"), "conversion toolchain")
    _expect_keys(
        toolchain,
        {"name", "release", "commit", "authority_sha256"},
        set(),
        "conversion toolchain",
    )
    return IntendedUse(
        product=_string(payload, "product"),
        platform=_string(payload, "platform"),
        use_class=_string(payload, "use_class"),
        operation_scope=_string(payload, "operation_scope"),
        conversion_toolchain=LegalReviewToolchain(
            name=_string(toolchain, "name"),
            release=_string(toolchain, "release"),
            commit=_string(toolchain, "commit"),
            authority_sha256=_string(toolchain, "authority_sha256"),
        ),
        source_weight_redistribution=_boolean(payload, "source_weight_redistribution"),
        community_prebuilt_artifacts=_boolean(payload, "community_prebuilt_artifacts"),
        benchmark_or_admission_claim=_boolean(payload, "benchmark_or_admission_claim"),
        production_readiness_claim=_boolean(payload, "production_readiness_claim"),
    )


def _parse_model_plan(value: object) -> LegalReviewModelPlan:
    payload = _object(value, "legal review model plan")
    required = {
        "role",
        "model_id",
        "revision",
        "license_spdx",
        "model_card_sha256",
        "license_text_sha256",
        "legal_packet_sha256",
        "source_manifest_sha256",
        "source_files_sha256",
        "review_record_path",
        "attestation_path",
    }
    _expect_keys(payload, required, set(), "legal review model plan")
    return LegalReviewModelPlan(
        role=CandidateRole(_string(payload, "role")),
        model_id=_string(payload, "model_id"),
        revision=_string(payload, "revision"),
        license_spdx=_string(payload, "license_spdx"),
        model_card_sha256=_string(payload, "model_card_sha256"),
        license_text_sha256=_string(payload, "license_text_sha256"),
        legal_packet_sha256=_string(payload, "legal_packet_sha256"),
        source_manifest_sha256=_string(payload, "source_manifest_sha256"),
        source_files_sha256=_string(payload, "source_files_sha256"),
        review_record_path=_string(payload, "review_record_path"),
        attestation_path=_string(payload, "attestation_path"),
    )


def _string_map(value: object, name: str) -> dict[str, str]:
    payload = _object(value, name)
    result: dict[str, str] = {}
    for key, item in payload.items():
        if not isinstance(item, str) or not item:
            raise ValueError(f"{name} values must be non-empty strings")
        result[key] = item
    return result


def _boolean(payload: dict[str, Any], key: str) -> bool:
    value = payload.get(key)
    if not isinstance(value, bool):
        raise ValueError(f"{key} must be a boolean")
    return value
