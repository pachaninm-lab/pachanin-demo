from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from tai import cpu_runtime_evidence_cli as cli

TAI_ROOT = Path(__file__).parents[1]
AUTHORITY = TAI_ROOT / "model-artifacts" / "cpu-runtime-evidence-authority.v1.json"
PENDING = TAI_ROOT / "model-artifacts" / "cpu-runtime-evidence.pending.json"


def _json_output(capsys: Any) -> dict[str, Any]:
    value = json.loads(capsys.readouterr().out)
    assert isinstance(value, dict)
    return value


def test_validate_authority_cli_reports_bounded_requirements(
    monkeypatch: Any,
    capsys: Any,
) -> None:
    monkeypatch.setattr(
        sys,
        "argv",
        ["cpu-runtime-evidence", "validate-authority", str(AUTHORITY)],
    )

    assert cli.main() == 0
    result = _json_output(capsys)
    assert result["status"] == "VALID"
    assert result["required_raw_observations"] == 348
    assert result["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert result["benchmark_status"] == "PENDING_BENCHMARK"
    assert result["production_operational_status"] == "NOT_ATTESTED"


def test_pending_manifest_cli_is_fail_closed(
    monkeypatch: Any,
    capsys: Any,
    tmp_path: Path,
) -> None:
    output = tmp_path / "pending-validation.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "cpu-runtime-evidence",
            "validate-manifest",
            str(PENDING),
            "--output",
            str(output),
        ],
    )

    assert cli.main() == 2
    result = _json_output(capsys)
    assert result["status"] == "PENDING_RUNTIME_EXECUTION"
    assert result["runtime_verification_status"] == "PENDING_RUNTIME_EXECUTION"
    assert json.loads(output.read_text(encoding="utf-8")) == result


def test_duplicate_key_manifest_cli_is_rejected_without_maturity_inflation(
    monkeypatch: Any,
    capsys: Any,
    tmp_path: Path,
) -> None:
    manifest = tmp_path / "duplicate.json"
    manifest.write_text(
        '{"schema_version":"tai.cpu-runtime-evidence.v1",'
        '"schema_version":"tai.cpu-runtime-evidence.v1"}',
        encoding="utf-8",
    )
    monkeypatch.setattr(
        sys,
        "argv",
        ["cpu-runtime-evidence", "validate-manifest", str(manifest)],
    )

    assert cli.main() == 2
    result = _json_output(capsys)
    assert result["status"] == "REJECTED"
    assert "duplicate JSON key" in result["reason"]
    assert result["runtime_verification_status"] == "PENDING_RUNTIME_EXECUTION"
    assert result["benchmark_status"] == "PENDING_BENCHMARK"
    assert result["model_admission_status"] == "PENDING_ADMISSION"
    assert result["production_operational_status"] == "NOT_ATTESTED"
