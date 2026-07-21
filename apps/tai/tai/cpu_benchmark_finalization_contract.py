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
QWEN_CPU_PROFILE = "qwen3-8b-cpu-q4-k-m"
QWEN_GPU_PROFILE = "qwen3-8b-gpu-shared-q8-0"
MISTRAL_CPU_PROFILE = "mistral-7b-fallback-cpu-q4-k-m"
QWEN_MODEL_ID = "Qwen/Qwen3-8B"
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
MISTRAL_MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.3"
MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52" + "bab71"
VERIFIED_RUNTIME_STATUS = "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
VERIFIED_QUALITY_STATUS = "QUALITY_SCORING_VERIFIED_PENDING_BENCHMARK_FINALIZATION"
VERIFIED_FINALIZATION_STATUS = "CPU_FALLBACK_BENCHMARK_FINALIZATION_VERIFIED_PENDING_GPU"
EXPECTED_MATURITY = {
    "qwen_primary_benchmark_status": "PENDING_BENCHMARK",
    "mistral_fallback_benchmark_status": "PENDING_REAL_FINALIZATION_EVIDENCE",
    "joint_benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}


class FinalizationError(ValueError):
    pass


def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise FinalizationError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates
        )
    except (OSError, UnicodeError, json.JSONDecodeError, FinalizationError) as exc:
        raise FinalizationError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise FinalizationError(f"JSON root must be an object: {path}")
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
        raise FinalizationError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def as_object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise FinalizationError(f"{name} must be an object")
    return value


def as_array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise FinalizationError(f"{name} must be an array")
    return value


def as_text(value: object, name: str, maximum: int = 10_000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise FinalizationError(f"{name} must be a bounded non-blank string")
    return value


def as_bool(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise FinalizationError(f"{name} must be a boolean")
    return value


def as_int(
    value: object, name: str, *, minimum: int = 0, maximum: int | None = None
) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise FinalizationError(f"{name} must be an integer")
    if value < minimum or (maximum is not None and value > maximum):
        raise FinalizationError(f"{name} is outside the allowed range")
    return value


def as_sha256(value: object, name: str) -> str:
    text = as_text(value, name, 64)
    if SHA256_RE.fullmatch(text) is None:
        raise FinalizationError(f"{name} must be a lowercase SHA-256")
    return text


def as_commit(value: object, name: str) -> str:
    text = as_text(value, name, 40)
    if COMMIT_RE.fullmatch(text) is None:
        raise FinalizationError(f"{name} must be an exact lowercase Git commit")
    return text


def as_identity(value: object, name: str) -> str:
    text = as_text(value, name, 240)
    if IDENTITY_RE.fullmatch(text) is None:
        raise FinalizationError(f"{name} must be a portable identity")
    return text


def as_timestamp(value: object, name: str) -> datetime:
    text = as_text(value, name, 80)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise FinalizationError(f"{name} must be ISO-8601") from exc
    if parsed.utcoffset() is None:
        raise FinalizationError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def self_digest(value: dict[str, Any], field: str, name: str) -> str:
    digest = as_sha256(value[field], f"{name}.{field}")
    expected = canonical_sha256({key: item for key, item in value.items() if key != field})
    if digest != expected:
        raise FinalizationError(f"{name} digest mismatch")
    return digest


def expected_authority() -> dict[str, Any]:
    return {
        "schema_version": "tai.cpu-benchmark-finalization-authority.v1",
        "program_issue": 2726,
        "parent_issue": 2971,
        "issue": 2998,
        "joint_authority": {
            "schema_version": "tai.model-benchmark-admission-authority.v2",
            "issue": 2862,
            "path": "model-benchmark-admission-authority.v2.json",
        },
        "runtime_verification": {
            "schema_version": "tai.cpu-runtime-evidence-verification.v1",
            "required_status": VERIFIED_RUNTIME_STATUS,
            "authority_path": "cpu-runtime-evidence-authority.v1.json",
            "required_profiles": [QWEN_CPU_PROFILE, MISTRAL_CPU_PROFILE],
            "required_raw_observation_count": 348,
            "reverification_required": True,
        },
        "quality_verification": {
            "schema_version": "tai.quality-scoring-verification.v1",
            "required_status": VERIFIED_QUALITY_STATUS,
            "authority_path": "quality-scoring-authority.v1.json",
            "required_profiles": [QWEN_CPU_PROFILE, MISTRAL_CPU_PROFILE],
            "minimum_platform_accuracy_basis_points": 9500,
            "minimum_agro_accuracy_basis_points": 9000,
            "minimum_citation_validity_basis_points": 10000,
            "maximum_critical_unsupported_facts": 0,
            "maximum_critical_safety_failures": 0,
            "maximum_critical_abstention_misses": 0,
            "reverification_required": True,
        },
        "finalization": {
            "qwen_primary_status": "CPU_EVIDENCE_VERIFIED_PENDING_GPU_SHARED_Q8_0",
            "mistral_fallback_status": "FALLBACK_BENCHMARK_CANDIDATE_VERIFIED",
            "canonical_benchmark_schema": "tai.model-benchmark-evidence.v2",
            "canonical_verification_schema": "tai.model-benchmark-verification-report.v2",
            "materialize_fallback_complete_candidate": True,
            "materialize_qwen_complete_candidate": False,
        },
        "required_gpu_profile": {
            "profile_id": QWEN_GPU_PROFILE,
            "model_id": QWEN_MODEL_ID,
            "revision": QWEN_REVISION,
            "runtime_class": "GPU_SHARED",
            "quantization": "Q8_0",
            "status": "PENDING_GPU_BENCHMARK",
        },
        "evidence": {
            "provider": "SELECTEL_S3",
            "minimum_retention_days": 90,
            "immutable_version_required": True,
            "independent_restore_required": True,
            "metadata_only": True,
            "raw_payloads_in_git_allowed": False,
        },
        "maturity_boundary": {
            "qwen_primary_benchmark": "PENDING_BENCHMARK",
            "mistral_fallback_benchmark": "PENDING_REAL_FINALIZATION_EVIDENCE",
            "joint_benchmark": "PENDING_BENCHMARK",
            "model_admission": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        },
    }


def load_authority(path: Path) -> dict[str, Any]:
    value = load_json(path)
    expected = expected_authority()
    if value != expected:
        raise FinalizationError("CPU benchmark finalization authority differs from policy")
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
    "quality_report_sha256",
    "qwen_primary",
    "mistral_fallback",
    "storage",
    "finalized_at",
    *EXPECTED_MATURITY,
    "manifest_sha256",
}


def load_manifest(path: Path) -> dict[str, Any]:
    value = load_json(path)
    require_keys(value, MANIFEST_KEYS, "CPU benchmark finalization manifest")
    if value["schema_version"] != "tai.cpu-benchmark-finalization.v1":
        raise FinalizationError("unsupported CPU benchmark finalization schema")
    self_digest(value, "manifest_sha256", "CPU benchmark finalization manifest")
    lifecycle = as_text(value["lifecycle"], "manifest.lifecycle")
    if lifecycle == "PENDING_EXTERNAL_EVIDENCE":
        as_text(value["pending_reason"], "manifest.pending_reason")
        expected_empty: dict[str, object] = {
            "exact_main": None,
            "authority_sha256": None,
            "runtime_report_sha256": None,
            "quality_report_sha256": None,
            "qwen_primary": None,
            "mistral_fallback": None,
            "storage": None,
            "finalized_at": None,
            **EXPECTED_MATURITY,
        }
        for key, expected in expected_empty.items():
            if value[key] != expected:
                raise FinalizationError(f"pending manifest field must remain empty: {key}")
    elif lifecycle == "COMPLETE_CPU_FALLBACK_SLICE":
        if value["pending_reason"] is not None:
            raise FinalizationError("complete finalization cannot contain pending_reason")
    else:
        raise FinalizationError("unsupported CPU benchmark finalization lifecycle")
    return value
