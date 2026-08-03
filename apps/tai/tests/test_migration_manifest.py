"""Regression coverage for immutable migration ordering and path integrity."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tai.release_acceptance_cli import _migration_inventory


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def test_repository_manifest_preserves_historical_paths_with_unique_authority_order() -> None:
    inventory = _migration_inventory(_repo_root())
    assert [item.version for item in inventory.migrations] == list(range(1, 25))
    paths = [item.path for item in inventory.migrations]
    assert paths[9].endswith("0010_operational_authority.sql")
    assert paths[10].endswith("0010_orchestration_runtime.sql")
    assert paths[-8].endswith("0016_official_source_coverage.sql")
    assert paths[-7].endswith("0017_official_source_run_evidence.sql")
    assert paths[-6].endswith("0018_confirmation_denial_audit.sql")
    assert paths[-5].endswith("0019_public_official_corpus.sql")
    assert paths[-4].endswith("0020_public_official_corpus_audit_authority.sql")
    assert paths[-3].endswith("0021_public_official_acquisition_authority.sql")
    assert paths[-2].endswith("0021_retrieval_activation_serialization.sql")
    assert paths[-1].endswith("0022_runtime_role_grant_reconciliation.sql")


def test_runtime_role_grant_reconciliation_is_bounded_and_fail_closed() -> None:
    migration = (
        _repo_root()
        / "apps/tai/tai/migrations/0022_runtime_role_grant_reconciliation.sql"
    ).read_text(encoding="utf-8")

    assert "WHERE rolname = 'tai_runtime'" in migration
    assert "relation.relname LIKE 'tai\\_%' ESCAPE '\\'" in migration
    assert "relation.relname NOT LIKE 'tai\\_%' ESCAPE '\\'" in migration
    assert "GRANT CONNECT ON DATABASE %I TO %I" in migration
    assert "GRANT USAGE ON SCHEMA public TO tai_runtime" in migration
    assert "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE" in migration
    assert "GRANT USAGE, SELECT, UPDATE ON SEQUENCE" in migration
    assert "has_database_privilege('tai_runtime', current_database(), 'CONNECT')" in migration
    assert "has_schema_privilege('tai_runtime', 'public', 'USAGE')" in migration
    assert "tai_runtime grant reconciliation is incomplete" in migration
    assert "GRANT ALL" not in migration.upper()
    assert "ON ALL TABLES" not in migration.upper()
    assert "ALTER ROLE" not in migration.upper()


def _fixture(root: Path) -> Path:
    migration_root = root / "apps/tai/tai/migrations"
    migration_root.mkdir(parents=True, exist_ok=True)
    names = ["0010_first.sql", "0010_second.sql"]
    for name in names:
        (migration_root / name).write_text("SELECT 1;\n", encoding="utf-8")
    manifest_path = migration_root / "manifest.json"
    manifest_path.write_text(
        json.dumps(
            {
                "schema_version": "tai.migration.manifest.v1",
                "migrations": [
                    {"path": name, "version": version}
                    for version, name in enumerate(names, start=1)
                ],
            }
        ),
        encoding="utf-8",
    )
    return manifest_path


def test_manifest_allows_duplicate_filename_prefixes_but_not_duplicate_versions(
    tmp_path: Path,
) -> None:
    manifest_path = _fixture(tmp_path)
    inventory = _migration_inventory(tmp_path)
    assert [item.version for item in inventory.migrations] == [1, 2]

    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw["migrations"][1]["version"] = 1
    manifest_path.write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="migration versions must be unique"):
        _migration_inventory(tmp_path)


def test_manifest_rejects_unlisted_missing_duplicate_and_traversal_paths(
    tmp_path: Path,
) -> None:
    manifest_path = _fixture(tmp_path)
    migration_root = manifest_path.parent

    (migration_root / "0011_unlisted.sql").write_text("SELECT 1;\n", encoding="utf-8")
    with pytest.raises(ValueError, match="manifest coverage mismatch"):
        _migration_inventory(tmp_path)
    (migration_root / "0011_unlisted.sql").unlink()

    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw["migrations"][1]["path"] = raw["migrations"][0]["path"]
    manifest_path.write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="paths must be unique"):
        _migration_inventory(tmp_path)

    manifest_path = _fixture(tmp_path)
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    raw["migrations"][0]["path"] = "../escape.sql"
    manifest_path.write_text(json.dumps(raw), encoding="utf-8")
    with pytest.raises(ValueError, match="bounded governed SQL filename"):
        _migration_inventory(tmp_path)

    manifest_path = _fixture(tmp_path)
    (migration_root / "0010_second.sql").unlink()
    with pytest.raises(ValueError, match="manifest coverage mismatch"):
        _migration_inventory(tmp_path)
