from __future__ import annotations

from typing import Any

from tai.cpu_runtime_contract import (
    EXPECTED_PROFILES,
    RuntimeEvidenceError,
    as_bool,
    as_identity,
    as_int,
    as_object,
    as_relative_path,
    require_keys,
)


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
    parsed: dict[str, Any] = {
        "primary_profile_id": as_identity(
            item["primary_profile_id"],
            "fallback_exercise.primary_profile_id",
        ),
        "fallback_profile_id": as_identity(
            item["fallback_profile_id"],
            "fallback_exercise.fallback_profile_id",
        ),
        "forced_primary_failure": as_bool(
            item["forced_primary_failure"],
            "fallback_exercise.forced_primary_failure",
        ),
        "trigger_count": as_int(
            item["trigger_count"],
            "fallback_exercise.trigger_count",
            minimum=1,
        ),
        "successful_transitions": as_int(
            item["successful_transitions"],
            "fallback_exercise.successful_transitions",
        ),
        "failed_transitions": as_int(
            item["failed_transitions"],
            "fallback_exercise.failed_transitions",
        ),
        "p95_takeover_ms": as_int(
            item["p95_takeover_ms"],
            "fallback_exercise.p95_takeover_ms",
            minimum=1,
        ),
        "continuity_violations": as_int(
            item["continuity_violations"],
            "fallback_exercise.continuity_violations",
        ),
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
    primary = str(parsed["primary_profile_id"])
    fallback_id = str(parsed["fallback_profile_id"])
    trigger = int(parsed["trigger_count"])
    successful = int(parsed["successful_transitions"])
    failed = int(parsed["failed_transitions"])
    if primary != EXPECTED_PROFILES[0]["profile_id"]:
        reasons.append("FALLBACK_PRIMARY_PROFILE_MISMATCH")
    if fallback_id != EXPECTED_PROFILES[1]["profile_id"]:
        reasons.append("FALLBACK_SECONDARY_PROFILE_MISMATCH")
    if bool(parsed["forced_primary_failure"]) is not bool(
        plan["forced_primary_failure_required"]
    ):
        reasons.append("FALLBACK_PRIMARY_FAILURE_NOT_FORCED")
    if trigger < int(plan["minimum_trigger_count"]):
        reasons.append("FALLBACK_TRIGGER_COUNT_BELOW_MINIMUM")
    if successful + failed != trigger:
        reasons.append("FALLBACK_TRANSITION_COUNT_MISMATCH")
    if failed > int(plan["maximum_failed_transitions"]):
        reasons.append("FALLBACK_FAILED_TRANSITIONS_PRESENT")
    if int(parsed["p95_takeover_ms"]) > int(
        plan["maximum_p95_takeover_ms"]
    ):
        reasons.append("FALLBACK_TAKEOVER_LATENCY_EXCEEDED")
    if int(parsed["continuity_violations"]) > int(
        plan["maximum_continuity_violations"]
    ):
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
    parsed: dict[str, Any] = {
        "profile_id": as_identity(item["profile_id"], "soak.profile_id"),
        "duration_seconds": as_int(
            item["duration_seconds"], "soak.duration_seconds", minimum=1
        ),
        "request_count": as_int(
            item["request_count"], "soak.request_count", minimum=1
        ),
        "failed_requests": as_int(
            item["failed_requests"], "soak.failed_requests"
        ),
        "critical_failures": as_int(
            item["critical_failures"], "soak.critical_failures"
        ),
        "memory_start_mb": as_int(
            item["memory_start_mb"], "soak.memory_start_mb", minimum=1
        ),
        "memory_end_mb": as_int(
            item["memory_end_mb"], "soak.memory_end_mb", minimum=1
        ),
        "memory_peak_mb": as_int(
            item["memory_peak_mb"], "soak.memory_peak_mb", minimum=1
        ),
        "memory_drift_mb": as_int(
            item["memory_drift_mb"], "soak.memory_drift_mb"
        ),
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
    failed = int(parsed["failed_requests"])
    requests = int(parsed["request_count"])
    if failed > requests:
        raise RuntimeEvidenceError(
            "soak failed_requests exceeds request_count"
        )
    plan = as_object(authority["soak"], "authority.soak")
    reasons: list[str] = []
    if parsed["profile_id"] not in {
        str(profile["profile_id"]) for profile in EXPECTED_PROFILES
    }:
        reasons.append("SOAK_PROFILE_UNKNOWN")
    if int(parsed["duration_seconds"]) < int(
        plan["minimum_duration_seconds"]
    ):
        reasons.append("SOAK_DURATION_BELOW_MINIMUM")
    if requests < int(plan["minimum_request_count"]):
        reasons.append("SOAK_REQUEST_COUNT_BELOW_MINIMUM")
    if failed > int(plan["maximum_failed_requests"]):
        reasons.append("SOAK_FAILED_REQUESTS_EXCEEDED")
    if int(parsed["critical_failures"]) > int(
        plan["maximum_critical_failures"]
    ):
        reasons.append("SOAK_CRITICAL_FAILURES_PRESENT")
    if int(parsed["memory_drift_mb"]) > int(
        plan["maximum_memory_drift_mb"]
    ):
        reasons.append("SOAK_MEMORY_DRIFT_EXCEEDED")
    return parsed, reasons
