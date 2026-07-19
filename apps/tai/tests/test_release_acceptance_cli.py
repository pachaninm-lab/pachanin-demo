from __future__ import annotations

import json
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from tai.release_acceptance import DEFAULT_REQUIRED_WORKFLOWS
from tai.release_acceptance_cli import _source_digest, main

NOW = datetime(2026, 7, 19, 0, 0, tzinfo=UTC)
HEAD = "a" * 64


def _repository(root: Path) -> None:
    migration_root = root / "apps/tai/tai/migrations"
    migration_root.mkdir(parents=True)
    migration_names = [
        *(f"{version:04d}_migration.sql" for version in range(1, 10)),
        "0010_operational_authority.sql",
        "0010_orchestration_runtime.sql",
        "0011_release_attestation.sql",
        "0012_git_object_id_contract.sql",
    ]
    for version, name in enumerate(migration_names, start=1):
        (migration_root / name).write_text(f"-- migration {version}\nSELECT {version};\n")
    (migration_root / "manifest.json").write_text(
        json.dumps(
            {
                "schema_version": "tai.migration.manifest.v1",
                "migrations": [
                    {"path": name, "version": version}
                    for version, name in enumerate(migration_names, start=1)
                ],
            }
        )
    )
    (root / "apps/tai/tai/module.py").write_text("VALUE = 1\n")
    (root / "apps/tai/tests").mkdir(parents=True)
    (root / "apps/tai/tests/test_module.py").write_text(
        "def test_value():\n    assert 1 == 1\n"
    )
    (root / "apps/tai/pyproject.toml").write_text("[project]\nname='tai-test'\n")
    workflow_root = root / ".github/workflows"
    workflow_root.mkdir(parents=True)
    (workflow_root / "tai-foundation.yml").write_text("name: TAI Foundation\n")
    (workflow_root / "tai-release-acceptance.yml").write_text(
        "name: TAI Release Acceptance\n"
    )
    (workflow_root / "security-scan.yaml").write_text("name: Security Scan\n")


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
    assert len(attestation["migration_inventory"]) == 13
    assert len(attestation["attestation_sha256"]) == 64
    assert len(attestation["source_tree_sha256"]) == 64


def test_source_digest_binds_yml_and_yaml_workflow_definitions(tmp_path: Path) -> None:
    _repository(tmp_path)
    initial = _source_digest(tmp_path)

    yml_workflow = tmp_path / ".github/workflows/tai-foundation.yml"
    yml_workflow.write_text("name: TAI Foundation\njobs: {}\n")
    after_yml_change = _source_digest(tmp_path)

    yaml_workflow = tmp_path / ".github/workflows/security-scan.yaml"
    yaml_workflow.write_text("name: Security Scan\njobs: {}\n")
    after_yaml_change = _source_digest(tmp_path)

    assert initial != after_yml_change
    assert after_yml_change != after_yaml_change


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

    with pytest.raises(ValueError, match="manifest coverage mismatch"):
        main()


def test_cli_requires_workflow_evidence_array(tmp_path: Path, monkeypatch) -> None:
    _repository(tmp_path)
    evidence = tmp_path / "workflow-evidence.json"
    output = tmp_path / "release-attestation.json"
    evidence.write_text(json.dumps({"invalid": True}))
    monkeypatch.setattr(sys, "argv", _argv(tmp_path, evidence, output))

    with pytest.raises(ValueError, match="JSON array"):
        main()
