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
        "0013_production_composition.sql",
        "0014_governed_tool_planner.sql",
        "0015_confirmed_logistics_authority.sql",
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

    api_root = root / "apps/api"
    (api_root / "src/modules/tai-tools").mkdir(parents=True)
    (api_root / "src/modules/tai-tools/tool.ts").write_text(
        "export const TOOL = 'getDealSummary';\n"
    )
    (api_root / "test").mkdir()
    (api_root / "test/tai-tools.spec.ts").write_text("describe('tools', () => {});\n")
    (api_root / "prisma").mkdir()
    (api_root / "prisma/schema.prisma").write_text(
        'datasource db { provider = "postgresql" }\n'
    )
    (api_root / "package.json").write_text('{"name":"api"}\n')

    package_root = root / "packages/domain-core/src"
    package_root.mkdir(parents=True)
    (package_root / "index.ts").write_text("export const DOMAIN = true;\n")
    script_root = root / "scripts"
    script_root.mkdir()
    (script_root / "acceptance.sh").write_text("#!/bin/sh\nexit 0\n")

    workflow_root = root / ".github/workflows"
    workflow_root.mkdir(parents=True)
    (workflow_root / "tai-foundation.yml").write_text("name: TAI Foundation\n")
    (workflow_root / "tai-release-acceptance.yml").write_text(
        "name: TAI Release Acceptance\n"
    )
    (workflow_root / "security-scan.yaml").write_text("name: Security Scan\n")

    (root / "package.json").write_text('{"private":true}\n')
    (root / "pnpm-lock.yaml").write_text("lockfileVersion: '9.0'\n")
    (root / "pnpm-workspace.yaml").write_text("packages:\n  - apps/api\n")
    (root / "tsconfig.base.json").write_text('{"compilerOptions":{}}\n')
    (root / "apps/tai/release-source-manifest.json").write_text(
        json.dumps(
            {
                "schema_version": "tai.release.source-manifest.v1",
                "roots": [
                    ".github/workflows",
                    "apps/api",
                    "apps/tai/tai",
                    "apps/tai/tests",
                    "packages",
                    "scripts",
                ],
                "files": [
                    "apps/tai/pyproject.toml",
                    "package.json",
                    "pnpm-lock.yaml",
                    "pnpm-workspace.yaml",
                    "tsconfig.base.json",
                ],
            }
        )
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
    assert len(attestation["migration_inventory"]) == 16
    assert len(attestation["attestation_sha256"]) == 64
    assert len(attestation["source_tree_sha256"]) == 64


def test_cli_rejects_release_below_confirmed_action_migration_authority(
    tmp_path: Path, monkeypatch
) -> None:
    _repository(tmp_path)
    migration_root = tmp_path / "apps/tai/tai/migrations"
    confirmed_migration = migration_root / "0015_confirmed_logistics_authority.sql"
    confirmed_migration.unlink()
    manifest_path = migration_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["migrations"] = manifest["migrations"][:-1]
    manifest_path.write_text(json.dumps(manifest))
    evidence = tmp_path / "workflow-evidence.json"
    output = tmp_path / "release-attestation.json"
    _evidence(evidence)
    monkeypatch.setattr(sys, "argv", _argv(tmp_path, evidence, output))

    result = main()
    attestation = json.loads(output.read_text())

    assert result == 1
    assert attestation["accepted"] is False
    assert attestation["reasons"] == ["MIGRATION_INVENTORY_BELOW_REQUIRED_VERSION"]


def test_source_digest_binds_workflows_and_integrated_platform_api(tmp_path: Path) -> None:
    _repository(tmp_path)
    initial = _source_digest(tmp_path)

    yml_workflow = tmp_path / ".github/workflows/tai-foundation.yml"
    yml_workflow.write_text("name: TAI Foundation\njobs: {}\n")
    after_workflow_change = _source_digest(tmp_path)

    api_tool = tmp_path / "apps/api/src/modules/tai-tools/tool.ts"
    api_tool.write_text("export const TOOL = 'getRoleNextActions';\n")
    after_api_change = _source_digest(tmp_path)

    prisma_schema = tmp_path / "apps/api/prisma/schema.prisma"
    prisma_schema.write_text('datasource db { provider = "sqlite" }\n')
    after_schema_change = _source_digest(tmp_path)

    assert initial != after_workflow_change
    assert after_workflow_change != after_api_change
    assert after_api_change != after_schema_change


def test_source_digest_rejects_narrowed_integrated_scope(tmp_path: Path) -> None:
    _repository(tmp_path)
    manifest_path = tmp_path / "apps/tai/release-source-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["roots"].remove("apps/api")
    manifest_path.write_text(json.dumps(manifest))

    with pytest.raises(ValueError, match="below required integrated scope"):
        _source_digest(tmp_path)


def test_source_digest_rejects_missing_or_traversing_paths(tmp_path: Path) -> None:
    missing_root = tmp_path / "missing"
    _repository(missing_root)
    (missing_root / "pnpm-lock.yaml").unlink()
    with pytest.raises(ValueError, match="not a regular file"):
        _source_digest(missing_root)

    traversal_root = tmp_path / "traversal"
    _repository(traversal_root)
    manifest_path = traversal_root / "apps/tai/release-source-manifest.json"
    manifest = json.loads(manifest_path.read_text())
    manifest["roots"].append("../outside")
    manifest_path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match="repository-relative"):
        _source_digest(traversal_root)


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
