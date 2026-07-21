from __future__ import annotations

import json
import sys
from pathlib import Path

from tai import cpu_benchmark_finalization_cli as cli
from tai.cpu_benchmark_finalization_contract import (
    EXPECTED_MATURITY,
    canonical_sha256,
    expected_authority,
    write_json,
)


def _pending(path: Path) -> None:
    value: dict[str, object] = {
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
    value["manifest_sha256"] = canonical_sha256(value)
    write_json(path, value)


def test_validate_authority_and_pending_manifest(
    monkeypatch, capsys, tmp_path: Path
) -> None:
    authority = tmp_path / "authority.json"
    pending = tmp_path / "pending.json"
    output = tmp_path / "output.json"
    write_json(authority, expected_authority())
    _pending(pending)
    monkeypatch.setattr(
        sys,
        "argv",
        ["finalize", "validate-authority", str(authority), "--output", str(output)],
    )
    assert cli.main() == 0
    value = json.loads(output.read_text(encoding="utf-8"))
    assert value["status"] == "VALID"
    assert value["required_gpu_profile"] == "qwen3-8b-gpu-shared-q8-0"
    assert value["joint_benchmark_status"] == "PENDING_BENCHMARK"
    assert json.loads(capsys.readouterr().out) == value
    monkeypatch.setattr(sys, "argv", ["finalize", "validate-manifest", str(pending)])
    assert cli.main() == 2
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "PENDING_EXTERNAL_EVIDENCE"
    assert value["production_operational_status"] == "NOT_ATTESTED"


def test_verify_and_contract_error_paths(monkeypatch, capsys, tmp_path: Path) -> None:
    accepted = {
        "schema_version": "tai.cpu-benchmark-finalization-verification.v1",
        "status": "CPU_FALLBACK_BENCHMARK_FINALIZATION_VERIFIED_PENDING_GPU",
        "accepted": True,
    }
    monkeypatch.setattr(
        cli.finalization, "verify_finalization", lambda *args, **kwargs: accepted
    )
    paths = [str(tmp_path / f"p{index}") for index in range(17)]
    monkeypatch.setattr(
        sys,
        "argv",
        ["finalize", "verify", *paths, "--evaluated-at", "2026-07-21T20:00:00Z"],
    )
    assert cli.main() == 0
    assert json.loads(capsys.readouterr().out) == accepted
    invalid = tmp_path / "invalid.json"
    invalid.write_text("{}\n", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["finalize", "validate-manifest", str(invalid)])
    assert cli.main() == 2
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "REJECTED"
    assert value["model_admission_status"] == "PENDING_ADMISSION"
    assert value["production_operational_status"] == "NOT_ATTESTED"
