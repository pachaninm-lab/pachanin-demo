from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any

from tai.release_acceptance import (
    ApplicationReleaseAuthority,
    ApplicationReleaseCandidate,
    ApplicationReleasePolicy,
    MigrationArtifact,
    MigrationInventory,
    WorkflowConclusion,
    WorkflowRunEvidence,
    source_tree_sha256,
    workflow_evidence_sha256,
)

_MIGRATION = re.compile(r"^(\d{4})_[A-Za-z0-9_-]+\.sql$")
_SOURCE_MANIFEST_SCHEMA = "tai.release.source-manifest.v1"
_SOURCE_MANIFEST_PATH = "apps/tai/release-source-manifest.json"
_REQUIRED_SOURCE_ROOTS = frozenset(
    {
        ".github/workflows",
        "apps/api",
        "apps/tai/tai",
        "apps/tai/tests",
        "packages",
        "scripts",
    }
)
_REQUIRED_SOURCE_FILES = frozenset(
    {
        "apps/tai/pyproject.toml",
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "tsconfig.base.json",
    }
)
_IGNORED_SOURCE_PARTS = frozenset(
    {
        "__pycache__",
        ".mypy_cache",
        ".pytest_cache",
        ".ruff_cache",
    }
)
_IGNORED_SOURCE_SUFFIXES = frozenset({".pyc", ".pyo"})
_MINIMUM_RELEASE_MIGRATION_VERSION = 16


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a TAI exact-main release attestation")
    parser.add_argument("--repository", required=True)
    parser.add_argument("--exact-head", required=True)
    parser.add_argument("--repository-root", required=True, type=Path)
    parser.add_argument("--workflow-evidence", required=True, type=Path)
    parser.add_argument("--created-at", required=True)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--previous-attestation-sha256")
    args = parser.parse_args()

    created_at = _datetime(args.created_at)
    repository_root = args.repository_root.resolve()
    workflow_runs = _load_workflow_evidence(args.workflow_evidence)
    migrations = _migration_inventory(repository_root)
    source_digest = _source_digest(repository_root)
    candidate = ApplicationReleaseCandidate(
        repository=args.repository,
        exact_main_sha=args.exact_head,
        source_tree_sha256=source_digest,
        migration_inventory=migrations,
        workflow_runs=workflow_runs,
        created_at=created_at,
        free_access_architecture=_free_access_proven(workflow_runs),
        previous_attestation_sha256=args.previous_attestation_sha256,
    )
    authority = ApplicationReleaseAuthority(
        ApplicationReleasePolicy(
            minimum_migration_version=_MINIMUM_RELEASE_MIGRATION_VERSION
        )
    )
    attestation = authority.attest(candidate)
    output = {
        "accepted": attestation.accepted,
        "attestation_sha256": attestation.attestation_sha256,
        "created_at": attestation.created_at.isoformat(),
        "exact_main_sha": attestation.exact_main_sha,
        "migration_inventory": [
            {
                "path": item.path,
                "sha256": item.sha256,
                "version": item.version,
            }
            for item in migrations.migrations
        ],
        "migration_inventory_sha256": attestation.migration_inventory_sha256,
        "previous_attestation_sha256": attestation.previous_attestation_sha256,
        "production_operational_status": attestation.production_operational_status.value,
        "reasons": list(attestation.reasons),
        "release_id": attestation.release_id,
        "repository": attestation.repository,
        "schema_version": "tai.release.attestation.v1",
        "source_tree_sha256": attestation.source_tree_sha256,
        "workflow_evidence": [
            {
                "completed_at": run.completed_at.isoformat(),
                "conclusion": run.conclusion.value,
                "evidence_sha256": run.evidence_sha256,
                "exact_head_sha": run.exact_head_sha,
                "run_id": run.run_id,
                "run_url": run.run_url,
                "workflow_name": run.workflow_name,
            }
            for run in sorted(workflow_runs, key=lambda item: item.workflow_name)
        ],
        "workflow_evidence_sha256s": list(attestation.workflow_evidence_sha256s),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )
    print(json.dumps(output, ensure_ascii=False, separators=(",", ":"), sort_keys=True))
    return 0 if attestation.accepted else 1


def _load_workflow_evidence(path: Path) -> tuple[WorkflowRunEvidence, ...]:
    raw = json.loads(path.read_text())
    if not isinstance(raw, list):
        raise ValueError("workflow evidence must be a JSON array")
    result: list[WorkflowRunEvidence] = []
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError("workflow evidence items must be objects")
        name = _string(item, "workflow_name")
        run_id = _integer(item, "run_id")
        head = _string(item, "exact_head_sha")
        conclusion = WorkflowConclusion(_string(item, "conclusion"))
        completed_at = _datetime(_string(item, "completed_at"))
        run_url = _string(item, "run_url")
        digest = workflow_evidence_sha256(
            workflow_name=name,
            run_id=run_id,
            exact_head_sha=head,
            conclusion=conclusion,
            completed_at=completed_at,
            run_url=run_url,
        )
        result.append(
            WorkflowRunEvidence(
                workflow_name=name,
                run_id=run_id,
                exact_head_sha=head,
                conclusion=conclusion,
                completed_at=completed_at,
                run_url=run_url,
                evidence_sha256=digest,
            )
        )
    return tuple(result)


def _migration_inventory(repository_root: Path) -> MigrationInventory:
    root = repository_root / "apps/tai/tai/migrations"
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file():
        raise ValueError("migration manifest is required")
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("migration manifest must be a JSON object")
    if raw.get("schema_version") != "tai.migration.manifest.v1":
        raise ValueError("migration manifest schema version is unsupported")
    items = raw.get("migrations")
    if not isinstance(items, list) or not items:
        raise ValueError("migration manifest must contain a non-empty migrations array")

    declared_paths: list[str] = []
    migrations: list[MigrationArtifact] = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("migration manifest entries must be objects")
        version = item.get("version")
        name = item.get("path")
        if not isinstance(version, int) or isinstance(version, bool) or version < 1:
            raise ValueError("migration manifest version must be a positive integer")
        if (
            not isinstance(name, str)
            or Path(name).name != name
            or _MIGRATION.fullmatch(name) is None
        ):
            raise ValueError("migration manifest path must be a bounded governed SQL filename")
        declared_paths.append(name)
        path = root / name
        migrations.append(
            MigrationArtifact(
                version=version,
                path=path.relative_to(repository_root).as_posix(),
                sha256=_file_sha256(path) if path.is_file() else "0" * 64,
            )
        )

    if len(declared_paths) != len(set(declared_paths)):
        raise ValueError("migration manifest paths must be unique")
    available = {path.name for path in root.glob("*.sql")}
    declared = set(declared_paths)
    if declared != available:
        missing_from_manifest = sorted(available - declared)
        missing_on_disk = sorted(declared - available)
        raise ValueError(
            "migration manifest coverage mismatch: "
            f"missing_from_manifest={missing_from_manifest}, missing_on_disk={missing_on_disk}"
        )
    return MigrationInventory(tuple(migrations))


def _source_digest(repository_root: Path) -> str:
    manifest_path = repository_root / _SOURCE_MANIFEST_PATH
    if not manifest_path.is_file() or manifest_path.is_symlink():
        raise ValueError("release source manifest is required as a regular file")
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("release source manifest must be a JSON object")
    if set(raw) != {"files", "roots", "schema_version"}:
        raise ValueError("release source manifest keys are invalid")
    if raw.get("schema_version") != _SOURCE_MANIFEST_SCHEMA:
        raise ValueError("release source manifest schema version is unsupported")
    roots = _manifest_paths(raw.get("roots"), "roots")
    declared_files = _manifest_paths(raw.get("files"), "files")
    missing_roots = sorted(_REQUIRED_SOURCE_ROOTS - set(roots))
    missing_files = sorted(_REQUIRED_SOURCE_FILES - set(declared_files))
    if missing_roots or missing_files:
        raise ValueError(
            "release source manifest is below required integrated scope: "
            f"missing_roots={missing_roots}, missing_files={missing_files}"
        )

    files: dict[str, bytes] = {
        _SOURCE_MANIFEST_PATH: manifest_path.read_bytes(),
    }
    for raw_root in roots:
        root = _resolve_governed_path(repository_root, raw_root)
        if not root.is_dir() or root.is_symlink():
            raise ValueError(f"release source root is not a regular directory: {raw_root}")
        found = False
        for path in sorted(root.rglob("*")):
            if path.is_symlink():
                raise ValueError(
                    f"release source authority does not allow symlinks: "
                    f"{path.relative_to(repository_root).as_posix()}"
                )
            if not path.is_file() or _ignored_source_path(path):
                continue
            relative = path.relative_to(repository_root).as_posix()
            files[relative] = path.read_bytes()
            found = True
        if not found:
            raise ValueError(f"release source root contains no governed files: {raw_root}")

    for raw_file in declared_files:
        path = _resolve_governed_path(repository_root, raw_file)
        if not path.is_file() or path.is_symlink():
            raise ValueError(f"release source file is not a regular file: {raw_file}")
        files[raw_file] = path.read_bytes()

    return source_tree_sha256(files)


def _manifest_paths(value: object, name: str) -> tuple[str, ...]:
    if not isinstance(value, list):
        raise ValueError(f"release source manifest {name} must be an array")
    result: list[str] = []
    for item in value:
        if not isinstance(item, str):
            raise ValueError(f"release source manifest {name} must contain strings")
        normalized = _relative_posix_path(item)
        result.append(normalized)
    if len(result) != len(set(result)):
        raise ValueError(f"release source manifest {name} must be unique")
    return tuple(result)


def _relative_posix_path(value: str) -> str:
    if not value or "\\" in value:
        raise ValueError("release source paths must use non-empty POSIX form")
    path = PurePosixPath(value)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError("release source paths must be repository-relative and normalized")
    normalized = path.as_posix()
    if normalized != value:
        raise ValueError("release source paths must be normalized")
    return normalized


def _resolve_governed_path(repository_root: Path, relative: str) -> Path:
    candidate = repository_root.joinpath(*PurePosixPath(relative).parts)
    resolved = candidate.resolve()
    if not resolved.is_relative_to(repository_root):
        raise ValueError("release source path escapes repository root")
    return resolved


def _ignored_source_path(path: Path) -> bool:
    return bool(_IGNORED_SOURCE_PARTS.intersection(path.parts)) or (
        path.suffix in _IGNORED_SOURCE_SUFFIXES
    )


def _free_access_proven(runs: tuple[WorkflowRunEvidence, ...]) -> bool:
    return any(
        run.workflow_name == "TAI Foundation"
        and run.conclusion is WorkflowConclusion.SUCCESS
        for run in runs
    )


def _file_sha256(path: Path) -> str:
    import hashlib

    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    result = datetime.fromisoformat(normalized)
    if result.utcoffset() is None:
        raise ValueError("datetime values must be timezone-aware")
    return result


def _string(item: dict[str, Any], key: str) -> str:
    value = item.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-blank string")
    return value


def _integer(item: dict[str, Any], key: str) -> int:
    value = item.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ValueError(f"{key} must be a positive integer")
    return value


if __name__ == "__main__":
    raise SystemExit(main())
