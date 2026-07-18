from __future__ import annotations

import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from tai.release_acceptance import DEFAULT_REQUIRED_WORKFLOWS
from tai.release_acceptance_cli import main

NOW = datetime(2026, 7, 19, 0, 0, tzinfo=UTC)
HEAD = "a" * 64


def _repository(root: Path) -> None:
    migration_root = root / "apps/tai/tai/migrations"
    migration_root.mkdir(parents=True)
    for version in range(1, 12):
        (migration_root / f"{version:04d}_migration.sql").write_text(
            f"-- migration {version}\nSELECT {version};\n"
        )
    (root / "apps/tai/tai/module.py").write_text("VALUE = 1\n")
    (root / "apps/tai/tests").mkdir(parents=True)
    (root / "apps/tai/tests/test_module.py").write_text("def test_value():\n    assert 1 == 1\n")
    (root / "apps/tai/pyproject.toml").write_text("[project]\nname='tai-test'\n")
    workflow_root = root / ".github/workflows"
    workflow_root.mkdir(parents=True)
    (workflow_root / "tai-foundation.yml").write_text("name: TAI Foundation\n")
    (workflow_root / "tai-release-acceptance.yml").write_text(
        "name: TAI Release Acceptance\n"
    )


def _evidence(path: Path, *, missing: str | None = None) -> None:
    items = []
    for index, name in enumerate(sorted(DEFAULT_REQUIRED_WORKFLOWS), start=1):
        if name == missing:
            continue
        completed_at = NOW - timedelta(minutes=1)
        items.append(
            {
                "completed_at": completed_at.isoformat(),
                "conclusion": "success",
                "exact_head_sha": HEAD,
                "run_id": 1000 + index,
                "run_url": (
                    "https://github.com/pachaninm-lab/pachanin-demo/actions/runs/"
                    f"{1000 + index}"
                ),
                "workflow_name": name,
            }
        )
    path.write_text(json.dumps(items))


def _argv(root: Path, evidence: Path, output: Path) -> list[str]:
    return [
        "tai-release-acceptance",
        "--repository",
        "pachaninm-lab/pachanin-demo",
        "--exact-head",
        HEAD,
        "--repository-root",
        str(root),
        "--workflow-evidence",
        str(evidence),
        "--created-at",
        NOW.isoformat(),
        "--output",
        str(output),
    ]


def test_cli_builds_accepted_application_attestation(tmp_path: Path, monkeypatch) -> None:
    _repository(tmp_path)
    evidence = tmp_path / "workflow-evidence.json"
    output = tmp_path / "release-attestation.json"
    _evidence(evidence)
    monkeypatch.setattr(sys, "argv", _argv(tmp_path, evidence, output))

    result = main()
    attestation = json.loads(output.read_text())

    assert result == 0
    assert attestation["accepted"] is True
    assert attestation["exact_main_sha"] == HEAD
    assert attestation["production_operational_status"] == "NOT_ATTESTED"
    assert attestation["reasons"] == []
    assert len(attestation["migration_inventory"]) == 11
    assert len(attestation["attestation_sha256"]) == 64
    assert len(attestation["source_tree_sha256"]) == 64


def test_cli_rejects_missing_required_workflow(tmp_path: Path, monkeypatch) -> None:
    _repository(tmp_path)
    evidence = tmp_path / "workflow-evidence.json"
    output = tmp_path / "release-attestation.json"
    _evidence(evidence, missing="Security Scan")
    monkeypatch.setattr(sys, "argv", _argv(tmp_path, evidence, output))

    result = main()
    attestation = json.loads(output.read_text())

    assert result == 1
    assert attestation["accepted"] is False
    assert attestation["reasons"] == ["REQUIRED_WORKFLOW_MISSING"]


def test_cli_rejects_ungoverned_migration_filename(tmp_path: Path, monkeypatch) -> None:
    _repository(tmp_path)
    (tmp_path / "apps/tai/tai/migrations/manual.sql").write_text("SELECT 1;\n")
    evidence = tmp_path / "workflow-evidence.json"
    output = tmp_path / "release-attestation.json"
    _evidence(evidence)
    monkeypatch.setattr(sys, "argv", _argv(tmp_path, evidence, output))

    with pytest.raises(ValueError, match="not governed"):
        main()
