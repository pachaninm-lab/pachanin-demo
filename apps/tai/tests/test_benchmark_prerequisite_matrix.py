from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest

from tai.benchmark_prerequisite_matrix import MatrixError, evaluate_matrix, load_authority

MODEL_ARTIFACTS = Path(__file__).resolve().parents[1] / "model-artifacts"
AUTHORITY = MODEL_ARTIFACTS / "benchmark-prerequisite-authority.v1.json"
BASELINE = MODEL_ARTIFACTS / "benchmark-prerequisite-baseline.v1.json"
EVALUATED_AT = datetime(2026, 7, 21, 14, 20, tzinfo=UTC)


def _write_json(path: Path, value: object) -> Path:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return path


def _baseline() -> dict[str, Any]:
    value = json.loads(BASELINE.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _ready_observation(tmp_path: Path) -> Path:
    authority = load_authority(AUTHORITY)
    value = _baseline()
    plans = {item["id"]: item for item in authority["prerequisites"]}
    for observation in cast(list[dict[str, Any]], value["observations"]):
        plan = plans[observation["id"]]
        observation["status"] = plan["required_status"]
        observation["simulated"] = False
        if plan["kind"] == "CODE_AUTHORITY" and observation["exact_commit"] is None:
            observation["exact_commit"] = "1" * 40
    return _write_json(tmp_path / "ready.json", value)


def test_committed_baseline_is_honestly_blocked() -> None:
    report = evaluate_matrix(AUTHORITY, BASELINE, evaluated_at=EVALUATED_AT)
    assert report["status"] == "BLOCKED"
    assert report["stale"] is False
    slices = cast(dict[str, dict[str, Any]], report["slices"])
    assert slices["cpu-fallback-execution"] == {
        "status": "BLOCKED",
        "ready": False,
        "blockers": [
            "immutable-model-bundles",
            "external-evidence-storage",
            "expert-reviewed-58-case-suite",
        ],
    }
    assert slices["gpu-execution"]["blockers"] == [
        "immutable-model-bundles",
        "external-evidence-storage",
        "expert-reviewed-58-case-suite",
        "dedicated-gpu-host",
    ]
    assert slices["joint-model-admission"]["blockers"] == [
        "immutable-model-bundles",
        "external-evidence-storage",
        "expert-reviewed-58-case-suite",
        "cpu-fallback-benchmark",
        "gpu-benchmark",
    ]
    assert report["benchmark_status"] == "PENDING_BENCHMARK"
    assert report["model_admission_status"] == "PENDING_ADMISSION"
    assert report["production_operational_status"] == "NOT_ATTESTED"
    assert isinstance(report["report_sha256"], str)
    assert len(cast(str, report["report_sha256"])) == 64


def test_all_real_prerequisites_enable_joint_admission_readiness(tmp_path: Path) -> None:
    report = evaluate_matrix(
        AUTHORITY, _ready_observation(tmp_path), evaluated_at=EVALUATED_AT
    )
    assert report["status"] == "READY_FOR_JOINT_MODEL_ADMISSION"
    assert report["reasons"] == []
    slices = cast(dict[str, dict[str, Any]], report["slices"])
    assert all(item["ready"] is True for item in slices.values())
    assert slices["cpu-fallback-execution"]["status"] == (
        "READY_FOR_CPU_FALLBACK_BENCHMARK"
    )
    assert slices["gpu-execution"]["status"] == "READY_FOR_GPU_BENCHMARK"


def test_simulated_evidence_never_satisfies_prerequisite(tmp_path: Path) -> None:
    path = _ready_observation(tmp_path)
    value = json.loads(path.read_text(encoding="utf-8"))
    observations = cast(list[dict[str, Any]], value["observations"])
    next(item for item in observations if item["id"] == "immutable-model-bundles")[
        "simulated"
    ] = True
    _write_json(path, value)
    report = evaluate_matrix(AUTHORITY, path, evaluated_at=EVALUATED_AT)
    prerequisite = cast(dict[str, dict[str, Any]], report["prerequisites"])[
        "immutable-model-bundles"
    ]
    assert prerequisite["satisfied"] is False
    assert report["status"] == "BLOCKED"


def test_stale_observation_blocks_every_slice(tmp_path: Path) -> None:
    path = _ready_observation(tmp_path)
    value = json.loads(path.read_text(encoding="utf-8"))
    value["observed_at"] = (EVALUATED_AT - timedelta(days=31)).isoformat()
    _write_json(path, value)
    report = evaluate_matrix(AUTHORITY, path, evaluated_at=EVALUATED_AT)
    assert report["stale"] is True
    slices = cast(dict[str, dict[str, Any]], report["slices"])
    assert all(item["ready"] is False for item in slices.values())


def test_future_observation_is_rejected(tmp_path: Path) -> None:
    value = _baseline()
    value["observed_at"] = (EVALUATED_AT + timedelta(minutes=6)).isoformat()
    path = _write_json(tmp_path / "future.json", value)
    with pytest.raises(MatrixError, match="in the future"):
        evaluate_matrix(AUTHORITY, path, evaluated_at=EVALUATED_AT)


def test_missing_code_commit_is_rejected(tmp_path: Path) -> None:
    value = _baseline()
    observations = cast(list[dict[str, Any]], value["observations"])
    next(item for item in observations if item["id"] == "benchmark-authority-v2")[
        "exact_commit"
    ] = None
    path = _write_json(tmp_path / "missing-commit.json", value)
    with pytest.raises(MatrixError, match="exact commit missing"):
        evaluate_matrix(AUTHORITY, path, evaluated_at=EVALUATED_AT)


def test_observation_must_cover_exact_prerequisite_set(tmp_path: Path) -> None:
    value = _baseline()
    cast(list[dict[str, Any]], value["observations"]).pop()
    path = _write_json(tmp_path / "missing.json", value)
    with pytest.raises(MatrixError, match="observation coverage invalid"):
        evaluate_matrix(AUTHORITY, path, evaluated_at=EVALUATED_AT)


def test_duplicate_json_keys_are_rejected(tmp_path: Path) -> None:
    path = tmp_path / "duplicate.json"
    path.write_text(
        '{"schema_version":"x","schema_version":"y"}\n', encoding="utf-8"
    )
    with pytest.raises(MatrixError, match="duplicate JSON key"):
        evaluate_matrix(AUTHORITY, path, evaluated_at=EVALUATED_AT)


def test_authority_rejects_unknown_prerequisite_kind(tmp_path: Path) -> None:
    value = json.loads(AUTHORITY.read_text(encoding="utf-8"))
    cast(list[dict[str, Any]], value["prerequisites"])[0]["kind"] = "SIMULATION"
    path = _write_json(tmp_path / "weak-authority.json", value)
    with pytest.raises(MatrixError, match="kind is unsupported"):
        load_authority(path)
