from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from tai.release_acceptance import (
    ApplicationReleaseAuthority,
    ApplicationReleaseCandidate,
    MigrationArtifact,
    MigrationInventory,
    WorkflowConclusion,
    WorkflowRunEvidence,
    source_tree_sha256,
    workflow_evidence_sha256,
)

_MIGRATION = re.compile(r"^(\d{4})_[A-Za-z0-9_-]+\.sql$")


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
    attestation = ApplicationReleaseAuthority().attest(candidate)
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
    migrations: list[MigrationArtifact] = []
    for path in sorted(root.glob("*.sql")):
        match = _MIGRATION.fullmatch(path.name)
        if match is None:
            raise ValueError(f"migration filename is not governed: {path.name}")
        relative = path.relative_to(repository_root).as_posix()
        migrations.append(
            MigrationArtifact(
                version=int(match.group(1)),
                path=relative,
                sha256=_file_sha256(path),
            )
        )
    return MigrationInventory(tuple(migrations))


def _source_digest(repository_root: Path) -> str:
    roots = (
        repository_root / "apps/tai/tai",
        repository_root / "apps/tai/tests",
    )
    files: dict[str, bytes] = {}
    for root in roots:
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            if "__pycache__" in path.parts or path.suffix in {".pyc", ".pyo"}:
                continue
            relative = path.relative_to(repository_root).as_posix()
            files[relative] = path.read_bytes()

    pyproject = repository_root / "apps/tai/pyproject.toml"
    if pyproject.is_file():
        files[pyproject.relative_to(repository_root).as_posix()] = pyproject.read_bytes()

    workflow_root = repository_root / ".github/workflows"
    for pattern in ("*.yml", "*.yaml"):
        for path in sorted(workflow_root.glob(pattern)):
            if path.is_file():
                files[path.relative_to(repository_root).as_posix()] = path.read_bytes()

    return source_tree_sha256(files)


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
