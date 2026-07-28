from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import textwrap
from dataclasses import dataclass
from pathlib import Path

import pytest

from tai.release_acceptance import DEFAULT_REQUIRED_WORKFLOWS

ROOT = Path(__file__).resolve().parents[3]
WORKFLOW_ROOT = ROOT / ".github" / "workflows"
TAI_ROOT = ROOT / "apps" / "tai"

EXACT_SHA = "a" * 40
RELEASE_WORKFLOW = ".github/workflows/tai-release-acceptance.yml"
RELEASE_NAME = "TAI Release Acceptance"


@dataclass(frozen=True, slots=True)
class ReleaseConsumer:
    source: Path
    runs_path: Path
    selected_path: Path
    report_root: str | None = None


RELEASE_CONSUMERS = (
    pytest.param(
        ReleaseConsumer(
            source=WORKFLOW_ROOT / "tai-model-bundle-storage-preflight.yml",
            runs_path=Path("storage-evidence/release/runs.json"),
            selected_path=Path("storage-evidence/release/selected-run.json"),
        ),
        id="storage-preflight",
    ),
    pytest.param(
        ReleaseConsumer(
            source=WORKFLOW_ROOT / "tai-selectel-s3-provision.yml",
            runs_path=Path("selectel-report/release/runs.json"),
            selected_path=Path("selectel-report/release/selected-run.json"),
            report_root="selectel-report",
        ),
        id="selectel-provision",
    ),
    pytest.param(
        ReleaseConsumer(
            source=TAI_ROOT / "model-artifacts" / "model-bundle-finalization-driver.v1.sh",
            runs_path=Path("bundle-finalization-evidence/release/runs.json"),
            selected_path=Path("bundle-finalization-evidence/release/selected-run.json"),
        ),
        id="bundle-finalization",
    ),
    pytest.param(
        ReleaseConsumer(
            source=TAI_ROOT / "model-artifacts" / "model-conversion-prerequisites.v1.sh",
            runs_path=Path("prerequisite-evidence/release/runs.json"),
            selected_path=Path("prerequisite-evidence/release/selected-run.json"),
        ),
        id="conversion-prerequisites",
    ),
)

RELEASE_ACCEPTANCE = WORKFLOW_ROOT / "tai-release-acceptance.yml"
DIAGNOSTICS = WORKFLOW_ROOT / "tai-model-conversion-diagnostics.yml"

_PYTHON_HEREDOC = re.compile(
    r"(?m)^[^\n]*\bpython(?:3)?\s+-\s+<<'(?P<marker>[A-Z][A-Z0-9_]*)'[^\n]*$"
)
_WORKFLOW_SCOPED_RELEASE_URL = re.compile(
    r"actions/workflows/tai-release-acceptance\.yml/runs\?"
    r"head_sha=(?:\$GITHUB_SHA|\$\{GITHUB_SHA\})"
    r"&branch=main&per_page=100"
)


def _source(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _python_block(path: Path, *needles: str) -> str:
    source = _source(path)
    matches: list[str] = []
    for opening in _PYTHON_HEREDOC.finditer(source):
        marker = opening.group("marker")
        body_start = opening.end() + 1
        closing = re.search(
            rf"(?m)^[ \t]*{re.escape(marker)}[ \t]*$",
            source[body_start:],
        )
        assert closing is not None, f"{path}: unterminated {marker} heredoc"
        body = textwrap.dedent(source[body_start : body_start + closing.start()])
        if all(needle in body for needle in needles):
            matches.append(body)

    assert len(matches) == 1, (
        f"{path}: expected one Python heredoc containing {needles}, found {len(matches)}"
    )
    compile(matches[0], str(path), "exec")
    return matches[0]


def _lookup_command(source: str, endpoint_fragment: str) -> str:
    lines = source.splitlines()
    endpoint_line = next(index for index, line in enumerate(lines) if endpoint_fragment in line)
    start = endpoint_line
    while start >= 0 and "gh api" not in lines[start]:
        start -= 1
    assert start >= 0
    return "\n".join(lines[start : endpoint_line + 3])


def _write_json(root: Path, relative: Path, payload: object) -> None:
    destination = root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _execute(
    block: str,
    *,
    cwd: Path,
    environment: dict[str, str],
) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.update(environment)
    return subprocess.run(  # noqa: S603 - fixed interpreter, isolated fixture input
        [sys.executable, "-c", block],
        cwd=cwd,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def _assert_returncode(
    completed: subprocess.CompletedProcess[str],
    expected: int,
) -> None:
    assert completed.returncode == expected, (
        f"expected return code {expected}, got {completed.returncode}\n"
        f"stdout:\n{completed.stdout}\n"
        f"stderr:\n{completed.stderr}"
    )


def _workflow_run(
    *,
    name: str,
    run_number: int,
    run_id: int | None = None,
    status: str = "completed",
    conclusion: str | None = "success",
    path: str = RELEASE_WORKFLOW,
    head_sha: str = EXACT_SHA,
    head_branch: str = "main",
    event: str = "push",
) -> dict[str, object]:
    identity = run_number if run_id is None else run_id
    return {
        "conclusion": conclusion,
        "event": event,
        "head_branch": head_branch,
        "head_sha": head_sha,
        "html_url": f"https://example.invalid/actions/runs/{identity}",
        "id": identity,
        "name": name,
        "path": path,
        "run_number": run_number,
        "status": status,
        "updated_at": "2026-07-28T00:00:00Z",
    }


def _release_run(
    *,
    run_number: int,
    run_id: int | None = None,
    status: str = "completed",
    conclusion: str | None = "success",
    **overrides: object,
) -> dict[str, object]:
    run = _workflow_run(
        name=RELEASE_NAME,
        run_number=run_number,
        run_id=run_id,
        status=status,
        conclusion=conclusion,
    )
    run.update(overrides)
    return run


def _mismatched_release_runs(start: int = 1_000) -> list[dict[str, object]]:
    mismatches: tuple[dict[str, object], ...] = (
        {"name": "Not TAI Release Acceptance"},
        {"path": ".github/workflows/not-tai-release-acceptance.yml"},
        {"head_sha": "b" * 40},
        {"head_branch": "feature/not-main"},
        {"event": "issue_comment"},
    )
    return [
        _release_run(
            run_number=start + offset,
            run_id=start + offset,
            conclusion="failure",
            **mismatch,
        )
        for offset, mismatch in enumerate(mismatches)
    ]


def _noise_runs(count: int) -> list[dict[str, object]]:
    return [
        _workflow_run(
            name=f"Noise workflow {index:03d}",
            run_number=10_000 + index,
            run_id=20_000 + index,
        )
        for index in range(count)
    ]


def _required_runs(*, exclude: frozenset[str] = frozenset()) -> list[dict[str, object]]:
    return [
        _workflow_run(
            name=name,
            path=f".github/workflows/{index:02d}.yml",
            run_number=100 + index,
            run_id=30_000 + index,
        )
        for index, name in enumerate(sorted(DEFAULT_REQUIRED_WORKFLOWS))
        if name not in exclude
    ]


@pytest.mark.parametrize("consumer", RELEASE_CONSUMERS)
def test_release_consumers_use_workflow_specific_exact_main_endpoint(
    consumer: ReleaseConsumer,
) -> None:
    source = _source(consumer.source)
    assert _WORKFLOW_SCOPED_RELEASE_URL.search(source), consumer.source
    assert not re.search(
        r"actions/runs\?head_sha=(?:\$GITHUB_SHA|\$\{GITHUB_SHA\})",
        source,
    ), consumer.source

    command = _lookup_command(
        source,
        "actions/workflows/tai-release-acceptance.yml/runs?",
    )
    assert "status=success" not in command
    assert "branch=main" in command

    _python_block(
        consumer.source,
        "selected-run.json",
        RELEASE_WORKFLOW,
        "run.get",
    )


@pytest.mark.parametrize("consumer", RELEASE_CONSUMERS)
@pytest.mark.parametrize(
    ("status", "conclusion", "expected_returncode"),
    (
        pytest.param("completed", "success", 0, id="newest-success"),
        pytest.param("in_progress", None, 3, id="newest-pending"),
        pytest.param("completed", "failure", 2, id="newest-failure"),
    ),
)
def test_release_consumer_executes_newest_run_and_fail_closed_filters(
    consumer: ReleaseConsumer,
    status: str,
    conclusion: str | None,
    expected_returncode: int,
    tmp_path: Path,
) -> None:
    block = _python_block(
        consumer.source,
        "selected-run.json",
        RELEASE_WORKFLOW,
        "run.get",
    )
    older_success = _release_run(run_number=10, run_id=101)
    newest = _release_run(
        run_number=11,
        run_id=202,
        status=status,
        conclusion=conclusion,
    )
    # Every mismatch has a larger run number. Omitting any fail-closed filter
    # therefore selects a deliberate failure instead of the valid candidate.
    runs = [older_success, newest, *_mismatched_release_runs()]
    _write_json(tmp_path, consumer.runs_path, {"workflow_runs": runs})
    environment = {"GITHUB_SHA": EXACT_SHA}
    if consumer.report_root is not None:
        environment["REPORT_ROOT"] = consumer.report_root

    completed = _execute(block, cwd=tmp_path, environment=environment)
    _assert_returncode(completed, expected_returncode)

    selected = tmp_path / consumer.selected_path
    if expected_returncode == 0:
        assert json.loads(selected.read_text(encoding="utf-8"))["id"] == 202
    else:
        assert not selected.exists()


@pytest.mark.parametrize(
    ("path", "endpoint"),
    (
        pytest.param(
            RELEASE_ACCEPTANCE,
            "actions/runs?head_sha=${EXACT_HEAD}&per_page=100",
            id="release-acceptance",
        ),
        pytest.param(
            DIAGNOSTICS,
            "actions/runs?head_sha=$GITHUB_SHA&per_page=100",
            id="diagnostics",
        ),
    ),
)
def test_multi_workflow_aggregators_paginate_slurp_and_use_pages_input(
    path: Path,
    endpoint: str,
) -> None:
    source = _source(path)
    command = _lookup_command(source, endpoint)
    assert "--paginate" in command
    assert "--slurp" in command
    assert "workflow-runs-pages.json" in command
    assert "status=success" not in command

    block = _python_block(path, "latest", "for run in runs")
    assert "workflow-runs-pages.json" in block
    assert "workflow-runs-raw.json" not in block
    assert "workflow-runs.json" not in block


@pytest.mark.parametrize(
    ("status", "conclusion", "expected_returncode", "state_key"),
    (
        pytest.param("completed", "success", 0, None, id="newest-success"),
        pytest.param("in_progress", None, 3, "pending", id="newest-pending"),
        pytest.param("completed", "failure", 2, "failed", id="newest-failure"),
    ),
)
def test_release_acceptance_flattens_page_two_and_uses_newest_gate_run(
    status: str,
    conclusion: str | None,
    expected_returncode: int,
    state_key: str | None,
    tmp_path: Path,
) -> None:
    target = "CI"
    block = _python_block(
        RELEASE_ACCEPTANCE,
        "workflow-wait-state.json",
        "for run in runs",
    )
    _write_json(
        tmp_path,
        Path("required-workflows.json"),
        sorted(DEFAULT_REQUIRED_WORKFLOWS),
    )

    older_success = _workflow_run(
        name=target,
        path=".github/workflows/ci.yml",
        run_number=10,
        run_id=401,
    )
    newest = _workflow_run(
        name=target,
        path=".github/workflows/ci.yml",
        run_number=11,
        run_id=402,
        status=status,
        conclusion=conclusion,
    )
    page_one = _noise_runs(100)
    assert len(page_one) == 100
    page_two = [
        *_required_runs(exclude=frozenset({target})),
        older_success,
        newest,
    ]
    _write_json(
        tmp_path,
        Path("workflow-runs-pages.json"),
        [
            {"total_count": len(page_one) + len(page_two), "workflow_runs": page_one},
            {"total_count": len(page_one) + len(page_two), "workflow_runs": page_two},
        ],
    )
    # A legacy parser must still fail instead of accidentally reading only page one.
    _write_json(
        tmp_path,
        Path("workflow-runs-raw.json"),
        [
            {"total_count": len(page_one) + len(page_two), "workflow_runs": page_one},
            {"total_count": len(page_one) + len(page_two), "workflow_runs": page_two},
        ],
    )

    completed = _execute(
        block,
        cwd=tmp_path,
        environment={"EXACT_HEAD": EXACT_SHA},
    )
    _assert_returncode(completed, expected_returncode)

    state = json.loads((tmp_path / "workflow-wait-state.json").read_text(encoding="utf-8"))
    if expected_returncode == 0:
        assert state == {"failed": [], "missing": [], "pending": []}
        evidence = json.loads((tmp_path / "workflow-evidence.json").read_text(encoding="utf-8"))
        assert len(evidence) == len(DEFAULT_REQUIRED_WORKFLOWS)
        selected = next(item for item in evidence if item["workflow_name"] == target)
        assert selected["run_id"] == 402
    else:
        assert state[state_key] == [target]
        assert not (tmp_path / "workflow-evidence.json").exists()


@pytest.mark.parametrize(
    ("status", "conclusion"),
    (
        pytest.param("completed", "success", id="newest-success"),
        pytest.param("in_progress", None, id="newest-pending"),
        pytest.param("completed", "failure", id="newest-failure"),
    ),
)
def test_diagnostics_flattens_page_two_and_reports_newest_filtered_release(
    status: str,
    conclusion: str | None,
    tmp_path: Path,
) -> None:
    block = _python_block(
        DIAGNOSTICS,
        "release_candidates",
        "diagnostics.json",
    )
    report_root = Path("diagnostic-report")
    older_success = _release_run(run_number=10, run_id=501)
    newest = _release_run(
        run_number=11,
        run_id=502,
        status=status,
        conclusion=conclusion,
    )
    page_one = _noise_runs(100)
    assert len(page_one) == 100
    page_two = [
        *_required_runs(),
        older_success,
        newest,
        *_mismatched_release_runs(start=2_000),
    ]
    _write_json(
        tmp_path,
        report_root / "workflow-runs-pages.json",
        [
            {"total_count": len(page_one) + len(page_two), "workflow_runs": page_one},
            {"total_count": len(page_one) + len(page_two), "workflow_runs": page_two},
        ],
    )
    # A legacy parser must still fail instead of accidentally reading only page one.
    _write_json(
        tmp_path,
        report_root / "workflow-runs.json",
        [
            {"total_count": len(page_one) + len(page_two), "workflow_runs": page_one},
            {"total_count": len(page_one) + len(page_two), "workflow_runs": page_two},
        ],
    )

    completed = _execute(
        block,
        cwd=tmp_path,
        environment={
            "GITHUB_SHA": EXACT_SHA,
            "REPORT_ROOT": report_root.as_posix(),
        },
    )
    _assert_returncode(completed, 0)

    diagnostics = json.loads(
        (tmp_path / report_root / "diagnostics.json").read_text(encoding="utf-8")
    )
    assert diagnostics["release_acceptance"] == {
        "conclusion": conclusion,
        "run_id": 502,
        "status": status,
        "url": "https://example.invalid/actions/runs/502",
    }
    required = diagnostics["required_workflows"]
    assert len(required) == len(DEFAULT_REQUIRED_WORKFLOWS)
    assert {item["name"] for item in required} == set(DEFAULT_REQUIRED_WORKFLOWS)
    assert all(
        item["status"] == "completed" and item["conclusion"] == "success" for item in required
    )
