from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_IDENTITY = re.compile(r"^[A-Za-z0-9._:/+-]{1,200}$")

_EXPECTED_MATURITY = {
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}


class ExecutionContractError(ValueError):
    pass


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    output: dict[str, Any] = {}
    for key, value in pairs:
        if key in output:
            raise ExecutionContractError(f"duplicate JSON key: {key}")
        output[key] = value
    return output


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicates
        )
    except (OSError, json.JSONDecodeError, ExecutionContractError) as exc:
        raise ExecutionContractError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ExecutionContractError(f"JSON root must be an object: {path}")
    return value


def canonical_sha256(value: object) -> str:
    rendered = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    )
    return hashlib.sha256(rendered.encode("utf-8")).hexdigest()


def _require_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    observed = set(value)
    missing = sorted(expected - observed)
    unknown = sorted(observed - expected)
    if missing or unknown:
        raise ExecutionContractError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ExecutionContractError(f"{name} must be an object")
    return value


def _array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise ExecutionContractError(f"{name} must be an array")
    return value


def _text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ExecutionContractError(f"{name} must be a non-blank string")
    return value


def _boolean(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise ExecutionContractError(f"{name} must be a boolean")
    return value


def _integer(value: object, name: str, *, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise ExecutionContractError(f"{name} must be an integer >= {minimum}")
    return value


def _sha256(value: object, name: str) -> str:
    text = _text(value, name)
    if _SHA256.fullmatch(text) is None:
        raise ExecutionContractError(f"{name} must be a lowercase SHA-256")
    return text


def _commit(value: object, name: str) -> str:
    text = _text(value, name)
    if _COMMIT.fullmatch(text) is None:
        raise ExecutionContractError(f"{name} must be an exact lowercase Git commit")
    return text


def _identity(value: object, name: str) -> str:
    text = _text(value, name)
    if _IDENTITY.fullmatch(text) is None:
        raise ExecutionContractError(f"{name} must be a portable bounded identity")
    return text


def _timestamp(value: object, name: str) -> datetime:
    text = _text(value, name)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ExecutionContractError(f"{name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise ExecutionContractError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def _string_array(value: object, name: str, *, non_empty: bool = True) -> list[str]:
    items = [
        _text(item, f"{name}[{index}]")
        for index, item in enumerate(_array(value, name))
    ]
    if non_empty and not items:
        raise ExecutionContractError(f"{name} must be non-empty")
    if len(items) != len(set(items)):
        raise ExecutionContractError(f"{name} must contain unique values")
    return items


def _integer_array(value: object, name: str) -> list[int]:
    items = [
        _integer(item, f"{name}[{index}]", minimum=1)
        for index, item in enumerate(_array(value, name))
    ]
    if not items or items != sorted(set(items)):
        raise ExecutionContractError(f"{name} must be non-empty sorted unique")
    return items


def load_execution_authority(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
        {
            "schema_version",
            "program_issue",
            "parent_issue",
            "issue",
            "command",
            "prerequisite_gate",
            "benchmark_authority",
            "bundle_authority",
            "toolchain",
            "target",
            "models",
            "evaluation",
            "measurements",
            "fallback",
            "soak",
            "evidence",
            "maturity_boundary",
        },
        "execution authority",
    )
    if raw["schema_version"] != "tai.cpu-benchmark-execution-authority.v1":
        raise ExecutionContractError("unsupported execution authority schema_version")
    if (
        _integer(raw["program_issue"], "execution authority.program_issue", minimum=1),
        _integer(raw["parent_issue"], "execution authority.parent_issue", minimum=1),
        _integer(raw["issue"], "execution authority.issue", minimum=1),
    ) != (2726, 2971, 2977):
        raise ExecutionContractError("execution authority issue binding mismatch")
    if raw["command"] != "/tai benchmark cpu-fallback exact-main":
        raise ExecutionContractError("execution authority command mismatch")

    prerequisite = _object(raw["prerequisite_gate"], "prerequisite_gate")
    _require_keys(
        prerequisite,
        {
            "authority_schema",
            "report_schema",
            "slice_id",
            "required_status",
            "maximum_report_age_hours",
        },
        "prerequisite_gate",
    )
    parsed_prerequisite = {
        "authority_schema": _text(
            prerequisite["authority_schema"], "prerequisite_gate.authority_schema"
        ),
        "report_schema": _text(
            prerequisite["report_schema"], "prerequisite_gate.report_schema"
        ),
        "slice_id": _identity(prerequisite["slice_id"], "prerequisite_gate.slice_id"),
        "required_status": _text(
            prerequisite["required_status"], "prerequisite_gate.required_status"
        ),
        "maximum_report_age_hours": _integer(
            prerequisite["maximum_report_age_hours"],
            "prerequisite_gate.maximum_report_age_hours",
            minimum=1,
        ),
    }
    if parsed_prerequisite != {
        "authority_schema": "tai.benchmark-prerequisite-authority.v1",
        "report_schema": "tai.benchmark-prerequisite-report.v1",
        "slice_id": "cpu-fallback-execution",
        "required_status": "READY_FOR_CPU_FALLBACK_BENCHMARK",
        "maximum_report_age_hours": 24,
    }:
        raise ExecutionContractError("prerequisite gate weakens the exact CPU slice")

    benchmark = _object(raw["benchmark_authority"], "benchmark_authority")
    _require_keys(
        benchmark,
        {"schema_version", "issue", "suite_id", "required_profiles"},
        "benchmark_authority",
    )
    parsed_benchmark = {
        "schema_version": _text(
            benchmark["schema_version"], "benchmark_authority.schema_version"
        ),
        "issue": _integer(benchmark["issue"], "benchmark_authority.issue", minimum=1),
        "suite_id": _identity(
            benchmark["suite_id"], "benchmark_authority.suite_id"
        ),
        "required_profiles": _string_array(
            benchmark["required_profiles"], "benchmark_authority.required_profiles"
        ),
    }
    if parsed_benchmark != {
        "schema_version": "tai.model-benchmark-admission-authority.v2",
        "issue": 2862,
        "suite_id": "tai-platform-agro-58-v1",
        "required_profiles": [
            "qwen3-8b-cpu-q4-k-m",
            "mistral-7b-fallback-cpu-q4-k-m",
        ],
    }:
        raise ExecutionContractError("benchmark authority binding mismatch")

    bundle = _object(raw["bundle_authority"], "bundle_authority")
    _require_keys(
        bundle,
        {
            "schema_version",
            "finalization_issue",
            "required_finalization_status",
            "verification_status",
            "exact_version_restore_required",
            "independent_restore_roots_required",
        },
        "bundle_authority",
    )
    parsed_bundle = {
        "schema_version": _text(
            bundle["schema_version"], "bundle_authority.schema_version"
        ),
        "finalization_issue": _integer(
            bundle["finalization_issue"],
            "bundle_authority.finalization_issue",
            minimum=1,
        ),
        "required_finalization_status": _text(
            bundle["required_finalization_status"],
            "bundle_authority.required_finalization_status",
        ),
        "verification_status": _text(
            bundle["verification_status"], "bundle_authority.verification_status"
        ),
        "exact_version_restore_required": _boolean(
            bundle["exact_version_restore_required"],
            "bundle_authority.exact_version_restore_required",
        ),
        "independent_restore_roots_required": _boolean(
            bundle["independent_restore_roots_required"],
            "bundle_authority.independent_restore_roots_required",
        ),
    }
    if parsed_bundle != {
        "schema_version": "tai.model-bundle-authority.v2",
        "finalization_issue": 2961,
        "required_finalization_status": "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED",
        "verification_status": "VERIFIED",
        "exact_version_restore_required": True,
        "independent_restore_roots_required": True,
    }:
        raise ExecutionContractError("bundle authority binding mismatch")

    toolchain = _object(raw["toolchain"], "toolchain")
    _require_keys(
        toolchain,
        {"name", "release", "commit", "profile", "required_binaries"},
        "toolchain",
    )
    parsed_toolchain = {
        "name": _text(toolchain["name"], "toolchain.name"),
        "release": _text(toolchain["release"], "toolchain.release"),
        "commit": _commit(toolchain["commit"], "toolchain.commit"),
        "profile": _identity(toolchain["profile"], "toolchain.profile"),
        "required_binaries": _string_array(
            toolchain["required_binaries"], "toolchain.required_binaries"
        ),
    }
    if parsed_toolchain != {
        "name": "ggml-org/llama.cpp",
        "release": "b9637",
        "commit": "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3",
        "profile": "linux-x86_64-cpu-release-static-v1",
        "required_binaries": ["llama-cli", "llama-server", "llama-bench"],
    }:
        raise ExecutionContractError("toolchain binding mismatch")

    target = _object(raw["target"], "target")
    _require_keys(
        target,
        {
            "host_role",
            "required_user",
            "workspace_root",
            "ssh_secret_prefix",
            "production_fallback_allowed",
            "network_egress",
        },
        "target",
    )
    parsed_target = {
        "host_role": _text(target["host_role"], "target.host_role"),
        "required_user": _text(target["required_user"], "target.required_user"),
        "workspace_root": _text(target["workspace_root"], "target.workspace_root"),
        "ssh_secret_prefix": _text(
            target["ssh_secret_prefix"], "target.ssh_secret_prefix"
        ),
        "production_fallback_allowed": _boolean(
            target["production_fallback_allowed"], "target.production_fallback_allowed"
        ),
        "network_egress": _text(target["network_egress"], "target.network_egress"),
    }
    if parsed_target != {
        "host_role": "DEDICATED_MODEL_HOST",
        "required_user": "tai-model",
        "workspace_root": "/srv/tai-models/benchmark-runs",
        "ssh_secret_prefix": "TAI_MODEL_",
        "production_fallback_allowed": False,
        "network_egress": "S3_EXACT_VERSION_ONLY",
    }:
        raise ExecutionContractError("target boundary mismatch")

    models: list[dict[str, Any]] = []
    for index, raw_model in enumerate(_array(raw["models"], "models")):
        name = f"models[{index}]"
        model = _object(raw_model, name)
        _require_keys(
            model,
            {
                "key",
                "role",
                "model_id",
                "revision",
                "runtime_profile_id",
                "runtime_class",
                "quantization",
                "artifact_path",
                "required_concurrency_levels",
            },
            name,
        )
        models.append(
            {
                "key": _identity(model["key"], f"{name}.key"),
                "role": _text(model["role"], f"{name}.role"),
                "model_id": _identity(model["model_id"], f"{name}.model_id"),
                "revision": _commit(model["revision"], f"{name}.revision"),
                "runtime_profile_id": _identity(
                    model["runtime_profile_id"], f"{name}.runtime_profile_id"
                ),
                "runtime_class": _text(
                    model["runtime_class"], f"{name}.runtime_class"
                ),
                "quantization": _identity(
                    model["quantization"], f"{name}.quantization"
                ),
                "artifact_path": _text(
                    model["artifact_path"], f"{name}.artifact_path"
                ),
                "required_concurrency_levels": _integer_array(
                    model["required_concurrency_levels"],
                    f"{name}.required_concurrency_levels",
                ),
            }
        )
    expected_models = [
        {
            "key": "qwen3-8b",
            "role": "PRIMARY",
            "model_id": "Qwen/Qwen3-8B",
            "revision": "895c8d171bc03c30e113cd7a28c02494b5e068b7",
            "runtime_profile_id": "qwen3-8b-cpu-q4-k-m",
            "runtime_class": "CPU",
            "quantization": "Q4_K_M",
            "artifact_path": "artifacts/qwen3-8b-q4-k-m.gguf",
            "required_concurrency_levels": [1, 2, 4],
        },
        {
            "key": "mistral-7b-instruct-v0.3",
            "role": "FALLBACK",
            "model_id": "mistralai/Mistral-7B-Instruct-v0.3",
            "revision": "c170c708c41dac9275d15a8fff4eca08d52bab71",
            "runtime_profile_id": "mistral-7b-fallback-cpu-q4-k-m",
            "runtime_class": "CPU",
            "quantization": "Q4_K_M",
            "artifact_path": "artifacts/mistral-7b-instruct-v0.3-q4-k-m.gguf",
            "required_concurrency_levels": [1, 2, 4],
        },
    ]
    if models != expected_models:
        raise ExecutionContractError("model execution set mismatch")

    evaluation = _object(raw["evaluation"], "evaluation")
    _require_keys(
        evaluation,
        {
            "suite_id",
            "assessment_schema",
            "required_status",
            "required_accepted",
            "required_total_cases",
            "required_critical_cases",
            "maximum_unreviewed_cases",
            "source_root",
            "materializer",
        },
        "evaluation",
    )
    parsed_evaluation = {
        "suite_id": _identity(evaluation["suite_id"], "evaluation.suite_id"),
        "assessment_schema": _text(
            evaluation["assessment_schema"], "evaluation.assessment_schema"
        ),
        "required_status": _text(
            evaluation["required_status"], "evaluation.required_status"
        ),
        "required_accepted": _boolean(
            evaluation["required_accepted"], "evaluation.required_accepted"
        ),
        "required_total_cases": _integer(
            evaluation["required_total_cases"],
            "evaluation.required_total_cases",
            minimum=1,
        ),
        "required_critical_cases": _integer(
            evaluation["required_critical_cases"],
            "evaluation.required_critical_cases",
            minimum=1,
        ),
        "maximum_unreviewed_cases": _integer(
            evaluation["maximum_unreviewed_cases"],
            "evaluation.maximum_unreviewed_cases",
        ),
        "source_root": _text(evaluation["source_root"], "evaluation.source_root"),
        "materializer": _text(evaluation["materializer"], "evaluation.materializer"),
    }
    if parsed_evaluation != {
        "suite_id": "tai-platform-agro-58-v1",
        "assessment_schema": "tai.gold-set-assessment.v1",
        "required_status": "ACCEPTED",
        "required_accepted": True,
        "required_total_cases": 58,
        "required_critical_cases": 23,
        "maximum_unreviewed_cases": 0,
        "source_root": "docs/platform-v7/autopilot/tai-ap-14c",
        "materializer": "docs/platform-v7/autopilot/tai-ap-14c/gold-set-authority.mjs",
    }:
        raise ExecutionContractError("evaluation authority binding mismatch")

    measurements = _object(raw["measurements"], "measurements")
    _require_keys(
        measurements,
        {
            "minimum_sample_count",
            "metrics",
            "concurrency_levels",
            "deterministic_seed",
            "temperature_milli",
            "maximum_output_tokens",
        },
        "measurements",
    )
    parsed_measurements = {
        "minimum_sample_count": _integer(
            measurements["minimum_sample_count"],
            "measurements.minimum_sample_count",
            minimum=1,
        ),
        "metrics": _string_array(measurements["metrics"], "measurements.metrics"),
        "concurrency_levels": _integer_array(
            measurements["concurrency_levels"], "measurements.concurrency_levels"
        ),
        "deterministic_seed": _integer(
            measurements["deterministic_seed"], "measurements.deterministic_seed"
        ),
        "temperature_milli": _integer(
            measurements["temperature_milli"], "measurements.temperature_milli"
        ),
        "maximum_output_tokens": _integer(
            measurements["maximum_output_tokens"],
            "measurements.maximum_output_tokens",
            minimum=1,
        ),
    }
    expected_metrics = [
        "prompt_tokens_per_second",
        "generation_tokens_per_second",
        "p50_latency_ms",
        "p95_latency_ms",
        "p99_latency_ms",
        "error_rate",
        "peak_ram_mb",
        "cold_start_ms",
        "warmup_ms",
        "operating_cost_inputs",
    ]
    if parsed_measurements != {
        "minimum_sample_count": 100,
        "metrics": expected_metrics,
        "concurrency_levels": [1, 2, 4],
        "deterministic_seed": 13001,
        "temperature_milli": 0,
        "maximum_output_tokens": 512,
    }:
        raise ExecutionContractError("measurement policy mismatch")

    fallback = _object(raw["fallback"], "fallback")
    _require_keys(
        fallback,
        {
            "minimum_trigger_count",
            "forced_primary_failure_required",
            "maximum_failed_transitions",
            "maximum_continuity_violations",
            "maximum_critical_unsupported_facts",
        },
        "fallback",
    )
    parsed_fallback = {
        "minimum_trigger_count": _integer(
            fallback["minimum_trigger_count"],
            "fallback.minimum_trigger_count",
            minimum=1,
        ),
        "forced_primary_failure_required": _boolean(
            fallback["forced_primary_failure_required"],
            "fallback.forced_primary_failure_required",
        ),
        "maximum_failed_transitions": _integer(
            fallback["maximum_failed_transitions"],
            "fallback.maximum_failed_transitions",
        ),
        "maximum_continuity_violations": _integer(
            fallback["maximum_continuity_violations"],
            "fallback.maximum_continuity_violations",
        ),
        "maximum_critical_unsupported_facts": _integer(
            fallback["maximum_critical_unsupported_facts"],
            "fallback.maximum_critical_unsupported_facts",
        ),
    }
    if parsed_fallback != {
        "minimum_trigger_count": 100,
        "forced_primary_failure_required": True,
        "maximum_failed_transitions": 0,
        "maximum_continuity_violations": 0,
        "maximum_critical_unsupported_facts": 0,
    }:
        raise ExecutionContractError("fallback policy mismatch")

    soak = _object(raw["soak"], "soak")
    _require_keys(
        soak,
        {
            "minimum_duration_seconds",
            "minimum_request_count",
            "maximum_failed_requests",
            "maximum_critical_failures",
            "maximum_memory_drift_mb",
        },
        "soak",
    )
    parsed_soak = {
        key: _integer(soak[key], f"soak.{key}", minimum=0)
        for key in {
            "minimum_duration_seconds",
            "minimum_request_count",
            "maximum_failed_requests",
            "maximum_critical_failures",
            "maximum_memory_drift_mb",
        }
    }
    if parsed_soak != {
        "minimum_duration_seconds": 3600,
        "minimum_request_count": 1000,
        "maximum_failed_requests": 10,
        "maximum_critical_failures": 0,
        "maximum_memory_drift_mb": 512,
    }:
        raise ExecutionContractError("soak policy mismatch")

    evidence = _object(raw["evidence"], "evidence")
    _require_keys(
        evidence,
        {
            "bounded_metadata_only",
            "maximum_github_file_bytes",
            "forbidden_suffixes",
            "forbidden_path_fragments",
            "artifact_retention_days",
            "independent_restore_required",
        },
        "evidence",
    )
    parsed_evidence = {
        "bounded_metadata_only": _boolean(
            evidence["bounded_metadata_only"], "evidence.bounded_metadata_only"
        ),
        "maximum_github_file_bytes": _integer(
            evidence["maximum_github_file_bytes"],
            "evidence.maximum_github_file_bytes",
            minimum=1,
        ),
        "forbidden_suffixes": _string_array(
            evidence["forbidden_suffixes"], "evidence.forbidden_suffixes"
        ),
        "forbidden_path_fragments": _string_array(
            evidence["forbidden_path_fragments"],
            "evidence.forbidden_path_fragments",
        ),
        "artifact_retention_days": _integer(
            evidence["artifact_retention_days"],
            "evidence.artifact_retention_days",
            minimum=1,
        ),
        "independent_restore_required": _boolean(
            evidence["independent_restore_required"],
            "evidence.independent_restore_required",
        ),
    }
    if parsed_evidence != {
        "bounded_metadata_only": True,
        "maximum_github_file_bytes": 10_000_000,
        "forbidden_suffixes": [".gguf", ".safetensors", ".tar", ".bin"],
        "forbidden_path_fragments": ["sources/", "artifacts/", "payload/"],
        "artifact_retention_days": 90,
        "independent_restore_required": True,
    }:
        raise ExecutionContractError("evidence boundary mismatch")

    maturity = _object(raw["maturity_boundary"], "maturity_boundary")
    if maturity != _EXPECTED_MATURITY:
        raise ExecutionContractError("maturity boundary is invalid")

    authority: dict[str, Any] = {
        "schema_version": raw["schema_version"],
        "program_issue": 2726,
        "parent_issue": 2971,
        "issue": 2977,
        "command": raw["command"],
        "prerequisite_gate": parsed_prerequisite,
        "benchmark_authority": parsed_benchmark,
        "bundle_authority": parsed_bundle,
        "toolchain": parsed_toolchain,
        "target": parsed_target,
        "models": models,
        "evaluation": parsed_evaluation,
        "measurements": parsed_measurements,
        "fallback": parsed_fallback,
        "soak": parsed_soak,
        "evidence": parsed_evidence,
        "maturity_boundary": maturity,
    }
    authority["authority_sha256"] = canonical_sha256(authority)
    return authority


def _load_prerequisite_report(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
        {
            "schema_version",
            "status",
            "authority_sha256",
            "observation_sha256",
            "observed_at",
            "evaluated_at",
            "stale",
            "prerequisites",
            "slices",
            "reasons",
            "benchmark_status",
            "model_admission_status",
            "production_operational_status",
            "report_sha256",
        },
        "prerequisite report",
    )
    if raw["schema_version"] != "tai.benchmark-prerequisite-report.v1":
        raise ExecutionContractError("unsupported prerequisite report schema_version")
    _sha256(raw["authority_sha256"], "prerequisite report.authority_sha256")
    _sha256(raw["observation_sha256"], "prerequisite report.observation_sha256")
    _sha256(raw["report_sha256"], "prerequisite report.report_sha256")
    observed_at = _timestamp(raw["observed_at"], "prerequisite report.observed_at")
    evaluated_at = _timestamp(raw["evaluated_at"], "prerequisite report.evaluated_at")
    stale = _boolean(raw["stale"], "prerequisite report.stale")
    prerequisites = _object(raw["prerequisites"], "prerequisite report.prerequisites")
    slices = _object(raw["slices"], "prerequisite report.slices")
    reasons = [
        _text(item, f"prerequisite report.reasons[{index}]")
        for index, item in enumerate(
            _array(raw["reasons"], "prerequisite report.reasons")
        )
    ]
    maturity = {
        "benchmark_status": raw["benchmark_status"],
        "model_admission_status": raw["model_admission_status"],
        "production_operational_status": raw["production_operational_status"],
    }
    if maturity != _EXPECTED_MATURITY:
        raise ExecutionContractError("prerequisite report maturity boundary is invalid")
    expected_digest = canonical_sha256(
        {key: value for key, value in raw.items() if key != "report_sha256"}
    )
    if raw["report_sha256"] != expected_digest:
        raise ExecutionContractError("prerequisite report digest mismatch")
    return {
        **raw,
        "observed_at_parsed": observed_at,
        "evaluated_at_parsed": evaluated_at,
        "stale": stale,
        "prerequisites": prerequisites,
        "slices": slices,
        "reasons": reasons,
    }


def _load_gold_assessment(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
        {
            "schema_version",
            "version",
            "accepted",
            "status",
            "corpus_sha256",
            "component_sha256",
            "counts",
            "quality_targets",
            "blocking_reasons",
            "missing_review_case_ids",
            "assessment_sha256",
        },
        "gold assessment",
    )
    if raw["schema_version"] != "tai.gold-set-assessment.v1":
        raise ExecutionContractError("unsupported gold assessment schema_version")
    _text(raw["version"], "gold assessment.version")
    _boolean(raw["accepted"], "gold assessment.accepted")
    _text(raw["status"], "gold assessment.status")
    _sha256(raw["corpus_sha256"], "gold assessment.corpus_sha256")
    components = _object(raw["component_sha256"], "gold assessment.component_sha256")
    _require_keys(
        components,
        {"platform_sha256", "agro_sha256", "coverage_sha256", "reviews_sha256"},
        "gold assessment.component_sha256",
    )
    for key, value in components.items():
        _sha256(value, f"gold assessment.component_sha256.{key}")
    counts = _object(raw["counts"], "gold assessment.counts")
    _require_keys(
        counts,
        {
            "platform_cases",
            "agro_cases",
            "total_cases",
            "critical_cases",
            "reviewed_cases",
            "unreviewed_cases",
            "platform_roles",
            "deal_states",
            "agro_topics",
            "locales",
        },
        "gold assessment.counts",
    )
    parsed_counts = {
        key: _integer(value, f"gold assessment.counts.{key}")
        for key, value in counts.items()
    }
    targets = _object(raw["quality_targets"], "gold assessment.quality_targets")
    _require_keys(
        targets,
        {
            "platform_accuracy_minimum",
            "agro_accuracy_minimum",
            "critical_unsupported_facts_maximum",
            "citation_validity_minimum",
        },
        "gold assessment.quality_targets",
    )
    for key, value in targets.items():
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ExecutionContractError(
                f"gold assessment.quality_targets.{key} must be numeric"
            )
    blockers = [
        _text(item, f"gold assessment.blocking_reasons[{index}]")
        for index, item in enumerate(
            _array(raw["blocking_reasons"], "gold assessment.blocking_reasons")
        )
    ]
    missing = [
        _text(item, f"gold assessment.missing_review_case_ids[{index}]")
        for index, item in enumerate(
            _array(
                raw["missing_review_case_ids"],
                "gold assessment.missing_review_case_ids",
            )
        )
    ]
    _sha256(raw["assessment_sha256"], "gold assessment.assessment_sha256")
    return {
        **raw,
        "counts": parsed_counts,
        "blocking_reasons": blockers,
        "missing_review_case_ids": missing,
    }


def evaluate_readiness(
    authority_path: Path,
    prerequisite_report_path: Path,
    gold_assessment_path: Path,
    *,
    exact_main: str,
    evaluated_at: str,
) -> dict[str, object]:
    authority = load_execution_authority(authority_path)
    prerequisite = _load_prerequisite_report(prerequisite_report_path)
    assessment = _load_gold_assessment(gold_assessment_path)
    exact_commit = _commit(exact_main, "exact_main")
    now = _timestamp(evaluated_at, "evaluated_at")

    reasons: list[str] = []
    report_time = prerequisite["evaluated_at_parsed"]
    observed_time = prerequisite["observed_at_parsed"]
    if not isinstance(report_time, datetime) or not isinstance(observed_time, datetime):
        raise ExecutionContractError("prerequisite report timestamp type is invalid")
    if report_time > now + timedelta(minutes=5):
        reasons.append("PREREQUISITE_REPORT_FROM_FUTURE")
    if observed_time > now + timedelta(minutes=5):
        reasons.append("PREREQUISITE_OBSERVATION_FROM_FUTURE")
    maximum_age = timedelta(
        hours=int(authority["prerequisite_gate"]["maximum_report_age_hours"])
    )
    if now - report_time > maximum_age:
        reasons.append("PREREQUISITE_REPORT_STALE")
    if prerequisite["stale"] is not False:
        reasons.append("PREREQUISITE_MATRIX_STALE")

    slice_id = str(authority["prerequisite_gate"]["slice_id"])
    slice_value = prerequisite["slices"].get(slice_id)
    if not isinstance(slice_value, dict):
        reasons.append("CPU_FALLBACK_SLICE_ABSENT")
        slice_status = None
        slice_ready = False
        slice_blockers: list[str] = []
    else:
        _require_keys(
            slice_value, {"status", "ready", "blockers"}, f"slices.{slice_id}"
        )
        slice_status = _text(slice_value["status"], f"slices.{slice_id}.status")
        slice_ready = _boolean(slice_value["ready"], f"slices.{slice_id}.ready")
        slice_blockers = [
            _text(item, f"slices.{slice_id}.blockers[{index}]")
            for index, item in enumerate(
                _array(slice_value["blockers"], f"slices.{slice_id}.blockers")
            )
        ]
    if slice_status != authority["prerequisite_gate"]["required_status"]:
        reasons.append("CPU_FALLBACK_SLICE_STATUS_NOT_READY")
    if not slice_ready:
        reasons.append("CPU_FALLBACK_SLICE_NOT_READY")
    if slice_blockers:
        reasons.extend(
            f"CPU_FALLBACK_BLOCKER:{item}" for item in sorted(set(slice_blockers))
        )

    required_prerequisite_ids = {
        "benchmark-authority-v2",
        "immutable-model-bundles",
        "external-evidence-storage",
        "expert-reviewed-58-case-suite",
        "dedicated-cpu-host",
    }
    observed_prerequisite_ids = set(prerequisite["prerequisites"])
    missing_prerequisites = sorted(
        required_prerequisite_ids - observed_prerequisite_ids
    )
    reasons.extend(
        f"PREREQUISITE_ABSENT:{item}" for item in missing_prerequisites
    )
    for prerequisite_id in sorted(
        required_prerequisite_ids & observed_prerequisite_ids
    ):
        item = prerequisite["prerequisites"][prerequisite_id]
        if not isinstance(item, dict):
            reasons.append(f"PREREQUISITE_INVALID:{prerequisite_id}")
            continue
        _require_keys(
            item,
            {
                "satisfied",
                "required_status",
                "observed_status",
                "owner_issue",
                "kind",
                "evidence_ref",
                "exact_commit",
                "simulated",
            },
            f"prerequisites.{prerequisite_id}",
        )
        if _boolean(
            item["simulated"], f"prerequisites.{prerequisite_id}.simulated"
        ):
            reasons.append(f"SIMULATED_PREREQUISITE:{prerequisite_id}")
        if not _boolean(
            item["satisfied"], f"prerequisites.{prerequisite_id}.satisfied"
        ):
            reasons.append(f"UNSATISFIED_PREREQUISITE:{prerequisite_id}")

    if assessment["status"] != authority["evaluation"]["required_status"]:
        reasons.append("GOLD_SET_STATUS_NOT_ACCEPTED")
    if assessment["accepted"] is not authority["evaluation"]["required_accepted"]:
        reasons.append("GOLD_SET_NOT_ACCEPTED")
    counts = assessment["counts"]
    if counts["total_cases"] != authority["evaluation"]["required_total_cases"]:
        reasons.append("GOLD_SET_TOTAL_CASE_COUNT_MISMATCH")
    if counts["critical_cases"] != authority["evaluation"]["required_critical_cases"]:
        reasons.append("GOLD_SET_CRITICAL_CASE_COUNT_MISMATCH")
    if counts["unreviewed_cases"] > authority["evaluation"]["maximum_unreviewed_cases"]:
        reasons.append("GOLD_SET_UNREVIEWED_CASES_PRESENT")
    if counts["reviewed_cases"] != counts["total_cases"]:
        reasons.append("GOLD_SET_REVIEW_COVERAGE_INCOMPLETE")
    if assessment["blocking_reasons"]:
        reasons.append("GOLD_SET_BLOCKING_REASONS_PRESENT")
    if assessment["missing_review_case_ids"]:
        reasons.append("GOLD_SET_MISSING_REVIEW_CASES_PRESENT")

    ready = not reasons
    report: dict[str, object] = {
        "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
        "status": "READY_FOR_EXTERNAL_EXECUTION" if ready else "BLOCKED",
        "ready": ready,
        "exact_main": exact_commit,
        "evaluated_at": now.isoformat(),
        "authority_sha256": authority["authority_sha256"],
        "prerequisite_report_sha256": prerequisite["report_sha256"],
        "gold_corpus_sha256": assessment["corpus_sha256"],
        "gold_assessment_sha256": assessment["assessment_sha256"],
        "required_profiles": authority["benchmark_authority"]["required_profiles"],
        "reasons": sorted(set(reasons)),
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
