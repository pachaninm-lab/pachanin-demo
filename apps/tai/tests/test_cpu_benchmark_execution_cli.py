from __future__ import annotations

import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest

from tai import cpu_benchmark_execution_cli as execution_cli
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


def _blocked_report(tmp_path: Path) -> Path:
    report = evaluate_matrix(
        PREREQUISITE_AUTHORITY,
        PREREQUISITE_BASELINE,
        evaluated_at=datetime(2026, 7, 21, 14, 20, tzinfo=UTC),
    )
    path = tmp_path / "prerequisite-report.json"
    write_json(path, report)
    return path


def _accepted_report(tmp_path: Path) -> Path:
    path = _blocked_report(tmp_path)
    report = _json(path)
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
    _write(path, report)
    return path


def _accepted_gold(tmp_path: Path) -> Path:
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
    path = tmp_path / "accepted-gold.json"
    _write(path, assessment)
    return path


def test_cli_validates_authority_and_writes_output(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    output = tmp_path / "authority-validation.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cpu-benchmark-execution",
            "validate-authority",
            str(AUTHORITY),
            "--output",
            str(output),
        ],
    )

    assert execution_cli.main() == 0
    emitted = json.loads(capsys.readouterr().out)
    assert emitted["status"] == "VALID"
    assert _json(output)["production_operational_status"] == "NOT_ATTESTED"


def test_cli_returns_two_for_current_blocked_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cpu-benchmark-execution",
            "evaluate-readiness",
            str(AUTHORITY),
            str(_blocked_report(tmp_path)),
            str(GOLD_BASELINE),
            "--exact-main",
            EXACT_MAIN,
            "--evaluated-at",
            "2026-07-21T14:21:00+00:00",
        ],
    )

    assert execution_cli.main() == 2
    emitted = json.loads(capsys.readouterr().out)
    assert emitted["status"] == "BLOCKED"
    assert emitted["benchmark_status"] == "PENDING_BENCHMARK"


def test_cli_opens_only_external_execution_gate_when_all_inputs_are_real(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cpu-benchmark-execution",
            "evaluate-readiness",
            str(AUTHORITY),
            str(_accepted_report(tmp_path)),
            str(_accepted_gold(tmp_path)),
            "--exact-main",
            EXACT_MAIN,
            "--evaluated-at",
            "2026-07-21T14:21:00+00:00",
        ],
    )

    assert execution_cli.main() == 0
    emitted = json.loads(capsys.readouterr().out)
    assert emitted["status"] == "READY_FOR_EXTERNAL_EXECUTION"
    assert emitted["model_admission_status"] == "PENDING_ADMISSION"


def test_cli_contract_error_preserves_maturity_boundary(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cpu-benchmark-execution",
            "evaluate-readiness",
            str(AUTHORITY),
            str(_accepted_report(tmp_path)),
            str(_accepted_gold(tmp_path)),
            "--exact-main",
            "main",
            "--evaluated-at",
            "2026-07-21T14:21:00+00:00",
        ],
    )

    assert execution_cli.main() == 2
    emitted = json.loads(capsys.readouterr().out)
    assert emitted["status"] == "REJECTED"
    assert emitted["reason"].startswith("CONTRACT_INVALID:")
    assert emitted["production_operational_status"] == "NOT_ATTESTED"


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        ("prerequisite-not-object", "must be an object"),
        ("models-not-array", "must be an array"),
        ("blank-toolchain-name", "non-blank string"),
        ("bad-toolchain-commit", "exact lowercase Git commit"),
        ("bad-toolchain-profile", "portable bounded identity"),
        ("duplicate-binaries", "unique values"),
        ("unsorted-concurrency", "sorted unique"),
        ("non-boolean-review", "must be a boolean"),
        ("negative-soak", "integer >= 0"),
        ("empty-suffixes", "must be non-empty"),
    ],
)
def test_authority_scalar_and_collection_guards_fail_closed(
    tmp_path: Path,
    mutation: str,
    match: str,
) -> None:
    authority = _json(AUTHORITY)
    if mutation == "prerequisite-not-object":
        authority["prerequisite_gate"] = []
    elif mutation == "models-not-array":
        authority["models"] = {}
    elif mutation == "blank-toolchain-name":
        authority["toolchain"]["name"] = ""
    elif mutation == "bad-toolchain-commit":
        authority["toolchain"]["commit"] = "main"
    elif mutation == "bad-toolchain-profile":
        authority["toolchain"]["profile"] = "bad profile"
    elif mutation == "duplicate-binaries":
        authority["toolchain"]["required_binaries"] = ["llama-cli", "llama-cli"]
    elif mutation == "unsorted-concurrency":
        authority["models"][0]["required_concurrency_levels"] = [2, 1]
    elif mutation == "non-boolean-review":
        authority["evaluation"]["required_accepted"] = 1
    elif mutation == "negative-soak":
        authority["soak"]["maximum_failed_requests"] = -1
    elif mutation == "empty-suffixes":
        authority["evidence"]["forbidden_suffixes"] = []
    path = tmp_path / f"{mutation}.json"
    _write(path, authority)

    with pytest.raises(ExecutionContractError, match=match):
        load_execution_authority(path)


def test_json_root_and_integer_boolean_are_rejected(tmp_path: Path) -> None:
    root = tmp_path / "array-root.json"
    root.write_text("[]", encoding="utf-8")
    with pytest.raises(ExecutionContractError, match="root must be an object"):
        load_execution_authority(root)

    authority = _json(AUTHORITY)
    authority["program_issue"] = True
    boolean_integer = tmp_path / "boolean-integer.json"
    _write(boolean_integer, authority)
    with pytest.raises(ExecutionContractError, match="integer >= 1"):
        load_execution_authority(boolean_integer)


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        ("schema", "unsupported prerequisite report"),
        ("sha", "lowercase SHA-256"),
        ("invalid-time", "ISO-8601"),
        ("naive-time", "timezone-aware"),
        ("unknown", "unknown=\['unknown'\]"),
        ("digest", "digest mismatch"),
    ],
)
def test_prerequisite_report_contract_rejects_tampering(
    tmp_path: Path,
    mutation: str,
    match: str,
) -> None:
    report_path = _accepted_report(tmp_path)
    report = _json(report_path)
    if mutation == "schema":
        report["schema_version"] = "wrong"
    elif mutation == "sha":
        report["authority_sha256"] = "bad"
    elif mutation == "invalid-time":
        report["evaluated_at"] = "not-a-time"
    elif mutation == "naive-time":
        report["evaluated_at"] = "2026-07-21T14:20:00"
    elif mutation == "unknown":
        report["unknown"] = True
    elif mutation == "digest":
        report["status"] = "READY"
    if mutation != "digest":
        report["report_sha256"] = canonical_sha256(
            {key: value for key, value in report.items() if key != "report_sha256"}
        )
    _write(report_path, report)

    with pytest.raises(ExecutionContractError, match=match):
        evaluate_readiness(
            AUTHORITY,
            report_path,
            _accepted_gold(tmp_path),
            exact_main=EXACT_MAIN,
            evaluated_at="2026-07-21T14:21:00+00:00",
        )


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        ("accepted-type", "must be a boolean"),
        ("component-sha", "lowercase SHA-256"),
        ("counts-object", "must be an object"),
        ("target-number", "must be numeric"),
        ("blockers-array", "must be an array"),
    ],
)
def test_gold_assessment_contract_rejects_invalid_evidence(
    tmp_path: Path,
    mutation: str,
    match: str,
) -> None:
    assessment_path = _accepted_gold(tmp_path)
    assessment = _json(assessment_path)
    if mutation == "accepted-type":
        assessment["accepted"] = "yes"
    elif mutation == "component-sha":
        assessment["component_sha256"]["platform_sha256"] = "bad"
    elif mutation == "counts-object":
        assessment["counts"] = []
    elif mutation == "target-number":
        assessment["quality_targets"]["platform_accuracy_minimum"] = "0.95"
    elif mutation == "blockers-array":
        assessment["blocking_reasons"] = {}
    _write(assessment_path, assessment)

    with pytest.raises(ExecutionContractError, match=match):
        evaluate_readiness(
            AUTHORITY,
            _accepted_report(tmp_path),
            assessment_path,
            exact_main=EXACT_MAIN,
            evaluated_at="2026-07-21T14:21:00+00:00",
        )
