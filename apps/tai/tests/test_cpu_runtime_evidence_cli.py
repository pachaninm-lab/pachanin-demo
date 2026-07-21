from __future__ import annotations

import json
import sys
from pathlib import Path

from tai.cpu_runtime_evidence_cli import main

ROOT = Path(__file__).parents[1]
AUTHORITY = ROOT / "model-artifacts" / "cpu-runtime-evidence-authority.v1.json"
PENDING = ROOT / "model-artifacts" / "cpu-runtime-evidence.pending.json"


def test_validate_authority_cli(monkeypatch, capsys, tmp_path: Path) -> None:
    output = tmp_path / "authority.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cpu-runtime-evidence",
            "validate-authority",
            str(AUTHORITY),
            "--output",
            str(output),
        ],
    )
    assert main() == 0
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["status"] == "VALID"
    assert payload["runtime_profiles"] == [
        "qwen3-8b-cpu-q4-k-m",
        "mistral-7b-fallback-cpu-q4-k-m",
    ]
    assert payload["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert "VALID" in capsys.readouterr().out


def test_pending_runtime_cli_exits_fail_closed(
    monkeypatch,
    capsys,
    tmp_path: Path,
) -> None:
    output = tmp_path / "pending.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cpu-runtime-evidence",
            "verify-runtime-evidence",
            str(AUTHORITY),
            str(PENDING),
            "/not-used",
            "/not-used",
            "--output",
            str(output),
        ],
    )
    assert main() == 2
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["status"] == "PENDING_RUNTIME_EXECUTION"
    assert payload["benchmark_status"] == "PENDING_BENCHMARK"
    assert payload["production_operational_status"] == "NOT_ATTESTED"
    assert "PENDING_RUNTIME_EXECUTION" in capsys.readouterr().out


def test_invalid_authority_cli_returns_contract_error(
    monkeypatch,
    capsys,
    tmp_path: Path,
) -> None:
    invalid = tmp_path / "invalid.json"
    invalid.write_text('{"schema_version":"wrong"}\n', encoding="utf-8")
    output = tmp_path / "error.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cpu-runtime-evidence",
            "validate-authority",
            str(invalid),
            "--output",
            str(output),
        ],
    )
    assert main() == 2
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert payload["status"] == "REJECTED"
    assert payload["reason"].startswith("CONTRACT_INVALID:")
    assert payload["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert "CONTRACT_INVALID" in capsys.readouterr().out
