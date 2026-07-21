from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path
from typing import Any

import pytest

from tai.cpu_runtime_evidence import (
    RuntimeEvidenceError,
    load_authority,
    load_json,
    verify_runtime_evidence,
)

ROOT = Path(__file__).parents[1]
ARTIFACTS = ROOT / "model-artifacts"
AUTHORITY = ARTIFACTS / "cpu-runtime-evidence-authority.v1.json"
PENDING = ARTIFACTS / "cpu-runtime-evidence.pending.json"
SCOPE = ROOT / "governance" / "scopes" / "ap-13c1c-raw-runtime-evidence-2987.json"

EXACT_MAIN = "cbc7bcba074177ba34e5fd142ec0c1c06f0b8863"
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52bab71"
QWEN_ARTIFACT_SHA = "a" * 64
MISTRAL_ARTIFACT_SHA = "b" * 64
ASSESSMENT_SHA = "c" * 64
CORPUS_SHA = "d" * 64
LOCALES = ["ru", "en", "zh"]
PROFILE_IDS = [
    "qwen3-8b-cpu-q4-k-m",
    "mistral-7b-fallback-cpu-q4-k-m",
]


def _write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _profile(
    *,
    profile_id: str,
    role: str,
    model_id: str,
    revision: str,
    artifact_sha256: str,
) -> dict[str, Any]:
    qwen = role == "PRIMARY"
    prompt_speed = 6_000 if qwen else 5_000
    generation_speed = 5_000 if qwen else 4_000
    p95 = 18_000 if qwen else 22_000
    p99 = 25_000 if qwen else 30_000
    return {
        "profile_id": profile_id,
        "role": role,
        "model_id": model_id,
        "revision": revision,
        "runtime_class": "CPU",
        "quantization": "Q4_K_M",
        "artifact_sha256": artifact_sha256,
        "hardware_profile_id": f"hardware-{profile_id}",
        "hardware_path": f"profiles/{profile_id}/hardware.json",
        "environment_path": f"profiles/{profile_id}/environment.json",
        "benchmark_metrics_path": f"profiles/{profile_id}/llama-bench.json",
        "request_metrics_path": f"profiles/{profile_id}/requests.json",
        "cost_inputs_path": f"profiles/{profile_id}/cost-inputs.json",
        "sample_count": 100,
        "prompt_tokens_per_second_milli": prompt_speed,
        "generation_tokens_per_second_milli": generation_speed,
        "p95_latency_ms": p95,
        "p99_latency_ms": p99,
        "error_rate_basis_points": 0,
        "peak_ram_mb": 12_000,
        "cold_start_ms": 60_000,
        "warmup_ms": 90_000,
        "concurrency": [
            {
                "level": level,
                "request_count": 100,
                "failed_requests": 0,
                "error_rate_basis_points": 0,
                "p95_latency_ms": p95,
                "generation_tokens_per_second_milli": generation_speed,
            }
            for level in (1, 2, 4)
        ],
    }


def _profile_files(root: Path, profile: dict[str, Any]) -> None:
    profile_id = profile["profile_id"]
    _write_json(
        root / profile["hardware_path"],
        {
            "schema_version": "tai.cpu-hardware-observation.v1",
            "hardware_profile_id": profile["hardware_profile_id"],
            "captured_at": "2026-07-21T09:00:00+00:00",
            "cpu_model": "controlled-x86-64",
            "logical_cpus": 8,
            "ram_mb": 32_768,
            "hostname_sha256": "1" * 64,
            "host_role": "DEDICATED_MODEL_HOST",
            "user": "tai-model",
        },
    )
    _write_json(
        root / profile["environment_path"],
        {
            "schema_version": "tai.cpu-runtime-environment.v1",
            "profile_id": profile_id,
            "model_id": profile["model_id"],
            "revision": profile["revision"],
            "runtime_class": "CPU",
            "quantization": "Q4_K_M",
            "artifact_sha256": profile["artifact_sha256"],
            "toolchain_commit": "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3",
            "loopback_only": True,
            "captured_at": "2026-07-21T09:00:00+00:00",
        },
    )
    metric_fields = {
        key: value
        for key, value in profile.items()
        if key
        in {
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
    }
    _write_json(
        root / profile["benchmark_metrics_path"],
        {
            "schema_version": "tai.llama-bench-metrics.v1",
            "profile_id": profile_id,
            **metric_fields,
        },
    )
    _write_json(
        root / profile["request_metrics_path"],
        {
            "schema_version": "tai.cpu-request-metrics.v1",
            "profile_id": profile_id,
            **metric_fields,
        },
    )
    _write_json(
        root / profile["cost_inputs_path"],
        {
            "schema_version": "tai.cpu-operating-cost-inputs.v1",
            "profile_id": profile_id,
            "currency": "RUB",
            "host_cost_rub_monthly_milli": 2_000_000,
            "power_watts_milli": 150_000,
            "utilization_basis_points": 7_000,
            "token_basis": 1_000_000,
            "measured_at": "2026-07-21T10:00:00+00:00",
        },
    )


def _case_and_observation_files(
    root: Path,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    manifest_entries: list[dict[str, Any]] = []
    payload_entries: list[dict[str, Any]] = []
    for case_index in range(58):
        case_id = f"case-{case_index + 1:02d}"
        prompts: dict[str, str] = {}
        prompt_texts: dict[str, str] = {}
        for locale in LOCALES:
            prompt = f"{case_id}:{locale}:governed prompt"
            prompt_texts[locale] = prompt
            prompts[locale] = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
        cases.append(
            {
                "case_id": case_id,
                "critical": case_index < 23,
                "prompt_sha256_by_locale": prompts,
            }
        )
        for profile_id in PROFILE_IDS:
            for locale in LOCALES:
                response = f"{case_id}:{locale}:{profile_id}:raw response"
                request_id = f"request-{case_index + 1:02d}-{locale}-{profile_id}"
                trace_sha = hashlib.sha256(request_id.encode("utf-8")).hexdigest()
                metadata = {
                    "case_id": case_id,
                    "locale": locale,
                    "profile_id": profile_id,
                    "request_id": request_id,
                    "status": "ANSWERED",
                    "started_at": "2026-07-21T09:10:00+00:00",
                    "completed_at": "2026-07-21T09:10:01+00:00",
                    "trace_sha256": trace_sha,
                }
                manifest_entries.append(
                    {
                        **metadata,
                        "prompt_sha256": prompts[locale],
                        "response_sha256": hashlib.sha256(
                            response.encode("utf-8")
                        ).hexdigest(),
                    }
                )
                payload_entries.append(
                    {
                        **metadata,
                        "prompt": prompt_texts[locale],
                        "response": response,
                    }
                )
    case_manifest = {
        "schema_version": "tai.runtime-corpus-manifest.v1",
        "suite_id": "tai-platform-agro-58-v1",
        "assessment_sha256": ASSESSMENT_SHA,
        "corpus_sha256": CORPUS_SHA,
        "locales": LOCALES,
        "cases": cases,
    }
    raw_manifest = {
        "schema_version": "tai.raw-model-observations.v1",
        "suite_id": "tai-platform-agro-58-v1",
        "profile_ids": PROFILE_IDS,
        "entries": manifest_entries,
    }
    raw_payload = {
        "schema_version": "tai.raw-model-observation-payload.v1",
        "suite_id": "tai-platform-agro-58-v1",
        "entries": payload_entries,
    }
    _write_json(root / "suite/case-manifest.json", case_manifest)
    _write_json(root / "raw-observations/manifest.json", raw_manifest)
    _write_json(root / "raw-observations/payload.json", raw_payload)
    return case_manifest, raw_manifest, raw_payload


def _fallback() -> dict[str, Any]:
    return {
        "primary_profile_id": PROFILE_IDS[0],
        "fallback_profile_id": PROFILE_IDS[1],
        "forced_primary_failure": True,
        "trigger_count": 100,
        "successful_transitions": 100,
        "failed_transitions": 0,
        "p95_takeover_ms": 4_000,
        "continuity_violations": 0,
        "raw_metrics_path": "fallback/metrics.json",
        "protocol_path": "fallback/protocol.txt",
    }


def _soak() -> dict[str, Any]:
    return {
        "profile_id": PROFILE_IDS[0],
        "duration_seconds": 3_600,
        "request_count": 1_000,
        "failed_requests": 0,
        "critical_failures": 0,
        "memory_start_mb": 10_000,
        "memory_end_mb": 10_200,
        "memory_peak_mb": 12_000,
        "memory_drift_mb": 200,
        "p95_latency_ms": 18_000,
        "raw_metrics_path": "soak/metrics.json",
        "environment_path": f"profiles/{PROFILE_IDS[0]}/environment.json",
    }


def _runtime_semantic_files(
    root: Path,
    profiles: list[dict[str, Any]],
    fallback: dict[str, Any],
    soak: dict[str, Any],
) -> None:
    for profile in profiles:
        _profile_files(root, profile)
    _write_json(
        root / fallback["raw_metrics_path"],
        {
            "schema_version": "tai.cpu-fallback-metrics.v1",
            **{
                key: value
                for key, value in fallback.items()
                if key not in {"raw_metrics_path", "protocol_path"}
            },
        },
    )
    protocol = root / fallback["protocol_path"]
    protocol.parent.mkdir(parents=True, exist_ok=True)
    protocol.write_text("force primary unavailable; invoke exact fallback\n", encoding="utf-8")
    _write_json(
        root / soak["raw_metrics_path"],
        {
            "schema_version": "tai.cpu-soak-metrics.v1",
            **{
                key: value
                for key, value in soak.items()
                if key not in {"raw_metrics_path", "environment_path"}
            },
        },
    )


def _copy_tree(source: Path, destination: Path) -> None:
    for path in source.rglob("*"):
        if path.is_file():
            target = destination / path.relative_to(source)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, target)


def _evidence_files(root: Path) -> list[dict[str, Any]]:
    return [
        {
            "path": path.relative_to(root).as_posix(),
            "sha256": _sha(path),
            "size_bytes": path.stat().st_size,
        }
        for path in sorted(root.rglob("*"))
        if path.is_file()
    ]


def _complete_evidence(tmp_path: Path) -> tuple[Path, Path, Path]:
    original = tmp_path / "original"
    restored = tmp_path / "restored"
    original.mkdir(parents=True)
    restored.mkdir(parents=True)

    profiles = [
        _profile(
            profile_id=PROFILE_IDS[0],
            role="PRIMARY",
            model_id="Qwen/Qwen3-8B",
            revision=QWEN_REVISION,
            artifact_sha256=QWEN_ARTIFACT_SHA,
        ),
        _profile(
            profile_id=PROFILE_IDS[1],
            role="FALLBACK",
            model_id="mistralai/Mistral-7B-Instruct-v0.3",
            revision=MISTRAL_REVISION,
            artifact_sha256=MISTRAL_ARTIFACT_SHA,
        ),
    ]
    _case_and_observation_files(original)
    fallback = _fallback()
    soak = _soak()
    _runtime_semantic_files(original, profiles, fallback, soak)
    _copy_tree(original, restored)

    manifest = {
        "schema_version": "tai.cpu-runtime-evidence.v1",
        "lifecycle": "COMPLETE",
        "pending_reason": None,
        "exact_main": EXACT_MAIN,
        "readiness": {
            "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
            "status": "READY_FOR_EXTERNAL_EXECUTION",
            "ready": True,
            "exact_main": EXACT_MAIN,
            "evaluated_at": "2026-07-21T09:30:00+00:00",
            "report_sha256": "2" * 64,
            "simulated": False,
        },
        "bundle_finalization": {
            "schema_version": "tai.model-bundle-finalization-report.v1",
            "status": "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED",
            "report_sha256": "3" * 64,
            "models": [
                {
                    "model_key": "qwen3-8b",
                    "role": "PRIMARY",
                    "model_id": "Qwen/Qwen3-8B",
                    "revision": QWEN_REVISION,
                    "archive_sha256": "4" * 64,
                    "version_id": "qwen-version-1",
                    "immutable_locator": (
                        "s3+version://storage/bucket/qwen.tar"
                        "?versionId=qwen-version-1#sha256=" + "4" * 64
                    ),
                    "verification_status": "VERIFIED",
                    "verification_report_sha256": "5" * 64,
                    "artifact_path": "artifacts/qwen3-8b-q4-k-m.gguf",
                    "artifact_sha256": QWEN_ARTIFACT_SHA,
                },
                {
                    "model_key": "mistral-7b-instruct-v0.3",
                    "role": "FALLBACK",
                    "model_id": "mistralai/Mistral-7B-Instruct-v0.3",
                    "revision": MISTRAL_REVISION,
                    "archive_sha256": "6" * 64,
                    "version_id": "mistral-version-1",
                    "immutable_locator": (
                        "s3+version://storage/bucket/mistral.tar"
                        "?versionId=mistral-version-1#sha256=" + "6" * 64
                    ),
                    "verification_status": "VERIFIED",
                    "verification_report_sha256": "7" * 64,
                    "artifact_path": "artifacts/mistral-7b-instruct-v0.3-q4-k-m.gguf",
                    "artifact_sha256": MISTRAL_ARTIFACT_SHA,
                },
            ],
        },
        "corpus": {
            "suite_id": "tai-platform-agro-58-v1",
            "status": "ACCEPTED",
            "accepted": True,
            "assessment_sha256": ASSESSMENT_SHA,
            "corpus_sha256": CORPUS_SHA,
            "total_cases": 58,
            "critical_cases": 23,
            "locales": LOCALES,
            "unreviewed_cases": 0,
            "case_manifest_path": "suite/case-manifest.json",
            "raw_observation_count": 348,
        },
        "runtime_profiles": profiles,
        "fallback_exercise": fallback,
        "soak": soak,
        "raw_observations": {
            "manifest_path": "raw-observations/manifest.json",
            "payload_path": "raw-observations/payload.json",
            "observation_count": 348,
        },
        "evidence_files": _evidence_files(original),
        "storage": {
            "immutable_locator": (
                "s3+version://storage/bucket/runtime.tar"
                "?versionId=runtime-version-1#sha256=" + "8" * 64
            ),
            "archive_sha256": "8" * 64,
            "archive_size_bytes": 2_000_000,
            "version_id": "runtime-version-1",
            "uploaded_at": "2026-07-21T10:30:00+00:00",
            "retention_expires_at": "2026-10-19T10:30:00+00:00",
            "restored_at": "2026-07-21T11:00:00+00:00",
        },
        "measured_at": "2026-07-21T10:00:00+00:00",
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    manifest_path = tmp_path / "manifest.json"
    _write_json(manifest_path, manifest)
    return manifest_path, original, restored


def _rewrite_evidence(
    manifest_path: Path,
    original: Path,
    restored: Path,
    relative: str,
    value: object,
) -> None:
    _write_json(original / relative, value)
    _write_json(restored / relative, value)
    manifest = load_json(manifest_path)
    for record in manifest["evidence_files"]:
        if record["path"] == relative:
            record["sha256"] = _sha(original / relative)
            record["size_bytes"] = (original / relative).stat().st_size
            break
    else:
        raise AssertionError(f"missing evidence declaration: {relative}")
    _write_json(manifest_path, manifest)


def test_authority_pins_raw_runtime_without_quality_inflation() -> None:
    authority = load_authority(AUTHORITY)
    assert authority["issue"] == 2987
    assert authority["corpus"]["required_raw_observations_per_profile"] == 174
    assert authority["corpus"]["required_raw_observations_total"] == 348
    assert authority["target"]["required_user"] == "tai-model"
    assert authority["target"]["production_fallback_allowed"] is False
    assert authority["maturity_boundary"]["verified_runtime_status"] == (
        "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
    )
    assert authority["maturity_boundary"]["quality_scoring_status"] == (
        "PENDING_QUALITY_SCORING"
    )
    scope = load_json(SCOPE)
    assert "LLM-as-judge or fabricated platform/agro accuracy" in scope[
        "forbidden_capabilities"
    ]


def test_pending_baseline_remains_fail_closed() -> None:
    report = verify_runtime_evidence(
        AUTHORITY,
        PENDING,
        Path("/not-used"),
        Path("/not-used"),
    )
    assert report["status"] == "PENDING_RUNTIME_EXECUTION"
    assert report["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert report["benchmark_status"] == "PENDING_BENCHMARK"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_complete_runtime_evidence_verifies_pending_quality_scoring(
    tmp_path: Path,
) -> None:
    manifest, original, restored = _complete_evidence(tmp_path)
    report = verify_runtime_evidence(AUTHORITY, manifest, original, restored)
    assert report["status"] == (
        "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING"
    )
    assert report["reasons"] == []
    assert report["raw_observation_count"] == 348
    assert report["runtime_profiles"] == {
        PROFILE_IDS[0]: "MEASURED",
        PROFILE_IDS[1]: "MEASURED",
    }
    assert report["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert report["benchmark_status"] == "PENDING_BENCHMARK"
    assert report["model_admission_status"] == "PENDING_ADMISSION"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_missing_multilingual_model_observation_is_rejected(tmp_path: Path) -> None:
    manifest_path, original, restored = _complete_evidence(tmp_path)
    raw_manifest = load_json(original / "raw-observations/manifest.json")
    raw_payload = load_json(original / "raw-observations/payload.json")
    raw_manifest["entries"].pop()
    raw_payload["entries"].pop()
    _rewrite_evidence(
        manifest_path,
        original,
        restored,
        "raw-observations/manifest.json",
        raw_manifest,
    )
    _rewrite_evidence(
        manifest_path,
        original,
        restored,
        "raw-observations/payload.json",
        raw_payload,
    )

    report = verify_runtime_evidence(
        AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert "RAW_OBSERVATION_COVERAGE_MISSING:1" in report["reasons"]
    assert "RAW_OBSERVATION_TOTAL_COUNT_MISMATCH" in report["reasons"]


def test_raw_payload_digest_tamper_is_rejected(tmp_path: Path) -> None:
    manifest_path, original, restored = _complete_evidence(tmp_path)
    payload = load_json(original / "raw-observations/payload.json")
    payload["entries"][0]["response"] = "tampered response"
    _rewrite_evidence(
        manifest_path,
        original,
        restored,
        "raw-observations/payload.json",
        payload,
    )
    report = verify_runtime_evidence(
        AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert any(
        reason.startswith("RAW_PAYLOAD_RESPONSE_DIGEST_MISMATCH:")
        for reason in report["reasons"]
    )


def test_runtime_threshold_and_concurrency_matrix_are_fail_closed(
    tmp_path: Path,
) -> None:
    manifest_path, original, restored = _complete_evidence(tmp_path)
    manifest = load_json(manifest_path)
    manifest["runtime_profiles"][0]["generation_tokens_per_second_milli"] = 1
    manifest["runtime_profiles"][0]["concurrency"].pop()
    _write_json(manifest_path, manifest)

    report = verify_runtime_evidence(
        AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert f"GENERATION_THROUGHPUT_BELOW_MINIMUM:{PROFILE_IDS[0]}" in report[
        "reasons"
    ]
    assert "CONCURRENCY_MATRIX_MISMATCH" in report["reasons"]


def test_fallback_and_soak_failures_are_rejected(tmp_path: Path) -> None:
    manifest_path, original, restored = _complete_evidence(tmp_path)
    manifest = load_json(manifest_path)
    manifest["fallback_exercise"]["failed_transitions"] = 1
    manifest["fallback_exercise"]["successful_transitions"] = 99
    manifest["soak"]["critical_failures"] = 1
    _write_json(manifest_path, manifest)

    report = verify_runtime_evidence(
        AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert "FALLBACK_FAILED_TRANSITIONS_PRESENT" in report["reasons"]
    assert "SOAK_CRITICAL_FAILURES_PRESENT" in report["reasons"]


def test_restore_drift_symlink_and_same_root_are_rejected(tmp_path: Path) -> None:
    manifest_path, original, restored = _complete_evidence(tmp_path)
    restored_payload = restored / "raw-observations/payload.json"
    restored_payload.write_text("{}\n", encoding="utf-8")
    report = verify_runtime_evidence(
        AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert "RESTORE_DRIFT:raw-observations/payload.json" in report["reasons"]

    manifest_path, original, restored = _complete_evidence(tmp_path / "symlink")
    target = restored / "fallback/protocol.txt"
    target.unlink()
    target.symlink_to(original / "fallback/protocol.txt")
    with pytest.raises(RuntimeEvidenceError, match="contains a symlink"):
        verify_runtime_evidence(AUTHORITY, manifest_path, original, restored)

    with pytest.raises(RuntimeEvidenceError, match="must be independent"):
        verify_runtime_evidence(AUTHORITY, manifest_path, original, original)


def test_duplicate_unknown_and_maturity_inflation_are_rejected(
    tmp_path: Path,
) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text(
        '{"schema_version":"x","schema_version":"y"}',
        encoding="utf-8",
    )
    with pytest.raises(RuntimeEvidenceError, match="duplicate JSON key"):
        load_json(duplicate)

    manifest_path, original, restored = _complete_evidence(tmp_path / "unknown")
    manifest = load_json(manifest_path)
    manifest["unknown"] = True
    _write_json(manifest_path, manifest)
    with pytest.raises(RuntimeEvidenceError, match="unknown=\\['unknown'\\]"):
        verify_runtime_evidence(AUTHORITY, manifest_path, original, restored)

    manifest_path, original, restored = _complete_evidence(tmp_path / "maturity")
    manifest = load_json(manifest_path)
    manifest["benchmark_status"] = "VERIFIED"
    _write_json(manifest_path, manifest)
    with pytest.raises(RuntimeEvidenceError, match="maturity boundary"):
        verify_runtime_evidence(AUTHORITY, manifest_path, original, restored)


def test_stale_or_simulated_readiness_and_nonimmutable_bundle_are_rejected(
    tmp_path: Path,
) -> None:
    manifest_path, original, restored = _complete_evidence(tmp_path)
    manifest = load_json(manifest_path)
    manifest["readiness"]["evaluated_at"] = "2026-07-19T00:00:00+00:00"
    manifest["readiness"]["simulated"] = True
    manifest["bundle_finalization"]["models"][0]["immutable_locator"] = (
        "https://mutable.example/qwen.tar"
    )
    _write_json(manifest_path, manifest)

    report = verify_runtime_evidence(
        AUTHORITY, manifest_path, original, restored
    )
    assert report["status"] == "REJECTED"
    assert "READINESS_STALE" in report["reasons"]
    assert "READINESS_SIMULATED" in report["reasons"]
    assert "BUNDLE_LOCATOR_NOT_IMMUTABLE:qwen3-8b" in report["reasons"]
