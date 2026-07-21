from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from tai.benchmark_prerequisite_matrix import evaluate_matrix, write_json
from tai.cpu_benchmark_execution import (
    ExecutionContractError,
    canonical_sha256,
    evaluate_readiness,
    load_execution_authority,
)

ROOT = Path(__file__).parents[1]
ARTIFACTS = ROOT / "model-artifacts"
AUTHORITY = ARTIFACTS / "cpu-benchmark-execution-authority.v1.json"
PREREQUISITE_AUTHORITY = ARTIFACTS / "benchmark-prerequisite-authority.v1.json"
PREREQUISITE_BASELINE = ARTIFACTS / "benchmark-prerequisite-baseline.v1.json"
GOLD_BASELINE = (
    ROOT.parents[1]
    / "docs"
    / "platform-v7"
    / "autopilot"
    / "tai-ap-14c"
    / "baseline-assessment.v1.json"
)
EXACT_MAIN = "4cc19710e070441081a031fd30efae3b0ba91ab0"


def _json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _write(path: Path, value: object) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _blocked_prerequisite_report(tmp_path: Path) -> Path:
    report = evaluate_matrix(
        PREREQUISITE_AUTHORITY,
        PREREQUISITE_BASELINE,
        evaluated_at=datetime(2026, 7, 21, 14, 20, tzinfo=UTC),
    )
    path = tmp_path / "prerequisite-report.json"
    write_json(path, report)
    return path


def _accepted_prerequisite_report(tmp_path: Path) -> Path:
    source = _blocked_prerequisite_report(tmp_path)
    report = _json(source)
    required = {
        "benchmark-authority-v2",
        "immutable-model-bundles",
        "external-evidence-storage",
        "expert-reviewed-58-case-suite",
        "dedicated-cpu-host",
    }
    for prerequisite_id in required:
        item = report["prerequisites"][prerequisite_id]
        item["satisfied"] = True
        item["observed_status"] = item["required_status"]
        item["simulated"] = False
    report["slices"]["cpu-fallback-execution"] = {
        "status": "READY_FOR_CPU_FALLBACK_BENCHMARK",
        "ready": True,
        "blockers": [],
    }
    report["reasons"] = [
        item
        for item in report["reasons"]
        if not item.startswith("cpu-fallback-execution:")
    ]
    report["report_sha256"] = canonical_sha256(
        {key: value for key, value in report.items() if key != "report_sha256"}
    )
    path = tmp_path / "accepted-prerequisite-report.json"
    _write(path, report)
    return path


def _accepted_gold_assessment(tmp_path: Path) -> Path:
    assessment = _json(GOLD_BASELINE)
    assessment["accepted"] = True
    assessment["status"] = "ACCEPTED"
    assessment["counts"]["reviewed_cases"] = 58
    assessment["counts"]["unreviewed_cases"] = 0
    assessment["blocking_reasons"] = []
    assessment["missing_review_case_ids"] = []
    assessment["component_sha256"]["reviews_sha256"] = "f" * 64
    assessment["assessment_sha256"] = canonical_sha256(
        {key: value for key, value in assessment.items() if key != "assessment_sha256"}
    )
    path = tmp_path / "accepted-gold-assessment.json"
    _write(path, assessment)
    return path


def test_authority_pins_exact_cpu_execution_boundary() -> None:
    authority = load_execution_authority(AUTHORITY)

    assert authority["issue"] == 2977
    assert authority["command"] == "/tai benchmark cpu-fallback exact-main"
    assert authority["toolchain"]["commit"] == (
        "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3"
    )
    assert authority["benchmark_authority"]["required_profiles"] == [
        "qwen3-8b-cpu-q4-k-m",
        "mistral-7b-fallback-cpu-q4-k-m",
    ]
    assert authority["measurements"]["concurrency_levels"] == [1, 2, 4]
    assert authority["fallback"]["minimum_trigger_count"] == 100
    assert authority["soak"]["minimum_duration_seconds"] == 3600
    assert authority["target"]["production_fallback_allowed"] is False
    assert authority["maturity_boundary"]["production_operational_status"] == (
        "NOT_ATTESTED"
    )
    assert authority["authority_sha256"]


def test_current_external_state_remains_blocked(tmp_path: Path) -> None:
    report = evaluate_readiness(
        AUTHORITY,
        _blocked_prerequisite_report(tmp_path),
        GOLD_BASELINE,
        exact_main=EXACT_MAIN,
        evaluated_at="2026-07-21T14:21:00+00:00",
    )

    assert report["status"] == "BLOCKED"
    assert report["ready"] is False
    reasons = set(report["reasons"])
    assert "CPU_FALLBACK_SLICE_NOT_READY" in reasons
    assert "UNSATISFIED_PREREQUISITE:immutable-model-bundles" in reasons
    assert "UNSATISFIED_PREREQUISITE:external-evidence-storage" in reasons
    assert "UNSATISFIED_PREREQUISITE:expert-reviewed-58-case-suite" in reasons
    assert "GOLD_SET_NOT_ACCEPTED" in reasons
    assert "GOLD_SET_UNREVIEWED_CASES_PRESENT" in reasons
    assert report["benchmark_status"] == "PENDING_BENCHMARK"
    assert report["model_admission_status"] == "PENDING_ADMISSION"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_all_real_prerequisites_open_only_external_execution_gate(
    tmp_path: Path,
) -> None:
    report = evaluate_readiness(
        AUTHORITY,
        _accepted_prerequisite_report(tmp_path),
        _accepted_gold_assessment(tmp_path),
        exact_main=EXACT_MAIN,
        evaluated_at="2026-07-21T14:21:00+00:00",
    )

    assert report["status"] == "READY_FOR_EXTERNAL_EXECUTION"
    assert report["ready"] is True
    assert report["reasons"] == []
    assert report["required_profiles"] == [
        "qwen3-8b-cpu-q4-k-m",
        "mistral-7b-fallback-cpu-q4-k-m",
    ]
    assert report["benchmark_status"] == "PENDING_BENCHMARK"
    assert report["model_admission_status"] == "PENDING_ADMISSION"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_stale_future_and_simulated_evidence_fail_closed(tmp_path: Path) -> None:
    prerequisite_path = _accepted_prerequisite_report(tmp_path)
    assessment_path = _accepted_gold_assessment(tmp_path)

    stale = evaluate_readiness(
        AUTHORITY,
        prerequisite_path,
        assessment_path,
        exact_main=EXACT_MAIN,
        evaluated_at="2026-07-23T14:21:00+00:00",
    )
    assert "PREREQUISITE_REPORT_STALE" in stale["reasons"]

    prerequisite = _json(prerequisite_path)
    future = datetime(2026, 7, 22, 14, 21, tzinfo=UTC)
    prerequisite["evaluated_at"] = future.isoformat()
    prerequisite["observed_at"] = future.isoformat()
    prerequisite["prerequisites"]["dedicated-cpu-host"]["simulated"] = True
    prerequisite["report_sha256"] = canonical_sha256(
        {key: value for key, value in prerequisite.items() if key != "report_sha256"}
    )
    _write(prerequisite_path, prerequisite)

    rejected = evaluate_readiness(
        AUTHORITY,
        prerequisite_path,
        assessment_path,
        exact_main=EXACT_MAIN,
        evaluated_at="2026-07-21T14:21:00+00:00",
    )
    reasons = set(rejected["reasons"])
    assert "PREREQUISITE_REPORT_FROM_FUTURE" in reasons
    assert "PREREQUISITE_OBSERVATION_FROM_FUTURE" in reasons
    assert "SIMULATED_PREREQUISITE:dedicated-cpu-host" in reasons


def test_maturity_inflation_and_authority_weakening_are_rejected(
    tmp_path: Path,
) -> None:
    authority = _json(AUTHORITY)
    authority["target"]["production_fallback_allowed"] = True
    weakened = tmp_path / "weakened-authority.json"
    _write(weakened, authority)
    with pytest.raises(ExecutionContractError, match="target boundary mismatch"):
        load_execution_authority(weakened)

    prerequisite = _json(_accepted_prerequisite_report(tmp_path))
    prerequisite["benchmark_status"] = "VERIFIED"
    prerequisite["report_sha256"] = canonical_sha256(
        {key: value for key, value in prerequisite.items() if key != "report_sha256"}
    )
    inflated = tmp_path / "inflated-prerequisite.json"
    _write(inflated, prerequisite)
    with pytest.raises(ExecutionContractError, match="maturity boundary"):
        evaluate_readiness(
            AUTHORITY,
            inflated,
            _accepted_gold_assessment(tmp_path),
            exact_main=EXACT_MAIN,
            evaluated_at="2026-07-21T14:21:00+00:00",
        )


def test_duplicate_and_unknown_authority_keys_are_rejected(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text(
        '{"schema_version":"x","schema_version":"y"}', encoding="utf-8"
    )
    with pytest.raises(ExecutionContractError, match="duplicate JSON key"):
        load_execution_authority(duplicate)

    authority = _json(AUTHORITY)
    authority["unknown"] = True
    unknown = tmp_path / "unknown.json"
    _write(unknown, authority)
    with pytest.raises(ExecutionContractError, match="unknown=\['unknown'\]"):
        load_execution_authority(unknown)
