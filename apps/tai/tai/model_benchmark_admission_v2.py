from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_REVISION = re.compile(r"^[0-9a-f]{40}$")
_IDENTITY = re.compile(r"^[A-Za-z0-9._:/+-]{1,200}$")
_ALLOWED_RUNTIME_CLASSES = {"CPU", "GPU_SHARED", "GPU_DEDICATED"}
_ALLOWED_ROLES = {"PRIMARY", "FALLBACK"}
_ALLOWED_LIFECYCLES = {"PENDING_BENCHMARK", "COMPLETE"}
_ALLOWED_VERIFICATION_STATUSES = {"PENDING_BENCHMARK", "VERIFIED", "REJECTED"}
_ALLOWED_ADMISSION_STATUSES = {"PENDING_ADMISSION", "ADMITTED", "REJECTED"}


class DuplicateKeyError(ValueError):
    pass


class ContractError(ValueError):
    pass


def _no_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for key, value in pairs:
        if key in output:
            raise DuplicateKeyError(f"duplicate JSON key: {key}")
        output[key] = value
    return output


def load_json_strict(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_no_duplicates
        )
    except (OSError, json.JSONDecodeError, DuplicateKeyError) as exc:
        raise ContractError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ContractError(f"JSON root must be an object: {path}")
    return value


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _require_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    observed = set(value)
    missing = sorted(expected - observed)
    unknown = sorted(observed - expected)
    if missing or unknown:
        raise ContractError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def _string(value: Any, name: str, *, allow_blank: bool = False) -> str:
    if not isinstance(value, str):
        raise ContractError(f"{name} must be a string")
    if not allow_blank and not value.strip():
        raise ContractError(f"{name} must not be blank")
    return value


def _integer(
    value: Any, name: str, *, minimum: int = 0, maximum: int | None = None
) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ContractError(f"{name} must be an integer")
    if value < minimum:
        raise ContractError(f"{name} must be >= {minimum}")
    if maximum is not None and value > maximum:
        raise ContractError(f"{name} must be <= {maximum}")
    return value


def _boolean(value: Any, name: str) -> bool:
    if not isinstance(value, bool):
        raise ContractError(f"{name} must be a boolean")
    return value


def _sha256(value: Any, name: str) -> str:
    text = _string(value, name)
    if _SHA256.fullmatch(text) is None:
        raise ContractError(f"{name} must be a lowercase SHA-256")
    return text


def _revision(value: Any, name: str) -> str:
    text = _string(value, name)
    if _REVISION.fullmatch(text) is None:
        raise ContractError(f"{name} must be an exact 40-character revision")
    return text


def _identity(value: Any, name: str) -> str:
    text = _string(value, name)
    if _IDENTITY.fullmatch(text) is None:
        raise ContractError(f"{name} must be a portable bounded identity")
    return text


def _timestamp(value: Any, name: str) -> datetime:
    text = _string(value, name)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ContractError(f"{name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise ContractError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def _immutable_locator(value: Any, name: str) -> str:
    text = _string(value, name)
    valid = (
        text.startswith("file://")
        or (text.startswith("oci://") and "@sha256:" in text)
        or (text.startswith("https://") and "version=" in text)
        or (text.startswith("https://") and "sha256=" in text)
    )
    if not valid:
        raise ContractError(f"{name} must be immutable or digest-pinned")
    return text


def _relative_path(value: Any, name: str) -> str:
    text = _string(value, name)
    path = PurePosixPath(text)
    if path.is_absolute() or not path.parts or ".." in path.parts or "." in path.parts:
        raise ContractError(f"{name} must be a bounded relative POSIX path")
    if text.startswith("~") or "\\" in text:
        raise ContractError(f"{name} must not use home or backslash traversal")
    return text


def _list(value: Any, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise ContractError(f"{name} must be an array")
    return value


def _dict(value: Any, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ContractError(f"{name} must be an object")
    return value


def _parse_file(value: Any, name: str) -> dict[str, Any]:
    item = _dict(value, name)
    _require_keys(item, {"path", "sha256", "size_bytes"}, name)
    return {
        "path": _relative_path(item["path"], f"{name}.path"),
        "sha256": _sha256(item["sha256"], f"{name}.sha256"),
        "size_bytes": _integer(item["size_bytes"], f"{name}.size_bytes", minimum=1),
    }


def _parse_thresholds(value: Any, name: str) -> dict[str, int]:
    item = _dict(value, name)
    expected = {
        "minimum_sample_count",
        "minimum_prompt_tokens_per_second_milli",
        "minimum_generation_tokens_per_second_milli",
        "maximum_p95_latency_ms",
        "maximum_p99_latency_ms",
        "maximum_error_rate_basis_points",
        "maximum_peak_ram_mb",
        "maximum_peak_vram_mb",
        "maximum_cold_start_ms",
        "maximum_warmup_ms",
    }
    _require_keys(item, expected, name)
    result = {key: _integer(item[key], f"{name}.{key}", minimum=0) for key in expected}
    if result["minimum_sample_count"] < 1:
        raise ContractError(f"{name}.minimum_sample_count must be positive")
    if result["minimum_prompt_tokens_per_second_milli"] < 1:
        raise ContractError(
            f"{name}.minimum_prompt_tokens_per_second_milli must be positive"
        )
    if result["minimum_generation_tokens_per_second_milli"] < 1:
        raise ContractError(
            f"{name}.minimum_generation_tokens_per_second_milli must be positive"
        )
    if result["maximum_p95_latency_ms"] < 1 or result["maximum_p99_latency_ms"] < 1:
        raise ContractError(f"{name} latency limits must be positive")
    if result["maximum_p99_latency_ms"] < result["maximum_p95_latency_ms"]:
        raise ContractError(f"{name}.maximum_p99_latency_ms must be >= p95")
    if result["maximum_error_rate_basis_points"] > 10_000:
        raise ContractError(f"{name}.maximum_error_rate_basis_points must be <= 10000")
    return result


def load_authority(path: Path) -> dict[str, Any]:
    raw = load_json_strict(path)
    expected = {
        "schema_version",
        "issue",
        "bundle_authority_schema",
        "benchmark_maximum_age_days",
        "suite_policy",
        "runtime_profiles",
        "fallback_policy",
        "soak_policy",
        "evidence_limits",
        "maturity_boundary",
    }
    _require_keys(raw, expected, "benchmark authority")
    if raw["schema_version"] != "tai.model-benchmark-admission-authority.v2":
        raise ContractError("unsupported benchmark authority schema_version")
    if raw["bundle_authority_schema"] != "tai.model-bundle-authority.v2":
        raise ContractError("bundle authority schema binding mismatch")
    issue = _integer(raw["issue"], "benchmark authority.issue", minimum=1)
    maximum_age_days = _integer(
        raw["benchmark_maximum_age_days"],
        "benchmark authority.benchmark_maximum_age_days",
        minimum=1,
    )

    suite = _dict(raw["suite_policy"], "benchmark authority.suite_policy")
    _require_keys(
        suite,
        {
            "suite_id",
            "required_total_cases",
            "required_critical_cases",
            "minimum_platform_accuracy_basis_points",
            "minimum_agro_accuracy_basis_points",
            "maximum_critical_unsupported_facts",
            "maximum_critical_safety_failures",
            "maximum_critical_abstention_misses",
        },
        "benchmark authority.suite_policy",
    )
    suite_policy: dict[str, Any] = {
        "suite_id": _identity(suite["suite_id"], "suite_policy.suite_id"),
        "required_total_cases": _integer(
            suite["required_total_cases"],
            "suite_policy.required_total_cases",
            minimum=1,
        ),
        "required_critical_cases": _integer(
            suite["required_critical_cases"],
            "suite_policy.required_critical_cases",
            minimum=1,
        ),
        "minimum_platform_accuracy_basis_points": _integer(
            suite["minimum_platform_accuracy_basis_points"],
            "suite_policy.minimum_platform_accuracy_basis_points",
            minimum=0,
            maximum=10_000,
        ),
        "minimum_agro_accuracy_basis_points": _integer(
            suite["minimum_agro_accuracy_basis_points"],
            "suite_policy.minimum_agro_accuracy_basis_points",
            minimum=0,
            maximum=10_000,
        ),
        "maximum_critical_unsupported_facts": _integer(
            suite["maximum_critical_unsupported_facts"],
            "suite_policy.maximum_critical_unsupported_facts",
            minimum=0,
        ),
        "maximum_critical_safety_failures": _integer(
            suite["maximum_critical_safety_failures"],
            "suite_policy.maximum_critical_safety_failures",
            minimum=0,
        ),
        "maximum_critical_abstention_misses": _integer(
            suite["maximum_critical_abstention_misses"],
            "suite_policy.maximum_critical_abstention_misses",
            minimum=0,
        ),
    }
    if suite_policy["required_critical_cases"] > suite_policy["required_total_cases"]:
        raise ContractError("critical case count cannot exceed total case count")

    profiles: list[dict[str, Any]] = []
    identities: set[tuple[str, str, str]] = set()
    profile_ids: set[str] = set()
    for index, raw_profile in enumerate(
        _list(raw["runtime_profiles"], "benchmark authority.runtime_profiles")
    ):
        name = f"benchmark authority.runtime_profiles[{index}]"
        profile = _dict(raw_profile, name)
        _require_keys(
            profile,
            {
                "profile_id",
                "role",
                "model_id",
                "revision",
                "runtime_class",
                "quantization",
                "required_concurrency_levels",
                "thresholds",
            },
            name,
        )
        role = _string(profile["role"], f"{name}.role")
        runtime_class = _string(profile["runtime_class"], f"{name}.runtime_class")
        if role not in _ALLOWED_ROLES:
            raise ContractError(f"{name}.role is unsupported")
        if runtime_class not in _ALLOWED_RUNTIME_CLASSES:
            raise ContractError(f"{name}.runtime_class is unsupported")
        levels = [
            _integer(item, f"{name}.required_concurrency_levels", minimum=1)
            for item in _list(
                profile["required_concurrency_levels"],
                f"{name}.required_concurrency_levels",
            )
        ]
        if not levels or levels != sorted(set(levels)):
            raise ContractError(
                f"{name}.required_concurrency_levels must be non-empty sorted unique"
            )
        parsed: dict[str, Any] = {
            "profile_id": _identity(profile["profile_id"], f"{name}.profile_id"),
            "role": role,
            "model_id": _identity(profile["model_id"], f"{name}.model_id"),
            "revision": _revision(profile["revision"], f"{name}.revision"),
            "runtime_class": runtime_class,
            "quantization": _identity(profile["quantization"], f"{name}.quantization"),
            "required_concurrency_levels": levels,
            "thresholds": _parse_thresholds(
                profile["thresholds"], f"{name}.thresholds"
            ),
        }
        profile_id = str(parsed["profile_id"])
        identity = (
            str(parsed["model_id"]),
            str(parsed["runtime_class"]),
            str(parsed["quantization"]),
        )
        if profile_id in profile_ids or identity in identities:
            raise ContractError("runtime profile identities must be unique")
        profile_ids.add(profile_id)
        identities.add(identity)
        profiles.append(parsed)

    if sum(item["role"] == "PRIMARY" for item in profiles) < 2:
        raise ContractError("authority requires primary CPU and GPU profiles")
    if sum(item["role"] == "FALLBACK" for item in profiles) < 1:
        raise ContractError("authority requires a fallback profile")
    if not any(
        item["runtime_class"] == "CPU" and item["role"] == "PRIMARY"
        for item in profiles
    ):
        raise ContractError("authority requires a primary CPU profile")
    if not any(
        item["runtime_class"] in {"GPU_SHARED", "GPU_DEDICATED"}
        and item["role"] == "PRIMARY"
        for item in profiles
    ):
        raise ContractError("authority requires a primary GPU profile")

    fallback = _dict(raw["fallback_policy"], "benchmark authority.fallback_policy")
    _require_keys(
        fallback,
        {
            "minimum_trigger_count",
            "maximum_failed_transitions",
            "maximum_p95_takeover_ms",
            "maximum_continuity_violations",
            "maximum_critical_unsupported_facts",
        },
        "benchmark authority.fallback_policy",
    )
    fallback_policy = {
        "minimum_trigger_count": _integer(
            fallback["minimum_trigger_count"],
            "fallback_policy.minimum_trigger_count",
            minimum=1,
        ),
        "maximum_failed_transitions": _integer(
            fallback["maximum_failed_transitions"],
            "fallback_policy.maximum_failed_transitions",
            minimum=0,
        ),
        "maximum_p95_takeover_ms": _integer(
            fallback["maximum_p95_takeover_ms"],
            "fallback_policy.maximum_p95_takeover_ms",
            minimum=1,
        ),
        "maximum_continuity_violations": _integer(
            fallback["maximum_continuity_violations"],
            "fallback_policy.maximum_continuity_violations",
            minimum=0,
        ),
        "maximum_critical_unsupported_facts": _integer(
            fallback["maximum_critical_unsupported_facts"],
            "fallback_policy.maximum_critical_unsupported_facts",
            minimum=0,
        ),
    }

    soak = _dict(raw["soak_policy"], "benchmark authority.soak_policy")
    _require_keys(
        soak,
        {
            "minimum_duration_seconds",
            "minimum_request_count",
            "maximum_failed_requests",
            "maximum_critical_failures",
            "maximum_memory_drift_mb",
        },
        "benchmark authority.soak_policy",
    )
    soak_policy = {
        "minimum_duration_seconds": _integer(
            soak["minimum_duration_seconds"],
            "soak_policy.minimum_duration_seconds",
            minimum=1,
        ),
        "minimum_request_count": _integer(
            soak["minimum_request_count"],
            "soak_policy.minimum_request_count",
            minimum=1,
        ),
        "maximum_failed_requests": _integer(
            soak["maximum_failed_requests"],
            "soak_policy.maximum_failed_requests",
            minimum=0,
        ),
        "maximum_critical_failures": _integer(
            soak["maximum_critical_failures"],
            "soak_policy.maximum_critical_failures",
            minimum=0,
        ),
        "maximum_memory_drift_mb": _integer(
            soak["maximum_memory_drift_mb"],
            "soak_policy.maximum_memory_drift_mb",
            minimum=0,
        ),
    }

    limits = _dict(raw["evidence_limits"], "benchmark authority.evidence_limits")
    _require_keys(
        limits,
        {"maximum_file_count", "maximum_file_size_bytes", "maximum_total_size_bytes"},
        "benchmark authority.evidence_limits",
    )
    evidence_limits = {
        "maximum_file_count": _integer(
            limits["maximum_file_count"],
            "evidence_limits.maximum_file_count",
            minimum=1,
        ),
        "maximum_file_size_bytes": _integer(
            limits["maximum_file_size_bytes"],
            "evidence_limits.maximum_file_size_bytes",
            minimum=1,
        ),
        "maximum_total_size_bytes": _integer(
            limits["maximum_total_size_bytes"],
            "evidence_limits.maximum_total_size_bytes",
            minimum=1,
        ),
    }

    maturity = _dict(raw["maturity_boundary"], "benchmark authority.maturity_boundary")
    _require_keys(
        maturity,
        {
            "model_bundles",
            "benchmarks",
            "model_admission",
            "production_operational_status",
        },
        "benchmark authority.maturity_boundary",
    )
    expected_maturity = {
        "model_bundles": "PENDING_VERIFIED_BUNDLES",
        "benchmarks": "PENDING_BENCHMARK",
        "model_admission": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    if maturity != expected_maturity:
        raise ContractError("benchmark authority maturity boundary is invalid")

    authority_value: dict[str, Any] = {
        "schema_version": raw["schema_version"],
        "issue": issue,
        "bundle_authority_schema": raw["bundle_authority_schema"],
        "benchmark_maximum_age_days": maximum_age_days,
        "suite_policy": suite_policy,
        "runtime_profiles": profiles,
        "fallback_policy": fallback_policy,
        "soak_policy": soak_policy,
        "evidence_limits": evidence_limits,
        "maturity_boundary": maturity,
    }
    authority_value["authority_sha256"] = canonical_sha256(authority_value)
    return authority_value


def _load_bundle_authority(path: Path) -> tuple[dict[str, Any], str]:
    value = load_json_strict(path)
    if value.get("schema_version") != "tai.model-bundle-authority.v2":
        raise ContractError("unsupported model bundle authority")
    models = _list(value.get("models"), "model bundle authority.models")
    if not models:
        raise ContractError("model bundle authority must contain models")
    return value, canonical_sha256(value)


def _bundle_plan(
    bundle_authority: dict[str, Any], model_id: str, revision: str
) -> dict[str, Any]:
    matches = [
        item
        for item in _list(bundle_authority["models"], "model bundle authority.models")
        if isinstance(item, dict)
        and item.get("model_id") == model_id
        and item.get("revision") == revision
    ]
    if len(matches) != 1:
        raise ContractError("benchmark model is not uniquely bound to bundle authority")
    return matches[0]


def _parse_bundle_binding(
    value: Any,
    name: str,
    *,
    expected_authority_sha256: str,
    bundle_plan: dict[str, Any],
) -> dict[str, Any]:
    item = _dict(value, name)
    _require_keys(
        item,
        {
            "authority_sha256",
            "manifest_sha256",
            "verification_report_sha256",
            "verification_status",
            "archive_sha256",
            "immutable_locator",
            "artifacts",
        },
        name,
    )
    if (
        _sha256(item["authority_sha256"], f"{name}.authority_sha256")
        != expected_authority_sha256
    ):
        raise ContractError("bundle authority digest mismatch")
    if item["verification_status"] != "VERIFIED":
        raise ContractError("model bundle verification_status must be VERIFIED")
    artifacts: list[dict[str, Any]] = []
    observed: set[tuple[str, str]] = set()
    allowed = {
        (entry["runtime_class"], entry["quantization"]): entry["output_path"]
        for entry in _list(
            bundle_plan.get("quantizations"), "bundle plan.quantizations"
        )
        if isinstance(entry, dict)
    }
    for index, raw_artifact in enumerate(_list(item["artifacts"], f"{name}.artifacts")):
        artifact_name = f"{name}.artifacts[{index}]"
        artifact = _dict(raw_artifact, artifact_name)
        _require_keys(
            artifact,
            {"runtime_class", "quantization", "path", "sha256", "size_bytes"},
            artifact_name,
        )
        runtime_class = _string(
            artifact["runtime_class"], f"{artifact_name}.runtime_class"
        )
        quantization = _identity(
            artifact["quantization"], f"{artifact_name}.quantization"
        )
        identity = (runtime_class, quantization)
        if identity not in allowed:
            raise ContractError("bundle artifact is not registered by bundle authority")
        path = _relative_path(artifact["path"], f"{artifact_name}.path")
        if path != allowed[identity]:
            raise ContractError("bundle artifact path differs from bundle authority")
        if identity in observed:
            raise ContractError("bundle artifacts must be unique")
        observed.add(identity)
        artifacts.append(
            {
                "runtime_class": runtime_class,
                "quantization": quantization,
                "path": path,
                "sha256": _sha256(artifact["sha256"], f"{artifact_name}.sha256"),
                "size_bytes": _integer(
                    artifact["size_bytes"], f"{artifact_name}.size_bytes", minimum=1
                ),
            }
        )
    if set(allowed) != observed:
        raise ContractError(
            "bundle binding must declare every registered quantized artifact"
        )
    return {
        "authority_sha256": expected_authority_sha256,
        "manifest_sha256": _sha256(item["manifest_sha256"], f"{name}.manifest_sha256"),
        "verification_report_sha256": _sha256(
            item["verification_report_sha256"], f"{name}.verification_report_sha256"
        ),
        "verification_status": "VERIFIED",
        "archive_sha256": _sha256(item["archive_sha256"], f"{name}.archive_sha256"),
        "immutable_locator": _immutable_locator(
            item["immutable_locator"], f"{name}.immutable_locator"
        ),
        "artifacts": artifacts,
    }


def _parse_suite(value: Any, policy: dict[str, Any]) -> dict[str, Any]:
    item = _dict(value, "benchmark.evaluation_suite")
    _require_keys(
        item,
        {
            "suite_id",
            "total_cases",
            "critical_cases",
            "manifest_path",
            "cases_path",
            "protocol_path",
        },
        "benchmark.evaluation_suite",
    )
    suite_id = _identity(item["suite_id"], "evaluation_suite.suite_id")
    if suite_id != policy["suite_id"]:
        raise ContractError("evaluation suite id mismatch")
    total = _integer(item["total_cases"], "evaluation_suite.total_cases", minimum=1)
    critical = _integer(
        item["critical_cases"], "evaluation_suite.critical_cases", minimum=1
    )
    if total != policy["required_total_cases"]:
        raise ContractError("evaluation suite total case count mismatch")
    if critical != policy["required_critical_cases"]:
        raise ContractError("evaluation suite critical case count mismatch")
    return {
        "suite_id": suite_id,
        "total_cases": total,
        "critical_cases": critical,
        "manifest_path": _relative_path(
            item["manifest_path"], "evaluation_suite.manifest_path"
        ),
        "cases_path": _relative_path(item["cases_path"], "evaluation_suite.cases_path"),
        "protocol_path": _relative_path(
            item["protocol_path"], "evaluation_suite.protocol_path"
        ),
    }


def _parse_quality(value: Any) -> dict[str, int]:
    item = _dict(value, "benchmark.quality")
    expected = {
        "sample_count",
        "platform_accuracy_basis_points",
        "agro_accuracy_basis_points",
        "critical_unsupported_facts",
        "critical_safety_failures",
        "critical_abstention_misses",
        "unsupported_facts_total",
        "results_path",
    }
    _require_keys(item, expected, "benchmark.quality")
    result: dict[str, Any] = {}
    for key in expected - {"results_path"}:
        result[key] = _integer(
            item[key],
            f"benchmark.quality.{key}",
            minimum=0,
            maximum=10_000 if key.endswith("basis_points") else None,
        )
    result["results_path"] = _relative_path(
        item["results_path"], "benchmark.quality.results_path"
    )
    if result["sample_count"] < 1:
        raise ContractError("quality sample_count must be positive")
    return result


def _parse_concurrency(value: Any, name: str) -> list[dict[str, int]]:
    output: list[dict[str, int]] = []
    levels: set[int] = set()
    for index, raw in enumerate(_list(value, name)):
        item_name = f"{name}[{index}]"
        item = _dict(raw, item_name)
        _require_keys(
            item,
            {
                "level",
                "request_count",
                "failed_requests",
                "error_rate_basis_points",
                "p95_latency_ms",
                "generation_tokens_per_second_milli",
            },
            item_name,
        )
        parsed = {
            "level": _integer(item["level"], f"{item_name}.level", minimum=1),
            "request_count": _integer(
                item["request_count"], f"{item_name}.request_count", minimum=1
            ),
            "failed_requests": _integer(
                item["failed_requests"], f"{item_name}.failed_requests", minimum=0
            ),
            "error_rate_basis_points": _integer(
                item["error_rate_basis_points"],
                f"{item_name}.error_rate_basis_points",
                minimum=0,
                maximum=10_000,
            ),
            "p95_latency_ms": _integer(
                item["p95_latency_ms"], f"{item_name}.p95_latency_ms", minimum=1
            ),
            "generation_tokens_per_second_milli": _integer(
                item["generation_tokens_per_second_milli"],
                f"{item_name}.generation_tokens_per_second_milli",
                minimum=1,
            ),
        }
        if parsed["failed_requests"] > parsed["request_count"]:
            raise ContractError("failed requests cannot exceed request count")
        expected_rate = (parsed["failed_requests"] * 10_000) // parsed["request_count"]
        if parsed["error_rate_basis_points"] != expected_rate:
            raise ContractError("concurrency error rate does not match request counts")
        if parsed["level"] in levels:
            raise ContractError("concurrency levels must be unique")
        levels.add(parsed["level"])
        output.append(parsed)
    output.sort(key=lambda item: item["level"])
    return output


def _parse_runtime_profile(value: Any, name: str) -> dict[str, Any]:
    item = _dict(value, name)
    expected = {
        "profile_id",
        "runtime_class",
        "quantization",
        "artifact_sha256",
        "hardware_profile_id",
        "hardware_path",
        "environment_path",
        "raw_metrics_path",
        "cost_calculation_path",
        "sample_count",
        "prompt_tokens_per_second_milli",
        "generation_tokens_per_second_milli",
        "p95_latency_ms",
        "p99_latency_ms",
        "peak_ram_mb",
        "peak_vram_mb",
        "cold_start_ms",
        "warmup_ms",
        "estimated_cost_rub_per_million_tokens_milli",
        "concurrency",
    }
    _require_keys(item, expected, name)
    runtime_class = _string(item["runtime_class"], f"{name}.runtime_class")
    if runtime_class not in _ALLOWED_RUNTIME_CLASSES:
        raise ContractError(f"{name}.runtime_class is unsupported")
    parsed: dict[str, Any] = {
        "profile_id": _identity(item["profile_id"], f"{name}.profile_id"),
        "runtime_class": runtime_class,
        "quantization": _identity(item["quantization"], f"{name}.quantization"),
        "artifact_sha256": _sha256(item["artifact_sha256"], f"{name}.artifact_sha256"),
        "hardware_profile_id": _identity(
            item["hardware_profile_id"], f"{name}.hardware_profile_id"
        ),
        "hardware_path": _relative_path(item["hardware_path"], f"{name}.hardware_path"),
        "environment_path": _relative_path(
            item["environment_path"], f"{name}.environment_path"
        ),
        "raw_metrics_path": _relative_path(
            item["raw_metrics_path"], f"{name}.raw_metrics_path"
        ),
        "cost_calculation_path": _relative_path(
            item["cost_calculation_path"], f"{name}.cost_calculation_path"
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
        "peak_ram_mb": _integer(item["peak_ram_mb"], f"{name}.peak_ram_mb", minimum=1),
        "peak_vram_mb": _integer(
            item["peak_vram_mb"], f"{name}.peak_vram_mb", minimum=0
        ),
        "cold_start_ms": _integer(
            item["cold_start_ms"], f"{name}.cold_start_ms", minimum=1
        ),
        "warmup_ms": _integer(item["warmup_ms"], f"{name}.warmup_ms", minimum=1),
        "estimated_cost_rub_per_million_tokens_milli": _integer(
            item["estimated_cost_rub_per_million_tokens_milli"],
            f"{name}.estimated_cost_rub_per_million_tokens_milli",
            minimum=0,
        ),
        "concurrency": _parse_concurrency(item["concurrency"], f"{name}.concurrency"),
    }
    if parsed["p99_latency_ms"] < parsed["p95_latency_ms"]:
        raise ContractError(f"{name}.p99_latency_ms must be >= p95")
    if parsed["runtime_class"] == "CPU" and parsed["peak_vram_mb"] != 0:
        raise ContractError(f"{name}.peak_vram_mb must be zero for CPU")
    return parsed


def _parse_fallback(value: Any, name: str) -> dict[str, Any]:
    item = _dict(value, name)
    _require_keys(
        item,
        {
            "primary_model_id",
            "primary_revision",
            "fallback_model_id",
            "fallback_revision",
            "fallback_artifact_sha256",
            "trigger_count",
            "successful_transitions",
            "failed_transitions",
            "p95_takeover_ms",
            "continuity_violations",
            "critical_unsupported_facts",
            "raw_metrics_path",
            "protocol_path",
        },
        name,
    )
    return {
        "primary_model_id": _identity(
            item["primary_model_id"], f"{name}.primary_model_id"
        ),
        "primary_revision": _revision(
            item["primary_revision"], f"{name}.primary_revision"
        ),
        "fallback_model_id": _identity(
            item["fallback_model_id"], f"{name}.fallback_model_id"
        ),
        "fallback_revision": _revision(
            item["fallback_revision"], f"{name}.fallback_revision"
        ),
        "fallback_artifact_sha256": _sha256(
            item["fallback_artifact_sha256"], f"{name}.fallback_artifact_sha256"
        ),
        "trigger_count": _integer(
            item["trigger_count"], f"{name}.trigger_count", minimum=1
        ),
        "successful_transitions": _integer(
            item["successful_transitions"], f"{name}.successful_transitions", minimum=0
        ),
        "failed_transitions": _integer(
            item["failed_transitions"], f"{name}.failed_transitions", minimum=0
        ),
        "p95_takeover_ms": _integer(
            item["p95_takeover_ms"], f"{name}.p95_takeover_ms", minimum=1
        ),
        "continuity_violations": _integer(
            item["continuity_violations"], f"{name}.continuity_violations", minimum=0
        ),
        "critical_unsupported_facts": _integer(
            item["critical_unsupported_facts"],
            f"{name}.critical_unsupported_facts",
            minimum=0,
        ),
        "raw_metrics_path": _relative_path(
            item["raw_metrics_path"], f"{name}.raw_metrics_path"
        ),
        "protocol_path": _relative_path(item["protocol_path"], f"{name}.protocol_path"),
    }


def _parse_soak(value: Any, name: str) -> dict[str, Any]:
    item = _dict(value, name)
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
        name,
    )
    parsed: dict[str, Any] = {
        "profile_id": _identity(item["profile_id"], f"{name}.profile_id"),
        "duration_seconds": _integer(
            item["duration_seconds"], f"{name}.duration_seconds", minimum=1
        ),
        "request_count": _integer(
            item["request_count"], f"{name}.request_count", minimum=1
        ),
        "failed_requests": _integer(
            item["failed_requests"], f"{name}.failed_requests", minimum=0
        ),
        "critical_failures": _integer(
            item["critical_failures"], f"{name}.critical_failures", minimum=0
        ),
        "memory_start_mb": _integer(
            item["memory_start_mb"], f"{name}.memory_start_mb", minimum=1
        ),
        "memory_end_mb": _integer(
            item["memory_end_mb"], f"{name}.memory_end_mb", minimum=1
        ),
        "memory_peak_mb": _integer(
            item["memory_peak_mb"], f"{name}.memory_peak_mb", minimum=1
        ),
        "memory_drift_mb": _integer(
            item["memory_drift_mb"], f"{name}.memory_drift_mb", minimum=0
        ),
        "p95_latency_ms": _integer(
            item["p95_latency_ms"], f"{name}.p95_latency_ms", minimum=1
        ),
        "raw_metrics_path": _relative_path(
            item["raw_metrics_path"], f"{name}.raw_metrics_path"
        ),
        "environment_path": _relative_path(
            item["environment_path"], f"{name}.environment_path"
        ),
    }
    if parsed["memory_peak_mb"] < max(
        parsed["memory_start_mb"], parsed["memory_end_mb"]
    ):
        raise ContractError(f"{name}.memory_peak_mb is inconsistent")
    if parsed["memory_drift_mb"] != abs(
        parsed["memory_end_mb"] - parsed["memory_start_mb"]
    ):
        raise ContractError(f"{name}.memory_drift_mb is inconsistent")
    return parsed


def _parse_storage(value: Any, name: str) -> dict[str, Any]:
    item = _dict(value, name)
    _require_keys(
        item,
        {
            "immutable_locator",
            "archive_sha256",
            "archive_size_bytes",
            "uploaded_at",
            "retention_days",
            "retention_expires_at",
            "restored_at",
        },
        name,
    )
    uploaded = _timestamp(item["uploaded_at"], f"{name}.uploaded_at")
    retention_days = _integer(
        item["retention_days"], f"{name}.retention_days", minimum=1
    )
    expires = _timestamp(item["retention_expires_at"], f"{name}.retention_expires_at")
    restored = _timestamp(item["restored_at"], f"{name}.restored_at")
    if expires != uploaded + timedelta(days=retention_days):
        raise ContractError(
            "storage retention expiry must equal upload + retention days"
        )
    if restored < uploaded or restored > expires:
        raise ContractError(
            "storage restore timestamp must be within retention interval"
        )
    return {
        "immutable_locator": _immutable_locator(
            item["immutable_locator"], f"{name}.immutable_locator"
        ),
        "archive_sha256": _sha256(item["archive_sha256"], f"{name}.archive_sha256"),
        "archive_size_bytes": _integer(
            item["archive_size_bytes"], f"{name}.archive_size_bytes", minimum=1
        ),
        "uploaded_at": uploaded.isoformat(),
        "retention_days": retention_days,
        "retention_expires_at": expires.isoformat(),
        "restored_at": restored.isoformat(),
    }


def _parse_complete_manifest(
    raw: dict[str, Any],
    authority: dict[str, Any],
    bundle_authority: dict[str, Any],
    bundle_authority_sha256: str,
) -> dict[str, Any]:
    _require_keys(
        raw,
        {
            "schema_version",
            "lifecycle",
            "pending_reason",
            "model",
            "bundle",
            "evaluation_suite",
            "quality",
            "runtime_profiles",
            "fallback_exercise",
            "soak",
            "evidence_files",
            "storage",
            "measured_at",
        },
        "benchmark manifest",
    )
    if raw["schema_version"] != "tai.model-benchmark-evidence.v2":
        raise ContractError("unsupported benchmark manifest schema_version")
    if raw["lifecycle"] != "COMPLETE" or raw["pending_reason"] is not None:
        raise ContractError(
            "complete benchmark must have lifecycle COMPLETE and null reason"
        )

    model = _dict(raw["model"], "benchmark.model")
    _require_keys(model, {"role", "model_id", "revision"}, "benchmark.model")
    role = _string(model["role"], "benchmark.model.role")
    if role not in _ALLOWED_ROLES:
        raise ContractError("benchmark model role unsupported")
    model_id = _identity(model["model_id"], "benchmark.model.model_id")
    revision = _revision(model["revision"], "benchmark.model.revision")
    plan = _bundle_plan(bundle_authority, model_id, revision)
    if plan.get("role") != role:
        raise ContractError("benchmark role differs from bundle authority")
    bundle = _parse_bundle_binding(
        raw["bundle"],
        "benchmark.bundle",
        expected_authority_sha256=bundle_authority_sha256,
        bundle_plan=plan,
    )
    suite = _parse_suite(raw["evaluation_suite"], authority["suite_policy"])
    quality = _parse_quality(raw["quality"])

    profiles = [
        _parse_runtime_profile(item, f"benchmark.runtime_profiles[{index}]")
        for index, item in enumerate(
            _list(raw["runtime_profiles"], "benchmark.runtime_profiles")
        )
    ]
    profile_ids = [item["profile_id"] for item in profiles]
    if len(profile_ids) != len(set(profile_ids)):
        raise ContractError("benchmark runtime profile ids must be unique")
    fallback = None
    if raw["fallback_exercise"] is not None:
        fallback = _parse_fallback(
            raw["fallback_exercise"], "benchmark.fallback_exercise"
        )
    soak = _parse_soak(raw["soak"], "benchmark.soak")
    files = [
        _parse_file(item, f"benchmark.evidence_files[{index}]")
        for index, item in enumerate(
            _list(raw["evidence_files"], "benchmark.evidence_files")
        )
    ]
    paths = [item["path"] for item in files]
    if len(paths) != len(set(paths)):
        raise ContractError("benchmark evidence file paths must be unique")
    storage = _parse_storage(raw["storage"], "benchmark.storage")
    measured_at = _timestamp(raw["measured_at"], "benchmark.measured_at")
    uploaded_at = _timestamp(storage["uploaded_at"], "benchmark.storage.uploaded_at")
    if measured_at > uploaded_at:
        raise ContractError(
            "benchmark measurement must not occur after evidence upload"
        )

    return {
        "schema_version": raw["schema_version"],
        "lifecycle": "COMPLETE",
        "pending_reason": None,
        "model": {"role": role, "model_id": model_id, "revision": revision},
        "bundle": bundle,
        "evaluation_suite": suite,
        "quality": quality,
        "runtime_profiles": profiles,
        "fallback_exercise": fallback,
        "soak": soak,
        "evidence_files": files,
        "storage": storage,
        "measured_at": measured_at.isoformat(),
    }


def _parse_pending_manifest(raw: dict[str, Any]) -> dict[str, Any]:
    _require_keys(
        raw,
        {
            "schema_version",
            "lifecycle",
            "pending_reason",
            "model",
            "bundle",
            "evaluation_suite",
            "quality",
            "runtime_profiles",
            "fallback_exercise",
            "soak",
            "evidence_files",
            "storage",
            "measured_at",
        },
        "pending benchmark manifest",
    )
    if raw["schema_version"] != "tai.model-benchmark-evidence.v2":
        raise ContractError("unsupported benchmark manifest schema_version")
    if raw["lifecycle"] != "PENDING_BENCHMARK":
        raise ContractError("pending benchmark lifecycle mismatch")
    reason = _string(raw["pending_reason"], "pending benchmark reason")
    model = _dict(raw["model"], "pending benchmark model")
    _require_keys(model, {"role", "model_id", "revision"}, "pending benchmark model")
    role = _string(model["role"], "pending benchmark model.role")
    if role not in _ALLOWED_ROLES:
        raise ContractError("pending benchmark model role unsupported")
    parsed_model = {
        "role": role,
        "model_id": _identity(model["model_id"], "pending benchmark model.model_id"),
        "revision": _revision(model["revision"], "pending benchmark model.revision"),
    }
    if raw["bundle"] is not None:
        raise ContractError("pending benchmark bundle must be null")
    if raw["evaluation_suite"] is not None or raw["quality"] is not None:
        raise ContractError("pending benchmark cannot contain evaluation results")
    if raw["runtime_profiles"] != [] or raw["evidence_files"] != []:
        raise ContractError(
            "pending benchmark cannot contain profiles or evidence files"
        )
    if raw["fallback_exercise"] is not None or raw["soak"] is not None:
        raise ContractError(
            "pending benchmark cannot contain fallback or soak evidence"
        )
    if raw["storage"] is not None or raw["measured_at"] is not None:
        raise ContractError(
            "pending benchmark cannot contain storage or measurement time"
        )
    return {
        "schema_version": raw["schema_version"],
        "lifecycle": "PENDING_BENCHMARK",
        "pending_reason": reason,
        "model": parsed_model,
    }


def _hash_file(path: Path, maximum: int) -> tuple[str, int]:
    stat_result = path.lstat()
    if path.is_symlink() or not path.is_file():
        raise ContractError(f"evidence path must be a non-symlink regular file: {path}")
    size = stat_result.st_size
    if size < 1 or size > maximum:
        raise ContractError(f"evidence file size outside authority limit: {path}")
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest(), size


def _verify_evidence_files(
    files: list[dict[str, Any]],
    original_root: Path,
    restored_root: Path,
    limits: dict[str, int],
) -> list[str]:
    if len(files) > limits["maximum_file_count"]:
        raise ContractError("evidence file count exceeds authority limit")
    total = sum(item["size_bytes"] for item in files)
    if total > limits["maximum_total_size_bytes"]:
        raise ContractError("evidence total size exceeds authority limit")
    reasons: list[str] = []
    original_inodes: set[tuple[int, int]] = set()
    restored_inodes: set[tuple[int, int]] = set()
    try:
        if original_root.resolve() == restored_root.resolve():
            reasons.append("RESTORE_ROOT_NOT_INDEPENDENT")
    except OSError:
        reasons.append("EVIDENCE_ROOT_INVALID")
    for item in files:
        relative = Path(item["path"])
        original = original_root / relative
        restored = restored_root / relative
        try:
            original_digest, original_size = _hash_file(
                original, limits["maximum_file_size_bytes"]
            )
        except (OSError, ContractError):
            reasons.append(f"ORIGINAL_EVIDENCE_INVALID:{item['path']}")
            continue
        try:
            restored_digest, restored_size = _hash_file(
                restored, limits["maximum_file_size_bytes"]
            )
        except (OSError, ContractError):
            reasons.append(f"RESTORED_EVIDENCE_INVALID:{item['path']}")
            continue
        original_stat = original.stat()
        restored_stat = restored.stat()
        original_inode = (original_stat.st_dev, original_stat.st_ino)
        restored_inode = (restored_stat.st_dev, restored_stat.st_ino)
        if original_inode in original_inodes:
            reasons.append(f"ORIGINAL_HARDLINK_ALIAS:{item['path']}")
        if restored_inode in restored_inodes:
            reasons.append(f"RESTORED_HARDLINK_ALIAS:{item['path']}")
        original_inodes.add(original_inode)
        restored_inodes.add(restored_inode)
        if original_inode == restored_inode:
            reasons.append(f"RESTORE_NOT_INDEPENDENT:{item['path']}")
        if original_size != item["size_bytes"] or original_digest != item["sha256"]:
            reasons.append(f"ORIGINAL_EVIDENCE_MISMATCH:{item['path']}")
        if restored_size != item["size_bytes"] or restored_digest != item["sha256"]:
            reasons.append(f"RESTORED_EVIDENCE_MISMATCH:{item['path']}")
        if original_digest != restored_digest or original_size != restored_size:
            reasons.append(f"RESTORE_DRIFT:{item['path']}")
    return reasons


def _referenced_paths(manifest: dict[str, Any]) -> set[str]:
    suite = manifest["evaluation_suite"]
    paths = {
        suite["manifest_path"],
        suite["cases_path"],
        suite["protocol_path"],
        manifest["quality"]["results_path"],
    }
    for profile in manifest["runtime_profiles"]:
        paths.update(
            {
                profile["hardware_path"],
                profile["environment_path"],
                profile["raw_metrics_path"],
                profile["cost_calculation_path"],
            }
        )
    fallback = manifest["fallback_exercise"]
    if fallback is not None:
        paths.update({fallback["raw_metrics_path"], fallback["protocol_path"]})
    soak = manifest["soak"]
    paths.update({soak["raw_metrics_path"], soak["environment_path"]})
    return paths


def _semantic_object(path: Path, name: str) -> dict[str, Any]:
    try:
        return load_json_strict(path)
    except ContractError as exc:
        raise ContractError(f"{name} semantic JSON invalid: {exc}") from exc


def _file_map(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {item["path"]: item for item in manifest["evidence_files"]}


def _verify_semantic_evidence(
    manifest: dict[str, Any], original_root: Path
) -> list[str]:
    reasons: list[str] = []
    files = _file_map(manifest)
    suite = manifest["evaluation_suite"]
    model = manifest["model"]
    quality = manifest["quality"]

    try:
        suite_manifest = _semantic_object(
            original_root / suite["manifest_path"], "evaluation suite manifest"
       )
        _require_keys(
            suite_manifest,
            {
                "schema_version",
                "suite_id",
                "total_cases",
                "critical_cases",
                "cases_sha256",
                "protocol_sha256",
            },
            "evaluation suite manifest",
        )
        if suite_manifest != {
            "schema_version": "tai.evaluation-suite-manifest.v1",
            "suite_id": suite["suite_id"],
            "total_cases": suite["total_cases"],
            "critical_cases": suite["critical_cases"],
            "cases_sha256": files[suite["cases_path"]]["sha256"],
            "protocol_sha256": files[suite["protocol_path"]]["sha256"],
        }:
            reasons.append("EVALUATION_SUITE_MANIFEST_MISMATCH")
    except (ContractError, KeyError):
        reasons.append("EVALUATION_SUITE_MANIFEST_INVALID")

    try:
        case_record = _semantic_object(
            original_root / suite["cases_path"], "evaluation suite cases"
        )
        _require_keys(
            case_record,
            {"schema_version", "suite_id", "cases"},
            "evaluation suite cases",
        )
        if case_record["schema_version"] != "tai.evaluation-suite-cases.v1":
            raise ContractError("evaluation cases schema mismatch")
        if case_record["suite_id"] != suite["suite_id"]:
            raise ContractError("evaluation cases suite id mismatch")
        cases = _list(case_record["cases"], "evaluation suite cases.cases")
        case_ids: set[str] = set()
        critical_count = 0
        for index, raw_case in enumerate(cases):
            case_name = f"evaluation suite case[{index}]"
            case = _dict(raw_case, case_name)
            _require_keys(case, {"case_id", "critical", "category"}, case_name)
            case_id = _identity(case["case_id"], f"{case_name}.case_id")
            if case_id in case_ids:
                raise ContractError("evaluation case ids must be unique")
            case_ids.add(case_id)
            if _boolean(case["critical"], f"{case_name}.critical"):
                critical_count += 1
            _identity(case["category"], f"{case_name}.category")
        if len(cases) != suite["total_cases"]:
            reasons.append("EVALUATION_CASE_COUNT_MISMATCH")
        if critical_count != suite["critical_cases"]:
            reasons.append("EVALUATION_CRITICAL_CASE_COUNT_MISMATCH")
    except ContractError:
        reasons.append("EVALUATION_CASES_INVALID")

    try:
        quality_record = _semantic_object(
            original_root / quality["results_path"], "quality results"
        )
        expected_quality = {
            "schema_version": "tai.model-quality-results.v1",
            "model_id": model["model_id"],
            "revision": model["revision"],
            "suite_id": suite["suite_id"],
            **{key: value for key, value in quality.items() if key != "results_path"},
        }
        _require_keys(quality_record, set(expected_quality), "quality results")
        if quality_record != expected_quality:
            reasons.append("QUALITY_RESULTS_MISMATCH")
    except ContractError:
        reasons.append("QUALITY_RESULTS_INVALID")

    for profile in manifest["runtime_profiles"]:
        try:
            raw_metrics = _semantic_object(
                original_root / profile["raw_metrics_path"],
                f"runtime metrics {profile['profile_id']}",
            )
            expected_metrics = {
                "schema_version": "tai.runtime-profile-metrics.v1",
                **{
                    key: value
                    for key, value in profile.items()
                    if key
                    not in {
                        "hardware_path",
                        "environment_path",
                        "raw_metrics_path",
                        "cost_calculation_path",
                        "hardware_profile_id",
                    }
                },
            }
            _require_keys(
                raw_metrics,
                set(expected_metrics),
                f"runtime metrics {profile['profile_id']}",
            )
            if raw_metrics != expected_metrics:
                reasons.append(f"RUNTIME_METRICS_MISMATCH:{profile['profile_id']}")
        except ContractError:
            reasons.append(f"RUNTIME_METRICS_INVALID:{profile['profile_id']}")

        try:
            hardware = _semantic_object(
                original_root / profile["hardware_path"],
                f"hardware observation {profile['profile_id']}",
            )
            _require_keys(
                hardware,
                {
                    "schema_version",
                    "hardware_profile_id",
                    "runtime_class",
                    "captured_at",
                    "details",
                },
                f"hardware observation {profile['profile_id']}",
            )
            if hardware["schema_version"] != "tai.hardware-observation.v1":
                raise ContractError("hardware observation schema mismatch")
            if hardware["hardware_profile_id"] != profile["hardware_profile_id"]:
                raise ContractError("hardware profile id mismatch")
            if hardware["runtime_class"] != profile["runtime_class"]:
                raise ContractError("hardware runtime class mismatch")
            _timestamp(hardware["captured_at"], "hardware captured_at")
            if not isinstance(hardware["details"], dict) or not hardware["details"]:
                raise ContractError("hardware details must be a non-empty object")
        except ContractError:
            reasons.append(f"HARDWARE_OBSERVATION_INVALID:{profile['profile_id']}")

        try:
            environment = _semantic_object(
                original_root / profile["environment_path"],
                f"runtime environment {profile['profile_id']}",
            )
            _require_keys(
                environment,
                {
                    "schema_version",
                    "profile_id",
                    "artifact_sha256",
                    "runtime_class",
                    "quantization",
                    "captured_at",
                    "details",
                },
                f"runtime environment {profile['profile_id']}",
            )
            if (
                environment["schema_version"]
                != "tai.runtime-environment-observation.v1"
            ):
                raise ContractError("runtime environment schema mismatch")
            if environment["profile_id"] != profile["profile_id"]:
                raise ContractError("runtime environment profile mismatch")
            if environment["artifact_sha256"] != profile["artifact_sha256"]:
                raise ContractError("runtime environment artifact mismatch")
            if environment["runtime_class"] != profile["runtime_class"]:
                raise ContractError("runtime environment class mismatch")
            if environment["quantization"] != profile["quantization"]:
                raise ContractError("runtime environment quantization mismatch")
            _timestamp(environment["captured_at"], "runtime environment captured_at")
            if (
                not isinstance(environment["details"], dict)
                or not environment["details"]
            ):
                raise ContractError("runtime environment details must be non-empty")
        except ContractError:
            reasons.append(f"RUNTIME_ENVIRONMENT_INVALID:{profile['profile_id']}")

        try:
            cost = _semantic_object(
                original_root / profile["cost_calculation_path"],
                f"cost calculation {profile['profile_id']}",
            )
            expected_cost = {
                "schema_version": "tai.operating-cost-calculation.v1",
                "profile_id": profile["profile_id"],
                "currency": "RUB",
                "token_basis": 1_000_000,
                "estimated_cost_rub_per_million_tokens_milli": profile[
                    "estimated_cost_rub_per_million_tokens_milli"
                ],
                "assumptions": cost.get("assumptions"),
            }
            _require_keys(
                cost, set(expected_cost), f"cost calculation {profile['profile_id']}"
            )
            if not isinstance(cost.get("assumptions"), list) or not cost["assumptions"]:
                raise ContractError("cost assumptions must be a non-empty list")
            if cost != expected_cost:
                reasons.append(f"COST_CALCULATION_MISMATCH:{profile['profile_id']}")
        except ContractError:
            reasons.append(f"COST_CALCULATION_INVALID:{profile['profile_id']}")

    fallback = manifest["fallback_exercise"]
    if fallback is not None:
        try:
            raw_fallback = _semantic_object(
                original_root / fallback["raw_metrics_path"], "fallback metrics"
            )
            expected_fallback = {
                "schema_version": "tai.fallback-exercise-metrics.v1",
                **{
                    key: value
                    for key, value in fallback.items()
                    if key not in {"raw_metrics_path", "protocol_path"}
                },
            }
            _require_keys(raw_fallback, set(expected_fallback), "fallback metrics")
            if raw_fallback != expected_fallback:
                reasons.append("FALLBACK_METRICS_MISMATCH")
        except ContractError:
            reasons.append("FALLBACK_METRICS_INVALID")

    soak = manifest["soak"]
    try:
        raw_soak = _semantic_object(
            original_root / soak["raw_metrics_path"], "soak metrics"
        )
        expected_soak = {
            "schema_version": "tai.soak-metrics.v1",
            **{
                key: value
                for key, value in soak.items()
                if key not in {"raw_metrics_path", "environment_path"}
            },
        }
        _require_keys(raw_soak, set(expected_soak), "soak metrics")
        if raw_soak != expected_soak:
            reasons.append("SOAK_METRICS_MISMATCH")
    except ContractError:
        reasons.append("SOAK_METRICS_INVALID")
    return reasons


def _profile_policy(
    authority: dict[str, Any], model_id: str, revision: str, profile_id: str
) -> dict[str, Any] | None:
    matches = [
        item
        for item in authority["runtime_profiles"]
        if item["model_id"] == model_id
        and item["revision"] == revision
        and item["profile_id"] == profile_id
    ]
    return matches[0] if len(matches) == 1 else None


def _evaluate_complete(
    manifest: dict[str, Any], authority: dict[str, Any]
) -> list[str]:
    reasons: list[str] = []
    suite_policy = authority["suite_policy"]
    quality = manifest["quality"]
    if quality["sample_count"] != suite_policy["required_total_cases"]:
        reasons.append("QUALITY_SAMPLE_COUNT_MISMATCH")
    if (
        quality["platform_accuracy_basis_points"]
        < suite_policy["minimum_platform_accuracy_basis_points"]
    ):
        reasons.append("PLATFORM_QUALITY_BELOW_POLICY")
    if (
        quality["agro_accuracy_basis_points"]
        < suite_policy["minimum_agro_accuracy_basis_points"]
    ):
        reasons.append("AGRO_QUALITY_BELOW_POLICY")
    if (
        quality["critical_unsupported_facts"]
        > suite_policy["maximum_critical_unsupported_facts"]
    ):
        reasons.append("CRITICAL_UNSUPPORTED_FACTS_PRESENT")
    if (
        quality["critical_safety_failures"]
        > suite_policy["maximum_critical_safety_failures"]
    ):
        reasons.append("CRITICAL_SAFETY_FAILURES_PRESENT")
    if (
        quality["critical_abstention_misses"]
        > suite_policy["maximum_critical_abstention_misses"]
    ):
        reasons.append("CRITICAL_ABSTENTION_MISSES_PRESENT")

    model = manifest["model"]
    bundle_artifacts = {
        (item["runtime_class"], item["quantization"]): item
        for item in manifest["bundle"]["artifacts"]
    }
    observed_profile_ids: set[str] = set()
    for profile in manifest["runtime_profiles"]:
        policy = _profile_policy(
            authority, model["model_id"], model["revision"], profile["profile_id"]
        )
        if policy is None:
            reasons.append(f"UNAUTHORIZED_RUNTIME_PROFILE:{profile['profile_id']}")
            continue
        observed_profile_ids.add(profile["profile_id"])
        if profile["runtime_class"] != policy["runtime_class"]:
            reasons.append(f"RUNTIME_CLASS_MISMATCH:{profile['profile_id']}")
        if profile["quantization"] != policy["quantization"]:
            reasons.append(f"QUANTIZATION_MISMATCH:{profile['profile_id']}")
        artifact = bundle_artifacts.get(
            (profile["runtime_class"], profile["quantization"])
        )
        if artifact is None or artifact["sha256"] != profile["artifact_sha256"]:
            reasons.append(f"PROFILE_ARTIFACT_MISMATCH:{profile['profile_id']}")
        thresholds = policy["thresholds"]
        comparisons = (
            (
                profile["sample_count"] < thresholds["minimum_sample_count"],
                "SAMPLE_COUNT_BELOW_POLICY",
            ),
            (
                profile["prompt_tokens_per_second_milli"]
                < thresholds["minimum_prompt_tokens_per_second_milli"],
                "PROMPT_SPEED_BELOW_POLICY",
            ),
            (
                profile["generation_tokens_per_second_milli"]
                < thresholds["minimum_generation_tokens_per_second_milli"],
                "GENERATION_SPEED_BELOW_POLICY",
            ),
            (
                profile["p95_latency_ms"] > thresholds["maximum_p95_latency_ms"],
                "P95_LATENCY_ABOVE_POLICY",
            ),
            (
                profile["p99_latency_ms"] > thresholds["maximum_p99_latency_ms"],
                "P99_LATENCY_ABOVE_POLICY",
            ),
            (
                profile["peak_ram_mb"] > thresholds["maximum_peak_ram_mb"],
                "RAM_ABOVE_POLICY",
            ),
            (
                profile["peak_vram_mb"] > thresholds["maximum_peak_vram_mb"],
                "VRAM_ABOVE_POLICY",
            ),
            (
                profile["cold_start_ms"] > thresholds["maximum_cold_start_ms"],
                "COLD_START_ABOVE_POLICY",
            ),
            (
                profile["warmup_ms"] > thresholds["maximum_warmup_ms"],
                "WARMUP_ABOVE_POLICY",
            ),
        )
        for failed, reason in comparisons:
            if failed:
                reasons.append(f"{reason}:{profile['profile_id']}")
        concurrency = {item["level"]: item for item in profile["concurrency"]}
        if set(concurrency) != set(policy["required_concurrency_levels"]):
            reasons.append(f"CONCURRENCY_MATRIX_MISMATCH:{profile['profile_id']}")
        for level, observation in concurrency.items():
            if observation["request_count"] < thresholds["minimum_sample_count"]:
                reasons.append(
                    f"CONCURRENCY_SAMPLE_COUNT_BELOW_POLICY:{profile['profile_id']}:{level}"
                )
            if (
                observation["error_rate_basis_points"]
                > thresholds["maximum_error_rate_basis_points"]
            ):
                reasons.append(
                    f"CONCURRENCY_ERROR_RATE_ABOVE_POLICY:{profile['profile_id']}:{level}"
                )
            if observation["p95_latency_ms"] > thresholds["maximum_p95_latency_ms"]:
                reasons.append(
                    f"CONCURRENCY_P95_ABOVE_POLICY:{profile['profile_id']}:{level}"
                )
            if (
                observation["generation_tokens_per_second_milli"]
                < thresholds["minimum_generation_tokens_per_second_milli"]
            ):
                reasons.append(
                    f"CONCURRENCY_SPEED_BELOW_POLICY:{profile['profile_id']}:{level}"
                )

    required_profiles = {
        item["profile_id"]
        for item in authority["runtime_profiles"]
        if item["model_id"] == model["model_id"]
        and item["revision"] == model["revision"]
    }
    if observed_profile_ids != required_profiles:
        reasons.append("REQUIRED_RUNTIME_PROFILES_MISSING_OR_EXTRA")

    soak = manifest["soak"]
    soak_policy = authority["soak_policy"]
    if soak["profile_id"] not in observed_profile_ids:
        reasons.append("SOAK_PROFILE_NOT_BENCHMARKED")
    if soak["duration_seconds"] < soak_policy["minimum_duration_seconds"]:
        reasons.append("SOAK_DURATION_BELOW_POLICY")
    if soak["request_count"] < soak_policy["minimum_request_count"]:
        reasons.append("SOAK_REQUEST_COUNT_BELOW_POLICY")
    if soak["failed_requests"] > soak_policy["maximum_failed_requests"]:
        reasons.append("SOAK_FAILED_REQUESTS_ABOVE_POLICY")
    if soak["critical_failures"] > soak_policy["maximum_critical_failures"]:
        reasons.append("SOAK_CRITICAL_FAILURES_PRESENT")
    if soak["memory_drift_mb"] > soak_policy["maximum_memory_drift_mb"]:
        reasons.append("SOAK_MEMORY_DRIFT_ABOVE_POLICY")

    fallback = manifest["fallback_exercise"]
    if model["role"] == "PRIMARY":
        if fallback is None:
            reasons.append("FALLBACK_EXERCISE_MISSING")
        else:
            policy = authority["fallback_policy"]
            if (
                fallback["primary_model_id"] != model["model_id"]
                or fallback["primary_revision"] != model["revision"]
            ):
                reasons.append("FALLBACK_PRIMARY_IDENTITY_MISMATCH")
            if fallback["trigger_count"] < policy["minimum_trigger_count"]:
                reasons.append("FALLBACK_TRIGGER_COUNT_BELOW_POLICY")
            if fallback["failed_transitions"] > policy["maximum_failed_transitions"]:
                reasons.append("FALLBACK_FAILED_TRANSITIONS_ABOVE_POLICY")
            if (
                fallback["successful_transitions"] + fallback["failed_transitions"]
                != fallback["trigger_count"]
            ):
                reasons.append("FALLBACK_TRANSITION_CARDINALITY_MISMATCH")
            if fallback["p95_takeover_ms"] > policy["maximum_p95_takeover_ms"]:
                reasons.append("FALLBACK_TAKEOVER_LATENCY_ABOVE_POLICY")
            if (
                fallback["continuity_violations"]
                > policy["maximum_continuity_violations"]
            ):
                reasons.append("FALLBACK_CONTINUITY_VIOLATIONS_PRESENT")
            if (
                fallback["critical_unsupported_facts"]
                > policy["maximum_critical_unsupported_facts"]
            ):
                reasons.append("FALLBACK_CRITICAL_UNSUPPORTED_FACTS_PRESENT")
    elif fallback is not None:
        reasons.append("FALLBACK_MODEL_MUST_NOT_DECLARE_FALLBACK_EXERCISE")
    return reasons


def verify_benchmark(
    authority_path: Path,
    bundle_authority_path: Path,
    manifest_path: Path,
    original_root: Path,
    restored_root: Path,
) -> dict[str, Any]:
    try:
        authority = load_authority(authority_path)
        bundle_authority, bundle_authority_sha256 = _load_bundle_authority(
            bundle_authority_path
        )
        raw = load_json_strict(manifest_path)
        lifecycle = raw.get("lifecycle")
        if lifecycle not in _ALLOWED_LIFECYCLES:
            raise ContractError("benchmark lifecycle is unsupported")
        if lifecycle == "PENDING_BENCHMARK":
            pending = _parse_pending_manifest(raw)
            return _report(
                status="PENDING_BENCHMARK",
                reasons=("BENCHMARK_PENDING",),
                authority=authority,
                manifest=pending,
            )
        manifest = _parse_complete_manifest(
            raw, authority, bundle_authority, bundle_authority_sha256
        )
        reasons = _evaluate_complete(manifest, authority)
        declared_paths = {item["path"] for item in manifest["evidence_files"]}
        references = _referenced_paths(manifest)
        if declared_paths != references:
            reasons.append("EVIDENCE_PATH_SET_MISMATCH")
        reasons.extend(
            _verify_evidence_files(
                manifest["evidence_files"],
                original_root,
                restored_root,
                authority["evidence_limits"],
            )
        )
        if not any(
            reason.startswith(("ORIGINAL_", "RESTORED_", "RESTORE_", "EVIDENCE_"))
            for reason in reasons
        ):
            reasons.extend(_verify_semantic_evidence(manifest, original_root))
        status = "VERIFIED" if not reasons else "REJECTED"
        return _report(
            status=status,
            reasons=tuple(sorted(set(reasons))),
            authority=authority,
            manifest=manifest,
        )
    except ContractError as exc:
        return {
            "schema_version": "tai.model-benchmark-verification-report.v2",
            "status": "REJECTED",
            "reasons": [f"CONTRACT_INVALID:{exc}"],
            "authority_sha256": None,
            "benchmark_manifest_sha256": None,
            "model": None,
            "bundle": None,
            "measured_at": None,
            "verified_profiles": [],
            "fallback_exercise": None,
            "report_sha256": None,
        }


def _report(
    *,
    status: str,
    reasons: tuple[str, ...],
    authority: dict[str, Any],
    manifest: dict[str, Any],
) -> dict[str, Any]:
    if status not in _ALLOWED_VERIFICATION_STATUSES:
        raise ContractError("verification report status unsupported")
    payload = {
        "schema_version": "tai.model-benchmark-verification-report.v2",
        "status": status,
        "reasons": list(reasons),
        "authority_sha256": authority["authority_sha256"],
        "benchmark_manifest_sha256": canonical_sha256(manifest),
        "model": manifest["model"],
        "bundle": manifest.get("bundle"),
        "measured_at": manifest.get("measured_at"),
        "verified_profiles": [
            item["profile_id"] for item in manifest.get("runtime_profiles", [])
        ],
        "fallback_exercise": manifest.get("fallback_exercise"),
    }
    payload["report_sha256"] = canonical_sha256(payload)
    return payload


def _parse_report(path: Path, name: str) -> dict[str, Any]:
    report = load_json_strict(path)
    expected = {
        "schema_version",
        "status",
        "reasons",
        "authority_sha256",
        "benchmark_manifest_sha256",
        "model",
        "bundle",
        "measured_at",
        "verified_profiles",
        "fallback_exercise",
        "report_sha256",
    }
    _require_keys(report, expected, name)
    if report["schema_version"] != "tai.model-benchmark-verification-report.v2":
        raise ContractError(f"{name} schema unsupported")
    if report["status"] not in _ALLOWED_VERIFICATION_STATUSES:
        raise ContractError(f"{name} status unsupported")
    expected_sha = report["report_sha256"]
    unsigned = dict(report)
    unsigned.pop("report_sha256")
    if expected_sha != canonical_sha256(unsigned):
        raise ContractError(f"{name} report_sha256 mismatch")
    return report


def admit_models(
    authority_path: Path,
    primary_report_path: Path,
    fallback_report_path: Path,
    *,
    evaluated_at: str,
) -> dict[str, Any]:
    try:
        authority = load_authority(authority_path)
        primary = _parse_report(primary_report_path, "primary report")
        fallback = _parse_report(fallback_report_path, "fallback report")
        evaluated = _timestamp(evaluated_at, "evaluated_at")
        statuses = {primary["status"], fallback["status"]}
        if "PENDING_BENCHMARK" in statuses:
            return _admission_decision(
                status="PENDING_ADMISSION",
                reasons=("BENCHMARK_PENDING",),
                authority=authority,
                primary=primary,
                fallback=fallback,
                evaluated_at=evaluated,
            )
        reasons: list[str] = []
        if primary["status"] != "VERIFIED":
            reasons.append("PRIMARY_BENCHMARK_NOT_VERIFIED")
        if fallback["status"] != "VERIFIED":
            reasons.append("FALLBACK_BENCHMARK_NOT_VERIFIED")
        if primary["authority_sha256"] != authority["authority_sha256"]:
            reasons.append("PRIMARY_AUTHORITY_MISMATCH")
        if fallback["authority_sha256"] != authority["authority_sha256"]:
            reasons.append("FALLBACK_AUTHORITY_MISMATCH")
        primary_model = primary["model"] or {}
        fallback_model = fallback["model"] or {}
        if primary_model.get("role") != "PRIMARY":
            reasons.append("PRIMARY_ROLE_MISMATCH")
        if fallback_model.get("role") != "FALLBACK":
            reasons.append("FALLBACK_ROLE_MISMATCH")
        required_primary = {
            item["profile_id"]
            for item in authority["runtime_profiles"]
            if item["role"] == "PRIMARY"
        }
        required_fallback = {
            item["profile_id"]
            for item in authority["runtime_profiles"]
            if item["role"] == "FALLBACK"
        }
        if set(primary["verified_profiles"]) != required_primary:
            reasons.append("PRIMARY_PROFILE_SET_MISMATCH")
        if set(fallback["verified_profiles"]) != required_fallback:
            reasons.append("FALLBACK_PROFILE_SET_MISMATCH")
        for label, report in (("PRIMARY", primary), ("FALLBACK", fallback)):
            measured_raw = report.get("measured_at")
            if not isinstance(measured_raw, str):
                reasons.append(f"{label}_MEASUREMENT_TIME_MISSING")
                continue
            measured = _timestamp(measured_raw, f"{label.lower()} measured_at")
            age = evaluated - measured
            if age < timedelta(0) or age > timedelta(
                days=authority["benchmark_maximum_age_days"]
            ):
                reasons.append(f"{label}_BENCHMARK_STALE_OR_FUTURE")
        primary_bundle = primary.get("bundle") or {}
        fallback_bundle = fallback.get("bundle") or {}
        if primary_bundle.get("verification_status") != "VERIFIED":
            reasons.append("PRIMARY_BUNDLE_NOT_VERIFIED")
        if fallback_bundle.get("verification_status") != "VERIFIED":
            reasons.append("FALLBACK_BUNDLE_NOT_VERIFIED")
        exercise = primary.get("fallback_exercise")
        if not isinstance(exercise, dict):
            reasons.append("PRIMARY_FALLBACK_EXERCISE_MISSING")
        else:
            if exercise.get("fallback_model_id") != fallback_model.get("model_id"):
                reasons.append("FALLBACK_EXERCISE_MODEL_MISMATCH")
            if exercise.get("fallback_revision") != fallback_model.get("revision"):
                reasons.append("FALLBACK_EXERCISE_REVISION_MISMATCH")
            fallback_artifact_hashes = {
                item.get("sha256")
                for item in fallback_bundle.get("artifacts", [])
                if isinstance(item, dict)
            }
            if exercise.get("fallback_artifact_sha256") not in fallback_artifact_hashes:
                reasons.append("FALLBACK_EXERCISE_ARTIFACT_MISMATCH")
        status = "ADMITTED" if not reasons else "REJECTED"
        return _admission_decision(
            status=status,
            reasons=tuple(sorted(set(reasons))),
            authority=authority,
            primary=primary,
            fallback=fallback,
            evaluated_at=evaluated,
        )
    except ContractError as exc:
        return {
            "schema_version": "tai.model-admission-decision.v2",
            "status": "REJECTED",
            "reasons": [f"CONTRACT_INVALID:{exc}"],
            "authority_sha256": None,
            "primary": None,
            "fallback": None,
            "evaluated_at": evaluated_at,
            "decision_sha256": None,
            "production_operational_status": "NOT_ATTESTED",
        }


def _admission_decision(
    *,
    status: str,
    reasons: tuple[str, ...],
    authority: dict[str, Any],
    primary: dict[str, Any],
    fallback: dict[str, Any],
    evaluated_at: datetime,
) -> dict[str, Any]:
    if status not in _ALLOWED_ADMISSION_STATUSES:
        raise ContractError("admission status unsupported")
    payload = {
        "schema_version": "tai.model-admission-decision.v2",
        "status": status,
        "reasons": list(reasons),
        "authority_sha256": authority["authority_sha256"],
        "primary": {
            "model": primary.get("model"),
            "benchmark_report_sha256": primary.get("report_sha256"),
            "benchmark_manifest_sha256": primary.get("benchmark_manifest_sha256"),
            "bundle_manifest_sha256": (primary.get("bundle") or {}).get(
                "manifest_sha256"
            ),
        },
        "fallback": {
            "model": fallback.get("model"),
            "benchmark_report_sha256": fallback.get("report_sha256"),
            "benchmark_manifest_sha256": fallback.get("benchmark_manifest_sha256"),
            "bundle_manifest_sha256": (fallback.get("bundle") or {}).get(
                "manifest_sha256"
            ),
        },
        "evaluated_at": evaluated_at.isoformat(),
        "production_operational_status": "NOT_ATTESTED",
    }
    payload["decision_sha256"] = canonical_sha256(payload)
    return payload


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
