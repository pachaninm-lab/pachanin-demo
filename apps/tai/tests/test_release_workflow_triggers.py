from __future__ import annotations

from pathlib import Path

from tai.release_acceptance import DEFAULT_REQUIRED_WORKFLOWS


_WORKFLOW_FILES = {
    "Auction Atomic Execution Acceptance": "auction-atomic-acceptance.yml",
    "CI": "ci.yml",
    "Dependency Review": "dependency-review.yml",
    "Disputes PostgreSQL Authority Acceptance": "disputes-postgresql-acceptance.yml",
    "Node CI": "node-ci.yml",
    "Optional Runtime Retirement Gate": "optional-runtime-retirement-gate.yml",
    "Outbox PostgreSQL Authority Acceptance": "outbox-postgresql-acceptance.yml",
    "Runtime Context Security Gate": "runtime-context-security-gate.yml",
    "Security Abuse and Evidence Acceptance": "security-abuse-evidence.yml",
    "Security Quality Gate": "security-quality-gate.yml",
    "Security Scan": "security.yml",
    "TAI Foundation": "tai-foundation.yml",
}


def _indentation(line: str) -> int:
    return len(line) - len(line.lstrip(" "))


def _nested_block(lines: list[str], parent: str, child: str) -> list[str]:
    parent_index = next(
        index for index, line in enumerate(lines) if line == f"{parent}:"
    )
    parent_end = len(lines)
    for index in range(parent_index + 1, len(lines)):
        line = lines[index]
        if line.strip() and not line.lstrip().startswith("#") and _indentation(line) == 0:
            parent_end = index
            break
    child_index = next(
        index
        for index in range(parent_index + 1, parent_end)
        if lines[index] == f"  {child}:"
    )
    child_end = parent_end
    for index in range(child_index + 1, parent_end):
        line = lines[index]
        if line.strip() and not line.lstrip().startswith("#") and _indentation(line) <= 2:
            child_end = index
            break
    return lines[child_index + 1 : child_end]


def test_required_workflow_inventory_matches_release_authority() -> None:
    assert frozenset(_WORKFLOW_FILES) == DEFAULT_REQUIRED_WORKFLOWS


def test_required_workflows_run_on_every_main_push() -> None:
    repository_root = Path(__file__).resolve().parents[3]
    workflow_root = repository_root / ".github/workflows"
    for expected_name, filename in _WORKFLOW_FILES.items():
        lines = (workflow_root / filename).read_text().splitlines()
        assert lines[0] == f"name: {expected_name}", filename
        push_block = _nested_block(lines, "on", "push")
        normalized = [line.strip().strip("'\"") for line in push_block]
        assert any(
            line == "branches: [main]"
            or line == "- main"
            or (line.startswith("branches:") and "main" in line)
            for line in normalized
        ), filename
        assert not any(
            line.startswith("paths:") or line.startswith("paths-ignore:")
            for line in normalized
        ), filename
