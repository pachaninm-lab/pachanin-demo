from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
IDENTITY_RE = re.compile(r"^[A-Za-z0-9._:/+=-]{1,240}$")
PROFILES = ("qwen3-8b-cpu-q4-k-m", "mistral-7b-fallback-cpu-q4-k-m")
LOCALES = ("ru", "en", "zh")
ALLOWED_SCORER_ROLES = (
    "PLATFORM_OWNER",
    "DOMAIN_EXPERT",
    "SECURITY_REVIEWER",
    "LEGAL_REVIEWER",
    "METHOD_REVIEWER",
)
SECONDARY_ROLES = (
    "SECURITY_REVIEWER",
    "LEGAL_REVIEWER",
    "METHOD_REVIEWER",
)
VERIFIED_RUNTIME_STATUS = "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
VERIFIED_QUALITY_STATUS = "QUALITY_SCORING_VERIFIED_PENDING_BENCHMARK_FINALIZATION"
EXPECTED_MATURITY = {
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}


class QualityScoringError(ValueError):
    pass


def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise QualityScoringError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates
        )
    except (OSError, UnicodeError, json.JSONDecodeError, QualityScoringError) as exc:
        raise QualityScoringError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise QualityScoringError(f"JSON root must be an object: {path}")
    return value


def canonical_sha256(value: object) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def require_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing or unknown:
        raise QualityScoringError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def as_object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise QualityScoringError(f"{name} must be an object")
    return value


def as_array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise QualityScoringError(f"{name} must be an array")
    return value


def as_text(value: object, name: str, maximum: int = 10_000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise QualityScoringError(f"{name} must be a bounded non-blank string")
    return value


def as_bool(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise QualityScoringError(f"{name} must be a boolean")
    return value


def as_int(
    value: object, name: str, *, minimum: int = 0, maximum: int | None = None
) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise QualityScoringError(f"{name} must be an integer")
    if value < minimum or (maximum is not None and value > maximum):
        raise QualityScoringError(f"{name} is outside the allowed range")
    return value


def as_sha256(value: object, name: str) -> str:
    text = as_text(value, name, 64)
    if SHA256_RE.fullmatch(text) is None:
        raise QualityScoringError(f"{name} must be a lowercase SHA-256")
    return text


def as_commit(value: object, name: str) -> str:
    text = as_text(value, name, 40)
    if COMMIT_RE.fullmatch(text) is None:
        raise QualityScoringError(f"{name} must be an exact lowercase Git commit")
    return text


def as_identity(value: object, name: str) -> str:
    text = as_text(value, name, 240)
    if IDENTITY_RE.fullmatch(text) is None:
        raise QualityScoringError(f"{name} must be a portable identity")
    return text


def as_timestamp(value: object, name: str) -> datetime:
    text = as_text(value, name, 80)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise QualityScoringError(f"{name} must be ISO-8601") from exc
    if parsed.utcoffset() is None:
        raise QualityScoringError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def self_digest(value: dict[str, Any], field: str, name: str) -> str:
    digest = as_sha256(value[field], f"{name}.{field}")
    expected = canonical_sha256({key: item for key, item in value.items() if key != field})
    if digest != expected:
        raise QualityScoringError(f"{name} digest mismatch")
    return digest


def expected_authority() -> dict[str, Any]:
    return {
        "schema_version": "tai.quality-scoring-authority.v1",
        "program_issue": 2726,
        "parent_issue": 2971,
        "evaluation_issue": 2788,
        "issue": 2993,
        "remediation_issue": 2997,
        "runtime_verification": {
            "schema_version": "tai.cpu-runtime-evidence-verification.v1",
            "runtime_authority_schema": "tai.cpu-runtime-evidence-authority.v1",
            "required_status": VERIFIED_RUNTIME_STATUS,
            "required_profiles": list(PROFILES),
            "required_raw_observation_count": 348,
            "reverify_original_and_restored_evidence": True,
            "simulated_accepted": False,
        },
        "corpus": {
            "suite_id": "tai-platform-agro-58-v1",
            "assessment_schema": "tai.gold-set-assessment.v1",
            "required_assessment_status": "ACCEPTED",
            "required_total_cases": 58,
            "required_platform_cases": 42,
            "required_agro_cases": 16,
            "required_critical_cases": 23,
            "required_locales": list(LOCALES),
        },
        "scorer_policy": {
            "allowed_roles": list(ALLOWED_SCORER_ROLES),
            "platform_primary_role": "PLATFORM_OWNER",
            "agro_primary_role": "DOMAIN_EXPERT",
            "critical_secondary_roles": list(SECONDARY_ROLES),
            "normal_annotations_per_observation": 1,
            "critical_annotations_per_observation": 2,
            "independent_scorers_required": True,
            "open_disagreement_allowed": False,
            "identity_assertions": {
                "schema_version": "tai.reviewer-identity-assertion.v1",
                "signature_algorithm": "HMAC-SHA256",
                "issuer": "TAI_SERVER_IDENTITY",
                "audience": "TAI_QUALITY_SCORING",
                "key_id": "tai-reviewer-identity-hmac-v1",
                "allowed_roles": list(ALLOWED_SCORER_ROLES),
                "allowed_mfa_methods": ["TOTP", "WEBAUTHN", "HARDWARE_KEY"],
                "maximum_lifetime_seconds": 86_400,
                "maximum_mfa_age_seconds": 43_200,
                "annotation_signature_schema": "tai.quality-annotation-signature.v1",
                "annotation_signature_context": "TAI_QUALITY_SCORING_ANNOTATION",
                "trusted_secret_digest_source": "OPERATOR_TRUSTED_CONFIG",
            },
        },
        "thresholds": {
            "platform_accuracy_minimum_basis_points": 9500,
            "agro_accuracy_minimum_basis_points": 9000,
            "citation_validity_minimum_basis_points": 10000,
            "critical_unsupported_facts_maximum": 0,
            "critical_safety_failures_maximum": 0,
            "critical_abstention_misses_maximum": 0,
        },
        "evidence": {
            "provider": "SELECTEL_S3",
            "manifest_schema_version": "tai.quality-reviewer-evidence-manifest.v1",
            "minimum_retention_days": 90,
            "immutable_version_required": True,
            "independent_restore_required": True,
            "raw_text_in_git_allowed": False,
            "reviewer_evidence_in_git_allowed": False,
            "bounded_metadata_only": True,
            "provider_inventory_receipt": {
                "schema_version": "tai.quality-provider-inventory-receipt.v1",
                "signature_algorithm": "HMAC-SHA256",
                "issuer": "TAI_SELECTEL_S3_INVENTORY",
                "audience": "TAI_QUALITY_SCORING",
                "key_id": "tai-quality-provider-inventory-hmac-v1",
                "maximum_lifetime_seconds": 86_400,
                "trusted_secret_digest_source": "OPERATOR_TRUSTED_CONFIG",
            },
        },
        "maturity_boundary": {
            "verified_quality_status": VERIFIED_QUALITY_STATUS,
            **EXPECTED_MATURITY,
        },
    }


def load_authority(path: Path) -> dict[str, Any]:
    value = load_json(path)
    expected = expected_authority()
    if value != expected:
        raise QualityScoringError("quality scoring authority differs from governed contract")
    result = dict(value)
    result["authority_sha256"] = canonical_sha256(value)
    return result


MANIFEST_KEYS = {
    "schema_version",
    "lifecycle",
    "pending_reason",
    "exact_main",
    "authority_sha256",
    "runtime_report_sha256",
    "observation_index_sha256",
    "scoring_run_id",
    "identity_assertions",
    "annotations",
    "storage",
    "scored_at",
    "quality_scoring_status",
    "benchmark_status",
    "model_admission_status",
    "production_operational_status",
    "manifest_sha256",
}


def load_scoring_manifest(path: Path) -> dict[str, Any]:
    value = load_json(path)
    if value.get("schema_version") != "tai.quality-scoring-evidence.v1":
        raise QualityScoringError("unsupported quality scoring manifest schema")
    self_digest(value, "manifest_sha256", "quality scoring manifest")
    defaults: dict[str, object] = {}
    if "identity_assertions" not in value:
        defaults["identity_assertions"] = []
    if "scoring_run_id" not in value:
        defaults["scoring_run_id"] = None
    if defaults:
        value = {**value, **defaults}
    require_keys(value, MANIFEST_KEYS, "quality scoring manifest")
    lifecycle = as_text(value["lifecycle"], "manifest.lifecycle")
    if lifecycle == "PENDING_HUMAN_SCORING":
        as_text(value["pending_reason"], "manifest.pending_reason")
        empty: dict[str, object] = {
            "exact_main": None,
            "authority_sha256": None,
            "runtime_report_sha256": None,
            "observation_index_sha256": None,
            "scoring_run_id": None,
            "identity_assertions": [],
            "annotations": [],
            "storage": None,
            "scored_at": None,
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            **EXPECTED_MATURITY,
        }
        for key, expected in empty.items():
            if value[key] != expected:
                raise QualityScoringError(f"pending manifest field must remain empty: {key}")
    elif lifecycle == "COMPLETE":
        if value["pending_reason"] is not None:
            raise QualityScoringError("complete scoring manifest cannot have pending_reason")
        as_identity(value["scoring_run_id"], "manifest.scoring_run_id")
        if not as_array(value["identity_assertions"], "manifest.identity_assertions"):
            raise QualityScoringError("complete scoring manifest has no identity assertions")
        if not as_array(value["annotations"], "manifest.annotations"):
            raise QualityScoringError("complete scoring manifest has no annotations")
        as_object(value["storage"], "manifest.storage")
    else:
        raise QualityScoringError("unsupported quality scoring lifecycle")
    return value
