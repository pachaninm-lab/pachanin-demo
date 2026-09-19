from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from typing import Any

SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
COMMIT_RE = re.compile(r"^[0-9a-f]{40}$")
IDENTITY_RE = re.compile(r"^[A-Za-z0-9._:/+-]{1,240}$")
ALLOWED_TERMINAL_STATUSES = {"ANSWERED", "ABSTAINED", "REJECTED", "ERROR"}
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52" + "bab71"
TOOLCHAIN_COMMIT = "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3"
VERIFIED_RUNTIME_STATUS = "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
EXPECTED_MATURITY: dict[str, str] = {
    "quality_scoring_status": "PENDING_QUALITY_SCORING",
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}

EXPECTED_PROFILES: list[dict[str, Any]] = [
    {
        "profile_id": "qwen3-8b-cpu-q4-k-m",
        "role": "PRIMARY",
        "model_key": "qwen3-8b",
        "model_id": "Qwen/Qwen3-8B",
        "revision": QWEN_REVISION,
        "runtime_class": "CPU",
        "quantization": "Q4_K_M",
        "artifact_path": "artifacts/qwen3-8b-q4-k-m.gguf",
        "required_concurrency_levels": [1, 2, 4],
        "thresholds": {
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
    },
    {
        "profile_id": "mistral-7b-fallback-cpu-q4-k-m",
        "role": "FALLBACK",
        "model_key": "mistral-7b-instruct-v0.3",
        "model_id": "mistralai/Mistral-7B-Instruct-v0.3",
        "revision": MISTRAL_REVISION,
        "runtime_class": "CPU",
        "quantization": "Q4_K_M",
        "artifact_path": "artifacts/mistral-7b-instruct-v0.3-q4-k-m.gguf",
        "required_concurrency_levels": [1, 2, 4],
        "thresholds": {
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
    },
]


class RuntimeEvidenceError(ValueError):
    pass


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for key, value in pairs:
        if key in output:
            raise RuntimeEvidenceError(f"duplicate JSON key: {key}")
        output[key] = value
    return output


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicates
        )
    except (OSError, json.JSONDecodeError, RuntimeEvidenceError) as exc:
        raise RuntimeEvidenceError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeEvidenceError(f"JSON root must be an object: {path}")
    return value


def canonical_sha256(value: object) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def require_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    observed = set(value)
    missing = sorted(expected - observed)
    unknown = sorted(observed - expected)
    if missing or unknown:
        raise RuntimeEvidenceError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def as_object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RuntimeEvidenceError(f"{name} must be an object")
    return value


def as_array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise RuntimeEvidenceError(f"{name} must be an array")
    return value


def as_text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RuntimeEvidenceError(f"{name} must be a non-blank string")
    return value


def as_bool(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise RuntimeEvidenceError(f"{name} must be a boolean")
    return value


def as_int(
    value: object,
    name: str,
    *,
    minimum: int = 0,
    maximum: int | None = None,
) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise RuntimeEvidenceError(f"{name} must be an integer")
    if value < minimum:
        raise RuntimeEvidenceError(f"{name} must be >= {minimum}")
    if maximum is not None and value > maximum:
        raise RuntimeEvidenceError(f"{name} must be <= {maximum}")
    return value


def as_sha256(value: object, name: str) -> str:
    text = as_text(value, name)
    if SHA256_RE.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be a lowercase SHA-256")
    return text


def as_commit(value: object, name: str) -> str:
    text = as_text(value, name)
    if COMMIT_RE.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be an exact lowercase Git commit")
    return text


def as_identity(value: object, name: str) -> str:
    text = as_text(value, name)
    if IDENTITY_RE.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be a portable bounded identity")
    return text


def as_timestamp(value: object, name: str) -> datetime:
    text = as_text(value, name)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeEvidenceError(f"{name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise RuntimeEvidenceError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def as_relative_path(value: object, name: str) -> str:
    text = as_text(value, name)
    path = PurePosixPath(text)
    if path.is_absolute() or not path.parts or "." in path.parts or ".." in path.parts:
        raise RuntimeEvidenceError(f"{name} must be a bounded relative POSIX path")
    if text.startswith("~") or "\\" in text:
        raise RuntimeEvidenceError(f"{name} must not use home or backslash traversal")
    return text


def as_unique_texts(value: object, name: str) -> list[str]:
    items = [
        as_text(item, f"{name}[{index}]")
        for index, item in enumerate(as_array(value, name))
    ]
    if not items or len(items) != len(set(items)):
        raise RuntimeEvidenceError(f"{name} must be non-empty and unique")
    return items


def expected_authority() -> dict[str, Any]:
    return {
        "schema_version": "tai.cpu-runtime-evidence-authority.v1",
        "program_issue": 2726,
        "parent_issue": 2971,
        "issue": 2987,
        "readiness": {
            "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
            "required_status": "READY_FOR_EXTERNAL_EXECUTION",
            "maximum_age_hours": 24,
            "exact_main_required": True,
            "simulated_evidence_accepted": False,
        },
        "bundle_finalization": {
            "schema_version": "tai.model-bundle-finalization-report.v1",
            "required_status": "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED",
            "bundle_authority_schema": "tai.model-bundle-authority.v2",
            "verification_status": "VERIFIED",
            "exact_object_version_required": True,
            "independent_restore_required": True,
        },
        "toolchain": {
            "name": "ggml-org/llama.cpp",
            "release": "b9637",
            "commit": TOOLCHAIN_COMMIT,
            "profile": "linux-x86_64-cpu-release-static-v1",
            "required_binaries": ["llama-cli", "llama-server", "llama-bench"],
        },
        "target": {
            "host_role": "DEDICATED_MODEL_HOST",
            "required_user": "tai-model",
            "workspace_root": "/srv/tai-models/cpu-runtime-runs",
            "production_fallback_allowed": False,
            "loopback_inference_only": True,
            "external_egress": "EXACT_VERSION_S3_ONLY",
        },
        "corpus": {
            "suite_id": "tai-platform-agro-58-v1",
            "assessment_schema": "tai.gold-set-assessment.v1",
            "required_status": "ACCEPTED",
            "required_accepted": True,
            "required_total_cases": 58,
            "required_critical_cases": 23,
            "required_locales": ["ru", "en", "zh"],
            "required_raw_observations_per_profile": 174,
            "required_raw_observations_total": 348,
            "maximum_unreviewed_cases": 0,
        },
        "runtime_profiles": EXPECTED_PROFILES,
        "generation": {
            "deterministic_seed": 13001,
            "temperature_milli": 0,
            "maximum_output_tokens": 512,
            "request_timeout_seconds": 120,
        },
        "fallback": {
            "minimum_trigger_count": 100,
            "forced_primary_failure_required": True,
            "maximum_failed_transitions": 0,
            "maximum_p95_takeover_ms": 5000,
            "maximum_continuity_violations": 0,
        },
        "soak": {
            "minimum_duration_seconds": 3600,
            "minimum_request_count": 1000,
            "maximum_failed_requests": 10,
            "maximum_critical_failures": 0,
            "maximum_memory_drift_mb": 512,
        },
        "evidence": {
            "schema_version": "tai.cpu-runtime-evidence.v1",
            "maximum_file_count": 256,
            "maximum_file_size_bytes": 536_870_912,
            "maximum_total_size_bytes": 8_589_934_592,
            "minimum_external_retention_days": 90,
            "exact_version_restore_required": True,
            "independent_restore_roots_required": True,
            "raw_payloads_in_github_allowed": False,
            "required_semantic_files": [
                "suite/case-manifest.json",
                "raw-observations/manifest.json",
                "raw-observations/payload.json",
                "fallback/metrics.json",
                "soak/metrics.json",
            ],
        },
        "maturity_boundary": {
            "verified_runtime_status": VERIFIED_RUNTIME_STATUS,
            **EXPECTED_MATURITY,
        },
    }


def load_authority(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    expected = expected_authority()
    require_keys(raw, set(expected), "runtime evidence authority")
    if raw != expected:
        raise RuntimeEvidenceError("runtime evidence authority differs from governed policy")
    result: dict[str, Any] = dict(raw)
    result["authority_sha256"] = canonical_sha256(raw)
    return result


def pending_report(authority: dict[str, Any], reason: str) -> dict[str, object]:
    report: dict[str, object] = {
        "schema_version": "tai.cpu-runtime-evidence-verification.v1",
        "status": "PENDING_RUNTIME_EXECUTION",
        "authority_sha256": authority["authority_sha256"],
        "manifest_sha256": None,
        "exact_main": None,
        "runtime_profiles": {},
        "raw_observation_count": 0,
        "evidence_file_count": 0,
        "evidence_total_size_bytes": 0,
        "reasons": [reason],
        **EXPECTED_MATURITY,
    }
    report["report_sha256"] = canonical_sha256(report)
    return report


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
