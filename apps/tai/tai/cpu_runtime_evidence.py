from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_IDENTITY = re.compile(r"^[A-Za-z0-9._:/+-]{1,240}$")
_ALLOWED_TERMINAL_STATUSES = {"ANSWERED", "ABSTAINED", "REJECTED", "ERROR"}
_QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
_MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52" + "bab71"
_TOOLCHAIN_COMMIT = "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3"

_EXPECTED_MATURITY = {
    "quality_scoring_status": "PENDING_QUALITY_SCORING",
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}
_VERIFIED_RUNTIME_STATUS = "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"

_EXPECTED_PROFILES: list[dict[str, Any]] = [
    {
        "profile_id": "qwen3-8b-cpu-q4-k-m",
        "role": "PRIMARY",
        "model_key": "qwen3-8b",
        "model_id": "Qwen/Qwen3-8B",
        "revision": _QWEN_REVISION,
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
        "revision": _MISTRAL_REVISION,
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
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicates,
        )
    except (OSError, json.JSONDecodeError, RuntimeEvidenceError) as exc:
        raise RuntimeEvidenceError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise RuntimeEvidenceError(f"JSON root must be an object: {path}")
    return value


def canonical_sha256(value: object) -> str:
    rendered = json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(rendered.encode("utf-8")).hexdigest()


def _require_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    observed = set(value)
    missing = sorted(expected - observed)
    unknown = sorted(observed - expected)
    if missing or unknown:
        raise RuntimeEvidenceError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RuntimeEvidenceError(f"{name} must be an object")
    return value


def _array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise RuntimeEvidenceError(f"{name} must be an array")
    return value


def _text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise RuntimeEvidenceError(f"{name} must be a non-blank string")
    return value


def _optional_text(value: object, name: str) -> str | None:
    if value is None:
        return None
    return _text(value, name)


def _boolean(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise RuntimeEvidenceError(f"{name} must be a boolean")
    return value


def _integer(
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


def _sha256(value: object, name: str) -> str:
    text = _text(value, name)
    if _SHA256.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be a lowercase SHA-256")
    return text


def _commit(value: object, name: str) -> str:
    text = _text(value, name)
    if _COMMIT.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be an exact lowercase Git commit")
    return text


def _identity(value: object, name: str) -> str:
    text = _text(value, name)
    if _IDENTITY.fullmatch(text) is None:
        raise RuntimeEvidenceError(f"{name} must be a portable bounded identity")
    return text


def _timestamp(value: object, name: str) -> datetime:
    text = _text(value, name)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RuntimeEvidenceError(f"{name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise RuntimeEvidenceError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def _relative_path(value: object, name: str) -> str:
    text = _text(value, name)
    path = PurePosixPath(text)
    if path.is_absolute() or not path.parts or "." in path.parts or ".." in path.parts:
        raise RuntimeEvidenceError(f"{name} must be a bounded relative POSIX path")
    if text.startswith("~") or "\\" in text:
        raise RuntimeEvidenceError(f"{name} must not use home or backslash traversal")
    return text


def _string_array(value: object, name: str) -> list[str]:
    items = [
        _text(item, f"{name}[{index}]")
        for index, item in enumerate(_array(value, name))
    ]
    if not items or len(items) != len(set(items)):
        raise RuntimeEvidenceError(f"{name} must be non-empty and unique")
    return items


def _expected_authority() -> dict[str, Any]:
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
            "commit": _TOOLCHAIN_COMMIT,
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
        "runtime_profiles": _EXPECTED_PROFILES,
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
            "verified_runtime_status": _VERIFIED_RUNTIME_STATUS,
            **_EXPECTED_MATURITY,
        },
    }


def load_authority(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    expected = _expected_authority()
    _require_keys(raw, set(expected), "runtime evidence authority")
    if raw != expected:
        raise RuntimeEvidenceError("runtime evidence authority differs from governed policy")
    authority = dict(raw)
    authority["authority_sha256"] = canonical_sha256(raw)
    return authority


def _pending_report(authority: dict[str, Any], reason: str) -> dict[str, object]:
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
        **_EXPECTED_MATURITY,
    }
    report["report_sha256"] = canonical_sha256(report)
    return report


def _file_record(value: object, name: str) -> dict[str, Any]:
    item = _object(value, name)
    _require_keys(item, {"path", "sha256", "size_bytes"}, name)
    return {
        "path": _relative_path(item["path"], f"{name}.path"),
        "sha256": _sha256(item["sha256"], f"{name}.sha256"),
        "size_bytes": _integer(item["size_bytes"], f"{name}.size_bytes", minimum=1),
    }


def _safe_file(root: Path, relative: str, name: str) -> Path:
    root_resolved = root.resolve(strict=True)
    if not root_resolved.is_dir():
        raise RuntimeEvidenceError(f"{name} root must be a directory")
    target = root / PurePosixPath(relative)
    current = root
    for part in PurePosixPath(relative).parts:
        current = current / part
        if current.is_symlink():
            raise RuntimeEvidenceError(f"{name} contains a symlink: {relative}")
    resolved = target.resolve(strict=True)
    if not resolved.is_relative_to(root_resolved):
        raise RuntimeEvidenceError(f"{name} escapes its evidence root: {relative}")
    if not resolved.is_file() or resolved.is_symlink():
        raise RuntimeEvidenceError(f"{name} must be a regular file: {relative}")
    return resolved


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _verify_declared_files(
    authority: dict[str, Any],
    files: list[dict[str, Any]],
    original_root: Path,
    restored_root: Path,
) -> tuple[dict[str, dict[str, Any]], list[str], int]:
    if original_root.resolve(strict=True) == restored_root.resolve(strict=True):
        raise RuntimeEvidenceError("original and restored evidence roots must be independent")
    limits = authority["evidence"]
    if len(files) > limits["maximum_file_count"]:
        raise RuntimeEvidenceError("evidence file count exceeds authority limit")
    by_path: dict[str, dict[str, Any]] = {}
    total = 0
    reasons: list[str] = []
    for index, record in enumerate(files):
        path = str(record["path"])
        if path in by_path:
            raise RuntimeEvidenceError(f"duplicate evidence path: {path}")
        by_path[path] = record
        size = int(record["size_bytes"])
        total += size
        if size > limits["maximum_file_size_bytes"]:
            reasons.append(f"EVIDENCE_FILE_TOO_LARGE:{path}")
        original = _safe_file(original_root, path, f"evidence_files[{index}].original")
        restored = _safe_file(restored_root, path, f"evidence_files[{index}].restored")
        if original.stat().st_size != size:
            reasons.append(f"ORIGINAL_SIZE_MISMATCH:{path}")
        if restored.stat().st_size != size:
            reasons.append(f"RESTORED_SIZE_MISMATCH:{path}")
        original_sha = _hash_file(original)
        restored_sha = _hash_file(restored)
        declared_sha = str(record["sha256"])
        if original_sha != declared_sha:
            reasons.append(f"ORIGINAL_DIGEST_MISMATCH:{path}")
        if restored_sha != declared_sha:
            reasons.append(f"RESTORED_DIGEST_MISMATCH:{path}")
        if original_sha != restored_sha:
            reasons.append(f"RESTORE_DRIFT:{path}")
    if total > limits["maximum_total_size_bytes"]:
        reasons.append("EVIDENCE_TOTAL_SIZE_EXCEEDED")
    return by_path, reasons, total


def _load_semantic(
    root: Path,
    records: dict[str, dict[str, Any]],
    path: str,
    name: str,
) -> dict[str, Any]:
    if path not in records:
        raise RuntimeEvidenceError(f"required semantic evidence is undeclared: {path}")
    return load_json(_safe_file(root, path, name))


def _parse_readiness(
    value: object,
    *,
    exact_main: str,
    measured_at: datetime,
    maximum_age_hours: int,
) -> tuple[dict[str, Any], list[str]]:
    item = _object(value, "readiness")
    _require_keys(
        item,
        {
            "schema_version",
            "status",
            "ready",
            "exact_main",
            "evaluated_at",
            "report_sha256",
            "simulated",
        },
        "readiness",
    )
    parsed = {
        "schema_version": _text(item["schema_version"], "readiness.schema_version"),
        "status": _text(item["status"], "readiness.status"),
        "ready": _boolean(item["ready"], "readiness.ready"),
        "exact_main": _commit(item["exact_main"], "readiness.exact_main"),
        "evaluated_at": _timestamp(item["evaluated_at"], "readiness.evaluated_at"),
        "report_sha256": _sha256(item["report_sha256"], "readiness.report_sha256"),
        "simulated": _boolean(item["simulated"], "readiness.simulated"),
    }
    reasons: list[str] = []
    if parsed["schema_version"] != "tai.cpu-benchmark-execution-readiness.v1":
        reasons.append("READINESS_SCHEMA_MISMATCH")
    if parsed["status"] != "READY_FOR_EXTERNAL_EXECUTION" or parsed["ready"] is not True:
        reasons.append("READINESS_NOT_ACCEPTED")
    if parsed["exact_main"] != exact_main:
        reasons.append("READINESS_EXACT_MAIN_MISMATCH")
    evaluated_at = parsed["evaluated_at"]
    if not isinstance(evaluated_at, datetime):
        raise RuntimeEvidenceError("readiness evaluated_at type is invalid")
    if evaluated_at > measured_at + timedelta(minutes=5):
        reasons.append("READINESS_FROM_FUTURE")
    if measured_at - evaluated_at > timedelta(hours=maximum_age_hours):
        reasons.append("READINESS_STALE")
    if parsed["simulated"] is not False:
        reasons.append("READINESS_SIMULATED")
    return parsed, reasons


def _parse_bundle_models(
    value: object,
    profiles: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    items = _array(value, "bundle_finalization.models")
    if len(items) != len(profiles):
        raise RuntimeEvidenceError("bundle finalization must contain exactly two models")
    expected = {str(profile["model_key"]): profile for profile in profiles}
    parsed: list[dict[str, Any]] = []
    reasons: list[str] = []
    seen: set[str] = set()
    for index, raw_item in enumerate(items):
        name = f"bundle_finalization.models[{index}]"
        item = _object(raw_item, name)
        _require_keys(
            item,
            {
                "model_key",
                "role",
                "model_id",
                "revision",
                "archive_sha256",
                "version_id",
                "immutable_locator",
                "verification_status",
                "verification_report_sha256",
                "artifact_path",
                "artifact_sha256",
            },
            name,
        )
        model_key = _identity(item["model_key"], f"{name}.model_key")
        if model_key in seen:
            raise RuntimeEvidenceError("bundle model keys must be unique")
        seen.add(model_key)
        profile = expected.get(model_key)
        if profile is None:
            raise RuntimeEvidenceError(f"unexpected bundle model: {model_key}")
        archive_sha = _sha256(item["archive_sha256"], f"{name}.archive_sha256")
        version_id = _text(item["version_id"], f"{name}.version_id")
        locator = _text(item["immutable_locator"], f"{name}.immutable_locator")
        parsed_item = {
            "model_key": model_key,
            "role": _text(item["role"], f"{name}.role"),
            "model_id": _identity(item["model_id"], f"{name}.model_id"),
            "revision": _commit(item["revision"], f"{name}.revision"),
            "archive_sha256": archive_sha,
            "version_id": version_id,
            "immutable_locator": locator,
            "verification_status": _text(
                item["verification_status"], f"{name}.verification_status"
            ),
            "verification_report_sha256": _sha256(
                item["verification_report_sha256"],
                f"{name}.verification_report_sha256",
            ),
            "artifact_path": _relative_path(
                item["artifact_path"], f"{name}.artifact_path"
            ),
            "artifact_sha256": _sha256(
                item["artifact_sha256"], f"{name}.artifact_sha256"
            ),
        }
        for key in ("role", "model_id", "revision", "artifact_path"):
            if parsed_item[key] != profile[key]:
                reasons.append(f"BUNDLE_MODEL_BINDING_MISMATCH:{model_key}:{key}")
        if parsed_item["verification_status"] != "VERIFIED":
            reasons.append(f"BUNDLE_NOT_VERIFIED:{model_key}")
        if (
            not locator.startswith("s3+version://")
            or "versionId=" not in locator
            or f"#sha256={archive_sha}" not in locator
        ):
            reasons.append(f"BUNDLE_LOCATOR_NOT_IMMUTABLE:{model_key}")
        parsed.append(parsed_item)
    if set(seen) != set(expected):
        raise RuntimeEvidenceError("bundle model coverage is incomplete")
    return parsed, reasons


def _parse_bundle_finalization(
    value: object,
    profiles: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[str]]:
    item = _object(value, "bundle_finalization")
    _require_keys(
        item,
        {"schema_version", "status", "report_sha256", "models"},
        "bundle_finalization",
    )
    models, reasons = _parse_bundle_models(item["models"], profiles)
    parsed = {
        "schema_version": _text(
            item["schema_version"], "bundle_finalization.schema_version"
        ),
        "status": _text(item["status"], "bundle_finalization.status"),
        "report_sha256": _sha256(
            item["report_sha256"], "bundle_finalization.report_sha256"
        ),
        "models": models,
    }
    if parsed["schema_version"] != "tai.model-bundle-finalization-report.v1":
        reasons.append("BUNDLE_FINALIZATION_SCHEMA_MISMATCH")
    if parsed["status"] != "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED":
        reasons.append("BUNDLE_FINALIZATION_NOT_ACCEPTED")
    return parsed, reasons


def _parse_corpus(
    value: object,
    authority: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    item = _object(value, "corpus")
    _require_keys(
        item,
        {
            "suite_id",
            "status",
            "accepted",
            "assessment_sha256",
            "corpus_sha256",
            "total_cases",
            "critical_cases",
            "locales",
            "unreviewed_cases",
            "case_manifest_path",
            "raw_observation_count",
        },
        "corpus",
    )
    parsed = {
        "suite_id": _identity(item["suite_id"], "corpus.suite_id"),
        "status": _text(item["status"], "corpus.status"),
        "accepted": _boolean(item["accepted"], "corpus.accepted"),
        "assessment_sha256": _sha256(
            item["assessment_sha256"], "corpus.assessment_sha256"
        ),
        "corpus_sha256": _sha256(item["corpus_sha256"], "corpus.corpus_sha256"),
        "total_cases": _integer(item["total_cases"], "corpus.total_cases", minimum=1),
        "critical_cases": _integer(
            item["critical_cases"], "corpus.critical_cases", minimum=1
        ),
        "locales": _string_array(item["locales"], "corpus.locales"),
        "unreviewed_cases": _integer(
            item["unreviewed_cases"], "corpus.unreviewed_cases"
        ),
        "case_manifest_path": _relative_path(
            item["case_manifest_path"], "corpus.case_manifest_path"
        ),
        "raw_observation_count": _integer(
            item["raw_observation_count"],
            "corpus.raw_observation_count",
            minimum=1,
        ),
    }
    plan = authority["corpus"]
    reasons: list[str] = []
    comparisons = {
        "suite_id": plan["suite_id"],
        "status": plan["required_status"],
        "accepted": plan["required_accepted"],
        "total_cases": plan["required_total_cases"],
        "critical_cases": plan["required_critical_cases"],
        "locales": plan["required_locales"],
        "unreviewed_cases": plan["maximum_unreviewed_cases"],
        "raw_observation_count": plan["required_raw_observations_total"],
    }
    for key, expected in comparisons.items():
        if parsed[key] != expected:
            reasons.append(f"CORPUS_{key.upper()}_MISMATCH")
    return parsed, reasons


def _parse_concurrency(
    value: object,
    *,
    name: str,
    required_levels: list[int],
    thresholds: dict[str, int],
) -> tuple[list[dict[str, int]], list[str]]:
    entries = _array(value, name)
    parsed: list[dict[str, int]] = []
    levels: list[int] = []
    reasons: list[str] = []
    for index, raw_entry in enumerate(entries):
        entry_name = f"{name}[{index}]"
        entry = _object(raw_entry, entry_name)
        _require_keys(
            entry,
            {
                "level",
                "request_count",
                "failed_requests",
                "error_rate_basis_points",
                "p95_latency_ms",
                "generation_tokens_per_second_milli",
            },
            entry_name,
        )
        parsed_entry = {
            "level": _integer(entry["level"], f"{entry_name}.level", minimum=1),
            "request_count": _integer(
                entry["request_count"], f"{entry_name}.request_count", minimum=1
            ),
            "failed_requests": _integer(
                entry["failed_requests"], f"{entry_name}.failed_requests"
            ),
            "error_rate_basis_points": _integer(
                entry["error_rate_basis_points"],
                f"{entry_name}.error_rate_basis_points",
                maximum=10_000,
            ),
            "p95_latency_ms": _integer(
                entry["p95_latency_ms"], f"{entry_name}.p95_latency_ms", minimum=1
            ),
            "generation_tokens_per_second_milli": _integer(
                entry["generation_tokens_per_second_milli"],
                f"{entry_name}.generation_tokens_per_second_milli",
                minimum=1,
            ),
        }
        levels.append(parsed_entry["level"])
        if parsed_entry["request_count"] < thresholds["minimum_sample_count"]:
            reasons.append(
                f"CONCURRENCY_SAMPLE_COUNT_BELOW_MINIMUM:{parsed_entry['level']}"
            )
        if (
            parsed_entry["error_rate_basis_points"]
            > thresholds["maximum_error_rate_basis_points"]
        ):
            reasons.append(f"CONCURRENCY_ERROR_RATE_EXCEEDED:{parsed_entry['level']}")
        if parsed_entry["p95_latency_ms"] > thresholds["maximum_p95_latency_ms"]:
            reasons.append(f"CONCURRENCY_P95_EXCEEDED:{parsed_entry['level']}")
        if (
            parsed_entry["generation_tokens_per_second_milli"]
            < thresholds["minimum_generation_tokens_per_second_milli"]
        ):
            reasons.append(
                "CONCURRENCY_GENERATION_THROUGHPUT_BELOW_MINIMUM:"
                f"{parsed_entry['level']}"
            )
        if parsed_entry["failed_requests"] > parsed_entry["request_count"]:
            raise RuntimeEvidenceError(f"{entry_name} failed requests exceed total")
        parsed.append(parsed_entry)
    if levels != required_levels:
        reasons.append("CONCURRENCY_MATRIX_MISMATCH")
    return parsed, reasons


def _parse_runtime_profile(
    value: object,
    plan: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    name = f"runtime_profiles.{plan['profile_id']}"
    item = _object(value, name)
    _require_keys(
        item,
        {
            "profile_id",
            "role",
            "model_id",
            "revision",
            "runtime_class",
            "quantization",
            "artifact_sha256",
            "hardware_profile_id",
            "hardware_path",
            "environment_path",
            "benchmark_metrics_path",
            "request_metrics_path",
            "cost_inputs_path",
            "sample_count",
            "prompt_tokens_per_second_milli",
            "generation_tokens_per_second_milli",
            "p95_latency_ms",
            "p99_latency_ms",
            "error_rate_basis_points",
            "peak_ram_mb",
            "cold_start_ms",
            "warmup_ms",
            "concurrency",
        },
        name,
    )
    thresholds = plan["thresholds"]
    concurrency, reasons = _parse_concurrency(
        item["concurrency"],
        name=f"{name}.concurrency",
        required_levels=plan["required_concurrency_levels"],
        thresholds=thresholds,
    )
    parsed = {
        "profile_id": _identity(item["profile_id"], f"{name}.profile_id"),
        "role": _text(item["role"], f"{name}.role"),
        "model_id": _identity(item["model_id"], f"{name}.model_id"),
        "revision": _commit(item["revision"], f"{name}.revision"),
        "runtime_class": _text(item["runtime_class"], f"{name}.runtime_class"),
        "quantization": _identity(item["quantization"], f"{name}.quantization"),
        "artifact_sha256": _sha256(
            item["artifact_sha256"], f"{name}.artifact_sha256"
        ),
        "hardware_profile_id": _identity(
            item["hardware_profile_id"], f"{name}.hardware_profile_id"
        ),
        "hardware_path": _relative_path(
            item["hardware_path"], f"{name}.hardware_path"
        ),
        "environment_path": _relative_path(
            item["environment_path"], f"{name}.environment_path"
        ),
        "benchmark_metrics_path": _relative_path(
            item["benchmark_metrics_path"], f"{name}.benchmark_metrics_path"
        ),
        "request_metrics_path": _relative_path(
            item["request_metrics_path"], f"{name}.request_metrics_path"
        ),
        "cost_inputs_path": _relative_path(
            item["cost_inputs_path"], f"{name}.cost_inputs_path"
        ),
        "sample_count": _integer(
            item["sample_count"], f"{name}.sample_count", minimum=1
        ),
        "prompt_tokens_per_second_milli": _integer(
            item["prompt_tokens_per_second_milli"],
            f"{name}.prompt_tokens_per_second_milli",
            minimum=1,
        ),
        "generation_tokens_per_second_milli": _integer(
            item["generation_tokens_per_second_milli"],
            f"{name}.generation_tokens_per_second_milli",
            minimum=1,
        ),
        "p95_latency_ms": _integer(
            item["p95_latency_ms"], f"{name}.p95_latency_ms", minimum=1
        ),
        "p99_latency_ms": _integer(
            item["p99_latency_ms"], f"{name}.p99_latency_ms", minimum=1
        ),
        "error_rate_basis_points": _integer(
            item["error_rate_basis_points"],
            f"{name}.error_rate_basis_points",
            maximum=10_000,
        ),
        "peak_ram_mb": _integer(
            item["peak_ram_mb"], f"{name}.peak_ram_mb", minimum=1
        ),
        "cold_start_ms": _integer(
            item["cold_start_ms"], f"{name}.cold_start_ms", minimum=1
        ),
        "warmup_ms": _integer(item["warmup_ms"], f"{name}.warmup_ms", minimum=1),
        "concurrency": concurrency,
    }
    for key in (
        "profile_id",
        "role",
        "model_id",
        "revision",
        "runtime_class",
        "quantization",
    ):
        if parsed[key] != plan[key]:
            reasons.append(f"PROFILE_BINDING_MISMATCH:{plan['profile_id']}:{key}")
    checks = [
        (
            parsed["sample_count"] >= thresholds["minimum_sample_count"],
            "SAMPLE_COUNT_BELOW_MINIMUM",
        ),
        (
            parsed["prompt_tokens_per_second_milli"]
            >= thresholds["minimum_prompt_tokens_per_second_milli"],
            "PROMPT_THROUGHPUT_BELOW_MINIMUM",
        ),
        (
            parsed["generation_tokens_per_second_milli"]
            >= thresholds["minimum_generation_tokens_per_second_milli"],
            "GENERATION_THROUGHPUT_BELOW_MINIMUM",
        ),
        (
            parsed["p95_latency_ms"] <= thresholds["maximum_p95_latency_ms"],
            "P95_LATENCY_EXCEEDED",
        ),
        (
            parsed["p99_latency_ms"] <= thresholds["maximum_p99_latency_ms"],
            "P99_LATENCY_EXCEEDED",
        ),
        (
            parsed["error_rate_basis_points"]
            <= thresholds["maximum_error_rate_basis_points"],
            "ERROR_RATE_EXCEEDED",
        ),
        (
            parsed["peak_ram_mb"] <= thresholds["maximum_peak_ram_mb"],
            "PEAK_RAM_EXCEEDED",
        ),
        (
            parsed["cold_start_ms"] <= thresholds["maximum_cold_start_ms"],
            "COLD_START_EXCEEDED",
        ),
        (
            parsed["warmup_ms"] <= thresholds["maximum_warmup_ms"],
            "WARMUP_EXCEEDED",
        ),
    ]
    for passed, reason in checks:
        if not passed:
            reasons.append(f"{reason}:{plan['profile_id']}")
    if parsed["p99_latency_ms"] < parsed["p95_latency_ms"]:
        raise RuntimeEvidenceError(f"{name} p99 latency must be >= p95")
    return parsed, reasons


def _parse_profiles(
    value: object,
    plans: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[str]]:
    items = _array(value, "runtime_profiles")
    if len(items) != len(plans):
        raise RuntimeEvidenceError("runtime_profiles must contain exactly two profiles")
    by_id: dict[str, dict[str, Any]] = {}
    for index, raw_item in enumerate(items):
        item = _object(raw_item, f"runtime_profiles[{index}]")
        profile_id = _identity(
            item.get("profile_id"), f"runtime_profiles[{index}].profile_id"
        )
        if profile_id in by_id:
            raise RuntimeEvidenceError("runtime profile ids must be unique")
        by_id[profile_id] = item
    parsed: list[dict[str, Any]] = []
    reasons: list[str] = []
    for plan in plans:
        profile_id = str(plan["profile_id"])
        raw_profile = by_id.get(profile_id)
        if raw_profile is None:
            raise RuntimeEvidenceError(f"runtime profile missing: {profile_id}")
        value_parsed, profile_reasons = _parse_runtime_profile(raw_profile, plan)
        parsed.append(value_parsed)
        reasons.extend(profile_reasons)
    if set(by_id) != {str(plan["profile_id"]) for plan in plans}:
        raise RuntimeEvidenceError("unexpected runtime profile")
    return parsed, reasons


def _validate_case_manifest(
    value: dict[str, Any],
    corpus: dict[str, Any],
    authority: dict[str, Any],
) -> tuple[dict[str, dict[str, str]], list[str]]:
    _require_keys(
        value,
        {
            "schema_version",
            "suite_id",
            "assessment_sha256",
            "corpus_sha256",
            "locales",
            "cases",
        },
        "case manifest",
    )
    reasons: list[str] = []
    if value["schema_version"] != "tai.runtime-corpus-manifest.v1":
        reasons.append("CASE_MANIFEST_SCHEMA_MISMATCH")
    if value["suite_id"] != corpus["suite_id"]:
        reasons.append("CASE_MANIFEST_SUITE_MISMATCH")
    if value["assessment_sha256"] != corpus["assessment_sha256"]:
        reasons.append("CASE_MANIFEST_ASSESSMENT_MISMATCH")
    if value["corpus_sha256"] != corpus["corpus_sha256"]:
        reasons.append("CASE_MANIFEST_CORPUS_MISMATCH")
    locales = _string_array(value["locales"], "case manifest.locales")
    if locales != authority["corpus"]["required_locales"]:
        reasons.append("CASE_MANIFEST_LOCALES_MISMATCH")
    cases = _array(value["cases"], "case manifest.cases")
    prompts: dict[str, dict[str, str]] = {}
    critical_count = 0
    for index, raw_case in enumerate(cases):
        name = f"case manifest.cases[{index}]"
        case = _object(raw_case, name)
        _require_keys(case, {"case_id", "critical", "prompt_sha256_by_locale"}, name)
        case_id = _identity(case["case_id"], f"{name}.case_id")
        if case_id in prompts:
            raise RuntimeEvidenceError("case manifest ids must be unique")
        critical = _boolean(case["critical"], f"{name}.critical")
        if critical:
            critical_count += 1
        prompt_map = _object(
            case["prompt_sha256_by_locale"], f"{name}.prompt_sha256_by_locale"
        )
        _require_keys(
            prompt_map,
            set(authority["corpus"]["required_locales"]),
            f"{name}.prompt_sha256_by_locale",
        )
        prompts[case_id] = {
            locale: _sha256(
                prompt_map[locale],
                f"{name}.prompt_sha256_by_locale.{locale}",
            )
            for locale in authority["corpus"]["required_locales"]
        }
    if len(prompts) != authority["corpus"]["required_total_cases"]:
        reasons.append("CASE_MANIFEST_TOTAL_CASES_MISMATCH")
    if critical_count != authority["corpus"]["required_critical_cases"]:
        reasons.append("CASE_MANIFEST_CRITICAL_CASES_MISMATCH")
    return prompts, reasons


def _validate_raw_observations(
    value: dict[str, Any],
    prompts: dict[str, dict[str, str]],
    corpus: dict[str, Any],
    profiles: list[dict[str, Any]],
    authority: dict[str, Any],
) -> tuple[int, list[str]]:
    _require_keys(
        value,
        {"schema_version", "suite_id", "profile_ids", "entries"},
        "raw observations manifest",
    )
    reasons: list[str] = []
    if value["schema_version"] != "tai.raw-model-observations.v1":
        reasons.append("RAW_OBSERVATIONS_SCHEMA_MISMATCH")
    if value["suite_id"] != corpus["suite_id"]:
        reasons.append("RAW_OBSERVATIONS_SUITE_MISMATCH")
    profile_ids = _string_array(
        value["profile_ids"], "raw observations manifest.profile_ids"
    )
    expected_profiles = [str(profile["profile_id"]) for profile in profiles]
    if profile_ids != expected_profiles:
        reasons.append("RAW_OBSERVATIONS_PROFILE_SET_MISMATCH")
    entries = _array(value["entries"], "raw observations manifest.entries")
    seen: set[tuple[str, str, str]] = set()
    counts = {profile_id: 0 for profile_id in expected_profiles}
    for index, raw_entry in enumerate(entries):
        name = f"raw observations manifest.entries[{index}]"
        entry = _object(raw_entry, name)
        _require_keys(
            entry,
            {
                "case_id",
                "locale",
                "profile_id",
                "request_id",
                "prompt_sha256",
                "response_sha256",
                "status",
                "started_at",
                "completed_at",
                "trace_sha256",
            },
            name,
        )
        case_id = _identity(entry["case_id"], f"{name}.case_id")
        locale = _text(entry["locale"], f"{name}.locale")
        profile_id = _identity(entry["profile_id"], f"{name}.profile_id")
        key = (case_id, locale, profile_id)
        if key in seen:
            raise RuntimeEvidenceError(f"duplicate raw observation: {key!r}")
        seen.add(key)
        if case_id not in prompts:
            reasons.append(f"RAW_OBSERVATION_UNKNOWN_CASE:{case_id}")
            continue
        if locale not in authority["corpus"]["required_locales"]:
            reasons.append(f"RAW_OBSERVATION_UNKNOWN_LOCALE:{locale}")
            continue
        if profile_id not in counts:
            reasons.append(f"RAW_OBSERVATION_UNKNOWN_PROFILE:{profile_id}")
            continue
        counts[profile_id] += 1
        prompt_sha = _sha256(entry["prompt_sha256"], f"{name}.prompt_sha256")
        if prompt_sha != prompts[case_id][locale]:
            reasons.append(
                f"RAW_OBSERVATION_PROMPT_DIGEST_MISMATCH:{case_id}:{locale}:{profile_id}"
            )
        _sha256(entry["response_sha256"], f"{name}.response_sha256")
        _identity(entry["request_id"], f"{name}.request_id")
        status = _text(entry["status"], f"{name}.status")
        if status not in _ALLOWED_TERMINAL_STATUSES:
            reasons.append(f"RAW_OBSERVATION_STATUS_INVALID:{status}")
        started = _timestamp(entry["started_at"], f"{name}.started_at")
        completed = _timestamp(entry["completed_at"], f"{name}.completed_at")
        if completed < started:
            reasons.append(
                f"RAW_OBSERVATION_TIME_INVALID:{case_id}:{locale}:{profile_id}"
            )
        _sha256(entry["trace_sha256"], f"{name}.trace_sha256")
    expected_keys = {
        (case_id, locale, profile_id)
        for case_id in prompts
        for locale in authority["corpus"]["required_locales"]
        for profile_id in expected_profiles
    }
    missing = expected_keys - seen
    unexpected = seen - expected_keys
    if missing:
        reasons.append(f"RAW_OBSERVATION_COVERAGE_MISSING:{len(missing)}")
    if unexpected:
        reasons.append(f"RAW_OBSERVATION_COVERAGE_UNEXPECTED:{len(unexpected)}")
    for profile_id, count in counts.items():
        if count != authority["corpus"]["required_raw_observations_per_profile"]:
            reasons.append(f"RAW_OBSERVATION_PROFILE_COUNT_MISMATCH:{profile_id}")
    if len(entries) != authority["corpus"]["required_raw_observations_total"]:
        reasons.append("RAW_OBSERVATION_TOTAL_COUNT_MISMATCH")
    return len(entries), reasons


def _validate_raw_payload(
    value: dict[str, Any],
    raw_manifest: dict[str, Any],
) -> list[str]:
    _require_keys(
        value,
        {"schema_version", "suite_id", "entries"},
        "raw observations payload",
    )
    reasons: list[str] = []
    if value["schema_version"] != "tai.raw-model-observation-payload.v1":
        reasons.append("RAW_PAYLOAD_SCHEMA_MISMATCH")
    if value["suite_id"] != raw_manifest["suite_id"]:
        reasons.append("RAW_PAYLOAD_SUITE_MISMATCH")
    raw_entries = _array(raw_manifest["entries"], "raw observations manifest.entries")
    manifest_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    for index, raw_entry in enumerate(raw_entries):
        entry = _object(raw_entry, f"raw observations manifest.entries[{index}]")
        key = (
            _identity(entry["case_id"], f"raw manifest entries[{index}].case_id"),
            _text(entry["locale"], f"raw manifest entries[{index}].locale"),
            _identity(entry["profile_id"], f"raw manifest entries[{index}].profile_id"),
        )
        manifest_by_key[key] = entry

    payload_entries = _array(value["entries"], "raw observations payload.entries")
    seen: set[tuple[str, str, str]] = set()
    for index, raw_entry in enumerate(payload_entries):
        name = f"raw observations payload.entries[{index}]"
        entry = _object(raw_entry, name)
        _require_keys(
            entry,
            {
                "case_id",
                "locale",
                "profile_id",
                "request_id",
                "prompt",
                "response",
                "status",
                "started_at",
                "completed_at",
                "trace_sha256",
            },
            name,
        )
        case_id = _identity(entry["case_id"], f"{name}.case_id")
        locale = _text(entry["locale"], f"{name}.locale")
        profile_id = _identity(entry["profile_id"], f"{name}.profile_id")
        key = (case_id, locale, profile_id)
        if key in seen:
            raise RuntimeEvidenceError(f"duplicate raw payload observation: {key!r}")
        seen.add(key)
        manifest_entry = manifest_by_key.get(key)
        if manifest_entry is None:
            reasons.append(f"RAW_PAYLOAD_ENTRY_UNDECLARED:{case_id}:{locale}:{profile_id}")
            continue
        prompt = _text(entry["prompt"], f"{name}.prompt")
        response = entry["response"]
        if not isinstance(response, str):
            raise RuntimeEvidenceError(f"{name}.response must be a string")
        if len(prompt) > 10_000:
            reasons.append(f"RAW_PAYLOAD_PROMPT_TOO_LARGE:{case_id}:{locale}:{profile_id}")
        if len(response) > 200_000:
            reasons.append(f"RAW_PAYLOAD_RESPONSE_TOO_LARGE:{case_id}:{locale}:{profile_id}")
        if hashlib.sha256(prompt.encode("utf-8")).hexdigest() != manifest_entry["prompt_sha256"]:
            reasons.append(
                f"RAW_PAYLOAD_PROMPT_DIGEST_MISMATCH:{case_id}:{locale}:{profile_id}"
            )
        response_sha256 = hashlib.sha256(response.encode("utf-8")).hexdigest()
        if response_sha256 != manifest_entry["response_sha256"]:
            reasons.append(
                f"RAW_PAYLOAD_RESPONSE_DIGEST_MISMATCH:{case_id}:{locale}:{profile_id}"
            )
        for field in (
            "request_id",
            "status",
            "started_at",
            "completed_at",
            "trace_sha256",
        ):
            if entry[field] != manifest_entry[field]:
                reasons.append(
                    f"RAW_PAYLOAD_METADATA_MISMATCH:{case_id}:{locale}:{profile_id}:{field}"
                )
    missing = set(manifest_by_key) - seen
    unexpected = seen - set(manifest_by_key)
    if missing:
        reasons.append(f"RAW_PAYLOAD_COVERAGE_MISSING:{len(missing)}")
    if unexpected:
        reasons.append(f"RAW_PAYLOAD_COVERAGE_UNEXPECTED:{len(unexpected)}")
    return reasons


def _validate_profile_semantics(
    original_root: Path,
    records: dict[str, dict[str, Any]],
    profile: dict[str, Any],
) -> list[str]:
    reasons: list[str] = []
    profile_id = str(profile["profile_id"])

    hardware = _load_semantic(
        original_root,
        records,
        str(profile["hardware_path"]),
        f"{profile_id}.hardware",
    )
    _require_keys(
        hardware,
        {
            "schema_version",
            "hardware_profile_id",
            "captured_at",
            "cpu_model",
            "logical_cpus",
            "ram_mb",
            "hostname_sha256",
            "host_role",
            "user",
        },
        f"{profile_id}.hardware",
    )
    if hardware["schema_version"] != "tai.cpu-hardware-observation.v1":
        reasons.append(f"HARDWARE_SCHEMA_MISMATCH:{profile_id}")
    if hardware["hardware_profile_id"] != profile["hardware_profile_id"]:
        reasons.append(f"HARDWARE_PROFILE_MISMATCH:{profile_id}")
    _timestamp(hardware["captured_at"], f"{profile_id}.hardware.captured_at")
    _text(hardware["cpu_model"], f"{profile_id}.hardware.cpu_model")
    _integer(hardware["logical_cpus"], f"{profile_id}.hardware.logical_cpus", minimum=1)
    _integer(hardware["ram_mb"], f"{profile_id}.hardware.ram_mb", minimum=1)
    _sha256(hardware["hostname_sha256"], f"{profile_id}.hardware.hostname_sha256")
    if hardware["host_role"] != "DEDICATED_MODEL_HOST":
        reasons.append(f"HARDWARE_HOST_ROLE_INVALID:{profile_id}")
    if hardware["user"] != "tai-model":
        reasons.append(f"HARDWARE_USER_INVALID:{profile_id}")

    environment = _load_semantic(
        original_root,
        records,
        str(profile["environment_path"]),
        f"{profile_id}.environment",
    )
    _require_keys(
        environment,
        {
            "schema_version",
            "profile_id",
            "model_id",
            "revision",
            "runtime_class",
            "quantization",
            "artifact_sha256",
            "toolchain_commit",
            "loopback_only",
            "captured_at",
        },
        f"{profile_id}.environment",
    )
    if environment["schema_version"] != "tai.cpu-runtime-environment.v1":
        reasons.append(f"ENVIRONMENT_SCHEMA_MISMATCH:{profile_id}")
    expected_environment = {
        "profile_id": profile["profile_id"],
        "model_id": profile["model_id"],
        "revision": profile["revision"],
        "runtime_class": profile["runtime_class"],
        "quantization": profile["quantization"],
        "artifact_sha256": profile["artifact_sha256"],
        "toolchain_commit": _TOOLCHAIN_COMMIT,
        "loopback_only": True,
    }
    for key, expected in expected_environment.items():
        if environment.get(key) != expected:
            reasons.append(f"ENVIRONMENT_BINDING_MISMATCH:{profile_id}:{key}")
    _timestamp(environment["captured_at"], f"{profile_id}.environment.captured_at")

    metrics_paths = {
        "benchmark_metrics_path": "tai.llama-bench-metrics.v1",
        "request_metrics_path": "tai.cpu-request-metrics.v1",
    }
    metric_fields = {
        "sample_count",
        "prompt_tokens_per_second_milli",
        "generation_tokens_per_second_milli",
        "p95_latency_ms",
        "p99_latency_ms",
        "error_rate_basis_points",
        "peak_ram_mb",
        "cold_start_ms",
        "warmup_ms",
        "concurrency",
    }
    for path_key, schema in metrics_paths.items():
        metrics = _load_semantic(
            original_root,
            records,
            str(profile[path_key]),
            f"{profile_id}.{path_key}",
        )
        _require_keys(
            metrics,
            {"schema_version", "profile_id", *metric_fields},
            f"{profile_id}.{path_key}",
        )
        if metrics["schema_version"] != schema:
            reasons.append(f"METRICS_SCHEMA_MISMATCH:{profile_id}:{path_key}")
        if metrics["profile_id"] != profile_id:
            reasons.append(f"METRICS_PROFILE_MISMATCH:{profile_id}:{path_key}")
        for field in metric_fields:
            if metrics[field] != profile[field]:
                reasons.append(
                    f"METRICS_SEMANTIC_MISMATCH:{profile_id}:{path_key}:{field}"
                )

    cost = _load_semantic(
        original_root,
        records,
        str(profile["cost_inputs_path"]),
        f"{profile_id}.cost",
    )
    _require_keys(
        cost,
        {
            "schema_version",
            "profile_id",
            "currency",
            "host_cost_rub_monthly_milli",
            "power_watts_milli",
            "utilization_basis_points",
            "token_basis",
            "measured_at",
        },
        f"{profile_id}.cost",
    )
    if cost["schema_version"] != "tai.cpu-operating-cost-inputs.v1":
        reasons.append(f"COST_SCHEMA_MISMATCH:{profile_id}")
    if cost["profile_id"] != profile_id or cost["currency"] != "RUB":
        reasons.append(f"COST_BINDING_MISMATCH:{profile_id}")
    _integer(
        cost["host_cost_rub_monthly_milli"],
        f"{profile_id}.cost.host_cost_rub_monthly_milli",
    )
    _integer(
        cost["power_watts_milli"],
        f"{profile_id}.cost.power_watts_milli",
        minimum=1,
    )
    _integer(
        cost["utilization_basis_points"],
        f"{profile_id}.cost.utilization_basis_points",
        minimum=1,
        maximum=10_000,
    )
    _integer(cost["token_basis"], f"{profile_id}.cost.token_basis", minimum=1)
    _timestamp(cost["measured_at"], f"{profile_id}.cost.measured_at")
    return reasons


def _parse_fallback(
    value: object,
    authority: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    item = _object(value, "fallback_exercise")
    _require_keys(
        item,
        {
            "primary_profile_id",
            "fallback_profile_id",
            "forced_primary_failure",
            "trigger_count",
            "successful_transitions",
            "failed_transitions",
            "p95_takeover_ms",
            "continuity_violations",
            "raw_metrics_path",
            "protocol_path",
        },
        "fallback_exercise",
    )
    parsed = {
        "primary_profile_id": _identity(
            item["primary_profile_id"], "fallback_exercise.primary_profile_id"
        ),
        "fallback_profile_id": _identity(
            item["fallback_profile_id"], "fallback_exercise.fallback_profile_id"
        ),
        "forced_primary_failure": _boolean(
            item["forced_primary_failure"], "fallback_exercise.forced_primary_failure"
        ),
        "trigger_count": _integer(
            item["trigger_count"], "fallback_exercise.trigger_count", minimum=1
        ),
        "successful_transitions": _integer(
            item["successful_transitions"],
            "fallback_exercise.successful_transitions",
        ),
        "failed_transitions": _integer(
            item["failed_transitions"], "fallback_exercise.failed_transitions"
        ),
        "p95_takeover_ms": _integer(
            item["p95_takeover_ms"], "fallback_exercise.p95_takeover_ms", minimum=1
        ),
        "continuity_violations": _integer(
            item["continuity_violations"],
            "fallback_exercise.continuity_violations",
        ),
        "raw_metrics_path": _relative_path(
            item["raw_metrics_path"], "fallback_exercise.raw_metrics_path"
        ),
        "protocol_path": _relative_path(
            item["protocol_path"], "fallback_exercise.protocol_path"
        ),
    }
    plan = authority["fallback"]
    reasons: list[str] = []
    if parsed["primary_profile_id"] != _EXPECTED_PROFILES[0]["profile_id"]:
        reasons.append("FALLBACK_PRIMARY_PROFILE_MISMATCH")
    if parsed["fallback_profile_id"] != _EXPECTED_PROFILES[1]["profile_id"]:
        reasons.append("FALLBACK_SECONDARY_PROFILE_MISMATCH")
    if parsed["forced_primary_failure"] is not plan["forced_primary_failure_required"]:
        reasons.append("FALLBACK_PRIMARY_FAILURE_NOT_FORCED")
    if parsed["trigger_count"] < plan["minimum_trigger_count"]:
        reasons.append("FALLBACK_TRIGGER_COUNT_BELOW_MINIMUM")
    if parsed["successful_transitions"] + parsed["failed_transitions"] != parsed["trigger_count"]:
        reasons.append("FALLBACK_TRANSITION_COUNT_MISMATCH")
    if parsed["failed_transitions"] > plan["maximum_failed_transitions"]:
        reasons.append("FALLBACK_FAILED_TRANSITIONS_PRESENT")
    if parsed["p95_takeover_ms"] > plan["maximum_p95_takeover_ms"]:
        reasons.append("FALLBACK_TAKEOVER_LATENCY_EXCEEDED")
    if parsed["continuity_violations"] > plan["maximum_continuity_violations"]:
        reasons.append("FALLBACK_CONTINUITY_VIOLATIONS_PRESENT")
    return parsed, reasons


def _parse_soak(
    value: object,
    authority: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    item = _object(value, "soak")
    _require_keys(
        item,
        {
            "profile_id",
            "duration_seconds",
            "request_count",
            "failed_requests",
            "critical_failures",
            "memory_start_mb",
            "memory_end_mb",
            "memory_peak_mb",
            "memory_drift_mb",
            "p95_latency_ms",
            "raw_metrics_path",
            "environment_path",
        },
        "soak",
    )
    parsed = {
        "profile_id": _identity(item["profile_id"], "soak.profile_id"),
        "duration_seconds": _integer(
            item["duration_seconds"], "soak.duration_seconds", minimum=1
        ),
        "request_count": _integer(
            item["request_count"], "soak.request_count", minimum=1
        ),
        "failed_requests": _integer(item["failed_requests"], "soak.failed_requests"),
        "critical_failures": _integer(
            item["critical_failures"], "soak.critical_failures"
        ),
        "memory_start_mb": _integer(
            item["memory_start_mb"], "soak.memory_start_mb", minimum=1
        ),
        "memory_end_mb": _integer(
            item["memory_end_mb"], "soak.memory_end_mb", minimum=1
        ),
        "memory_peak_mb": _integer(
            item["memory_peak_mb"], "soak.memory_peak_mb", minimum=1
        ),
        "memory_drift_mb": _integer(item["memory_drift_mb"], "soak.memory_drift_mb"),
        "p95_latency_ms": _integer(
            item["p95_latency_ms"], "soak.p95_latency_ms", minimum=1
        ),
        "raw_metrics_path": _relative_path(
            item["raw_metrics_path"], "soak.raw_metrics_path"
        ),
        "environment_path": _relative_path(
            item["environment_path"], "soak.environment_path"
        ),
    }
    plan = authority["soak"]
    reasons: list[str] = []
    if parsed["profile_id"] not in {
        profile["profile_id"] for profile in _EXPECTED_PROFILES
    }:
        reasons.append("SOAK_PROFILE_UNKNOWN")
    if parsed["duration_seconds"] < plan["minimum_duration_seconds"]:
        reasons.append("SOAK_DURATION_BELOW_MINIMUM")
    if parsed["request_count"] < plan["minimum_request_count"]:
        reasons.append("SOAK_REQUEST_COUNT_BELOW_MINIMUM")
    if parsed["failed_requests"] > plan["maximum_failed_requests"]:
        reasons.append("SOAK_FAILED_REQUESTS_EXCEEDED")
    if parsed["critical_failures"] > plan["maximum_critical_failures"]:
        reasons.append("SOAK_CRITICAL_FAILURES_PRESENT")
    if parsed["memory_drift_mb"] > plan["maximum_memory_drift_mb"]:
        reasons.append("SOAK_MEMORY_DRIFT_EXCEEDED")
    if parsed["failed_requests"] > parsed["request_count"]:
        raise RuntimeEvidenceError("soak failed_requests exceeds request_count")
    return parsed, reasons


def _validate_fallback_semantics(
    original_root: Path,
    records: dict[str, dict[str, Any]],
    fallback: dict[str, Any],
) -> list[str]:
    metrics = _load_semantic(
        original_root,
        records,
        str(fallback["raw_metrics_path"]),
        "fallback metrics",
    )
    _require_keys(
        metrics,
        {"schema_version", *fallback.keys() - {"raw_metrics_path", "protocol_path"}},
        "fallback metrics",
    )
    reasons: list[str] = []
    if metrics["schema_version"] != "tai.cpu-fallback-metrics.v1":
        reasons.append("FALLBACK_METRICS_SCHEMA_MISMATCH")
    for key, value in fallback.items():
        if key not in {"raw_metrics_path", "protocol_path"} and metrics[key] != value:
            reasons.append(f"FALLBACK_METRICS_SEMANTIC_MISMATCH:{key}")
    protocol_path = str(fallback["protocol_path"])
    if protocol_path not in records:
        raise RuntimeEvidenceError("fallback protocol is undeclared")
    return reasons


def _validate_soak_semantics(
    original_root: Path,
    records: dict[str, dict[str, Any]],
    soak: dict[str, Any],
) -> list[str]:
    metrics = _load_semantic(
        original_root,
        records,
        str(soak["raw_metrics_path"]),
        "soak metrics",
    )
    _require_keys(
        metrics,
        {"schema_version", *soak.keys() - {"raw_metrics_path", "environment_path"}},
        "soak metrics",
    )
    reasons: list[str] = []
    if metrics["schema_version"] != "tai.cpu-soak-metrics.v1":
        reasons.append("SOAK_METRICS_SCHEMA_MISMATCH")
    for key, value in soak.items():
        if key not in {"raw_metrics_path", "environment_path"} and metrics[key] != value:
            reasons.append(f"SOAK_METRICS_SEMANTIC_MISMATCH:{key}")
    if str(soak["environment_path"]) not in records:
        raise RuntimeEvidenceError("soak environment is undeclared")
    return reasons


def _parse_storage(
    value: object,
    authority: dict[str, Any],
    measured_at: datetime,
) -> tuple[dict[str, Any], list[str]]:
    item = _object(value, "storage")
    _require_keys(
        item,
        {
            "immutable_locator",
            "archive_sha256",
            "archive_size_bytes",
            "version_id",
            "uploaded_at",
            "retention_expires_at",
            "restored_at",
        },
        "storage",
    )
    archive_sha = _sha256(item["archive_sha256"], "storage.archive_sha256")
    locator = _text(item["immutable_locator"], "storage.immutable_locator")
    parsed = {
        "immutable_locator": locator,
        "archive_sha256": archive_sha,
        "archive_size_bytes": _integer(
            item["archive_size_bytes"], "storage.archive_size_bytes", minimum=1
        ),
        "version_id": _text(item["version_id"], "storage.version_id"),
        "uploaded_at": _timestamp(item["uploaded_at"], "storage.uploaded_at"),
        "retention_expires_at": _timestamp(
            item["retention_expires_at"], "storage.retention_expires_at"
        ),
        "restored_at": _timestamp(item["restored_at"], "storage.restored_at"),
    }
    reasons: list[str] = []
    if (
        not locator.startswith("s3+version://")
        or "versionId=" not in locator
        or f"#sha256={archive_sha}" not in locator
    ):
        reasons.append("RUNTIME_STORAGE_LOCATOR_NOT_IMMUTABLE")
    uploaded = parsed["uploaded_at"]
    restored = parsed["restored_at"]
    retention = parsed["retention_expires_at"]
    if not all(isinstance(item, datetime) for item in (uploaded, restored, retention)):
        raise RuntimeEvidenceError("storage timestamp type is invalid")
    if restored < uploaded:
        reasons.append("RUNTIME_STORAGE_RESTORE_PRECEDES_UPLOAD")
    if uploaded < measured_at - timedelta(minutes=5):
        reasons.append("RUNTIME_STORAGE_UPLOAD_PRECEDES_MEASUREMENT")
    minimum_retention = timedelta(
        days=int(authority["evidence"]["minimum_external_retention_days"])
    )
    if retention - uploaded < minimum_retention:
        reasons.append("RUNTIME_STORAGE_RETENTION_TOO_SHORT")
    return parsed, reasons


def verify_runtime_evidence(
    authority_path: Path,
    manifest_path: Path,
    original_root: Path,
    restored_root: Path,
) -> dict[str, object]:
    authority = load_authority(authority_path)
    manifest = load_json(manifest_path)
    expected_keys = {
        "schema_version",
        "lifecycle",
        "pending_reason",
        "exact_main",
        "readiness",
        "bundle_finalization",
        "corpus",
        "runtime_profiles",
        "fallback_exercise",
        "soak",
        "raw_observations",
        "evidence_files",
        "storage",
        "measured_at",
        "quality_scoring_status",
        "benchmark_status",
        "model_admission_status",
        "production_operational_status",
    }
    _require_keys(manifest, expected_keys, "runtime evidence manifest")
    if manifest["schema_version"] != "tai.cpu-runtime-evidence.v1":
        raise RuntimeEvidenceError("unsupported runtime evidence schema_version")
    maturity = {
        "quality_scoring_status": manifest["quality_scoring_status"],
        "benchmark_status": manifest["benchmark_status"],
        "model_admission_status": manifest["model_admission_status"],
        "production_operational_status": manifest["production_operational_status"],
    }
    if maturity != _EXPECTED_MATURITY:
        raise RuntimeEvidenceError("runtime evidence maturity boundary is invalid")

    lifecycle = _text(manifest["lifecycle"], "manifest.lifecycle")
    if lifecycle == "PENDING_RUNTIME_EXECUTION":
        reason = _text(manifest["pending_reason"], "manifest.pending_reason")
        pending_expected = {
            "exact_main": None,
            "readiness": None,
            "bundle_finalization": None,
            "corpus": None,
            "runtime_profiles": [],
            "fallback_exercise": None,
            "soak": None,
            "raw_observations": None,
            "evidence_files": [],
            "storage": None,
            "measured_at": None,
        }
        for key, expected in pending_expected.items():
            if manifest[key] != expected:
                raise RuntimeEvidenceError(
                    f"pending runtime manifest field must remain empty: {key}"
                )
        return _pending_report(authority, reason)
    if lifecycle != "COMPLETE":
        raise RuntimeEvidenceError("runtime evidence lifecycle is unsupported")
    if manifest["pending_reason"] is not None:
        raise RuntimeEvidenceError("complete runtime evidence cannot have pending_reason")

    exact_main = _commit(manifest["exact_main"], "manifest.exact_main")
    measured_at = _timestamp(manifest["measured_at"], "manifest.measured_at")
    reasons: list[str] = []

    _, readiness_reasons = _parse_readiness(
        manifest["readiness"],
        exact_main=exact_main,
        measured_at=measured_at,
        maximum_age_hours=int(authority["readiness"]["maximum_age_hours"]),
    )
    reasons.extend(readiness_reasons)

    bundles, bundle_reasons = _parse_bundle_finalization(
        manifest["bundle_finalization"],
        authority["runtime_profiles"],
    )
    reasons.extend(bundle_reasons)

    corpus, corpus_reasons = _parse_corpus(manifest["corpus"], authority)
    reasons.extend(corpus_reasons)

    profiles, profile_reasons = _parse_profiles(
        manifest["runtime_profiles"],
        authority["runtime_profiles"],
    )
    reasons.extend(profile_reasons)

    bundle_by_key = {str(item["model_key"]): item for item in bundles["models"]}
    plan_by_profile = {
        str(plan["profile_id"]): plan for plan in authority["runtime_profiles"]
    }
    for profile in profiles:
        plan = plan_by_profile[str(profile["profile_id"])]
        bundle = bundle_by_key[str(plan["model_key"])]
        if profile["artifact_sha256"] != bundle["artifact_sha256"]:
            reasons.append(f"PROFILE_ARTIFACT_MISMATCH:{profile['profile_id']}")

    fallback, fallback_reasons = _parse_fallback(
        manifest["fallback_exercise"], authority
    )
    reasons.extend(fallback_reasons)
    soak, soak_reasons = _parse_soak(manifest["soak"], authority)
    reasons.extend(soak_reasons)

    files = [
        _file_record(item, f"evidence_files[{index}]")
        for index, item in enumerate(
            _array(manifest["evidence_files"], "evidence_files")
        )
    ]
    records, file_reasons, total_size = _verify_declared_files(
        authority,
        files,
        original_root,
        restored_root,
    )
    reasons.extend(file_reasons)

    required_paths = set(authority["evidence"]["required_semantic_files"])
    required_paths.add(str(corpus["case_manifest_path"]))
    required_paths.add("raw-observations/manifest.json")
    required_paths.add("raw-observations/payload.json")
    required_paths.add(str(fallback["raw_metrics_path"]))
    required_paths.add(str(fallback["protocol_path"]))
    required_paths.add(str(soak["raw_metrics_path"]))
    required_paths.add(str(soak["environment_path"]))
    for profile in profiles:
        required_paths.update(
            {
                str(profile["hardware_path"]),
                str(profile["environment_path"]),
                str(profile["benchmark_metrics_path"]),
                str(profile["request_metrics_path"]),
                str(profile["cost_inputs_path"]),
            }
        )
    missing_required = sorted(required_paths - set(records))
    if missing_required:
        reasons.extend(f"REQUIRED_EVIDENCE_UNDECLARED:{path}" for path in missing_required)

    case_manifest = _load_semantic(
        original_root,
        records,
        str(corpus["case_manifest_path"]),
        "case manifest",
    )
    prompts, case_reasons = _validate_case_manifest(
        case_manifest,
        corpus,
        authority,
    )
    reasons.extend(case_reasons)

    raw_info = _object(manifest["raw_observations"], "raw_observations")
    _require_keys(
        raw_info,
        {"manifest_path", "payload_path", "observation_count"},
        "raw_observations",
    )
    raw_manifest_path = _relative_path(
        raw_info["manifest_path"], "raw_observations.manifest_path"
    )
    raw_payload_path = _relative_path(
        raw_info["payload_path"], "raw_observations.payload_path"
    )
    raw_count_declared = _integer(
        raw_info["observation_count"],
        "raw_observations.observation_count",
        minimum=1,
    )
    raw_manifest = _load_semantic(
        original_root,
        records,
        raw_manifest_path,
        "raw observations manifest",
    )
    raw_count, raw_reasons = _validate_raw_observations(
        raw_manifest,
        prompts,
        corpus,
        profiles,
        authority,
    )
    reasons.extend(raw_reasons)
    raw_payload = _load_semantic(
        original_root,
        records,
        raw_payload_path,
        "raw observations payload",
    )
    reasons.extend(_validate_raw_payload(raw_payload, raw_manifest))
    if raw_count_declared != raw_count:
        reasons.append("RAW_OBSERVATION_DECLARED_COUNT_MISMATCH")
    if raw_count_declared != corpus["raw_observation_count"]:
        reasons.append("RAW_OBSERVATION_CORPUS_COUNT_MISMATCH")

    for profile in profiles:
        reasons.extend(_validate_profile_semantics(original_root, records, profile))
    reasons.extend(_validate_fallback_semantics(original_root, records, fallback))
    reasons.extend(_validate_soak_semantics(original_root, records, soak))

    _, storage_reasons = _parse_storage(
        manifest["storage"],
        authority,
        measured_at,
    )
    reasons.extend(storage_reasons)

    unique_reasons = sorted(set(reasons))
    profile_status = {
        str(profile["profile_id"]): (
            "REJECTED"
            if any(str(profile["profile_id"]) in reason for reason in unique_reasons)
            else "MEASURED"
        )
        for profile in profiles
    }
    status = _VERIFIED_RUNTIME_STATUS if not unique_reasons else "REJECTED"
    report: dict[str, object] = {
        "schema_version": "tai.cpu-runtime-evidence-verification.v1",
        "status": status,
        "authority_sha256": authority["authority_sha256"],
        "manifest_sha256": canonical_sha256(manifest),
        "exact_main": exact_main,
        "runtime_profiles": profile_status,
        "raw_observation_count": raw_count,
        "evidence_file_count": len(files),
        "evidence_total_size_bytes": total_size,
        "reasons": unique_reasons,
        **_EXPECTED_MATURITY,
    }
    report["report_sha256"] = canonical_sha256(report)
    return report


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
