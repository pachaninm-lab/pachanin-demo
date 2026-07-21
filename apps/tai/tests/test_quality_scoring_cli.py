from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from test_quality_scoring import EVALUATED_AT, build_fixture


def test_cli_validate_authority(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "tai.quality_scoring_cli",
            "validate-authority",
            str(fixture.authority_path),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["status"] == "VALID"


def test_cli_complete_and_contract_rejection(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    command = [
        sys.executable,
        "-m",
        "tai.quality_scoring_cli",
        "verify",
        str(fixture.authority_path),
        str(fixture.manifest_path),
        str(fixture.runtime_report_path),
        str(fixture.runtime_manifest_path),
        str(fixture.assessment_path),
        str(fixture.case_authority_path),
        str(fixture.original_root),
        str(fixture.restored_root),
        "--evaluated-at",
        EVALUATED_AT.isoformat(),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout)["accepted"] is True

    fixture.runtime_report_path.write_text("{}", encoding="utf-8")
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    assert result.returncode == 2
    value = json.loads(result.stdout)
    assert value["status"] == "REJECTED"
    assert value["reason"].startswith("CONTRACT_INVALID:")
