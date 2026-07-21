from __future__ import annotations

import copy
from pathlib import Path

import pytest
from cpu_benchmark_finalization_fixtures import (
    EVALUATED_AT,
    fixture,
    rewrite_finalization,
)

from tai.cpu_benchmark_finalization import verify_finalization
from tai.cpu_benchmark_finalization_contract import (
    EXPECTED_MATURITY,
    QWEN_GPU_PROFILE,
    VERIFIED_FINALIZATION_STATUS,
    FinalizationError,
    canonical_sha256,
    expected_authority,
    load_authority,
    load_json,
    load_manifest,
    write_json,
)


def _verify(value: dict[str, object]) -> dict[str, object]:
    return verify_finalization(
        value["finalization_authority_path"],
        value["joint_authority_path"],
        value["bundle_authority_path"],
        value["runtime_authority_path"],
        value["runtime_path"],
        value["runtime_manifest_path"],
        value["original_root"],
        value["restored_root"],
        value["authority_path"],
        value["quality_report_path"],
        value["scoring_path"],
        value["assessment_path"],
        value["cases_path"],
        value["benchmark_path"],
        value["benchmark_original"],
        value["benchmark_restored"],
        value["finalization_path"],
        evaluated_at=EVALUATED_AT,
    )


def test_authority_pins_gpu_blocker_without_admission(tmp_path: Path) -> None:
    path = tmp_path / "authority.json"
    write_json(path, expected_authority())
    authority = load_authority(path)
    assert authority["issue"] == 2998
    assert authority["required_gpu_profile"]["profile_id"] == QWEN_GPU_PROFILE
    assert authority["finalization"]["materialize_qwen_complete_candidate"] is False
    assert authority["maturity_boundary"]["joint_benchmark"] == "PENDING_BENCHMARK"
    assert authority["maturity_boundary"]["model_admission"] == "PENDING_ADMISSION"
    assert authority["maturity_boundary"]["production_operational_status"] == (
        "NOT_ATTESTED"
    )


def test_pending_baseline_is_fail_closed(tmp_path: Path) -> None:
    authority_path = tmp_path / "authority.json"
    pending_path = tmp_path / "pending.json"
    write_json(authority_path, expected_authority())
    pending: dict[str, object] = {
        "schema_version": "tai.cpu-benchmark-finalization.v1",
        "lifecycle": "PENDING_EXTERNAL_EVIDENCE",
        "pending_reason": "Real evidence absent.",
        "exact_main": None,
        "authority_sha256": None,
        "runtime_report_sha256": None,
        "quality_report_sha256": None,
        "qwen_primary": None,
        "mistral_fallback": None,
        "storage": None,
        "finalized_at": None,
        **EXPECTED_MATURITY,
    }
    pending["manifest_sha256"] = canonical_sha256(pending)
    write_json(pending_path, pending)
    missing = tmp_path / "missing"
    report = verify_finalization(
        authority_path,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        pending_path,
        evaluated_at=EVALUATED_AT,
    )
    assert report["accepted"] is False
    assert report["status"] == "PENDING_EXTERNAL_EVIDENCE"
    assert report["joint_benchmark_status"] == "PENDING_BENCHMARK"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_complete_cpu_and_fallback_finalization_passes(tmp_path: Path) -> None:
    value = fixture(tmp_path)
    report = _verify(value)
    assert report["accepted"] is True
    assert report["status"] == VERIFIED_FINALIZATION_STATUS
    assert report["reasons"] == ["QWEN_GPU_SHARED_Q8_0_BENCHMARK_REQUIRED"]
    assert report["qwen_primary_benchmark_status"] == "PENDING_BENCHMARK"
    assert report["mistral_fallback_benchmark_status"] == "VERIFIED"
    assert report["joint_benchmark_status"] == "PENDING_BENCHMARK"
    assert report["model_admission_status"] == "PENDING_ADMISSION"
    assert report["production_operational_status"] == "NOT_ATTESTED"


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        ("qwen-complete", "Qwen primary finalization boundary mismatch"),
        ("gpu-relabel", "Qwen primary finalization boundary mismatch"),
        ("runtime-digest", "runtime report digest mismatch"),
        ("quality-digest", "quality report digest mismatch"),
        ("mistral-report", "Mistral fallback finalization binding mismatch"),
        ("same-root", "restore roots are not independent"),
        ("maturity", "maturity boundary"),
    ],
)
def test_finalization_manifest_tampering_is_rejected(
    tmp_path: Path, mutation: str, match: str
) -> None:
    value = fixture(tmp_path)
    manifest = copy.deepcopy(value["finalization"])
    if mutation == "qwen-complete":
        manifest["qwen_primary"]["status"] = "COMPLETE"
    elif mutation == "gpu-relabel":
        manifest["qwen_primary"]["required_gpu_profile"] = (
            "qwen3-8b-cpu-q4-k-m"
        )
    elif mutation == "runtime-digest":
        manifest["runtime_report_sha256"] = "f" * 64
    elif mutation == "quality-digest":
        manifest["quality_report_sha256"] = "f" * 64
    elif mutation == "mistral-report":
        manifest["mistral_fallback"]["benchmark_report_sha256"] = "f" * 64
    elif mutation == "same-root":
        manifest["storage"]["restored_root_id"] = manifest["storage"][
            "original_root_id"
        ]
    else:
        manifest["joint_benchmark_status"] = "COMPLETE"
    value["finalization"] = rewrite_finalization(
        manifest, value["finalization_path"]
    )
    with pytest.raises(FinalizationError, match=match):
        _verify(value)


def test_forged_runtime_and_quality_summaries_are_rejected(tmp_path: Path) -> None:
    runtime_value = fixture(tmp_path / "runtime")
    runtime_report = load_json(runtime_value["runtime_path"])
    runtime_report["raw_observation_count"] = 347
    runtime_report.pop("report_sha256")
    runtime_report["report_sha256"] = canonical_sha256(runtime_report)
    write_json(runtime_value["runtime_path"], runtime_report)
    with pytest.raises(FinalizationError, match="not reproduced"):
        _verify(runtime_value)

    quality_value = fixture(tmp_path / "quality")
    quality_report = load_json(quality_value["quality_report_path"])
    quality_report["aggregate"]["citation_validity_basis_points"] = 9999
    quality_report.pop("report_sha256")
    quality_report["report_sha256"] = canonical_sha256(quality_report)
    write_json(quality_value["quality_report_path"], quality_report)
    with pytest.raises(FinalizationError, match="not reproduced"):
        _verify(quality_value)


def test_candidate_quality_runtime_and_bundle_projection_is_fail_closed(
    tmp_path: Path,
) -> None:
    quality_value = fixture(tmp_path / "candidate-quality")
    candidate = load_json(quality_value["benchmark_path"])
    candidate["quality"]["platform_accuracy_basis_points"] = 9500
    write_json(quality_value["benchmark_path"], candidate)
    with pytest.raises(FinalizationError, match="candidate is not verified"):
        _verify(quality_value)

    runtime_value = fixture(tmp_path / "candidate-runtime")
    candidate = load_json(runtime_value["benchmark_path"])
    candidate["runtime_profiles"][0]["peak_ram_mb"] = 11999
    write_json(runtime_value["benchmark_path"], candidate)
    with pytest.raises(FinalizationError, match="candidate is not verified"):
        _verify(runtime_value)

    bundle_value = fixture(tmp_path / "candidate-bundle")
    candidate = load_json(bundle_value["benchmark_path"])
    candidate["bundle"]["artifacts"][0]["sha256"] = "f" * 64
    write_json(bundle_value["benchmark_path"], candidate)
    with pytest.raises(FinalizationError, match="candidate is not verified"):
        _verify(bundle_value)


def test_duplicate_keys_and_authority_weakening_are_rejected(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text('{"schema_version":"x","schema_version":"y"}')
    with pytest.raises(FinalizationError, match="duplicate JSON key"):
        load_json(duplicate)
    authority = expected_authority()
    authority["finalization"]["materialize_qwen_complete_candidate"] = True
    path = tmp_path / "weakened-authority.json"
    write_json(path, authority)
    with pytest.raises(FinalizationError, match="differs from policy"):
        load_authority(path)


def test_manifest_contract_rejects_unknown_lifecycle_and_pending_contamination(
    tmp_path: Path,
) -> None:
    pending: dict[str, object] = {
        "schema_version": "tai.cpu-benchmark-finalization.v1",
        "lifecycle": "PENDING_EXTERNAL_EVIDENCE",
        "pending_reason": "absent",
        "exact_main": "a" * 40,
        "authority_sha256": None,
        "runtime_report_sha256": None,
        "quality_report_sha256": None,
        "qwen_primary": None,
        "mistral_fallback": None,
        "storage": None,
        "finalized_at": None,
        **EXPECTED_MATURITY,
    }
    pending["manifest_sha256"] = canonical_sha256(pending)
    path = tmp_path / "contaminated.json"
    write_json(path, pending)
    with pytest.raises(FinalizationError, match="must remain empty"):
        load_manifest(path)
    pending["exact_main"] = None
    pending["lifecycle"] = "UNKNOWN"
    pending.pop("manifest_sha256")
    pending["manifest_sha256"] = canonical_sha256(pending)
    write_json(path, pending)
    with pytest.raises(FinalizationError, match="unsupported.*lifecycle"):
        load_manifest(path)
