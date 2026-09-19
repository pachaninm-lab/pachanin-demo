from __future__ import annotations

from pathlib import Path
from typing import Any

from tai.model_bundle_v2_common import _load_json_strict, _object, _string
from tai.model_legal_review_authority import ModelLegalReviewAuthority


def validate_source_acceptance(
    authority: ModelLegalReviewAuthority,
    acceptance_path: Path,
) -> None:
    payload = _load_json_strict(acceptance_path)
    reference = authority.source_acceptance
    if payload.get("schema_version") != "tai.model-source-acquisition-acceptance.v1":
        raise ValueError("source acquisition acceptance schema mismatch")
    if payload.get("exact_main_sha") != reference.source_exact_main_sha:
        raise ValueError("source acquisition exact-main mismatch")
    if payload.get("authority_sha256") != reference.model_bundle_authority_sha256:
        raise ValueError("source acquisition authority digest mismatch")
    if payload.get("status") != reference.status:
        raise ValueError("source acquisition acceptance status mismatch")

    boundary = _object(payload.get("maturity_boundary"), "source maturity boundary")
    expected_boundary = {
        "legal_review": "PENDING_HUMAN_DECISION",
        "conversion": "NOT_RUN",
        "quantization": "NOT_RUN",
        "benchmarks": "NOT_RUN",
        "model_admission": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    for key, expected in expected_boundary.items():
        if boundary.get(key) != expected:
            raise ValueError(f"source acquisition maturity mismatch: {key}")

    release = _object(payload.get("release_acceptance"), "source release acceptance")
    attestation = _object(release.get("attestation"), "source release attestation")
    if attestation.get("accepted") is not True or attestation.get("reasons") != []:
        raise ValueError("source acquisition release attestation is not accepted")
    if attestation.get("production_operational_status") != "NOT_ATTESTED":
        raise ValueError("source acquisition release attestation overstates operations")

    raw_models = payload.get("models")
    if not isinstance(raw_models, list):
        raise ValueError("source acquisition model evidence is missing")
    by_identity: dict[tuple[str, str], dict[str, Any]] = {}
    for raw in raw_models:
        model = _object(raw, "source acquisition model evidence")
        identity = (_string(model, "model_id"), _string(model, "revision"))
        if identity in by_identity:
            raise ValueError("source acquisition model evidence is duplicated")
        by_identity[identity] = model
    expected_identities = {(item.model_id, item.revision) for item in authority.models}
    if set(by_identity) != expected_identities:
        raise ValueError("source acquisition model evidence set mismatch")

    for plan in authority.models:
        _validate_model(plan=plan, model=by_identity[(plan.model_id, plan.revision)])


def _validate_model(*, plan: Any, model: dict[str, Any]) -> None:
    expected = {
        "role": plan.role.value,
        "status": "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING",
        "source_manifest_sha256": plan.source_manifest_sha256,
        "source_files_sha256": plan.source_files_sha256,
        "legal_packet_sha256": plan.legal_packet_sha256,
        "legal_review_status": "PENDING_HUMAN_DECISION",
        "conversion_status": "NOT_RUN",
        "quantization_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
    }
    for key, value in expected.items():
        if model.get(key) != value:
            raise ValueError(f"source acquisition model evidence mismatch: {key}")
    if model.get("reasons") != []:
        raise ValueError("source acquisition model evidence has rejection reasons")
    storage = _object(model.get("source_bytes_storage"), "source storage evidence")
    if storage.get("locally_hashed") is not True:
        raise ValueError("source acquisition local hashing is not verified")
    if storage.get("clean_redownload_reverified") is not True:
        raise ValueError("source acquisition clean restore is not verified")
    if storage.get("copied_to_git_or_actions_artifact") is not False:
        raise ValueError("source acquisition copied model bytes into metadata storage")
