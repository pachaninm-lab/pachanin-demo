from __future__ import annotations

from pathlib import Path
from typing import Any

from tai.cpu_runtime_contract import (
    EXPECTED_PROFILES,
    TOOLCHAIN_COMMIT,
    RuntimeEvidenceError,
    as_array,
    as_bool,
    as_commit,
    as_identity,
    as_int,
    as_object,
    as_relative_path,
    as_sha256,
    as_text,
    as_timestamp,
    require_keys,
)
from tai.cpu_runtime_files import load_semantic, require_declared_text


def parse_bundle_finalization(
    value: object, plans: list[dict[str, Any]]
) -> tuple[dict[str, Any], list[str]]:
    item = as_object(value, "bundle_finalization")
    require_keys(
        item,
        {"schema_version", "status", "report_sha256", "models"},
        "bundle_finalization",
    )
    expected = {str(plan["model_key"]): plan for plan in plans}
    models: list[dict[str, Any]] = []
    reasons: list[str] = []
    seen: set[str] = set()
    raw_models = as_array(item["models"], "bundle_finalization.models")
    if len(raw_models) != len(plans):
        raise RuntimeEvidenceError(
            "bundle finalization must contain exactly two models"
        )
    for index, raw_model in enumerate(raw_models):
        name = f"bundle_finalization.models[{index}]"
        model = as_object(raw_model, name)
        require_keys(
            model,
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
        model_key = as_identity(model["model_key"], f"{name}.model_key")
        if model_key in seen:
            raise RuntimeEvidenceError("bundle model keys must be unique")
        seen.add(model_key)
        plan = expected.get(model_key)
        if plan is None:
            raise RuntimeEvidenceError(f"unexpected bundle model: {model_key}")
        archive_sha = as_sha256(
            model["archive_sha256"], f"{name}.archive_sha256"
        )
        locator = as_text(
            model["immutable_locator"], f"{name}.immutable_locator"
        )
        parsed: dict[str, Any] = {
            "model_key": model_key,
            "role": as_text(model["role"], f"{name}.role"),
            "model_id": as_identity(model["model_id"], f"{name}.model_id"),
            "revision": as_commit(model["revision"], f"{name}.revision"),
            "archive_sha256": archive_sha,
            "version_id": as_text(model["version_id"], f"{name}.version_id"),
            "immutable_locator": locator,
            "verification_status": as_text(
                model["verification_status"], f"{name}.verification_status"
            ),
            "verification_report_sha256": as_sha256(
                model["verification_report_sha256"],
                f"{name}.verification_report_sha256",
            ),
            "artifact_path": as_relative_path(
                model["artifact_path"], f"{name}.artifact_path"
            ),
            "artifact_sha256": as_sha256(
                model["artifact_sha256"], f"{name}.artifact_sha256"
            ),
        }
        for key in ("role", "model_id", "revision", "artifact_path"):
            if parsed[key] != plan[key]:
                reasons.append(
                    f"BUNDLE_MODEL_BINDING_MISMATCH:{model_key}:{key}"
                )
        if parsed["verification_status"] != "VERIFIED":
            reasons.append(f"BUNDLE_NOT_VERIFIED:{model_key}")
        if (
            not locator.startswith("s3+version://")
            or "versionId=" not in locator
            or f"#sha256={archive_sha}" not in locator
        ):
            reasons.append(f"BUNDLE_LOCATOR_NOT_IMMUTABLE:{model_key}")
        models.append(parsed)
    if set(expected) != seen:
        raise RuntimeEvidenceError("bundle model coverage is incomplete")
    parsed_finalization: dict[str, Any] = {
        "schema_version": as_text(
            item["schema_version"], "bundle_finalization.schema_version"
        ),
        "status": as_text(item["status"], "bundle_finalization.status"),
        "report_sha256": as_sha256(
            item["report_sha256"], "bundle_finalization.report_sha256"
        ),
        "models": models,
    }
    if (
        parsed_finalization["schema_version"]
        != "tai.model-bundle-finalization-report.v1"
    ):
        reasons.append("BUNDLE_FINALIZATION_SCHEMA_MISMATCH")
    if (
        parsed_finalization["status"]
        != "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED"
    ):
        reasons.append("BUNDLE_FINALIZATION_NOT_ACCEPTED")
    return parsed_finalization, reasons


def _parse_concurrency(
    value: object,
    profile_id: str,
    required_levels: list[int],
    thresholds: dict[str, Any],
) -> tuple[list[dict[str, int]], list[str]]:
    entries = as_array(value, f"{profile_id}.concurrency")
    parsed: list[dict[str, int]] = []
    reasons: list[str] = []
    levels: list[int] = []
    minimum_samples = as_int(
        thresholds["minimum_sample_count"],
        "minimum_sample_count",
        minimum=1,
    )
    max_error = as_int(
        thresholds["maximum_error_rate_basis_points"],
        "maximum_error_rate_basis_points",
    )
    max_p95 = as_int(
        thresholds["maximum_p95_latency_ms"],
        "maximum_p95_latency_ms",
        minimum=1,
    )
    min_generation = as_int(
        thresholds["minimum_generation_tokens_per_second_milli"],
        "minimum_generation_tokens_per_second_milli",
        minimum=1,
    )
    for index, raw_entry in enumerate(entries):
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
        level = as_int(entry["level"], f"{name}.level", minimum=1)
        request_count = as_int(
            entry["request_count"], f"{name}.request_count", minimum=1
        )
        failed = as_int(
            entry["failed_requests"], f"{name}.failed_requests"
        )
        error_rate = as_int(
            entry["error_rate_basis_points"],
            f"{name}.error_rate_basis_points",
            maximum=10_000,
        )
        p95 = as_int(
            entry["p95_latency_ms"], f"{name}.p95_latency_ms", minimum=1
        )
        generation = as_int(
            entry["generation_tokens_per_second_milli"],
            f"{name}.generation_tokens_per_second_milli",
            minimum=1,
        )
        if failed > request_count:
            raise RuntimeEvidenceError(f"{name} failed requests exceed total")
        levels.append(level)
        parsed.append(
            {
                "level": level,
                "request_count": request_count,
                "failed_requests": failed,
                "error_rate_basis_points": error_rate,
                "p95_latency_ms": p95,
                "generation_tokens_per_second_milli": generation,
            }
        )
        if request_count < minimum_samples:
            reasons.append(
                f"CONCURRENCY_SAMPLE_COUNT_BELOW_MINIMUM:{level}"
            )
        if error_rate > max_error:
            reasons.append(f"CONCURRENCY_ERROR_RATE_EXCEEDED:{level}")
        if p95 > max_p95:
            reasons.append(f"CONCURRENCY_P95_EXCEEDED:{level}")
        if generation < min_generation:
            reasons.append(
                "CONCURRENCY_GENERATION_THROUGHPUT_BELOW_MINIMUM:"
                f"{level}"
            )
    if levels != required_levels:
        reasons.append("CONCURRENCY_MATRIX_MISMATCH")
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
        item = as_object(raw_profile, f"runtime_profiles[{index}]")
        profile_id = as_identity(
            item.get("profile_id"), f"runtime_profiles[{index}].profile_id"
        )
        if profile_id in by_id:
            raise RuntimeEvidenceError("runtime profile ids must be unique")
        by_id[profile_id] = item
    parsed_profiles: list[dict[str, Any]] = []
    reasons: list[str] = []
    for plan in plans:
        profile_id = str(plan["profile_id"])
        item = by_id.get(profile_id)
        if item is None:
            raise RuntimeEvidenceError(f"runtime profile missing: {profile_id}")
        name = f"runtime_profiles.{profile_id}"
        require_keys(
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
        thresholds = as_object(
            plan["thresholds"], f"{profile_id}.thresholds"
        )
        required_levels = [
            int(level) for level in plan["required_concurrency_levels"]
        ]
        concurrency, concurrency_reasons = _parse_concurrency(
            item["concurrency"], profile_id, required_levels, thresholds
        )
        reasons.extend(concurrency_reasons)
        sample_count = as_int(
            item["sample_count"], f"{name}.sample_count", minimum=1
        )
        prompt_speed = as_int(
            item["prompt_tokens_per_second_milli"],
            f"{name}.prompt_tokens_per_second_milli",
            minimum=1,
        )
        generation_speed = as_int(
            item["generation_tokens_per_second_milli"],
            f"{name}.generation_tokens_per_second_milli",
            minimum=1,
        )
        p95 = as_int(
            item["p95_latency_ms"], f"{name}.p95_latency_ms", minimum=1
        )
        p99 = as_int(
            item["p99_latency_ms"], f"{name}.p99_latency_ms", minimum=1
        )
        error_rate = as_int(
            item["error_rate_basis_points"],
            f"{name}.error_rate_basis_points",
            maximum=10_000,
        )
        peak_ram = as_int(
            item["peak_ram_mb"], f"{name}.peak_ram_mb", minimum=1
        )
        cold_start = as_int(
            item["cold_start_ms"], f"{name}.cold_start_ms", minimum=1
        )
        warmup = as_int(
            item["warmup_ms"], f"{name}.warmup_ms", minimum=1
        )
        if p99 < p95:
            raise RuntimeEvidenceError(
                f"{name} p99 latency must be >= p95"
            )
        parsed: dict[str, Any] = {
            "profile_id": as_identity(
                item["profile_id"], f"{name}.profile_id"
            ),
            "role": as_text(item["role"], f"{name}.role"),
            "model_id": as_identity(item["model_id"], f"{name}.model_id"),
            "revision": as_commit(item["revision"], f"{name}.revision"),
            "runtime_class": as_text(
                item["runtime_class"], f"{name}.runtime_class"
            ),
            "quantization": as_identity(
                item["quantization"], f"{name}.quantization"
            ),
            "artifact_sha256": as_sha256(
                item["artifact_sha256"], f"{name}.artifact_sha256"
            ),
            "hardware_profile_id": as_identity(
                item["hardware_profile_id"], f"{name}.hardware_profile_id"
            ),
            "hardware_path": as_relative_path(
                item["hardware_path"], f"{name}.hardware_path"
            ),
            "environment_path": as_relative_path(
                item["environment_path"], f"{name}.environment_path"
            ),
            "benchmark_metrics_path": as_relative_path(
                item["benchmark_metrics_path"],
                f"{name}.benchmark_metrics_path",
            ),
            "request_metrics_path": as_relative_path(
                item["request_metrics_path"],
                f"{name}.request_metrics_path",
            ),
            "cost_inputs_path": as_relative_path(
                item["cost_inputs_path"], f"{name}.cost_inputs_path"
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
        for key in (
            "profile_id",
            "role",
            "model_id",
            "revision",
            "runtime_class",
            "quantization",
        ):
            if parsed[key] != plan[key]:
                reasons.append(
                    f"PROFILE_BINDING_MISMATCH:{profile_id}:{key}"
                )
        checks = [
            (
                sample_count >= int(thresholds["minimum_sample_count"]),
                "SAMPLE_COUNT_BELOW_MINIMUM",
            ),
            (
                prompt_speed
                >= int(
                    thresholds[
                        "minimum_prompt_tokens_per_second_milli"
                    ]
                ),
                "PROMPT_THROUGHPUT_BELOW_MINIMUM",
            ),
            (
                generation_speed
                >= int(
                    thresholds[
                        "minimum_generation_tokens_per_second_milli"
                    ]
                ),
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
                error_rate
                <= int(thresholds["maximum_error_rate_basis_points"]),
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
        ]
        for passed, reason in checks:
            if not passed:
                reasons.append(f"{reason}:{profile_id}")
        parsed_profiles.append(parsed)
    if set(by_id) != {str(plan["profile_id"]) for plan in plans}:
        raise RuntimeEvidenceError("unexpected runtime profile")
    return parsed_profiles, reasons


def parse_fallback(
    value: object, authority: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    item = as_object(value, "fallback_exercise")
    require_keys(
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
    trigger = as_int(
        item["trigger_count"], "fallback_exercise.trigger_count", minimum=1
    )
    successful = as_int(
        item["successful_transitions"],
        "fallback_exercise.successful_transitions",
    )
    failed = as_int(
        item["failed_transitions"], "fallback_exercise.failed_transitions"
    )
    p95 = as_int(
        item["p95_takeover_ms"],
        "fallback_exercise.p95_takeover_ms",
        minimum=1,
    )
    continuity = as_int(
        item["continuity_violations"],
        "fallback_exercise.continuity_violations",
    )
    forced = as_bool(
        item["forced_primary_failure"],
        "fallback_exercise.forced_primary_failure",
    )
    primary = as_identity(
        item["primary_profile_id"],
        "fallback_exercise.primary_profile_id",
    )
    fallback_id = as_identity(
        item["fallback_profile_id"],
        "fallback_exercise.fallback_profile_id",
    )
    parsed: dict[str, Any] = {
        "primary_profile_id": primary,
        "fallback_profile_id": fallback_id,
        "forced_primary_failure": forced,
        "trigger_count": trigger,
        "successful_transitions": successful,
        "failed_transitions": failed,
        "p95_takeover_ms": p95,
        "continuity_violations": continuity,
        "raw_metrics_path": as_relative_path(
            item["raw_metrics_path"],
            "fallback_exercise.raw_metrics_path",
        ),
        "protocol_path": as_relative_path(
            item["protocol_path"], "fallback_exercise.protocol_path"
        ),
    }
    plan = as_object(authority["fallback"], "authority.fallback")
    reasons: list[str] = []
    if primary != EXPECTED_PROFILES[0]["profile_id"]:
        reasons.append("FALLBACK_PRIMARY_PROFILE_MISMATCH")
    if fallback_id != EXPECTED_PROFILES[1]["profile_id"]:
        reasons.append("FALLBACK_SECONDARY_PROFILE_MISMATCH")
    if forced is not bool(plan["forced_primary_failure_required"]):
        reasons.append("FALLBACK_PRIMARY_FAILURE_NOT_FORCED")
    if trigger < int(plan["minimum_trigger_count"]):
        reasons.append("FALLBACK_TRIGGER_COUNT_BELOW_MINIMUM")
    if successful + failed != trigger:
        reasons.append("FALLBACK_TRANSITION_COUNT_MISMATCH")
    if failed > int(plan["maximum_failed_transitions"]):
        reasons.append("FALLBACK_FAILED_TRANSITIONS_PRESENT")
    if p95 > int(plan["maximum_p95_takeover_ms"]):
        reasons.append("FALLBACK_TAKEOVER_LATENCY_EXCEEDED")
    if continuity > int(plan["maximum_continuity_violations"]):
        reasons.append("FALLBACK_CONTINUITY_VIOLATIONS_PRESENT")
    return parsed, reasons


def parse_soak(
    value: object, authority: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    item = as_object(value, "soak")
    require_keys(
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
    profile_id = as_identity(item["profile_id"], "soak.profile_id")
    duration = as_int(
        item["duration_seconds"], "soak.duration_seconds", minimum=1
    )
    requests = as_int(
        item["request_count"], "soak.request_count", minimum=1
    )
    failed = as_int(item["failed_requests"], "soak.failed_requests")
    critical = as_int(
        item["critical_failures"], "soak.critical_failures"
    )
    drift = as_int(item["memory_drift_mb"], "soak.memory_drift_mb")
    if failed > requests:
        raise RuntimeEvidenceError(
            "soak failed_requests exceeds request_count"
        )
    parsed: dict[str, Any] = {
        "profile_id": profile_id,
        "duration_seconds": duration,
        "request_count": requests,
        "failed_requests": failed,
        "critical_failures": critical,
        "memory_start_mb": as_int(
            item["memory_start_mb"], "soak.memory_start_mb", minimum=1
        ),
        "memory_end_mb": as_int(
            item["memory_end_mb"], "soak.memory_end_mb", minimum=1
        ),
        "memory_peak_mb": as_int(
            item["memory_peak_mb"], "soak.memory_peak_mb", minimum=1
        ),
        "memory_drift_mb": drift,
        "p95_latency_ms": as_int(
            item["p95_latency_ms"], "soak.p95_latency_ms", minimum=1
        ),
        "raw_metrics_path": as_relative_path(
            item["raw_metrics_path"], "soak.raw_metrics_path"
        ),
        "environment_path": as_relative_path(
            item["environment_path"], "soak.environment_path"
        ),
    }
    plan = as_object(authority["soak"], "authority.soak")
    reasons: list[str] = []
    if profile_id not in {
        str(profile["profile_id"]) for profile in EXPECTED_PROFILES
    }:
        reasons.append("SOAK_PROFILE_UNKNOWN")
    if duration < int(plan["minimum_duration_seconds"]):
        reasons.append("SOAK_DURATION_BELOW_MINIMUM")
    if requests < int(plan["minimum_request_count"]):
        reasons.append("SOAK_REQUEST_COUNT_BELOW_MINIMUM")
    if failed > int(plan["maximum_failed_requests"]):
        reasons.append("SOAK_FAILED_REQUESTS_EXCEEDED")
    if critical > int(plan["maximum_critical_failures"]):
        reasons.append("SOAK_CRITICAL_FAILURES_PRESENT")
    if drift > int(plan["maximum_memory_drift_mb"]):
        reasons.append("SOAK_MEMORY_DRIFT_EXCEEDED")
    return parsed, reasons


def validate_profile_semantics(
    original_root: Path,
    records: dict[str, dict[str, Any]],
    profile: dict[str, Any],
) -> list[str]:
    profile_id = str(profile["profile_id"])
    reasons: list[str] = []
    hardware = load_semantic(
        original_root,
        records,
        str(profile["hardware_path"]),
        f"{profile_id}.hardware",
    )
    require_keys(
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
    as_timestamp(
        hardware["captured_at"], f"{profile_id}.hardware.captured_at"
    )
    as_text(hardware["cpu_model"], f"{profile_id}.hardware.cpu_model")
    as_int(
        hardware["logical_cpus"],
        f"{profile_id}.hardware.logical_cpus",
        minimum=1,
    )
    as_int(
        hardware["ram_mb"], f"{profile_id}.hardware.ram_mb", minimum=1
    )
    as_sha256(
        hardware["hostname_sha256"],
        f"{profile_id}.hardware.hostname_sha256",
    )
    if hardware["host_role"] != "DEDICATED_MODEL_HOST":
        reasons.append(f"HARDWARE_HOST_ROLE_INVALID:{profile_id}")
    if hardware["user"] != "tai-model":
        reasons.append(f"HARDWARE_USER_INVALID:{profile_id}")

    environment = load_semantic(
        original_root,
        records,
        str(profile["environment_path"]),
        f"{profile_id}.environment",
    )
    require_keys(
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
    expected_environment: dict[str, Any] = {
        "profile_id": profile["profile_id"],
        "model_id": profile["model_id"],
        "revision": profile["revision"],
        "runtime_class": profile["runtime_class"],
        "quantization": profile["quantization"],
        "artifact_sha256": profile["artifact_sha256"],
        "toolchain_commit": TOOLCHAIN_COMMIT,
        "loopback_only": True,
    }
    for key, expected in expected_environment.items():
        if environment.get(key) != expected:
            reasons.append(
                f"ENVIRONMENT_BINDING_MISMATCH:{profile_id}:{key}"
            )
    as_timestamp(
        environment["captured_at"],
        f"{profile_id}.environment.captured_at",
    )

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
    for path_key, schema in (
        ("benchmark_metrics_path", "tai.llama-bench-metrics.v1"),
        ("request_metrics_path", "tai.cpu-request-metrics.v1"),
    ):
        metrics = load_semantic(
            original_root,
            records,
            str(profile[path_key]),
            f"{profile_id}.{path_key}",
        )
        require_keys(
            metrics,
            {"schema_version", "profile_id", *metric_fields},
            f"{profile_id}.{path_key}",
        )
        if metrics["schema_version"] != schema:
            reasons.append(
                f"METRICS_SCHEMA_MISMATCH:{profile_id}:{path_key}"
            )
        if metrics["profile_id"] != profile_id:
            reasons.append(
                f"METRICS_PROFILE_MISMATCH:{profile_id}:{path_key}"
            )
        for field in metric_fields:
            if metrics[field] != profile[field]:
                reasons.append(
                    "METRICS_SEMANTIC_MISMATCH:"
                    f"{profile_id}:{path_key}:{field}"
                )

    cost = load_semantic(
        original_root,
        records,
        str(profile["cost_inputs_path"]),
        f"{profile_id}.cost",
    )
    require_keys(
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
    as_int(
        cost["host_cost_rub_monthly_milli"],
        f"{profile_id}.cost.host_cost_rub_monthly_milli",
    )
    as_int(
        cost["power_watts_milli"],
        f"{profile_id}.cost.power_watts_milli",
        minimum=1,
    )
    as_int(
        cost["utilization_basis_points"],
        f"{profile_id}.cost.utilization_basis_points",
        minimum=1,
        maximum=10_000,
    )
    as_int(
        cost["token_basis"],
        f"{profile_id}.cost.token_basis",
        minimum=1,
    )
    as_timestamp(cost["measured_at"], f"{profile_id}.cost.measured_at")
    return reasons


def validate_fallback_semantics(
    original_root: Path,
    records: dict[str, dict[str, Any]],
    fallback: dict[str, Any],
) -> list[str]:
    metrics = load_semantic(
        original_root,
        records,
        str(fallback["raw_metrics_path"]),
        "fallback metrics",
    )
    semantic_keys = set(fallback) - {"raw_metrics_path", "protocol_path"}
    require_keys(
        metrics, {"schema_version", *semantic_keys}, "fallback metrics"
    )
    reasons: list[str] = []
    if metrics["schema_version"] != "tai.cpu-fallback-metrics.v1":
        reasons.append("FALLBACK_METRICS_SCHEMA_MISMATCH")
    for key in semantic_keys:
        if metrics[key] != fallback[key]:
            reasons.append(
                f"FALLBACK_METRICS_SEMANTIC_MISMATCH:{key}"
            )
    require_declared_text(
        original_root,
        records,
        str(fallback["protocol_path"]),
        "fallback protocol",
    )
    return reasons


def validate_soak_semantics(
    original_root: Path,
    records: dict[str, dict[str, Any]],
    soak: dict[str, Any],
) -> list[str]:
    metrics = load_semantic(
        original_root,
        records,
        str(soak["raw_metrics_path"]),
        "soak metrics",
    )
    semantic_keys = set(soak) - {"raw_metrics_path", "environment_path"}
    require_keys(metrics, {"schema_version", *semantic_keys}, "soak metrics")
    reasons: list[str] = []
    if metrics["schema_version"] != "tai.cpu-soak-metrics.v1":
        reasons.append("SOAK_METRICS_SCHEMA_MISMATCH")
    for key in semantic_keys:
        if metrics[key] != soak[key]:
            reasons.append(f"SOAK_METRICS_SEMANTIC_MISMATCH:{key}")
    require_declared_text(
        original_root,
        records,
        str(soak["environment_path"]),
        "soak environment",
    )
    return reasons
