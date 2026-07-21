from __future__ import annotations

from datetime import timedelta
from pathlib import Path
from typing import Any

from tai.cpu_benchmark_finalization_contract import (
    EXPECTED_MATURITY,
    MISTRAL_CPU_PROFILE,
    MISTRAL_MODEL_ID,
    MISTRAL_REVISION,
    QWEN_CPU_PROFILE,
    QWEN_GPU_PROFILE,
    QWEN_MODEL_ID,
    QWEN_REVISION,
    VERIFIED_FINALIZATION_STATUS,
    VERIFIED_QUALITY_STATUS,
    VERIFIED_RUNTIME_STATUS,
    FinalizationError,
    as_array,
    as_commit,
    as_identity,
    as_int,
    as_object,
    as_sha256,
    as_timestamp,
    canonical_sha256,
    load_authority,
    load_json,
    load_manifest,
    require_keys,
)
from tai.cpu_runtime_contract import RuntimeEvidenceError
from tai.cpu_runtime_evidence import verify_runtime_evidence
from tai.model_benchmark_admission_v2 import verify_benchmark
from tai.quality_scoring import verify_quality_scoring
from tai.quality_scoring_contract import QualityScoringError


def _self_digest(value: dict[str, Any], field: str, name: str) -> None:
    digest = as_sha256(value[field], f"{name}.{field}")
    expected = canonical_sha256({key: item for key, item in value.items() if key != field})
    if digest != expected:
        raise FinalizationError(f"{name} digest mismatch")


def _reproduce_runtime(
    runtime_authority_path: Path,
    runtime_report_path: Path,
    runtime_manifest_path: Path,
    original_root: Path,
    restored_root: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    supplied = load_json(runtime_report_path)
    _self_digest(supplied, "report_sha256", "runtime report")
    try:
        reproduced = verify_runtime_evidence(
            runtime_authority_path,
            runtime_manifest_path,
            original_root,
            restored_root,
        )
    except RuntimeEvidenceError as exc:
        raise FinalizationError(f"runtime re-verification failed: {exc}") from exc
    if supplied != reproduced:
        raise FinalizationError("runtime report is not reproduced from immutable evidence")
    if supplied.get("status") != VERIFIED_RUNTIME_STATUS or supplied.get("reasons") != []:
        raise FinalizationError("runtime evidence is not verified")
    if supplied.get("raw_observation_count") != 348:
        raise FinalizationError("runtime observation count mismatch")
    if supplied.get("runtime_profiles") != {
        QWEN_CPU_PROFILE: "MEASURED",
        MISTRAL_CPU_PROFILE: "MEASURED",
    }:
        raise FinalizationError("runtime profile set mismatch")
    manifest = load_json(runtime_manifest_path)
    if canonical_sha256(manifest) != supplied.get("manifest_sha256"):
        raise FinalizationError("runtime manifest digest mismatch")
    return supplied, manifest


def _reproduce_quality(
    quality_authority_path: Path,
    quality_report_path: Path,
    quality_scoring_manifest_path: Path,
    runtime_authority_path: Path,
    runtime_report_path: Path,
    runtime_manifest_path: Path,
    runtime_original_root: Path,
    runtime_restored_root: Path,
    accepted_assessment_path: Path,
    case_manifest_path: Path,
    *,
    evaluated_at: str,
) -> dict[str, Any]:
    supplied = load_json(quality_report_path)
    _self_digest(supplied, "report_sha256", "quality report")
    try:
        reproduced = verify_quality_scoring(
            quality_authority_path,
            runtime_authority_path,
            runtime_report_path,
            runtime_manifest_path,
            runtime_original_root,
            runtime_restored_root,
            accepted_assessment_path,
            case_manifest_path,
            quality_scoring_manifest_path,
            evaluated_at=evaluated_at,
        )
    except QualityScoringError as exc:
        raise FinalizationError(f"quality re-verification failed: {exc}") from exc
    if supplied != reproduced:
        raise FinalizationError("quality report is not reproduced from immutable evidence")
    if supplied.get("status") != VERIFIED_QUALITY_STATUS or supplied.get("accepted") is not True:
        raise FinalizationError("quality evidence is not verified")
    if supplied.get("reasons") != []:
        raise FinalizationError("quality report contains blockers")
    return supplied


def _runtime_profile(runtime_manifest: dict[str, Any], profile_id: str) -> dict[str, Any]:
    rows = as_array(runtime_manifest.get("runtime_profiles"), "runtime profiles")
    matches = [row for row in rows if isinstance(row, dict) and row.get("profile_id") == profile_id]
    if len(matches) != 1:
        raise FinalizationError(f"runtime profile not uniquely present: {profile_id}")
    return matches[0]


def _bundle_artifact(runtime_manifest: dict[str, Any], model_key: str) -> dict[str, Any]:
    finalization = as_object(runtime_manifest.get("bundle_finalization"), "bundle finalization")
    rows = as_array(finalization.get("models"), "bundle finalization models")
    matches = [row for row in rows if isinstance(row, dict) and row.get("model_key") == model_key]
    if len(matches) != 1:
        raise FinalizationError(f"bundle model not uniquely present: {model_key}")
    return matches[0]


def _quality_profile(quality_report: dict[str, Any], profile_id: str) -> dict[str, Any]:
    aggregate = as_object(quality_report.get("aggregate"), "quality aggregate")
    profiles = as_object(aggregate.get("profiles"), "quality aggregate profiles")
    value = as_object(profiles.get(profile_id), f"quality profile {profile_id}")
    require_keys(value, {"platform", "agro"}, f"quality profile {profile_id}")
    return value


def _check_candidate_projection(
    benchmark_manifest: dict[str, Any],
    benchmark_report: dict[str, Any],
    runtime_manifest: dict[str, Any],
    quality_report: dict[str, Any],
) -> None:
    if benchmark_report.get("status") != "VERIFIED" or benchmark_report.get("reasons") != []:
        raise FinalizationError("Mistral canonical benchmark candidate is not verified")
    model = as_object(benchmark_manifest.get("model"), "Mistral benchmark model")
    if model != {
        "role": "FALLBACK",
        "model_id": MISTRAL_MODEL_ID,
        "revision": MISTRAL_REVISION,
    }:
        raise FinalizationError("Mistral benchmark model identity mismatch")
    if benchmark_manifest.get("fallback_exercise") is not None:
        raise FinalizationError("fallback model must not declare another fallback exercise")
    profiles = as_array(benchmark_manifest.get("runtime_profiles"), "benchmark profiles")
    if len(profiles) != 1 or not isinstance(profiles[0], dict):
        raise FinalizationError("Mistral benchmark must contain exactly one runtime profile")
    candidate_profile = profiles[0]
    if candidate_profile.get("profile_id") != MISTRAL_CPU_PROFILE:
        raise FinalizationError("Mistral benchmark profile identity mismatch")
    runtime_profile = _runtime_profile(runtime_manifest, MISTRAL_CPU_PROFILE)
    field_pairs = {
        "runtime_class": "runtime_class",
        "quantization": "quantization",
        "artifact_sha256": "artifact_sha256",
        "sample_count": "sample_count",
        "prompt_tokens_per_second_milli": "prompt_tokens_per_second_milli",
        "generation_tokens_per_second_milli": "generation_tokens_per_second_milli",
        "p95_latency_ms": "p95_latency_ms",
        "p99_latency_ms": "p99_latency_ms",
        "peak_ram_mb": "peak_ram_mb",
        "cold_start_ms": "cold_start_ms",
        "warmup_ms": "warmup_ms",
    }
    for candidate_field, runtime_field in field_pairs.items():
        if candidate_profile.get(candidate_field) != runtime_profile.get(runtime_field):
            raise FinalizationError(
      "Mistral benchmark runtime projection mismatch: "
      f"{candidate_field}"
  )
    if candidate_profile.get("peak_vram_mb") != 0:
        raise FinalizationError("Mistral CPU benchmark cannot claim VRAM usage")
    candidate_levels = {
        row.get("level"): row
        for row in as_array(candidate_profile.get("concurrency"), "candidate concurrency")
        if isinstance(row, dict)
    }
    runtime_levels = {
        row.get("level"): row
        for row in as_array(runtime_profile.get("concurrency"), "runtime concurrency")
        if isinstance(row, dict)
    }
    if set(candidate_levels) != {1, 2, 4} or set(runtime_levels) != {1, 2, 4}:
        raise FinalizationError("Mistral concurrency coverage mismatch")
    for level in (1, 2, 4):
        for field in (
            "request_count",
            "failed_requests",
            "error_rate_basis_points",
            "p95_latency_ms",
            "generation_tokens_per_second_milli",
        ):
            if candidate_levels[level].get(field) != runtime_levels[level].get(field):
                raise FinalizationError(
                    f"Mistral concurrency projection mismatch: {level}:{field}"
                )
    quality = as_object(benchmark_manifest.get("quality"), "Mistral benchmark quality")
    profile_quality = _quality_profile(quality_report, MISTRAL_CPU_PROFILE)
    platform = as_object(profile_quality["platform"], "Mistral platform quality")
    agro = as_object(profile_quality["agro"], "Mistral agro quality")
    aggregate = as_object(quality_report["aggregate"], "quality aggregate")
    expected_quality = {
        "sample_count": 58,
        "platform_accuracy_basis_points": platform["accuracy_basis_points"],
        "agro_accuracy_basis_points": agro["accuracy_basis_points"],
        "critical_unsupported_facts": aggregate["critical_unsupported_facts"],
        "critical_safety_failures": aggregate["critical_safety_failures"],
        "critical_abstention_misses": aggregate["critical_abstention_misses"],
        "unsupported_facts_total": 0,
    }
    for field, expected in expected_quality.items():
        if quality.get(field) != expected:
            raise FinalizationError(f"Mistral benchmark quality projection mismatch: {field}")
    bundle_model = _bundle_artifact(runtime_manifest, "mistral-7b-instruct-v0.3")
    bundle = as_object(benchmark_manifest.get("bundle"), "Mistral benchmark bundle")
    artifact_hashes = {
        row.get("sha256")
        for row in as_array(bundle.get("artifacts"), "Mistral bundle artifacts")
        if isinstance(row, dict)
    }
    if bundle_model.get("artifact_sha256") not in artifact_hashes:
        raise FinalizationError("Mistral benchmark bundle artifact differs from runtime bundle")


def _parse_storage(value: object, authority: dict[str, Any], finalized_at: Any) -> dict[str, Any]:
    storage = as_object(value, "finalization storage")
    require_keys(
        storage,
        {
            "provider",
            "object_version_id",
            "retention_days",
            "immutability_status",
            "original_root_id",
            "restored_root_id",
            "evidence_manifest_sha256",
            "stored_at",
        },
        "finalization storage",
    )
    if storage["provider"] != authority["evidence"]["provider"]:
        raise FinalizationError("finalization storage provider mismatch")
    if storage["immutability_status"] != "IMMUTABLE_VERSIONED":
        raise FinalizationError("finalization storage is not immutable")
    if as_int(storage["retention_days"], "storage.retention_days") < authority["evidence"][
        "minimum_retention_days"
    ]:
        raise FinalizationError("finalization storage retention is insufficient")
    for field in ("object_version_id", "original_root_id", "restored_root_id"):
        as_identity(storage[field], f"storage.{field}")
    if storage["original_root_id"] == storage["restored_root_id"]:
        raise FinalizationError("finalization restore roots are not independent")
    as_sha256(storage["evidence_manifest_sha256"], "storage.evidence_manifest_sha256")
    stored_at = as_timestamp(storage["stored_at"], "storage.stored_at")
    if stored_at < finalized_at:
        raise FinalizationError("finalization storage timestamp precedes finalization")
    return storage


def verify_finalization(
    authority_path: Path,
    joint_authority_path: Path,
    bundle_authority_path: Path,
    runtime_authority_path: Path,
    runtime_report_path: Path,
    runtime_manifest_path: Path,
    runtime_original_root: Path,
    runtime_restored_root: Path,
    quality_authority_path: Path,
    quality_report_path: Path,
    quality_scoring_manifest_path: Path,
    accepted_assessment_path: Path,
    case_manifest_path: Path,
    mistral_benchmark_manifest_path: Path,
    mistral_benchmark_original_root: Path,
    mistral_benchmark_restored_root: Path,
    finalization_manifest_path: Path,
    *,
    evaluated_at: str,
) -> dict[str, object]:
    authority = load_authority(authority_path)
    manifest = load_manifest(finalization_manifest_path)
    now = as_timestamp(evaluated_at, "evaluated_at")
    if manifest["lifecycle"] == "PENDING_EXTERNAL_EVIDENCE":
        report: dict[str, object] = {
            "schema_version": "tai.cpu-benchmark-finalization-verification.v1",
            "status": "PENDING_EXTERNAL_EVIDENCE",
            "accepted": False,
            "reasons": ["REAL_RUNTIME_QUALITY_AND_FINALIZATION_EVIDENCE_REQUIRED"],
            "authority_sha256": authority["authority_sha256"],
            "manifest_sha256": manifest["manifest_sha256"],
            "evaluated_at": now.isoformat(),
            **EXPECTED_MATURITY,
        }
        report["report_sha256"] = canonical_sha256(report)
        return report

    runtime_report, runtime_manifest = _reproduce_runtime(
        runtime_authority_path,
        runtime_report_path,
        runtime_manifest_path,
        runtime_original_root,
        runtime_restored_root,
    )
    quality_report = _reproduce_quality(
        quality_authority_path,
        quality_report_path,
        quality_scoring_manifest_path,
        runtime_authority_path,
        runtime_report_path,
        runtime_manifest_path,
        runtime_original_root,
        runtime_restored_root,
        accepted_assessment_path,
        case_manifest_path,
        evaluated_at=evaluated_at,
    )
    benchmark_report = verify_benchmark(
        joint_authority_path,
        bundle_authority_path,
        mistral_benchmark_manifest_path,
        mistral_benchmark_original_root,
        mistral_benchmark_restored_root,
    )
    benchmark_manifest = load_json(mistral_benchmark_manifest_path)
    _check_candidate_projection(
        benchmark_manifest,
        benchmark_report,
        runtime_manifest,
        quality_report,
    )
    exact_main = as_commit(manifest["exact_main"], "manifest.exact_main")
    if exact_main != runtime_report["exact_main"] or exact_main != quality_report["exact_main"]:
        raise FinalizationError("finalization exact-main mismatch")
    if manifest["authority_sha256"] != authority["authority_sha256"]:
        raise FinalizationError("finalization authority digest mismatch")
    if manifest["runtime_report_sha256"] != runtime_report["report_sha256"]:
        raise FinalizationError("finalization runtime report digest mismatch")
    if manifest["quality_report_sha256"] != quality_report["report_sha256"]:
        raise FinalizationError("finalization quality report digest mismatch")
    qwen = as_object(manifest["qwen_primary"], "Qwen primary finalization")
    require_keys(
        qwen,
        {
            "model_id",
            "revision",
            "verified_cpu_profile",
            "required_gpu_profile",
            "status",
            "runtime_manifest_sha256",
            "quality_report_sha256",
        },
        "Qwen primary finalization",
    )
    if qwen != {
        "model_id": QWEN_MODEL_ID,
        "revision": QWEN_REVISION,
        "verified_cpu_profile": QWEN_CPU_PROFILE,
        "required_gpu_profile": QWEN_GPU_PROFILE,
        "status": authority["finalization"]["qwen_primary_status"],
        "runtime_manifest_sha256": runtime_report["manifest_sha256"],
        "quality_report_sha256": quality_report["report_sha256"],
    }:
        raise FinalizationError("Qwen primary finalization boundary mismatch")
    mistral = as_object(manifest["mistral_fallback"], "Mistral fallback finalization")
    require_keys(
        mistral,
        {
            "model_id",
            "revision",
            "profile_id",
            "status",
            "benchmark_manifest_sha256",
            "benchmark_report_sha256",
        },
        "Mistral fallback finalization",
    )
    if mistral != {
        "model_id": MISTRAL_MODEL_ID,
        "revision": MISTRAL_REVISION,
        "profile_id": MISTRAL_CPU_PROFILE,
        "status": authority["finalization"]["mistral_fallback_status"],
        "benchmark_manifest_sha256": benchmark_report["benchmark_manifest_sha256"],
        "benchmark_report_sha256": benchmark_report["report_sha256"],
    }:
        raise FinalizationError("Mistral fallback finalization binding mismatch")
    finalized_at = as_timestamp(manifest["finalized_at"], "manifest.finalized_at")
    if finalized_at > now + timedelta(minutes=5):
        raise FinalizationError("finalization timestamp is from the future")
    _parse_storage(manifest["storage"], authority, finalized_at)
    complete_maturity = {
        "qwen_primary_benchmark_status": manifest["qwen_primary_benchmark_status"],
        "mistral_fallback_benchmark_status": manifest[
            "mistral_fallback_benchmark_status"
        ],
        "joint_benchmark_status": manifest["joint_benchmark_status"],
        "model_admission_status": manifest["model_admission_status"],
        "production_operational_status": manifest["production_operational_status"],
    }
    if complete_maturity != {
        **EXPECTED_MATURITY,
        "mistral_fallback_benchmark_status": "VERIFIED",
    }:
        raise FinalizationError("complete finalization maturity boundary is invalid")
    report = {
        "schema_version": "tai.cpu-benchmark-finalization-verification.v1",
        "status": VERIFIED_FINALIZATION_STATUS,
        "accepted": True,
        "reasons": ["QWEN_GPU_SHARED_Q8_0_BENCHMARK_REQUIRED"],
        "exact_main": exact_main,
        "authority_sha256": authority["authority_sha256"],
        "runtime_report_sha256": runtime_report["report_sha256"],
        "quality_report_sha256": quality_report["report_sha256"],
        "mistral_benchmark_report_sha256": benchmark_report["report_sha256"],
        "mistral_benchmark_manifest_sha256": benchmark_report[
            "benchmark_manifest_sha256"
        ],
        "manifest_sha256": manifest["manifest_sha256"],
        "evaluated_at": now.isoformat(),
        "qwen_primary_benchmark_status": "PENDING_BENCHMARK",
        "mistral_fallback_benchmark_status": "VERIFIED",
        "joint_benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    report["report_sha256"] = canonical_sha256(report)
    return report
