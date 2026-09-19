from __future__ import annotations

from pathlib import Path
from typing import Any

from tai.cpu_runtime_contract import (
    TOOLCHAIN_COMMIT,
    as_int,
    as_sha256,
    as_text,
    as_timestamp,
    require_keys,
)
from tai.cpu_runtime_files import load_semantic, require_declared_text

METRIC_FIELDS = {
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
            {"schema_version", "profile_id", *METRIC_FIELDS},
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
        for field in METRIC_FIELDS:
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
        cost["token_basis"], f"{profile_id}.cost.token_basis", minimum=1
    )
    as_timestamp(cost["measured_at"], f"{profile_id}.cost.measured_at")
    return reasons


def _validate_semantic_record(
    original_root: Path,
    records: dict[str, dict[str, Any]],
    value: dict[str, Any],
    *,
    path_field: str,
    excluded: set[str],
    schema: str,
    prefix: str,
    label: str,
) -> list[str]:
    metrics = load_semantic(
        original_root, records, str(value[path_field]), label
    )
    semantic_keys = set(value) - excluded
    require_keys(metrics, {"schema_version", *semantic_keys}, label)
    reasons: list[str] = []
    if metrics["schema_version"] != schema:
        reasons.append(f"{prefix}_SCHEMA_MISMATCH")
    for key in semantic_keys:
        if metrics[key] != value[key]:
            reasons.append(f"{prefix}_SEMANTIC_MISMATCH:{key}")
    return reasons


def validate_fallback_semantics(
    original_root: Path,
    records: dict[str, dict[str, Any]],
    fallback: dict[str, Any],
) -> list[str]:
    reasons = _validate_semantic_record(
        original_root,
        records,
        fallback,
        path_field="raw_metrics_path",
        excluded={"raw_metrics_path", "protocol_path"},
        schema="tai.cpu-fallback-metrics.v1",
        prefix="FALLBACK_METRICS",
        label="fallback metrics",
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
    reasons = _validate_semantic_record(
        original_root,
        records,
        soak,
        path_field="raw_metrics_path",
        excluded={"raw_metrics_path", "environment_path"},
        schema="tai.cpu-soak-metrics.v1",
        prefix="SOAK_METRICS",
        label="soak metrics",
    )
    require_declared_text(
        original_root,
        records,
        str(soak["environment_path"]),
        "soak environment",
    )
    return reasons
