from __future__ import annotations

import hashlib
import json
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from tai import cpu_runtime_evidence as runtime

SHA = "a" * 40
DUMMY_SHA = "b" * 64
PROFILES = (
    "qwen3-8b-cpu-q4-k-m",
    "mistral-7b-fallback-cpu-q4-k-m",
)


TAI_ROOT = Path(__file__).parents[1]


def _execution_authority() -> dict[str, Any]:
    value = json.loads(
        (
            TAI_ROOT
            / "model-artifacts"
            / "cpu-benchmark-execution-authority.v1.json"
        ).read_text(encoding="utf-8")
    )
    assert isinstance(value, dict)
    return value


def _runtime_authority() -> dict[str, Any]:
    execution = _execution_authority()
    return {
        "schema_version": "tai.cpu-runtime-evidence-authority.v1",
        "program_issue": 2726,
        "parent_issue": 2971,
        "issue": 2987,
        "execution_authority": {
            "schema_version": execution["schema_version"],
            "issue": 2977,
            "path": "cpu-benchmark-execution-authority.v1.json",
        },
        "readiness": {
            "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
            "required_status": "READY_FOR_EXTERNAL_EXECUTION",
            "maximum_age_hours": 24,
            "exact_main_required": True,
            "simulated_evidence_accepted": False,
        },
        "bundle_finalization": {
            "schema_version": "tai.model-bundle-finalization-report.v1",
            "required_status": (
                "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED"
            ),
            "bundle_authority_schema": "tai.model-bundle-authority.v2",
            "verification_status": "VERIFIED",
            "exact_object_version_required": True,
            "independent_restore_required": True,
        },
        "toolchain": execution["toolchain"],
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
        "runtime_profiles": [
            {
                "profile_id": PROFILES[0],
                "role": "PRIMARY",
                "model_key": "qwen3-8b",
                "model_id": "Qwen/Qwen3-8B",
                "revision": execution["models"][0]["revision"],
                "runtime_class": "CPU",
                "quantization": "Q4_K_M",
                "artifact_path": execution["models"][0]["artifact_path"],
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
                "profile_id": PROFILES[1],
                "role": "FALLBACK",
                "model_key": "mistral-7b-instruct-v0.3",
                "model_id": "mistralai/Mistral-7B-Instruct-v0.3",
                "revision": execution["models"][1]["revision"],
                "runtime_class": "CPU",
                "quantization": "Q4_K_M",
                "artifact_path": execution["models"][1]["artifact_path"],
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
        ],
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
            "maximum_file_size_bytes": 536870912,
            "maximum_total_size_bytes": 8589934592,
            "minimum_external_retention_days": 90,
            "exact_version_restore_required": True,
            "independent_restore_roots_required": True,
            "raw_payloads_in_github_allowed": False,
            "forbidden_suffixes": [
                ".gguf",
                ".safetensors",
                ".bin",
                ".pt",
                ".pth",
                ".tar",
                ".zip",
            ],
            "required_semantic_files": [
                "suite/case-manifest.json",
                "raw-observations/manifest.json",
                f"raw-observations/{PROFILES[0]}.jsonl",
                f"raw-observations/{PROFILES[1]}.jsonl",
                f"runtime/{PROFILES[0]}/metrics.json",
                f"runtime/{PROFILES[1]}/metrics.json",
                "toolchain/manifest.json",
                "fallback/metrics.json",
                "soak/metrics.json",
                "storage/manifest.json",
            ],
        },
        "maturity_boundary": {
            "runtime_verification_status": (
                "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
            ),
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            "benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        },
    }


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _with_digest(value: dict[str, Any], field: str) -> dict[str, Any]:
    output = dict(value)
    output[field] = runtime.canonical_sha256(output)
    return output


def _authorities(tmp_path: Path) -> tuple[Path, dict[str, Any]]:
    root = tmp_path / "model-artifacts"
    root.mkdir()
    execution = _execution_authority()
    _write_json(root / "cpu-benchmark-execution-authority.v1.json", execution)
    authority_path = root / "cpu-runtime-evidence-authority.v1.json"
    _write_json(authority_path, _runtime_authority())
    authority = runtime.load_runtime_authority(authority_path)
    return authority_path, authority


def _profile(authority: dict[str, Any], index: int, now: datetime) -> dict[str, Any]:
    source = authority["runtime_profiles"][index]
    toolchain = {
        "name": authority["toolchain"]["name"],
        "release": authority["toolchain"]["release"],
        "commit": authority["toolchain"]["commit"],
        "profile": authority["toolchain"]["profile"],
        "acceptance_sha256": DUMMY_SHA,
        "binary_sha256": {
            "llama-cli": "1" * 64,
            "llama-server": "2" * 64,
            "llama-bench": "3" * 64,
        },
    }
    rows = []
    for concurrency in (1, 2, 4):
        rows.append(
            {
                "concurrency": concurrency,
                "sample_count": 100,
                "request_count": 100,
                "error_count": 0,
                "prompt_tokens_per_second_milli": 6000,
                "generation_tokens_per_second_milli": 5000,
                "p50_latency_ms": 5000,
                "p95_latency_ms": 10000,
                "p99_latency_ms": 15000,
                "error_rate_basis_points": 0,
                "peak_ram_mb": 8000,
            }
        )
    profile = {
        "profile_id": source["profile_id"],
        "role": source["role"],
        "model_id": source["model_id"],
        "revision": source["revision"],
        "runtime_class": source["runtime_class"],
        "quantization": source["quantization"],
        "artifact_sha256": str(index + 4) * 64,
        "bundle_manifest_sha256": str(index + 6) * 64,
        "host": {
            "host_role": "DEDICATED_MODEL_HOST",
            "user": "tai-model",
            "host_id": "tai-model-cpu-01",
            "cpu_model": "Test CPU",
            "physical_cores": 8,
            "logical_cores": 16,
            "ram_mb": 16384,
            "os_release": "Ubuntu 24.04",
            "kernel_release": "6.8.0",
            "production_host": False,
            "loopback_only": True,
        },
        "toolchain": toolchain,
        "concurrency_results": rows,
        "cold_start_ms": 60000,
        "warmup_ms": 90000,
        "cost_inputs": {
            "currency": "RUB",
            "host_monthly_cost_minor": 250000,
            "monthly_hours": 730,
            "energy_price_minor_per_kwh": 900,
            "average_power_watts": 160,
            "pricing_observed_at": now.isoformat(),
            "pricing_source_sha256": "9" * 64,
        },
    }
    return _with_digest(profile, "metrics_sha256")


def _case_manifest() -> tuple[dict[str, Any], list[str]]:
    cases = []
    case_ids = []
    for index in range(58):
        case_id = f"case.{index:02d}"
        case_ids.append(case_id)
        cases.append(
            {
                "case_id": case_id,
                "domain": "PLATFORM" if index < 30 else "AGRO",
                "criticality": "CRITICAL" if index < 23 else "HIGH",
                "variant_kind": "CANONICAL",
                "prompt_sha256": hashlib.sha256(
                    f"prompts:{case_id}".encode()
                ).hexdigest(),
                "case_sha256": hashlib.sha256(case_id.encode()).hexdigest(),
                "coverage_family_id": f"family.{index:02d}",
            }
        )
    return {
        "schema_version": "tai.gold-case-manifest.v1",
        "version": "v1",
        "cases": cases,
    }, case_ids


def _raw_records(profile_id: str, case_ids: list[str], now: datetime) -> str:
    lines: list[str] = []
    for case_id in case_ids:
        for locale in ("ru", "en", "zh"):
            prompt = f"{profile_id}:{case_id}:{locale}:prompt"
            response = f"{profile_id}:{case_id}:{locale}:response"
            record = {
                "schema_version": "tai.raw-observation.v1",
                "profile_id": profile_id,
                "case_id": case_id,
                "locale": locale,
                "prompt": prompt,
                "response": response,
                "status": "SUCCEEDED",
                "started_at": now.isoformat(),
                "completed_at": (now + timedelta(seconds=1)).isoformat(),
                "latency_ms": 1000,
                "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
                "response_sha256": hashlib.sha256(response.encode()).hexdigest(),
            }
            record["record_sha256"] = runtime.canonical_sha256(record)
            lines.append(json.dumps(record, ensure_ascii=False, sort_keys=True))
    return "\n".join(lines) + "\n"


def _file_row(root: Path, relative: str) -> dict[str, Any]:
    path = root / relative
    content = path.read_bytes()
    return {
        "path": relative,
        "sha256": hashlib.sha256(content).hexdigest(),
        "size_bytes": len(content),
    }


def _complete_fixture(
    tmp_path: Path,
) -> tuple[Path, Path, Path, Path, dict[str, Any]]:
    authority_path, authority = _authorities(tmp_path)
    original = tmp_path / "original"
    original.mkdir()
    now = datetime(2026, 7, 21, 12, tzinfo=UTC)

    case_manifest, case_ids = _case_manifest()
    case_path = original / "suite/case-manifest.json"
    _write_json(case_path, case_manifest)
    case_digest = hashlib.sha256(case_path.read_bytes()).hexdigest()

    payload_rows = []
    for profile_id in PROFILES:
        relative = f"raw-observations/{profile_id}.jsonl"
        path = original / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(_raw_records(profile_id, case_ids, now), encoding="utf-8")
        payload_rows.append(
            {
                "profile_id": profile_id,
                "path": relative,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                "record_count": 174,
            }
        )

    corpus = {
        "suite_id": "tai-platform-agro-58-v1",
        "status": "ACCEPTED",
        "accepted": True,
        "assessment_sha256": "a" * 64,
        "corpus_sha256": "c" * 64,
        "case_manifest_path": "suite/case-manifest.json",
        "case_manifest_sha256": case_digest,
        "total_cases": 58,
        "critical_cases": 23,
        "locales": ["ru", "en", "zh"],
        "unreviewed_cases": 0,
    }
    raw_manifest = {
        "schema_version": "tai.raw-observation-manifest.v1",
        "suite_id": corpus["suite_id"],
        "corpus_sha256": corpus["corpus_sha256"],
        "assessment_sha256": corpus["assessment_sha256"],
        "case_manifest_sha256": case_digest,
        "locales": ["ru", "en", "zh"],
        "profiles": payload_rows,
        "total_records": 348,
    }
    raw_manifest = _with_digest(raw_manifest, "manifest_sha256")
    raw_manifest_path = original / "raw-observations/manifest.json"
    _write_json(raw_manifest_path, raw_manifest)

    profiles = [_profile(authority, index, now) for index in range(2)]
    for profile in profiles:
        _write_json(
            original / f"runtime/{profile['profile_id']}/metrics.json",
            profile,
        )
    _write_json(original / "toolchain/manifest.json", profiles[0]["toolchain"])

    fallback = _with_digest(
        {
            "primary_profile_id": PROFILES[0],
            "fallback_profile_id": PROFILES[1],
            "forced_primary_failure": True,
            "trigger_count": 100,
            "failed_transitions": 0,
            "p50_takeover_ms": 1000,
            "p95_takeover_ms": 3000,
            "continuity_violations": 0,
        },
        "metrics_sha256",
    )
    _write_json(original / "fallback/metrics.json", fallback)
    soak = _with_digest(
        {
            "started_at": now.isoformat(),
            "completed_at": (now + timedelta(seconds=3600)).isoformat(),
            "duration_seconds": 3600,
            "request_count": 1000,
            "failed_requests": 0,
            "critical_failures": 0,
            "memory_start_mb": 8000,
            "memory_end_mb": 8100,
            "memory_drift_mb": 100,
            "profile_request_counts": {PROFILES[0]: 500, PROFILES[1]: 500},
        },
        "metrics_sha256",
    )
    _write_json(original / "soak/metrics.json", soak)

    non_storage_paths = [
        "fallback/metrics.json",
        f"raw-observations/{PROFILES[1]}.jsonl",
        f"raw-observations/{PROFILES[0]}.jsonl",
        "raw-observations/manifest.json",
        f"runtime/{PROFILES[1]}/metrics.json",
        f"runtime/{PROFILES[0]}/metrics.json",
        "soak/metrics.json",
        "suite/case-manifest.json",
        "toolchain/manifest.json",
    ]
    non_storage_rows = sorted(
        (_file_row(original, path) for path in non_storage_paths),
        key=lambda item: item["path"],
    )
    storage = _with_digest(
        {
            "provider": "SELECTEL_S3",
            "bucket": "tai-evidence",
            "prefix": "cpu/runtime/run-001",
            "evidence_object_version_id": "version-001",
            "retention_days": 90,
            "immutability_status": "IMMUTABLE_VERSIONED",
            "original_root_id": "restore-original-001",
            "restored_root_id": "restore-independent-001",
            "restored_at": (now + timedelta(hours=2)).isoformat(),
            "evidence_set_sha256": runtime.canonical_sha256(non_storage_rows),
        },
        "storage_manifest_sha256",
    )
    _write_json(original / "storage/manifest.json", storage)
    all_paths = sorted([*non_storage_paths, "storage/manifest.json"])
    evidence_files = [_file_row(original, path) for path in all_paths]

    readiness = _with_digest(
        {
            "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
            "status": "READY_FOR_EXTERNAL_EXECUTION",
            "ready": True,
            "exact_main": SHA,
            "evaluated_at": (now - timedelta(hours=1)).isoformat(),
            "authority_sha256": authority["execution_authority_sha256"],
            "prerequisite_report_sha256": "d" * 64,
            "gold_corpus_sha256": corpus["corpus_sha256"],
            "gold_assessment_sha256": corpus["assessment_sha256"],
            "required_profiles": list(PROFILES),
            "reasons": [],
            "benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
        },
        "report_sha256",
    )
    bundles = []
    for index, source in enumerate(authority["runtime_profiles"]):
        bundles.append(
            {
                "profile_id": source["profile_id"],
                "model_id": source["model_id"],
                "revision": source["revision"],
                "object_key": f"bundles/{source['profile_id']}.tar.zst",
                "object_version_id": f"version-{index}",
                "bundle_sha256": str(index + 6) * 64,
                "bundle_manifest_sha256": str(index + 8) * 64,
                "original_restore_root_id": f"bundle-original-{index}",
                "independent_restore_root_id": f"bundle-restored-{index}",
            }
        )
    bundle_finalization = {
        "schema_version": "tai.model-bundle-finalization-report.v1",
        "status": "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED",
        "verification_status": "VERIFIED",
        "source_report_sha256": "e" * 64,
        "authority_sha256": "f" * 64,
        "exact_main": SHA,
        "bundles": bundles,
    }
    raw_observations = {
        "manifest_path": "raw-observations/manifest.json",
        "manifest_file_sha256": hashlib.sha256(raw_manifest_path.read_bytes()).hexdigest(),
        "per_profile_counts": {PROFILES[0]: 174, PROFILES[1]: 174},
        "total_count": 348,
        "case_count": 58,
        "critical_case_count": 23,
        "locales": ["ru", "en", "zh"],
        "external_only": True,
        "github_payload_exported": False,
        "quality_scored": False,
    }
    manifest = {
        "schema_version": "tai.cpu-runtime-evidence.v1",
        "lifecycle": "COMPLETE",
        "pending_reason": None,
        "exact_main": SHA,
        "authority_sha256": authority["authority_sha256"],
        "execution_authority_sha256": authority["execution_authority_sha256"],
        "readiness": readiness,
        "bundle_finalization": bundle_finalization,
        "corpus": corpus,
        "runtime_profiles": profiles,
        "fallback_exercise": fallback,
        "soak": soak,
        "raw_observations": raw_observations,
        "evidence_files": evidence_files,
        "storage": storage,
        "measured_at": now.isoformat(),
        "runtime_verification_status": (
            "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
        ),
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    manifest = _with_digest(manifest, "manifest_sha256")
    manifest_path = tmp_path / "manifest.json"
    _write_json(manifest_path, manifest)
    restored = tmp_path / "restored"
    shutil.copytree(original, restored)
    return authority_path, manifest_path, original, restored, manifest


def test_complete_runtime_evidence_verifies_without_quality_claim(tmp_path: Path) -> None:
    authority, manifest, original, restored, _ = _complete_fixture(tmp_path)
    report = runtime.verify_runtime_evidence(
        authority,
        manifest,
        original,
        restored,
        evaluated_at="2026-07-21T15:00:00+00:00",
    )
    assert report["accepted"] is True
    assert report["status"] == (
        "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
    )
    assert report["raw_observation_count"] == 348
    assert report["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert report["benchmark_status"] == "PENDING_BENCHMARK"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_same_restore_root_is_rejected(tmp_path: Path) -> None:
    authority, manifest, original, _, _ = _complete_fixture(tmp_path)
    with pytest.raises(runtime.RuntimeEvidenceError, match="roots are identical"):
        runtime.verify_runtime_evidence(
            authority,
            manifest,
            original,
            original,
            evaluated_at="2026-07-21T15:00:00+00:00",
        )


def test_missing_raw_observation_is_rejected(tmp_path: Path) -> None:
    authority, manifest_path, original, restored, manifest = _complete_fixture(tmp_path)
    path = original / f"raw-observations/{PROFILES[0]}.jsonl"
    lines = path.read_text(encoding="utf-8").splitlines()
    path.write_text("\n".join(lines[:-1]) + "\n", encoding="utf-8")
    shutil.rmtree(restored)
    shutil.copytree(original, restored)
    row = next(
        item
        for item in manifest["evidence_files"]
        if item["path"] == path.relative_to(original).as_posix()
    )
    row["sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    row["size_bytes"] = path.stat().st_size
    manifest["storage"]["evidence_set_sha256"] = runtime.canonical_sha256(
        [
            item
            for item in manifest["evidence_files"]
            if item["path"] != "storage/manifest.json"
        ]
    )
    manifest["storage"] = _with_digest(
        {
            key: value
            for key, value in manifest["storage"].items()
            if key != "storage_manifest_sha256"
        },
        "storage_manifest_sha256",
    )
    _write_json(original / "storage/manifest.json", manifest["storage"])
    shutil.copy2(original / "storage/manifest.json", restored / "storage/manifest.json")
    storage_row = next(
        item for item in manifest["evidence_files"] if item["path"] == "storage/manifest.json"
    )
    storage_row["sha256"] = hashlib.sha256(
        (original / "storage/manifest.json").read_bytes()
    ).hexdigest()
    storage_row["size_bytes"] = (original / "storage/manifest.json").stat().st_size
    manifest = _with_digest(
        {key: value for key, value in manifest.items() if key != "manifest_sha256"},
        "manifest_sha256",
    )
    _write_json(manifest_path, manifest)
    with pytest.raises(runtime.RuntimeEvidenceError, match="payload digest mismatch"):
        runtime.verify_runtime_evidence(
            authority,
            manifest_path,
            original,
            restored,
            evaluated_at="2026-07-21T15:00:00+00:00",
        )


def test_declared_raw_coverage_must_be_174_per_profile(tmp_path: Path) -> None:
    authority, manifest_path, original, restored, manifest = _complete_fixture(tmp_path)
    manifest["raw_observations"]["per_profile_counts"][PROFILES[0]] = 173
    manifest = _with_digest(
        {key: value for key, value in manifest.items() if key != "manifest_sha256"},
        "manifest_sha256",
    )
    _write_json(manifest_path, manifest)
    with pytest.raises(runtime.RuntimeEvidenceError, match="per-profile count mismatch"):
        runtime.verify_runtime_evidence(
            authority,
            manifest_path,
            original,
            restored,
            evaluated_at="2026-07-21T15:00:00+00:00",
        )


def test_low_throughput_is_rejected_before_quality_scoring(tmp_path: Path) -> None:
    authority, manifest_path, original, restored, manifest = _complete_fixture(tmp_path)
    profile = manifest["runtime_profiles"][0]
    profile["concurrency_results"][0]["generation_tokens_per_second_milli"] = 1
    profile = _with_digest(
        {key: value for key, value in profile.items() if key != "metrics_sha256"},
        "metrics_sha256",
    )
    manifest["runtime_profiles"][0] = profile
    _write_json(original / f"runtime/{PROFILES[0]}/metrics.json", profile)
    shutil.copy2(
        original / f"runtime/{PROFILES[0]}/metrics.json",
        restored / f"runtime/{PROFILES[0]}/metrics.json",
    )
    row = next(
        item
        for item in manifest["evidence_files"]
        if item["path"] == f"runtime/{PROFILES[0]}/metrics.json"
    )
    row["sha256"] = hashlib.sha256(
        (original / row["path"]).read_bytes()
    ).hexdigest()
    row["size_bytes"] = (original / row["path"]).stat().st_size
    manifest["storage"]["evidence_set_sha256"] = runtime.canonical_sha256(
        [
            item
            for item in manifest["evidence_files"]
            if item["path"] != "storage/manifest.json"
        ]
    )
    manifest["storage"] = _with_digest(
        {
            key: value
            for key, value in manifest["storage"].items()
            if key != "storage_manifest_sha256"
        },
        "storage_manifest_sha256",
    )
    _write_json(original / "storage/manifest.json", manifest["storage"])
    shutil.copy2(original / "storage/manifest.json", restored / "storage/manifest.json")
    storage_row = next(
        item for item in manifest["evidence_files"] if item["path"] == "storage/manifest.json"
    )
    storage_row["sha256"] = hashlib.sha256(
        (original / "storage/manifest.json").read_bytes()
    ).hexdigest()
    storage_row["size_bytes"] = (original / "storage/manifest.json").stat().st_size
    manifest = _with_digest(
        {key: value for key, value in manifest.items() if key != "manifest_sha256"},
        "manifest_sha256",
    )
    _write_json(manifest_path, manifest)
    with pytest.raises(runtime.RuntimeEvidenceError, match="throughput is below threshold"):
        runtime.verify_runtime_evidence(
            authority,
            manifest_path,
            original,
            restored,
            evaluated_at="2026-07-21T15:00:00+00:00",
        )


def test_pending_manifest_is_fail_closed(tmp_path: Path) -> None:
    authority_path, authority = _authorities(tmp_path)
    pending = {
        "schema_version": "tai.cpu-runtime-evidence.v1",
        "lifecycle": "PENDING_RUNTIME_EXECUTION",
        "pending_reason": "External prerequisites are absent.",
        "exact_main": None,
        "authority_sha256": None,
        "execution_authority_sha256": None,
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
        "runtime_verification_status": "PENDING_RUNTIME_EXECUTION",
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    pending = _with_digest(pending, "manifest_sha256")
    manifest_path = tmp_path / "pending.json"
    _write_json(manifest_path, pending)
    original = tmp_path / "original"
    restored = tmp_path / "restored"
    original.mkdir()
    restored.mkdir()
    report = runtime.verify_runtime_evidence(
        authority_path,
        manifest_path,
        original,
        restored,
        evaluated_at="2026-07-21T15:00:00+00:00",
    )
    assert report["accepted"] is False
    assert report["status"] == "PENDING_RUNTIME_EXECUTION"
    assert report["authority_sha256"] == authority["authority_sha256"]
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_duplicate_json_key_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "duplicate.json"
    path.write_text('{"schema_version":"x","schema_version":"y"}', encoding="utf-8")
    with pytest.raises(runtime.RuntimeEvidenceError, match="duplicate JSON key"):
        runtime.load_runtime_manifest(path)
