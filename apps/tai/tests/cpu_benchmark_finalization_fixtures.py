from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

from quality_scoring_fixtures import NOW as QUALITY_NOW
from quality_scoring_fixtures import _fixture as _quality_fixture
from quality_scoring_fixtures import _verify as _verify_quality
from test_model_benchmark_admission_v2 import AUTHORITY as JOINT_AUTHORITY
from test_model_benchmark_admission_v2 import BUNDLE_AUTHORITY
from test_model_benchmark_admission_v2 import _create_manifest, _sha, _write_json

from tai.cpu_benchmark_finalization_contract import (
    EXPECTED_MATURITY,
    MISTRAL_CPU_PROFILE,
    MISTRAL_MODEL_ID,
    MISTRAL_REVISION,
    QWEN_CPU_PROFILE,
    QWEN_GPU_PROFILE,
    QWEN_MODEL_ID,
    QWEN_REVISION,
    canonical_sha256,
    expected_authority,
    load_authority,
    load_json,
    write_json,
)
from tai.model_benchmark_admission_v2 import verify_benchmark

EVALUATED_AT = "2026-07-21T20:00:00+00:00"


def _signed(value: dict[str, Any], field: str) -> dict[str, Any]:
    output = copy.deepcopy(value)
    output.pop(field, None)
    output[field] = canonical_sha256(output)
    return output


def _authority(path: Path) -> dict[str, Any]:
    write_json(path, expected_authority())
    return load_authority(path)


def _update_evidence_record(
    manifest: dict[str, Any], original: Path, restored: Path, relative: str
) -> None:
    source = original / relative
    destination = restored / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(source.read_bytes())
    matches = [row for row in manifest["evidence_files"] if row["path"] == relative]
    if len(matches) != 1:
        raise AssertionError(f"candidate evidence path is not unique: {relative}")
    matches[0]["sha256"] = _sha(source)
    matches[0]["size_bytes"] = source.stat().st_size


def _project_mistral_candidate(
    root: Path,
    quality: dict[str, Any],
    runtime_manifest: dict[str, Any],
) -> tuple[Path, Path, Path, dict[str, Any]]:
    manifest_path, original, restored = _create_manifest(root, primary=False)
    manifest = load_json(manifest_path)
    runtime_profiles = [
        row
        for row in runtime_manifest["runtime_profiles"]
        if row["profile_id"] == MISTRAL_CPU_PROFILE
    ]
    if len(runtime_profiles) != 1:
        raise AssertionError("runtime Mistral profile missing")
    runtime_profile = runtime_profiles[0]
    candidate_profile = manifest["runtime_profiles"][0]
    for field in (
        "runtime_class",
        "quantization",
        "artifact_sha256",
        "sample_count",
        "prompt_tokens_per_second_milli",
        "generation_tokens_per_second_milli",
        "p95_latency_ms",
        "p99_latency_ms",
        "peak_ram_mb",
        "cold_start_ms",
        "warmup_ms",
        "concurrency",
    ):
        candidate_profile[field] = copy.deepcopy(runtime_profile[field])
    candidate_profile["peak_vram_mb"] = 0
    metrics_path = candidate_profile["raw_metrics_path"]
    excluded = {
        "hardware_path",
        "environment_path",
        "raw_metrics_path",
        "cost_calculation_path",
        "hardware_profile_id",
    }
    _write_json(
        original / metrics_path,
        {
            "schema_version": "tai.runtime-profile-metrics.v1",
            **{
                key: value
                for key, value in candidate_profile.items()
                if key not in excluded
            },
        },
    )
    _update_evidence_record(manifest, original, restored, metrics_path)

    profile_quality = quality["aggregate"]["profiles"][MISTRAL_CPU_PROFILE]
    aggregate = quality["aggregate"]
    candidate_quality = manifest["quality"]
    candidate_quality.update(
        {
            "sample_count": 58,
            "platform_accuracy_basis_points": profile_quality["platform"][
                "accuracy_basis_points"
            ],
            "agro_accuracy_basis_points": profile_quality["agro"][
                "accuracy_basis_points"
            ],
            "critical_unsupported_facts": aggregate[
                "critical_unsupported_facts"
            ],
            "critical_safety_failures": aggregate["critical_safety_failures"],
            "critical_abstention_misses": aggregate[
                "critical_abstention_misses"
            ],
            "unsupported_facts_total": 0,
        }
    )
    quality_path = candidate_quality["results_path"]
    _write_json(
        original / quality_path,
        {
            "schema_version": "tai.model-quality-results.v1",
            "model_id": MISTRAL_MODEL_ID,
            "revision": MISTRAL_REVISION,
            "suite_id": "tai-platform-agro-58-v1",
            **{
                key: value
                for key, value in candidate_quality.items()
                if key != "results_path"
            },
        },
    )
    _update_evidence_record(manifest, original, restored, quality_path)
    _write_json(manifest_path, manifest)
    report = verify_benchmark(
        JOINT_AUTHORITY,
        BUNDLE_AUTHORITY,
        manifest_path,
        original,
        restored,
    )
    if report["status"] != "VERIFIED":
        raise AssertionError(f"fixture benchmark failed: {report}")
    return manifest_path, original, restored, report


def _finalization_manifest(
    path: Path,
    authority: dict[str, Any],
    runtime: dict[str, Any],
    quality: dict[str, Any],
    benchmark: dict[str, Any],
) -> dict[str, Any]:
    value = _signed(
        {
            "schema_version": "tai.cpu-benchmark-finalization.v1",
            "lifecycle": "COMPLETE_CPU_FALLBACK_SLICE",
            "pending_reason": None,
            "exact_main": runtime["exact_main"],
            "authority_sha256": authority["authority_sha256"],
            "runtime_report_sha256": runtime["report_sha256"],
            "quality_report_sha256": quality["report_sha256"],
            "qwen_primary": {
                "model_id": QWEN_MODEL_ID,
                "revision": QWEN_REVISION,
                "verified_cpu_profile": QWEN_CPU_PROFILE,
                "required_gpu_profile": QWEN_GPU_PROFILE,
                "status": "CPU_EVIDENCE_VERIFIED_PENDING_GPU_SHARED_Q8_0",
                "runtime_manifest_sha256": runtime["manifest_sha256"],
                "quality_report_sha256": quality["report_sha256"],
            },
            "mistral_fallback": {
                "model_id": MISTRAL_MODEL_ID,
                "revision": MISTRAL_REVISION,
                "profile_id": MISTRAL_CPU_PROFILE,
                "status": "FALLBACK_BENCHMARK_CANDIDATE_VERIFIED",
                "benchmark_manifest_sha256": benchmark[
                    "benchmark_manifest_sha256"
                ],
                "benchmark_report_sha256": benchmark["report_sha256"],
            },
            "storage": {
                "provider": "SELECTEL_S3",
                "object_version_id": "finalization-version-1",
                "retention_days": 90,
                "immutability_status": "IMMUTABLE_VERSIONED",
                "original_root_id": "finalization-original",
                "restored_root_id": "finalization-restored",
                "evidence_manifest_sha256": "9" * 64,
                "stored_at": "2026-07-21T19:05:00+00:00",
            },
            "finalized_at": "2026-07-21T19:00:00+00:00",
            "qwen_primary_benchmark_status": "PENDING_BENCHMARK",
            "mistral_fallback_benchmark_status": "VERIFIED",
            "joint_benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        },
        "manifest_sha256",
    )
    write_json(path, value)
    return value


def fixture(tmp_path: Path) -> dict[str, Any]:
    quality_fixture = _quality_fixture(tmp_path / "quality")
    quality_report = _verify_quality(
        quality_fixture,
        evaluated_at=EVALUATED_AT,
    )
    quality_report_path = tmp_path / "quality-report.json"
    write_json(quality_report_path, quality_report)
    runtime_manifest = load_json(quality_fixture["runtime_manifest_path"])
    benchmark_path, benchmark_original, benchmark_restored, benchmark_report = (
        _project_mistral_candidate(
            tmp_path / "benchmark",
            quality_report,
            runtime_manifest,
        )
    )
    authority_path = tmp_path / "finalization-authority.json"
    authority = _authority(authority_path)
    finalization_path = tmp_path / "finalization.json"
    finalization = _finalization_manifest(
        finalization_path,
        authority,
        quality_fixture["runtime"],
        quality_report,
        benchmark_report,
    )
    return {
        **quality_fixture,
        "finalization_authority_path": authority_path,
        "finalization_authority": authority,
        "quality_report_path": quality_report_path,
        "quality_report": quality_report,
        "benchmark_path": benchmark_path,
        "benchmark_original": benchmark_original,
        "benchmark_restored": benchmark_restored,
        "benchmark_report": benchmark_report,
        "finalization_path": finalization_path,
        "finalization": finalization,
        "joint_authority_path": JOINT_AUTHORITY,
        "bundle_authority_path": BUNDLE_AUTHORITY,
    }


def rewrite_finalization(value: dict[str, Any], path: Path) -> dict[str, Any]:
    updated = _signed(value, "manifest_sha256")
    write_json(path, updated)
    return updated
