from __future__ import annotations

import hashlib
import json
import os
import shutil
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from tai.model_benchmark_admission_v2 import (
    ContractError,
    admit_models,
    canonical_sha256,
    load_authority,
    load_json_strict,
    verify_benchmark,
    write_json,
)

ROOT = Path(__file__).parents[1]
ARTIFACTS = ROOT / "model-artifacts"
AUTHORITY = ARTIFACTS / "model-benchmark-admission-authority.v2.json"
BUNDLE_AUTHORITY = ROOT / "model-bundle-authority.v2.json"
QWEN_PENDING = ARTIFACTS / "qwen3-8b.benchmark.v2.pending.json"
MISTRAL_PENDING = ARTIFACTS / "mistral-7b-instruct-v0.3.benchmark.v2.pending.json"
SCOPE = ROOT / "governance" / "scopes" / "ap-13cd-benchmark-admission-2862.json"

QWEN_ID = "Qwen/Qwen3-8B"
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
MISTRAL_ID = "mistralai/Mistral-7B-Instruct-v0.3"
MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52bab71"
QWEN_CPU_SHA = "a" * 64
QWEN_GPU_SHA = "c" * 64
MISTRAL_CPU_SHA = "b" * 64


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, sort_keys=True) + "\n", encoding="utf-8")


def _bundle_authority() -> dict[str, Any]:
    return {
        "schema_version": "tai.model-bundle-authority.v2",
        "models": [
            {
                "role": "PRIMARY",
                "model_id": QWEN_ID,
                "revision": QWEN_REVISION,
                "quantizations": [
                    {
                        "runtime_class": "CPU",
                        "quantization": "Q4_K_M",
                        "output_path": "artifacts/qwen3-8b-q4-k-m.gguf",
                    },
                    {
                        "runtime_class": "GPU_SHARED",
                        "quantization": "Q8_0",
                        "output_path": "artifacts/qwen3-8b-q8-0.gguf",
                    },
                ],
            },
            {
                "role": "FALLBACK",
                "model_id": MISTRAL_ID,
                "revision": MISTRAL_REVISION,
                "quantizations": [
                    {
                        "runtime_class": "CPU",
                        "quantization": "Q4_K_M",
                        "output_path": (
                            "artifacts/mistral-7b-instruct-v0.3-q4-k-m.gguf"
                        ),
                    }
                ],
            },
        ],
    }


@pytest.fixture(scope="session", autouse=True)
def _write_bundle_authority() -> None:
    _write_json(BUNDLE_AUTHORITY, _bundle_authority())


def _profile(
    *,
    profile_id: str,
    runtime_class: str,
    quantization: str,
    artifact_sha256: str,
    concurrency_levels: list[int],
) -> dict[str, Any]:
    if runtime_class == "GPU_SHARED":
        prompt_speed = 25_000
        generation_speed = 15_000
        p95 = 8_000
        p99 = 12_000
        ram = 7_000
        vram = 20_000
    elif profile_id.startswith("qwen"):
        prompt_speed = 6_000
        generation_speed = 5_000
        p95 = 18_000
        p99 = 25_000
        ram = 12_000
        vram = 0
    else:
        prompt_speed = 5_000
        generation_speed = 4_000
        p95 = 22_000
        p99 = 30_000
        ram = 11_000
        vram = 0
    return {
        "profile_id": profile_id,
        "runtime_class": runtime_class,
        "quantization": quantization,
        "artifact_sha256": artifact_sha256,
        "hardware_profile_id": f"hw-{profile_id}",
        "hardware_path": f"profiles/{profile_id}/hardware.json",
        "environment_path": f"profiles/{profile_id}/environment.json",
        "raw_metrics_path": f"profiles/{profile_id}/metrics.json",
        "cost_calculation_path": f"profiles/{profile_id}/cost.json",
        "sample_count": 100,
        "prompt_tokens_per_second_milli": prompt_speed,
        "generation_tokens_per_second_milli": generation_speed,
        "p95_latency_ms": p95,
        "p99_latency_ms": p99,
        "peak_ram_mb": ram,
        "peak_vram_mb": vram,
        "cold_start_ms": 60_000,
        "warmup_ms": 90_000,
        "estimated_cost_rub_per_million_tokens_milli": 100_000,
        "concurrency": [
            {
                "level": level,
                "request_count": 100,
                "failed_requests": 0,
                "error_rate_basis_points": 0,
                "p95_latency_ms": p95,
                "generation_tokens_per_second_milli": generation_speed,
            }
            for level in concurrency_levels
        ],
    }


def _semantic_profile_files(root: Path, profile: dict[str, Any]) -> None:
    _write_json(
        root / profile["hardware_path"],
        {
            "schema_version": "tai.hardware-observation.v1",
            "hardware_profile_id": profile["hardware_profile_id"],
            "runtime_class": profile["runtime_class"],
            "captured_at": "2026-07-20T09:00:00+00:00",
            "details": {"cpu": "controlled", "gpu": profile["runtime_class"]},
        },
    )
    _write_json(
        root / profile["environment_path"],
        {
            "schema_version": "tai.runtime-environment-observation.v1",
            "profile_id": profile["profile_id"],
            "artifact_sha256": profile["artifact_sha256"],
            "runtime_class": profile["runtime_class"],
            "quantization": profile["quantization"],
            "captured_at": "2026-07-20T09:00:00+00:00",
            "details": {"runtime": "llama.cpp-b9637"},
        },
    )
    excluded = {
        "hardware_path",
        "environment_path",
        "raw_metrics_path",
        "cost_calculation_path",
        "hardware_profile_id",
    }
    _write_json(
        root / profile["raw_metrics_path"],
        {
            "schema_version": "tai.runtime-profile-metrics.v1",
            **{key: value for key, value in profile.items() if key not in excluded},
        },
    )
    _write_json(
        root / profile["cost_calculation_path"],
        {
            "schema_version": "tai.operating-cost-calculation.v1",
            "profile_id": profile["profile_id"],
            "currency": "RUB",
            "token_basis": 1_000_000,
            "estimated_cost_rub_per_million_tokens_milli": profile[
                "estimated_cost_rub_per_million_tokens_milli"
            ],
            "assumptions": ["measured host power and amortization basis"],
        },
    )


def _create_manifest(tmp_path: Path, *, primary: bool) -> tuple[Path, Path, Path]:
    original = tmp_path / ("primary-original" if primary else "fallback-original")
    restored = tmp_path / ("primary-restored" if primary else "fallback-restored")
    original.mkdir(parents=True)
    restored.mkdir(parents=True)

    cases_path = "suite/cases.json"
    protocol_path = "suite/protocol.txt"
    suite_manifest_path = "suite/manifest.json"
    quality_path = "quality/results.json"
    cases = [
        {
            "case_id": f"case-{index + 1:02d}",
            "critical": index < 23,
            "category": "platform" if index % 2 == 0 else "agro",
        }
        for index in range(58)
    ]
    _write_json(
        original / cases_path,
        {
            "schema_version": "tai.evaluation-suite-cases.v1",
            "suite_id": "tai-platform-agro-58-v1",
            "cases": cases,
        },
    )
    (original / protocol_path).parent.mkdir(parents=True, exist_ok=True)
    (original / protocol_path).write_text("fixed deterministic scoring protocol\n")
    _write_json(
        original / suite_manifest_path,
        {
            "schema_version": "tai.evaluation-suite-manifest.v1",
            "suite_id": "tai-platform-agro-58-v1",
            "total_cases": 58,
            "critical_cases": 23,
            "cases_sha256": _sha(original / cases_path),
            "protocol_sha256": _sha(original / protocol_path),
        },
    )

    quality = {
        "sample_count": 58,
        "platform_accuracy_basis_points": 9600,
        "agro_accuracy_basis_points": 9100,
        "critical_unsupported_facts": 0,
        "critical_safety_failures": 0,
        "critical_abstention_misses": 0,
        "unsupported_facts_total": 0,
        "results_path": quality_path,
    }
    model_id = QWEN_ID if primary else MISTRAL_ID
    revision = QWEN_REVISION if primary else MISTRAL_REVISION
    role = "PRIMARY" if primary else "FALLBACK"
    _write_json(
        original / quality_path,
        {
            "schema_version": "tai.model-quality-results.v1",
            "model_id": model_id,
            "revision": revision,
            "suite_id": "tai-platform-agro-58-v1",
            **{key: value for key, value in quality.items() if key != "results_path"},
        },
    )

    profiles: list[dict[str, Any]]
    artifacts: list[dict[str, Any]]
    if primary:
        profiles = [
            _profile(
                profile_id="qwen3-8b-cpu-q4-k-m",
                runtime_class="CPU",
                quantization="Q4_K_M",
                artifact_sha256=QWEN_CPU_SHA,
                concurrency_levels=[1, 2, 4],
            ),
            _profile(
                profile_id="qwen3-8b-gpu-shared-q8-0",
                runtime_class="GPU_SHARED",
                quantization="Q8_0",
                artifact_sha256=QWEN_GPU_SHA,
                concurrency_levels=[1, 2, 4, 8],
            ),
        ]
        artifacts = [
            {
                "runtime_class": "CPU",
                "quantization": "Q4_K_M",
                "path": "artifacts/qwen3-8b-q4-k-m.gguf",
                "sha256": QWEN_CPU_SHA,
                "size_bytes": 5_000_000_000,
            },
            {
                "runtime_class": "GPU_SHARED",
                "quantization": "Q8_0",
                "path": "artifacts/qwen3-8b-q8-0.gguf",
                "sha256": QWEN_GPU_SHA,
                "size_bytes": 8_000_000_000,
            },
        ]
    else:
        profiles = [
            _profile(
                profile_id="mistral-7b-fallback-cpu-q4-k-m",
                runtime_class="CPU",
                quantization="Q4_K_M",
                artifact_sha256=MISTRAL_CPU_SHA,
                concurrency_levels=[1, 2, 4],
            )
        ]
        artifacts = [
            {
                "runtime_class": "CPU",
                "quantization": "Q4_K_M",
                "path": "artifacts/mistral-7b-instruct-v0.3-q4-k-m.gguf",
                "sha256": MISTRAL_CPU_SHA,
                "size_bytes": 4_500_000_000,
            }
        ]
    for profile in profiles:
        _semantic_profile_files(original, profile)

    fallback: dict[str, Any] | None = None
    if primary:
        fallback = {
            "primary_model_id": QWEN_ID,
            "primary_revision": QWEN_REVISION,
            "fallback_model_id": MISTRAL_ID,
            "fallback_revision": MISTRAL_REVISION,
            "fallback_artifact_sha256": MISTRAL_CPU_SHA,
            "trigger_count": 100,
            "successful_transitions": 100,
            "failed_transitions": 0,
            "p95_takeover_ms": 4000,
            "continuity_violations": 0,
            "critical_unsupported_facts": 0,
            "raw_metrics_path": "fallback/metrics.json",
            "protocol_path": "fallback/protocol.txt",
        }
        _write_json(
            original / fallback["raw_metrics_path"],
            {
                "schema_version": "tai.fallback-exercise-metrics.v1",
                **{
                    key: value
                    for key, value in fallback.items()
                    if key not in {"raw_metrics_path", "protocol_path"}
                },
            },
        )
        (original / fallback["protocol_path"]).parent.mkdir(parents=True, exist_ok=True)
        (original / fallback["protocol_path"]).write_text("forced primary failure\n")

    soak_profile = profiles[-1]
    soak: dict[str, Any] = {
        "profile_id": soak_profile["profile_id"],
        "duration_seconds": 3600,
        "request_count": 1000,
        "failed_requests": 0,
        "critical_failures": 0,
        "memory_start_mb": 5000,
        "memory_end_mb": 5200,
        "memory_peak_mb": 6000,
        "memory_drift_mb": 200,
        "p95_latency_ms": soak_profile["p95_latency_ms"],
        "raw_metrics_path": "soak/metrics.json",
        "environment_path": soak_profile["environment_path"],
    }
    _write_json(
        original / soak["raw_metrics_path"],
        {
            "schema_version": "tai.soak-metrics.v1",
            **{
                key: value
                for key, value in soak.items()
                if key not in {"raw_metrics_path", "environment_path"}
            },
        },
    )

    paths = {
        suite_manifest_path,
        cases_path,
        protocol_path,
        quality_path,
        soak["raw_metrics_path"],
        soak["environment_path"],
    }
    for profile in profiles:
        paths.update(
            {
                profile["hardware_path"],
                profile["environment_path"],
                profile["raw_metrics_path"],
                profile["cost_calculation_path"],
            }
        )
    if fallback:
        paths.update({fallback["raw_metrics_path"], fallback["protocol_path"]})
    evidence = [
        {
            "path": path,
            "sha256": _sha(original / path),
            "size_bytes": (original / path).stat().st_size,
        }
        for path in sorted(paths)
    ]
    for path in paths:
        destination = restored / path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(original / path, destination)

    authority_digest = canonical_sha256(load_json_strict(BUNDLE_AUTHORITY))
    archive_sha = "d" * 64 if primary else "e" * 64
    manifest = {
        "schema_version": "tai.model-benchmark-evidence.v2",
        "lifecycle": "COMPLETE",
        "pending_reason": None,
        "model": {"role": role, "model_id": model_id, "revision": revision},
        "bundle": {
            "authority_sha256": authority_digest,
            "manifest_sha256": "1" * 64 if primary else "2" * 64,
            "verification_report_sha256": "3" * 64 if primary else "4" * 64,
            "verification_status": "VERIFIED",
            "archive_sha256": archive_sha,
            "immutable_locator": f"oci://tai/{role.lower()}@sha256:{archive_sha}",
            "artifacts": artifacts,
        },
        "evaluation_suite": {
            "suite_id": "tai-platform-agro-58-v1",
            "total_cases": 58,
            "critical_cases": 23,
            "manifest_path": suite_manifest_path,
            "cases_path": cases_path,
            "protocol_path": protocol_path,
        },
        "quality": quality,
        "runtime_profiles": profiles,
        "fallback_exercise": fallback,
        "soak": soak,
        "evidence_files": evidence,
        "storage": {
            "immutable_locator": f"oci://tai/benchmark-{role.lower()}@sha256:{archive_sha}",
            "archive_sha256": archive_sha,
            "archive_size_bytes": 1_000_000,
            "uploaded_at": "2026-07-20T11:00:00+00:00",
            "retention_days": 90,
            "retention_expires_at": "2026-10-18T11:00:00+00:00",
            "restored_at": "2026-07-20T12:00:00+00:00",
        },
        "measured_at": "2026-07-20T10:00:00+00:00",
    }
    manifest_path = tmp_path / ("primary.json" if primary else "fallback.json")
    _write_json(manifest_path, manifest)
    return manifest_path, original, restored


def test_authority_pins_full_ap13c_and_ap13d_policy() -> None:
    authority = load_authority(AUTHORITY)

    assert authority["issue"] == 2862
    assert authority["suite_policy"]["required_total_cases"] == 58
    assert authority["suite_policy"]["required_critical_cases"] == 23
    assert authority["suite_policy"]["maximum_critical_unsupported_facts"] == 0
    assert {item["profile_id"] for item in authority["runtime_profiles"]} == {
        "qwen3-8b-cpu-q4-k-m",
        "qwen3-8b-gpu-shared-q8-0",
        "mistral-7b-fallback-cpu-q4-k-m",
    }
    assert authority["fallback_policy"]["maximum_failed_transitions"] == 0
    assert authority["soak_policy"]["minimum_duration_seconds"] == 3600
    assert authority["maturity_boundary"]["production_operational_status"] == (
        "NOT_ATTESTED"
    )


@pytest.mark.parametrize("path", [QWEN_PENDING, MISTRAL_PENDING])
def test_pending_baselines_fail_closed(path: Path) -> None:
    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, path, Path("/not-used"), Path("/not-used")
    )

    assert report["status"] == "PENDING_BENCHMARK"
    assert report["reasons"] == ["BENCHMARK_PENDING"]
    assert report["report_sha256"]


def test_complete_primary_and_fallback_verify_and_jointly_admit(tmp_path: Path) -> None:
    primary_path, primary_original, primary_restored = _create_manifest(
        tmp_path, primary=True
    )
    fallback_path, fallback_original, fallback_restored = _create_manifest(
        tmp_path, primary=False
    )

    primary = verify_benchmark(
        AUTHORITY,
        BUNDLE_AUTHORITY,
        primary_path,
        primary_original,
        primary_restored,
    )
    fallback = verify_benchmark(
        AUTHORITY,
        BUNDLE_AUTHORITY,
        fallback_path,
        fallback_original,
        fallback_restored,
    )
    assert primary["status"] == "VERIFIED", primary
    assert fallback["status"] == "VERIFIED", fallback

    primary_report = tmp_path / "primary-report.json"
    fallback_report = tmp_path / "fallback-report.json"
    write_json(primary_report, primary)
    write_json(fallback_report, fallback)
    decision = admit_models(
        AUTHORITY,
        primary_report,
        fallback_report,
        evaluated_at="2026-07-21T10:00:00+00:00",
    )
    assert decision["status"] == "ADMITTED", decision
    assert decision["reasons"] == []
    assert decision["production_operational_status"] == "NOT_ATTESTED"
    assert decision["decision_sha256"]


def test_critical_unsupported_fact_rejects_benchmark(tmp_path: Path) -> None:
    manifest_path, original, restored = _create_manifest(tmp_path, primary=True)
    manifest = load_json_strict(manifest_path)
    manifest["quality"]["critical_unsupported_facts"] = 1
    _write_json(manifest_path, manifest)

    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert "CRITICAL_UNSUPPORTED_FACTS_PRESENT" in report["reasons"]
    assert "QUALITY_RESULTS_MISMATCH" in report["reasons"]


def test_concurrency_matrix_is_exact_and_fail_closed(tmp_path: Path) -> None:
    manifest_path, original, restored = _create_manifest(tmp_path, primary=False)
    manifest = load_json_strict(manifest_path)
    manifest["runtime_profiles"][0]["concurrency"].pop()
    _write_json(manifest_path, manifest)

    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert any("CONCURRENCY_MATRIX_MISMATCH" in item for item in report["reasons"])


def test_restore_drift_is_rejected(tmp_path: Path) -> None:
    manifest_path, original, restored = _create_manifest(tmp_path, primary=False)
    (restored / "suite/protocol.txt").write_text("tampered\n")

    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert "RESTORED_EVIDENCE_MISMATCH:suite/protocol.txt" in report["reasons"]
    assert "RESTORE_DRIFT:suite/protocol.txt" in report["reasons"]


def test_symlink_and_same_root_restore_are_rejected(tmp_path: Path) -> None:
    manifest_path, original, restored = _create_manifest(tmp_path, primary=False)
    target = restored / "suite/protocol.txt"
    target.unlink()
    target.symlink_to(original / "suite/protocol.txt")

    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert "RESTORED_EVIDENCE_INVALID:suite/protocol.txt" in report["reasons"]

    same = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, original
    )
    assert same["status"] == "REJECTED"
    assert "RESTORE_ROOT_NOT_INDEPENDENT" in same["reasons"]


def test_duplicate_and_unknown_keys_are_rejected(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"schema_version":"x","schema_version":"y"}')
    with pytest.raises(ContractError):
        load_json_strict(duplicate)

    manifest_path, original, restored = _create_manifest(tmp_path, primary=False)
    manifest = load_json_strict(manifest_path)
    manifest["unknown"] = True
    _write_json(manifest_path, manifest)
    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert report["reasons"][0].startswith("CONTRACT_INVALID:")


def test_semantic_raw_metrics_mismatch_is_rejected(tmp_path: Path) -> None:
    manifest_path, original, restored = _create_manifest(tmp_path, primary=False)
    path = original / "profiles/mistral-7b-fallback-cpu-q4-k-m/metrics.json"
    value = load_json_strict(path)
    value["generation_tokens_per_second_milli"] += 1
    _write_json(path, value)
    shutil.copyfile(path, restored / path.relative_to(original))
    manifest = load_json_strict(manifest_path)
    for item in manifest["evidence_files"]:
        if item["path"].endswith("/metrics.json") and "profiles/" in item["path"]:
            item["sha256"] = _sha(path)
            item["size_bytes"] = path.stat().st_size
    _write_json(manifest_path, manifest)

    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert any("RUNTIME_METRICS_MISMATCH" in item for item in report["reasons"])


def test_admission_rejects_fallback_artifact_mismatch(tmp_path: Path) -> None:
    primary_path, primary_original, primary_restored = _create_manifest(
        tmp_path, primary=True
    )
    fallback_path, fallback_original, fallback_restored = _create_manifest(
        tmp_path, primary=False
    )
    primary = verify_benchmark(
        AUTHORITY,
        BUNDLE_AUTHORITY,
        primary_path,
        primary_original,
        primary_restored,
    )
    fallback = verify_benchmark(
        AUTHORITY,
        BUNDLE_AUTHORITY,
        fallback_path,
        fallback_original,
        fallback_restored,
    )
    primary["fallback_exercise"]["fallback_artifact_sha256"] = "f" * 64
    unsigned = dict(primary)
    unsigned.pop("report_sha256")
    primary["report_sha256"] = canonical_sha256(unsigned)
    primary_report = tmp_path / "primary-report.json"
    fallback_report = tmp_path / "fallback-report.json"
    write_json(primary_report, primary)
    write_json(fallback_report, fallback)

    decision = admit_models(
        AUTHORITY,
        primary_report,
        fallback_report,
        evaluated_at="2026-07-21T10:00:00+00:00",
    )
    assert decision["status"] == "REJECTED"
    assert "FALLBACK_EXERCISE_ARTIFACT_MISMATCH" in decision["reasons"]


def test_pending_reports_produce_pending_admission(tmp_path: Path) -> None:
    primary = verify_benchmark(
        AUTHORITY,
        BUNDLE_AUTHORITY,
        QWEN_PENDING,
        Path("/not-used"),
        Path("/not-used"),
    )
    fallback = verify_benchmark(
        AUTHORITY,
        BUNDLE_AUTHORITY,
        MISTRAL_PENDING,
        Path("/not-used"),
        Path("/not-used"),
    )
    primary_report = tmp_path / "primary-pending.json"
    fallback_report = tmp_path / "fallback-pending.json"
    write_json(primary_report, primary)
    write_json(fallback_report, fallback)
    decision = admit_models(
        AUTHORITY,
        primary_report,
        fallback_report,
        evaluated_at="2026-07-21T10:00:00+00:00",
    )
    assert decision["status"] == "PENDING_ADMISSION"
    assert decision["reasons"] == ["BENCHMARK_PENDING"]
    assert decision["production_operational_status"] == "NOT_ATTESTED"


def test_primitive_contract_validators_fail_closed(tmp_path: Path) -> None:
    from tai import model_benchmark_admission_v2 as v2

    invalid_calls: list[Callable[[], object]] = [
        lambda: v2._string(1, "value"),
        lambda: v2._string(" ", "value"),
        lambda: v2._integer("1", "value"),
        lambda: v2._integer(-1, "value"),
        lambda: v2._integer(2, "value", maximum=1),
        lambda: v2._boolean(1, "value"),
        lambda: v2._sha256("x", "value"),
        lambda: v2._revision("x", "value"),
        lambda: v2._identity("bad identity", "value"),
        lambda: v2._timestamp("not-a-time", "value"),
        lambda: v2._timestamp("2026-07-20T10:00:00", "value"),
        lambda: v2._immutable_locator("https://mutable.invalid/object", "value"),
        lambda: v2._relative_path("../escape", "value"),
        lambda: v2._relative_path("bad\\path", "value"),
        lambda: v2._list({}, "value"),
        lambda: v2._dict([], "value"),
        lambda: v2._parse_file({}, "file"),
    ]
    for call in invalid_calls:
        with pytest.raises(ContractError):
            call()

    scalar = tmp_path / "scalar.json"
    scalar.write_text("[]")
    with pytest.raises(ContractError):
        load_json_strict(scalar)


@pytest.mark.parametrize(
    "mutation",
    [
        lambda value: value.update(schema_version="bad"),
        lambda value: value.update(bundle_authority_schema="bad"),
        lambda value: value.update(issue=0),
        lambda value: value.update(benchmark_maximum_age_days=0),
        lambda value: value["suite_policy"].update(required_total_cases=0),
        lambda value: value["suite_policy"].update(required_critical_cases=59),
        lambda value: value["suite_policy"].update(
            minimum_platform_accuracy_basis_points=10_001
        ),
        lambda value: value.update(runtime_profiles=[]),
        lambda value: value["runtime_profiles"][0].update(role="UNKNOWN"),
        lambda value: value["runtime_profiles"][0].update(runtime_class="TPU"),
        lambda value: value["runtime_profiles"][0].update(
            required_concurrency_levels=[2, 1]
        ),
        lambda value: value["runtime_profiles"][1].update(
            profile_id=value["runtime_profiles"][0]["profile_id"]
        ),
        lambda value: value["runtime_profiles"][1].update(role="FALLBACK"),
        lambda value: value["runtime_profiles"][2].update(role="PRIMARY"),
        lambda value: value["runtime_profiles"][0]["thresholds"].update(
            minimum_sample_count=0
        ),
        lambda value: value["runtime_profiles"][0]["thresholds"].update(
            maximum_p99_latency_ms=1
        ),
        lambda value: value["runtime_profiles"][0]["thresholds"].update(
            minimum_prompt_tokens_per_second_milli=0
        ),
        lambda value: value["runtime_profiles"][0]["thresholds"].update(
            minimum_generation_tokens_per_second_milli=0
        ),
        lambda value: value["runtime_profiles"][0]["thresholds"].update(
            maximum_p95_latency_ms=0
        ),
        lambda value: value["runtime_profiles"][0]["thresholds"].update(
            maximum_error_rate_basis_points=10_001
        ),
        lambda value: value["fallback_policy"].update(minimum_trigger_count=0),
        lambda value: value["soak_policy"].update(minimum_duration_seconds=0),
        lambda value: value["evidence_limits"].update(maximum_file_count=0),
        lambda value: value["maturity_boundary"].update(
            production_operational_status="ATTESTED"
        ),
        lambda value: value.update(unknown=True),
    ],
)
def test_authority_rejects_invalid_policy(tmp_path: Path, mutation: Any) -> None:
    value = load_json_strict(AUTHORITY)
    mutation(value)
    path = tmp_path / "authority.json"
    _write_json(path, value)
    with pytest.raises(ContractError):
        load_authority(path)


def test_bundle_authority_and_binding_fail_closed(tmp_path: Path) -> None:
    from tai import model_benchmark_admission_v2 as v2

    invalid = tmp_path / "bundle.json"
    _write_json(invalid, {"schema_version": "bad", "models": []})
    with pytest.raises(ContractError):
        v2._load_bundle_authority(invalid)

    empty = tmp_path / "empty.json"
    _write_json(
        empty, {"schema_version": "tai.model-bundle-authority.v2", "models": []}
    )
    with pytest.raises(ContractError):
        v2._load_bundle_authority(empty)

    authority, digest = v2._load_bundle_authority(BUNDLE_AUTHORITY)
    plan = v2._bundle_plan(authority, QWEN_ID, QWEN_REVISION)
    valid = {
        "authority_sha256": digest,
        "manifest_sha256": "1" * 64,
        "verification_report_sha256": "2" * 64,
        "verification_status": "VERIFIED",
        "archive_sha256": "3" * 64,
        "immutable_locator": f"oci://tai/qwen@sha256:{'3' * 64}",
        "artifacts": [
            {
                "runtime_class": "CPU",
                "quantization": "Q4_K_M",
                "path": "artifacts/qwen3-8b-q4-k-m.gguf",
                "sha256": QWEN_CPU_SHA,
                "size_bytes": 1,
            },
            {
                "runtime_class": "GPU_SHARED",
                "quantization": "Q8_0",
                "path": "artifacts/qwen3-8b-q8-0.gguf",
                "sha256": QWEN_GPU_SHA,
                "size_bytes": 1,
            },
        ],
    }
    assert (
        v2._parse_bundle_binding(
            valid,
            "bundle",
            expected_authority_sha256=digest,
            bundle_plan=plan,
        )["verification_status"]
        == "VERIFIED"
    )

    mutators: tuple[Callable[[dict[str, Any]], object], ...] = (
        lambda value: value.update(authority_sha256="f" * 64),
        lambda value: value.update(verification_status="PENDING"),
        lambda value: value["artifacts"][0].update(quantization="UNKNOWN"),
        lambda value: value["artifacts"][0].update(path="wrong.gguf"),
        lambda value: value["artifacts"].pop(),
    )
    for mutate in mutators:
        value = json.loads(json.dumps(valid))
        mutate(value)
        with pytest.raises(ContractError):
            v2._parse_bundle_binding(
                value,
                "bundle",
                expected_authority_sha256=digest,
                bundle_plan=plan,
            )


def _rewrite_manifest(path: Path, mutate: Callable[[dict[str, Any]], object]) -> None:
    value = load_json_strict(path)
    mutate(value)
    _write_json(path, value)


@pytest.mark.parametrize(
    ("mutation", "expected"),
    [
        (
            lambda value: value["quality"].update(sample_count=57),
            "QUALITY_SAMPLE_COUNT_MISMATCH",
        ),
        (
            lambda value: value["quality"].update(platform_accuracy_basis_points=9499),
            "PLATFORM_QUALITY_BELOW_POLICY",
        ),
        (
            lambda value: value["quality"].update(agro_accuracy_basis_points=8999),
            "AGRO_QUALITY_BELOW_POLICY",
        ),
        (
            lambda value: value["quality"].update(critical_safety_failures=1),
            "CRITICAL_SAFETY_FAILURES_PRESENT",
        ),
        (
            lambda value: value["quality"].update(critical_abstention_misses=1),
            "CRITICAL_ABSTENTION_MISSES_PRESENT",
        ),
        (
            lambda value: value["runtime_profiles"][0].update(sample_count=99),
            "SAMPLE_COUNT_BELOW_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0].update(
                prompt_tokens_per_second_milli=1
            ),
            "PROMPT_SPEED_BELOW_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0].update(
                generation_tokens_per_second_milli=1
            ),
            "GENERATION_SPEED_BELOW_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0].update(
                p95_latency_ms=99_999, p99_latency_ms=100_000
            ),
            "P95_LATENCY_ABOVE_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0].update(p99_latency_ms=99_999),
            "P99_LATENCY_ABOVE_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0].update(peak_ram_mb=99_999),
            "RAM_ABOVE_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][1].update(peak_vram_mb=99_999),
            "VRAM_ABOVE_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0].update(cold_start_ms=999_999),
            "COLD_START_ABOVE_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0].update(warmup_ms=999_999),
            "WARMUP_ABOVE_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0]["concurrency"][0].update(
                request_count=99
            ),
            "CONCURRENCY_SAMPLE_COUNT_BELOW_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0]["concurrency"][0].update(
                p95_latency_ms=99_999
            ),
            "CONCURRENCY_P95_ABOVE_POLICY",
        ),
        (
            lambda value: value["runtime_profiles"][0]["concurrency"][0].update(
                generation_tokens_per_second_milli=1
            ),
            "CONCURRENCY_SPEED_BELOW_POLICY",
        ),
        (
            lambda value: value["fallback_exercise"].update(trigger_count=99),
            "FALLBACK_TRIGGER_COUNT_BELOW_POLICY",
        ),
        (
            lambda value: value["fallback_exercise"].update(
                failed_transitions=1, successful_transitions=99
            ),
            "FALLBACK_FAILED_TRANSITIONS_ABOVE_POLICY",
        ),
        (
            lambda value: value["fallback_exercise"].update(p95_takeover_ms=999_999),
            "FALLBACK_TAKEOVER_LATENCY_ABOVE_POLICY",
        ),
        (
            lambda value: value["fallback_exercise"].update(continuity_violations=1),
            "FALLBACK_CONTINUITY_VIOLATIONS_PRESENT",
        ),
        (
            lambda value: value["fallback_exercise"].update(
                critical_unsupported_facts=1
            ),
            "FALLBACK_CRITICAL_UNSUPPORTED_FACTS_PRESENT",
        ),
        (
            lambda value: value["soak"].update(duration_seconds=3599),
            "SOAK_DURATION_BELOW_POLICY",
        ),
        (
            lambda value: value["soak"].update(request_count=999),
            "SOAK_REQUEST_COUNT_BELOW_POLICY",
        ),
        (
            lambda value: value["soak"].update(failed_requests=11),
            "SOAK_FAILED_REQUESTS_ABOVE_POLICY",
        ),
        (
            lambda value: value["soak"].update(critical_failures=1),
            "SOAK_CRITICAL_FAILURES_PRESENT",
        ),
        (
            lambda value: value["soak"].update(
                memory_start_mb=5000,
                memory_end_mb=5600,
                memory_peak_mb=6000,
                memory_drift_mb=600,
            ),
            "SOAK_MEMORY_DRIFT_ABOVE_POLICY",
        ),
    ],
)
def test_policy_failures_are_machine_readable(
    tmp_path: Path,
    mutation: Callable[[dict[str, Any]], object],
    expected: str,
) -> None:
    manifest_path, original, restored = _create_manifest(tmp_path, primary=True)
    _rewrite_manifest(manifest_path, mutation)
    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert any(expected in reason for reason in report["reasons"]), report


def test_concurrency_error_rate_and_runtime_shape_are_validated(tmp_path: Path) -> None:
    from tai import model_benchmark_admission_v2 as v2

    profile = _profile(
        profile_id="x",
        runtime_class="CPU",
        quantization="Q4_K_M",
        artifact_sha256="a" * 64,
        concurrency_levels=[1],
    )
    profile["concurrency"][0].update(failed_requests=1, error_rate_basis_points=0)
    with pytest.raises(ContractError):
        v2._parse_runtime_profile(profile, "profile")

    profile = _profile(
        profile_id="x",
        runtime_class="CPU",
        quantization="Q4_K_M",
        artifact_sha256="a" * 64,
        concurrency_levels=[1],
    )
    profile["p99_latency_ms"] = 1
    with pytest.raises(ContractError):
        v2._parse_runtime_profile(profile, "profile")

    profile = _profile(
        profile_id="x",
        runtime_class="CPU",
        quantization="Q4_K_M",
        artifact_sha256="a" * 64,
        concurrency_levels=[1],
    )
    profile["peak_vram_mb"] = 1
    with pytest.raises(ContractError):
        v2._parse_runtime_profile(profile, "profile")


def test_soak_and_storage_semantics_are_validated() -> None:
    from tai import model_benchmark_admission_v2 as v2

    soak = {
        "profile_id": "x",
        "duration_seconds": 1,
        "request_count": 1,
        "failed_requests": 0,
        "critical_failures": 0,
        "memory_start_mb": 10,
        "memory_end_mb": 20,
        "memory_peak_mb": 15,
        "memory_drift_mb": 10,
        "p95_latency_ms": 1,
        "raw_metrics_path": "metrics.json",
        "environment_path": "environment.json",
    }
    with pytest.raises(ContractError):
        v2._parse_soak(soak, "soak")
    soak["memory_peak_mb"] = 20
    soak["memory_drift_mb"] = 9
    with pytest.raises(ContractError):
        v2._parse_soak(soak, "soak")

    storage = {
        "immutable_locator": f"oci://tai/x@sha256:{'a' * 64}",
        "archive_sha256": "a" * 64,
        "archive_size_bytes": 1,
        "uploaded_at": "2026-07-20T10:00:00+00:00",
        "retention_days": 1,
        "retention_expires_at": "2026-07-21T11:00:00+00:00",
        "restored_at": "2026-07-20T12:00:00+00:00",
    }
    with pytest.raises(ContractError):
        v2._parse_storage(storage, "storage")
    storage["retention_expires_at"] = "2026-07-21T10:00:00+00:00"
    storage["restored_at"] = "2026-07-22T10:00:00+00:00"
    with pytest.raises(ContractError):
        v2._parse_storage(storage, "storage")


def test_missing_original_and_hardlink_aliases_are_rejected(tmp_path: Path) -> None:
    manifest_path, original, restored = _create_manifest(tmp_path, primary=False)
    (original / "suite/protocol.txt").unlink()
    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert "ORIGINAL_EVIDENCE_INVALID:suite/protocol.txt" in report["reasons"]

    manifest_path, original, restored = _create_manifest(
        tmp_path / "links", primary=False
    )
    first = original / "suite/protocol.txt"
    second = original / "suite/manifest.json"
    second.unlink()
    os.link(first, second)
    manifest = load_json_strict(manifest_path)
    for item in manifest["evidence_files"]:
        if item["path"] == "suite/manifest.json":
            item["sha256"] = _sha(second)
            item["size_bytes"] = second.stat().st_size
    shutil.copyfile(second, restored / "suite/manifest.json")
    _write_json(manifest_path, manifest)
    report = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
    )
    assert any(
        reason.startswith("ORIGINAL_HARDLINK_ALIAS:") for reason in report["reasons"]
    )


def test_semantic_suite_hardware_cost_fallback_and_soak_are_validated(
    tmp_path: Path,
) -> None:
    checks: list[tuple[str, Callable[[dict[str, Any]], object], str]] = [
        (
            "suite/manifest.json",
            lambda value: value.update(total_cases=57),
            "EVALUATION_SUITE_MANIFEST_MISMATCH",
        ),
        (
            "suite/cases.json",
            lambda value: value["cases"].pop(),
            "EVALUATION_CASE_COUNT_MISMATCH",
        ),
        (
            "profiles/qwen3-8b-cpu-q4-k-m/hardware.json",
            lambda value: value.update(hardware_profile_id="wrong"),
            "HARDWARE_OBSERVATION_INVALID",
        ),
        (
            "profiles/qwen3-8b-cpu-q4-k-m/environment.json",
            lambda value: value.update(artifact_sha256="f" * 64),
            "RUNTIME_ENVIRONMENT_INVALID",
        ),
        (
            "profiles/qwen3-8b-cpu-q4-k-m/cost.json",
            lambda value: value.update(token_basis=1),
            "COST_CALCULATION_MISMATCH",
        ),
        (
            "fallback/metrics.json",
            lambda value: value.update(trigger_count=99),
            "FALLBACK_METRICS_MISMATCH",
        ),
        (
            "soak/metrics.json",
            lambda value: value.update(request_count=999),
            "SOAK_METRICS_MISMATCH",
        ),
    ]
    for index, (relative, mutation, expected) in enumerate(checks):
        case_root = tmp_path / str(index)
        manifest_path, original, restored = _create_manifest(case_root, primary=True)
        target = original / relative
        value = load_json_strict(target)
        mutation(value)
        _write_json(target, value)
        shutil.copyfile(target, restored / relative)
        manifest = load_json_strict(manifest_path)
        for item in manifest["evidence_files"]:
            if item["path"] == relative:
                item["sha256"] = _sha(target)
                item["size_bytes"] = target.stat().st_size
        _write_json(manifest_path, manifest)
        report = verify_benchmark(
            AUTHORITY, BUNDLE_AUTHORITY, manifest_path, original, restored
        )
        assert any(expected in reason for reason in report["reasons"]), report


def _resign_report(report: dict[str, Any]) -> None:
    unsigned = dict(report)
    unsigned.pop("report_sha256")
    report["report_sha256"] = canonical_sha256(unsigned)


@pytest.mark.parametrize(
    ("mutation", "expected"),
    [
        (
            lambda primary, fallback: primary.update(status="REJECTED"),
            "PRIMARY_BENCHMARK_NOT_VERIFIED",
        ),
        (
            lambda primary, fallback: fallback.update(status="REJECTED"),
            "FALLBACK_BENCHMARK_NOT_VERIFIED",
        ),
        (
            lambda primary, fallback: primary.update(authority_sha256="f" * 64),
            "PRIMARY_AUTHORITY_MISMATCH",
        ),
        (
            lambda primary, fallback: fallback.update(authority_sha256="f" * 64),
            "FALLBACK_AUTHORITY_MISMATCH",
        ),
        (
            lambda primary, fallback: primary["model"].update(role="FALLBACK"),
            "PRIMARY_ROLE_MISMATCH",
        ),
        (
            lambda primary, fallback: fallback["model"].update(role="PRIMARY"),
            "FALLBACK_ROLE_MISMATCH",
        ),
        (
            lambda primary, fallback: primary.update(verified_profiles=[]),
            "PRIMARY_PROFILE_SET_MISMATCH",
        ),
        (
            lambda primary, fallback: fallback.update(verified_profiles=[]),
            "FALLBACK_PROFILE_SET_MISMATCH",
        ),
        (
            lambda primary, fallback: primary.update(
                measured_at="2025-01-01T00:00:00+00:00"
            ),
            "PRIMARY_BENCHMARK_STALE_OR_FUTURE",
        ),
        (
            lambda primary, fallback: fallback["bundle"].update(
                verification_status="REJECTED"
            ),
            "FALLBACK_BUNDLE_NOT_VERIFIED",
        ),
        (
            lambda primary, fallback: primary["fallback_exercise"].update(
                fallback_model_id="wrong/model"
            ),
            "FALLBACK_EXERCISE_MODEL_MISMATCH",
        ),
        (
            lambda primary, fallback: primary["fallback_exercise"].update(
                fallback_revision="f" * 40
            ),
         "FALLBACK_EXERCISE_REVISION_MISMATCH",
        ),
    ],
)
def test_joint_admission_reasons_are_fail_closed(
    tmp_path: Path,
    mutation: Callable[[dict[str, Any], dict[str, Any]], object],
    expected: str,
) -> None:
    primary_path, primary_original, primary_restored = _create_manifest(
        tmp_path, primary=True
    )
    fallback_path, fallback_original, fallback_restored = _create_manifest(
        tmp_path, primary=False
    )
    primary = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, primary_path, primary_original, primary_restored
    )
    fallback = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, fallback_path, fallback_original, fallback_restored
    )
    mutation(primary, fallback)
    _resign_report(primary)
    _resign_report(fallback)
    primary_report = tmp_path / "primary-report.json"
    fallback_report = tmp_path / "fallback-report.json"
    write_json(primary_report, primary)
    write_json(fallback_report, fallback)
    decision = admit_models(
        AUTHORITY,
        primary_report,
        fallback_report,
        evaluated_at="2026-07-21T10:00:00+00:00",
    )
    assert decision["status"] == "REJECTED"
    assert expected in decision["reasons"], decision


def test_invalid_report_hash_is_rejected(tmp_path: Path) -> None:
    primary = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, QWEN_PENDING, Path("/x"), Path("/y")
    )
    fallback = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, MISTRAL_PENDING, Path("/x"), Path("/y")
    )
    primary["report_sha256"] = "f" * 64
    primary_path = tmp_path / "primary.json"
    fallback_path = tmp_path / "fallback.json"
    write_json(primary_path, primary)
    write_json(fallback_path, fallback)
    decision = admit_models(
        AUTHORITY,
        primary_path,
        fallback_path,
        evaluated_at="2026-07-21T10:00:00+00:00",
    )
    assert decision["status"] == "REJECTED"
    assert decision["reasons"][0].startswith("CONTRACT_INVALID:")


def test_cli_validate_pending_and_admit_exit_codes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from tai.model_benchmark_admission_v2_cli import main

    monkeypatch.setattr("sys.argv", ["cli", "validate-authority", str(AUTHORITY)])
    assert main() == 0
    assert '"status": "VALID"' in capsys.readouterr().out

    output = tmp_path / "pending-report.json"
    monkeypatch.setattr(
        "sys.argv",
        [
            "cli",
            "verify-benchmark",
            str(AUTHORITY),
            str(BUNDLE_AUTHORITY),
            str(QWEN_PENDING),
            "/not-used",
            "/not-used",
            "--output",
            str(output),
        ],
    )
    assert main() == 2
    assert load_json_strict(output)["status"] == "PENDING_BENCHMARK"

    primary = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, QWEN_PENDING, Path("/x"), Path("/y")
    )
    fallback = verify_benchmark(
        AUTHORITY, BUNDLE_AUTHORITY, MISTRAL_PENDING, Path("/x"), Path("/y")
    )
    primary_path = tmp_path / "primary.json"
    fallback_path = tmp_path / "fallback.json"
    write_json(primary_path, primary)
    write_json(fallback_path, fallback)
    monkeypatch.setattr(
        "sys.argv",
        [
            "cli",
            "admit",
            str(AUTHORITY),
            str(primary_path),
            str(fallback_path),
            "--evaluated-at",
            "2026-07-21T10:00:00+00:00",
        ],
    )
    assert main() == 2
    assert '"status": "PENDING_ADMISSION"' in capsys.readouterr().out


def test_scope_is_exact_and_forbids_fabricated_evidence() -> None:
    scope = load_json_strict(SCOPE)
    expected = {
        "apps/tai/governance/scopes/ap-13cd-benchmark-admission-2862.json",
        "apps/tai/model-artifacts/model-admission-decision.schema.v2.json",
        "apps/tai/model-artifacts/model-benchmark-admission-authority.v2.json",
        "apps/tai/model-artifacts/model-benchmark-admission-runbook.v2.md",
        "apps/tai/model-artifacts/model-benchmark-evidence.schema.v2.json",
        "apps/tai/model-artifacts/mistral-7b-instruct-v0.3.benchmark.v2.pending.json",
        "apps/tai/model-artifacts/qwen3-8b.benchmark.v2.pending.json",
        "apps/tai/tai/model_benchmark_admission_v2.py",
        "apps/tai/tai/model_benchmark_admission_v2_cli.py",
        "apps/tai/tests/test_model_benchmark_admission_v2.py",
    }
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["issue"] == 2862
    assert set(scope["allowed_paths"]) == expected
    assert len(scope["allowed_paths"]) == len(expected)
    assert any(
        "fabricated model bundle" in item for item in scope["forbidden_capabilities"]
    )
    assert any("ADMITTED decision" in item for item in scope["forbidden_capabilities"])
    assert any("NOT_ATTESTED" in item for item in scope["acceptance"])


def test_cli_invalid_authority_returns_rejected(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from tai.model_benchmark_admission_v2_cli import main

    invalid = tmp_path / "invalid-authority.json"
    _write_json(invalid, {"schema_version": "bad"})
    output = tmp_path / "error.json"
    monkeypatch.setattr(
        "sys.argv",
        ["cli", "validate-authority", str(invalid), "--output", str(output)],
    )
    assert main() == 2
    assert load_json_strict(output)["status"] == "REJECTED"
    assert "CONTRACT_INVALID" in capsys.readouterr().out
