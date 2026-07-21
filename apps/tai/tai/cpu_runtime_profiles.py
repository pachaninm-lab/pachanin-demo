from __future__ import annotations

from typing import Any

from tai.cpu_runtime_contract import (
    RuntimeEvidenceError,
    as_array,
    as_commit,
    as_identity,
    as_int,
    as_object,
    as_relative_path,
    as_sha256,
    as_text,
    require_keys,
)

PROFILE_FIELDS = {
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
}


def _parse_concurrency(
    value: object, plan: dict[str, Any]
) -> tuple[list[dict[str, int]], list[str]]:
    profile_id = str(plan["profile_id"])
    thresholds = as_object(plan["thresholds"], f"{profile_id}.thresholds")
    required_levels = [
        int(level) for level in plan["required_concurrency_levels"]
    ]
    parsed: list[dict[str, int]] = []
    reasons: list[str] = []
    for index, raw_entry in enumerate(
        as_array(value, f"{profile_id}.concurrency")
    ):
        name = f"{profile_id}.concurrency[{index}]"
        entry = as_object(raw_entry, name)
        require_keys(
            entry,
            {
                "level",
                "request_count",
                "failed_requests",
                "error_rate_basis_points",
                "p95_latency_ms",
                "generation_tokens_per_second_milli",
            },
            name,
        )
        result: dict[str, int] = {
            "level": as_int(entry["level"], f"{name}.level", minimum=1),
            "request_count": as_int(
                entry["request_count"], f"{name}.request_count", minimum=1
            ),
            "failed_requests": as_int(
                entry["failed_requests"], f"{name}.failed_requests"
            ),
            "error_rate_basis_points": as_int(
                entry["error_rate_basis_points"],
                f"{name}.error_rate_basis_points",
                maximum=10_000,
            ),
            "p95_latency_ms": as_int(
                entry["p95_latency_ms"], f"{name}.p95_latency_ms", minimum=1
            ),
            "generation_tokens_per_second_milli": as_int(
                entry["generation_tokens_per_second_milli"],
                f"{name}.generation_tokens_per_second_milli",
                minimum=1,
            ),
        }
        if result["failed_requests"] > result["request_count"]:
            raise RuntimeEvidenceError(f"{name} failed requests exceed total")
        level = result["level"]
        if result["request_count"] < int(thresholds["minimum_sample_count"]):
            reasons.append(f"CONCURRENCY_SAMPLE_COUNT_BELOW_MINIMUM:{level}")
        if result["error_rate_basis_points"] > int(
            thresholds["maximum_error_rate_basis_points"]
        ):
            reasons.append(f"CONCURRENCY_ERROR_RATE_EXCEEDED:{level}")
        if result["p95_latency_ms"] > int(
            thresholds["maximum_p95_latency_ms"]
        ):
            reasons.append(f"CONCURRENCY_P95_EXCEEDED:{level}")
        if result["generation_tokens_per_second_milli"] < int(
            thresholds["minimum_generation_tokens_per_second_milli"]
        ):
            reasons.append(
                f"CONCURRENCY_GENERATION_THROUGHPUT_BELOW_MINIMUM:{level}"
            )
        parsed.append(result)
    if [entry["level"] for entry in parsed] != required_levels:
        reasons.append("CONCURRENCY_MATRIX_MISMATCH")
    return parsed, reasons


def _parse_profile(
    selected: dict[str, Any], plan: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    profile_id = str(plan["profile_id"])
    name = f"runtime_profiles.{profile_id}"
    require_keys(selected, PROFILE_FIELDS, name)
    thresholds = as_object(plan["thresholds"], f"{profile_id}.thresholds")
    concurrency, reasons = _parse_concurrency(selected["concurrency"], plan)
    sample_count = as_int(
        selected["sample_count"], f"{name}.sample_count", minimum=1
    )
    prompt_speed = as_int(
        selected["prompt_tokens_per_second_milli"],
        f"{name}.prompt_tokens_per_second_milli",
        minimum=1,
    )
    generation_speed = as_int(
        selected["generation_tokens_per_second_milli"],
        f"{name}.generation_tokens_per_second_milli",
        minimum=1,
    )
    p95 = as_int(
        selected["p95_latency_ms"], f"{name}.p95_latency_ms", minimum=1
    )
    p99 = as_int(
        selected["p99_latency_ms"], f"{name}.p99_latency_ms", minimum=1
    )
    error_rate = as_int(
        selected["error_rate_basis_points"],
        f"{name}.error_rate_basis_points",
        maximum=10_000,
    )
    peak_ram = as_int(
        selected["peak_ram_mb"], f"{name}.peak_ram_mb", minimum=1
    )
    cold_start = as_int(
        selected["cold_start_ms"], f"{name}.cold_start_ms", minimum=1
    )
    warmup = as_int(
        selected["warmup_ms"], f"{name}.warmup_ms", minimum=1
    )
    if p99 < p95:
        raise RuntimeEvidenceError(f"{name} p99 latency must be >= p95")
    parsed: dict[str, Any] = {
        "profile_id": as_identity(
            selected["profile_id"], f"{name}.profile_id"
        ),
        "role": as_text(selected["role"], f"{name}.role"),
        "model_id": as_identity(selected["model_id"], f"{name}.model_id"),
        "revision": as_commit(selected["revision"], f"{name}.revision"),
        "runtime_class": as_text(
            selected["runtime_class"], f"{name}.runtime_class"
        ),
        "quantization": as_identity(
            selected["quantization"], f"{name}.quantization"
        ),
        "artifact_sha256": as_sha256(
            selected["artifact_sha256"], f"{name}.artifact_sha256"
        ),
        "hardware_profile_id": as_identity(
            selected["hardware_profile_id"], f"{name}.hardware_profile_id"
        ),
        "hardware_path": as_relative_path(
            selected["hardware_path"], f"{name}.hardware_path"
        ),
        "environment_path": as_relative_path(
            selected["environment_path"], f"{name}.environment_path"
        ),
        "benchmark_metrics_path": as_relative_path(
            selected["benchmark_metrics_path"],
            f"{name}.benchmark_metrics_path",
        ),
        "request_metrics_path": as_relative_path(
            selected["request_metrics_path"], f"{name}.request_metrics_path"
        ),
        "cost_inputs_path": as_relative_path(
            selected["cost_inputs_path"], f"{name}.cost_inputs_path"
        ),
        "sample_count": sample_count,
        "prompt_tokens_per_second_milli": prompt_speed,
        "generation_tokens_per_second_milli": generation_speed,
        "p95_latency_ms": p95,
        "p99_latency_ms": p99,
        "error_rate_basis_points": error_rate,
        "peak_ram_mb": peak_ram,
        "cold_start_ms": cold_start,
        "warmup_ms": warmup,
        "concurrency": concurrency,
    }
    for field in (
        "profile_id",
        "role",
        "model_id",
        "revision",
        "runtime_class",
        "quantization",
    ):
        if parsed[field] != plan[field]:
            reasons.append(f"PROFILE_BINDING_MISMATCH:{profile_id}:{field}")
    checks = (
        (
            sample_count >= int(thresholds["minimum_sample_count"]),
            "SAMPLE_COUNT_BELOW_MINIMUM",
        ),
        (
            prompt_speed
            >= int(thresholds["minimum_prompt_tokens_per_second_milli"]),
            "PROMPT_THROUGHPUT_BELOW_MINIMUM",
        ),
        (
            generation_speed
            >= int(thresholds["minimum_generation_tokens_per_second_milli"]),
            "GENERATION_THROUGHPUT_BELOW_MINIMUM",
        ),
        (
            p95 <= int(thresholds["maximum_p95_latency_ms"]),
            "P95_LATENCY_EXCEEDED",
        ),
        (
            p99 <= int(thresholds["maximum_p99_latency_ms"]),
            "P99_LATENCY_EXCEEDED",
        ),
        (
            error_rate <= int(thresholds["maximum_error_rate_basis_points"]),
            "ERROR_RATE_EXCEEDED",
        ),
        (
            peak_ram <= int(thresholds["maximum_peak_ram_mb"]),
            "PEAK_RAM_EXCEEDED",
        ),
        (
            cold_start <= int(thresholds["maximum_cold_start_ms"]),
            "COLD_START_EXCEEDED",
        ),
        (
            warmup <= int(thresholds["maximum_warmup_ms"]),
            "WARMUP_EXCEEDED",
        ),
    )
    for passed, reason in checks:
        if not passed:
            reasons.append(f"{reason}:{profile_id}")
    return parsed, reasons


def parse_profiles(
    value: object, plans: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[str]]:
    raw_profiles = as_array(value, "runtime_profiles")
    if len(raw_profiles) != len(plans):
        raise RuntimeEvidenceError(
            "runtime_profiles must contain exactly two profiles"
        )
    by_id: dict[str, dict[str, Any]] = {}
    for index, raw_profile in enumerate(raw_profiles):
        candidate = as_object(raw_profile, f"runtime_profiles[{index}]")
        profile_id = as_identity(
            candidate.get("profile_id"),
            f"runtime_profiles[{index}].profile_id",
        )
        if profile_id in by_id:
            raise RuntimeEvidenceError("runtime profile ids must be unique")
        by_id[profile_id] = candidate
    parsed_profiles: list[dict[str, Any]] = []
    reasons: list[str] = []
    for plan in plans:
        profile_id = str(plan["profile_id"])
        selected = by_id.get(profile_id)
        if selected is None:
            raise RuntimeEvidenceError(f"runtime profile missing: {profile_id}")
        parsed, profile_reasons = _parse_profile(selected, plan)
        parsed_profiles.append(parsed)
        reasons.extend(profile_reasons)
    if set(by_id) != {str(plan["profile_id"]) for plan in plans}:
        raise RuntimeEvidenceError("unexpected runtime profile")
    return parsed_profiles, reasons
