from __future__ import annotations

import json
import sys
from pathlib import Path

from cpu_benchmark_run_plan_fixtures import (
    BENCHMARK_AUTHORITY,
    BUNDLE_AUTHORITY,
    EXACT_MAIN,
    EXECUTION_AUTHORITY,
    FINALIZATION_AUTHORITY,
    NOW,
    PENDING,
    RUN_PLAN_AUTHORITY,
    _write,
    build_fixture,
)

from tai import cpu_benchmark_run_plan_cli as cli


def test_validate_authority_and_pending_cli(monkeypatch, capsys, tmp_path: Path) -> None:
    output = tmp_path / "authority.json"
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run-plan",
            "validate-authority",
            str(RUN_PLAN_AUTHORITY),
            "--output",
            str(output),
        ],
    )
    assert cli.main() == 0
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "VALID"
    assert value["protected_access_allowed"] is False
    assert json.loads(output.read_text(encoding="utf-8")) == value

    monkeypatch.setattr(
        sys,
        "argv",
        ["run-plan", "validate-pending", str(PENDING)],
    )
    assert cli.main() == 2
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "PENDING_EXTERNAL_RUN_PLAN_INPUTS"


def test_compile_cli_and_fail_closed_error(monkeypatch, capsys, tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    output = tmp_path / "plan.json"
    argv = [
        "run-plan",
        "compile",
        str(RUN_PLAN_AUTHORITY),
        str(fixture["root"]),
        str(fixture["index_path"]),
        str(EXECUTION_AUTHORITY),
        str(BUNDLE_AUTHORITY),
        str(BENCHMARK_AUTHORITY),
        str(FINALIZATION_AUTHORITY),
        "--exact-main",
        EXACT_MAIN,
        "--evaluated-at",
        NOW.isoformat(),
        "--output",
        str(output),
    ]
    monkeypatch.setattr(sys, "argv", argv)
    assert cli.main() == 0
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "RUN_PLAN_VERIFIED_READY_FOR_PROTECTED_ACCESS"
    assert json.loads(output.read_text(encoding="utf-8")) == value

    fixture["index"]["unknown"] = True
    _write(fixture["index_path"], fixture["index"])
    monkeypatch.setattr(sys, "argv", argv)
    assert cli.main() == 2
    value = json.loads(capsys.readouterr().out)
    assert value["status"] == "REJECTED"
    assert value["accepted"] is False
    assert value["protected_access_allowed"] is False
    assert value["benchmark_status"] == "PENDING_BENCHMARK"
