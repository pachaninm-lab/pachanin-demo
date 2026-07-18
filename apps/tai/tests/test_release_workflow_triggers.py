from __future__ import annotations

from pathlib import Path

_REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
_WORKFLOW_ROOT = _REPOSITORY_ROOT / ".github/workflows"
_REQUIRED_EXACT_MAIN_WORKFLOWS = (
    "ci.yml",
    "node-ci.yml",
    "tai-foundation.yml",
)


def _mapping_block(text: str, key: str, indent: int) -> str:
    prefix = " " * indent
    marker = f"{prefix}{key}:"
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line != marker:
            continue
        block = [line]
        for candidate in lines[index + 1 :]:
            if candidate.strip():
                candidate_indent = len(candidate) - len(candidate.lstrip(" "))
                if candidate_indent <= indent:
                    break
            block.append(candidate)
        return "\n".join(block)
    raise AssertionError(f"workflow mapping {key!r} at indent {indent} is missing")


def _workflow(name: str) -> str:
    path = _WORKFLOW_ROOT / name
    assert path.is_file(), f"required workflow is missing: {path}"
    return path.read_text()


def test_required_workflows_run_for_every_main_sha() -> None:
    for name in _REQUIRED_EXACT_MAIN_WORKFLOWS:
        text = _workflow(name)
        on_block = _mapping_block(text, "on", 0)
        push_block = _mapping_block(on_block, "push", 2)

        assert "branches:" in push_block
        assert "main" in push_block
        assert "paths:" not in push_block, (
            f"{name} cannot be path-filtered on main because AP-11 requires "
            "exact-head evidence for every release candidate"
        )


def test_required_workflows_preserve_exact_sha_evidence() -> None:
    for name in _REQUIRED_EXACT_MAIN_WORKFLOWS:
        concurrency = _mapping_block(_workflow(name), "concurrency", 0)

        assert "${{ github.sha }}" in concurrency
        assert "cancel-in-progress: false" in concurrency
        assert "${{ github.ref }}" not in concurrency


def test_node_ci_reviews_its_own_trigger_contract() -> None:
    text = _workflow("node-ci.yml")
    on_block = _mapping_block(text, "on", 0)
    pull_request = _mapping_block(on_block, "pull_request", 2)

    assert ".github/workflows/node-ci.yml" in pull_request


def test_tai_foundation_supports_manual_exact_sha_recovery() -> None:
    on_block = _mapping_block(_workflow("tai-foundation.yml"), "on", 0)

    assert "workflow_dispatch:" in on_block
