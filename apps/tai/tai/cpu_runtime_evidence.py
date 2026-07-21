from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any

from tai import cpu_benchmark_execution as benchmark_execution

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_ID = re.compile(r"^[A-Za-z0-9._:/+-]{1,240}$")
_PROFILES = ("qwen3-8b-cpu-q4-k-m", "mistral-7b-fallback-cpu-q4-k-m")
_LOCALES = ("ru", "en", "zh")
_MATURITY = {
    "runtime_verification_status": "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING",
    "quality_scoring_status": "PENDING_QUALITY_SCORING",
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}
_PENDING_MATURITY = {**_MATURITY, "runtime_verification_status": "PENDING_RUNTIME_EXECUTION"}
_THRESHOLDS = {
    _PROFILES[0]: {
        "minimum_sample_count": 100,
        "minimum_prompt_tokens_per_second_milli": 5000,
        "minimum_generation_tokens_per_second_milli": 4000,
        "maximum_p95_latency_ms": 20000,
        "maximum_p99_latency_ms": 30000,
        "maximum_error_rate_basis_points": 100,
        "maximum_peak_ram_mb": 16384,
        "maximum_cold_start_ms": 120000,
        "maximum_warmup_ms": 180000,
    },
    _PROFILES[1]: {
        "minimum_sample_count": 100,
        "minimum_prompt_tokens_per_second_milli": 4000,
        "minimum_generation_tokens_per_second_milli": 3000,
        "maximum_p95_latency_ms": 25000,
        "maximum_p99_latency_ms": 35000,
        "maximum_error_rate_basis_points": 100,
        "maximum_peak_ram_mb": 16384,
        "maximum_cold_start_ms": 120000,
        "maximum_warmup_ms": 180000,
    },
}
_REQUIRED_FILES = (
    "suite/case-manifest.json",
    "raw-observations/manifest.json",
    f"raw-observations/{_PROFILES[0]}.jsonl",
    f"raw-observations/{_PROFILES[1]}.jsonl",
    f"runtime/{_PROFILES[0]}/metrics.json",
    f"runtime/{_PROFILES[1]}/metrics.json",
    "toolchain/manifest.json",
    "fallback/metrics.json",
    "soak/metrics.json",
    "storage/manifest.json",
)


class RuntimeEvidenceError(ValueError):
    pass


def _duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise RuntimeEvidenceError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=_duplicates)
    except (OSError, UnicodeError, json.JSONDecodeError, RuntimeEvidenceError) as exc:
        raise RuntimeEvidenceError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeEvidenceError(f"JSON root must be an object: {path}")
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


def _keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    missing = sorted(expected - set(value))
    unknown = sorted(set(value) - expected)
    if missing or unknown:
        raise RuntimeEvidenceError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def _obj(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RuntimeEvidenceError(f"{name} must be an object")
    return value


def _arr(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise RuntimeEvidenceError(f"{name} must be an array")
    return value


def _text(value: object, name: str, maximum: int = 100_000) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > maximum:
        raise RuntimeEvidenceError(f"{name} must be a bounded non-blank string")
    return value


def _int(value: object, name: str, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise RuntimeEvidenceError(f"{name} must be an integer >= {minimum}")
    return value


def _bool(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise RuntimeEvidenceError(f"{name} must be a boolean")
    return value


def _sha(value: object, name: str) -> str:
    text = _text(value, name, 64)
    if _SHA256.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be a lowercase SHA-256")
    return text


def _commit(value: object, name: str) -> str:
    text = _text(value, name, 40)
    if _COMMIT.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be an exact lowercase Git commit")
    return text


def _identity(value: object, name: str) -> str:
    text = _text(value, name, 240)
    if _ID.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be a portable identity")
    return text


def _time(value: object, name: str) -> datetime:
    text = _text(value, name, 80)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeEvidenceError(f"{name} must be ISO-8601") from exc
    if parsed.utcoffset() is None:
        raise RuntimeEvidenceError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def _path(value: object, name: str) -> str:
    text = _text(value, name, 400)
    path = PurePosixPath(text)
    if (
        "\\" in text
        or text.startswith("/")
        or path.is_absolute()
        or path.as_posix() != text
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        raise RuntimeEvidenceError(f"{name} must be a normalized relative POSIX path")
    return text


def _self_digest(value: dict[str, Any], field: str, name: str) -> str:
    digest = _sha(value[field], f"{name}.{field}")
    expected = canonical_sha256({key: item for key, item in value.items() if key != field})
    if digest != expected:
        raise RuntimeEvidenceError(f"{name} digest mismatch")
    return digest


def _exact(value: object, expected: object, name: str) -> None:
    if value != expected:
        raise RuntimeEvidenceError(f"{name} mismatch")


def load_runtime_authority(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _keys(
        raw,
        {
            "schema_version", "program_issue", "parent_issue", "issue",
            "execution_authority", "readiness", "bundle_finalization", "toolchain",
            "target", "corpus", "runtime_profiles", "generation", "fallback", "soak",
            "evidence", "maturity_boundary",
        },
        "runtime authority",
    )
    _exact(raw["schema_version"], "tai.cpu-runtime-evidence-authority.v1", "schema")
    _exact((raw["program_issue"], raw["parent_issue"], raw["issue"]), (2726, 2971, 2987), "issue binding")
    execution_ref = {
        "schema_version": "tai.cpu-benchmark-execution-authority.v1",
        "issue": 2977,
        "path": "cpu-benchmark-execution-authority.v1.json",
    }
    _exact(raw["execution_authority"], execution_ref, "execution authority reference")
    execution_path = path.parent / _path(execution_ref["path"], "execution_authority.path")
    execution = benchmark_execution.load_execution_authority(execution_path)
    _exact(
        raw["readiness"],
        {
            "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
            "required_status": "READY_FOR_EXTERNAL_EXECUTION",
            "maximum_age_hours": 24,
            "exact_main_required": True,
            "simulated_evidence_accepted": False,
        },
        "readiness policy",
    )
    _exact(
        raw["bundle_finalization"],
        {
            "schema_version": "tai.model-bundle-finalization-report.v1",
            "required_status": "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED",
            "bundle_authority_schema": "tai.model-bundle-authority.v2",
            "verification_status": "VERIFIED",
            "exact_object_version_required": True,
            "independent_restore_required": True,
        },
        "bundle policy",
    )
    _exact(raw["toolchain"], execution["toolchain"], "toolchain")
    _exact(
        raw["target"],
        {
            "host_role": "DEDICATED_MODEL_HOST", "required_user": "tai-model",
            "workspace_root": "/srv/tai-models/cpu-runtime-runs",
            "production_fallback_allowed": False, "loopback_inference_only": True,
            "external_egress": "EXACT_VERSION_S3_ONLY",
        },
        "target boundary",
    )
    _exact(
        raw["corpus"],
        {
            "suite_id": "tai-platform-agro-58-v1",
            "assessment_schema": "tai.gold-set-assessment.v1",
            "required_status": "ACCEPTED", "required_accepted": True,
            "required_total_cases": 58, "required_critical_cases": 23,
            "required_locales": list(_LOCALES),
            "required_raw_observations_per_profile": 174,
            "required_raw_observations_total": 348, "maximum_unreviewed_cases": 0,
        },
        "corpus authority",
    )
    models = {
        str(item["runtime_profile_id"]): item
        for item in _arr(execution["models"], "execution.models")
        if isinstance(item, dict)
    }
    profiles = _arr(raw["runtime_profiles"], "runtime_profiles")
    if len(profiles) != 2:
        raise RuntimeEvidenceError("runtime profile count mismatch")
    parsed_profiles: list[dict[str, Any]] = []
    for index, item in enumerate(profiles):
        profile = _obj(item, f"runtime_profiles[{index}]")
        profile_id = _identity(profile.get("profile_id"), f"runtime_profiles[{index}].profile_id")
        source = models.get(profile_id)
        if source is None or profile_id != _PROFILES[index]:
            raise RuntimeEvidenceError("runtime profile authority mismatch")
        expected_identity = {
            "profile_id": source["runtime_profile_id"], "role": source["role"],
            "model_key": source["key"], "model_id": source["model_id"],
            "revision": source["revision"], "runtime_class": source["runtime_class"],
            "quantization": source["quantization"], "artifact_path": source["artifact_path"],
            "required_concurrency_levels": source["required_concurrency_levels"],
            "thresholds": _THRESHOLDS[profile_id],
        }
        _exact(profile, expected_identity, f"runtime profile {profile_id}")
        parsed_profiles.append(dict(profile))
    _exact(
        raw["generation"],
        {"deterministic_seed": 13001, "temperature_milli": 0, "maximum_output_tokens": 512, "request_timeout_seconds": 120},
        "generation policy",
    )
    _exact(
        raw["fallback"],
        {"minimum_trigger_count": 100, "forced_primary_failure_required": True, "maximum_failed_transitions": 0, "maximum_p95_takeover_ms": 5000, "maximum_continuity_violations": 0},
        "fallback policy",
    )
    _exact(
        raw["soak"],
        {"minimum_duration_seconds": 3600, "minimum_request_count": 1000, "maximum_failed_requests": 10, "maximum_critical_failures": 0, "maximum_memory_drift_mb": 512},
        "soak policy",
    )
    _exact(
        raw["evidence"],
        {
            "schema_version": "tai.cpu-runtime-evidence.v1", "maximum_file_count": 256,
            "maximum_file_size_bytes": 536870912, "maximum_total_size_bytes": 8589934592,
            "minimum_external_retention_days": 90, "exact_version_restore_required": True,
            "independent_restore_roots_required": True, "raw_payloads_in_github_allowed": False,
            "forbidden_suffixes": [".gguf", ".safetensors", ".bin", ".pt", ".pth", ".tar", ".zip"],
            "required_semantic_files": list(_REQUIRED_FILES),
        },
        "evidence boundary",
    )
    _exact(raw["maturity_boundary"], _MATURITY, "maturity boundary")
    result = {**raw, "runtime_profiles": parsed_profiles, "execution_authority_sha256": execution["authority_sha256"]}
    result["authority_sha256"] = canonical_sha256(result)
    return result


def load_runtime_manifest(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _keys(
        raw,
        {
            "schema_version", "lifecycle", "pending_reason", "exact_main",
            "authority_sha256", "execution_authority_sha256", "readiness",
            "bundle_finalization", "corpus", "runtime_profiles", "fallback_exercise",
            "soak", "raw_observations", "evidence_files", "storage", "measured_at",
            "runtime_verification_status", "quality_scoring_status", "benchmark_status",
            "model_admission_status", "production_operational_status", "manifest_sha256",
        },
        "runtime manifest",
    )
    _exact(raw["schema_version"], "tai.cpu-runtime-evidence.v1", "manifest schema")
    _self_digest(raw, "manifest_sha256", "runtime manifest")
    lifecycle = _text(raw["lifecycle"], "lifecycle")
    if lifecycle == "PENDING_RUNTIME_EXECUTION":
        if not isinstance(raw["pending_reason"], str) or not raw["pending_reason"].strip():
            raise RuntimeEvidenceError("pending manifest requires a reason")
        nullable = (
            "exact_main", "authority_sha256", "execution_authority_sha256", "readiness",
            "bundle_finalization", "corpus", "fallback_exercise", "soak",
            "raw_observations", "storage", "measured_at",
        )
        if any(raw[key] is not None for key in nullable) or raw["runtime_profiles"] or raw["evidence_files"]:
            raise RuntimeEvidenceError("pending manifest contains completed evidence")
        _exact({key: raw[key] for key in _PENDING_MATURITY}, _PENDING_MATURITY, "pending maturity")
    elif lifecycle == "COMPLETE":
        if raw["pending_reason"] is not None:
            raise RuntimeEvidenceError("complete manifest has pending_reason")
    else:
        raise RuntimeEvidenceError("runtime manifest lifecycle is invalid")
    return raw



from tai.cpu_runtime_evidence_verify import verify_runtime_evidence  # noqa: E402

__all__ = [
    "RuntimeEvidenceError",
    "canonical_sha256",
    "load_json",
    "load_runtime_authority",
    "load_runtime_manifest",
    "verify_runtime_evidence",
    "write_json",
]
