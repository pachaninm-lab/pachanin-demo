from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import textwrap
from pathlib import Path

from tai.release_acceptance import DEFAULT_REQUIRED_WORKFLOWS

ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github" / "workflows" / "tai-release-acceptance.yml"
EXACT_SHA = "a" * 40


def _release_selector_block() -> str:
    source = WORKFLOW.read_text(encoding="utf-8")
    match = re.search(
        r"python - <<'PY'\n(?P<body>.*?)\n\s*PY\n",
        source,
        flags=re.DOTALL,
    )
    assert match is not None
    block = textwrap.dedent(match.group("body"))
    assert "workflow-wait-state.json" in block
    assert "for run in runs" in block
    compile(block, str(WORKFLOW), "exec")
    return block


def _run(
    *,
    name: str,
    run_number: int,
    run_id: int,
    event: str = "push",
    conclusion: str = "success",
) -> dict[str, object]:
    return {
        "conclusion": conclusion,
        "event": event,
        "head_sha": EXACT_SHA,
        "html_url": f"https://example.invalid/actions/runs/{run_id}",
        "id": run_id,
        "name": name,
        "run_number": run_number,
        "status": "completed",
        "updated_at": "2026-09-04T00:00:00Z",
    }


def test_release_acceptance_filters_push_runs_before_selection() -> None:
    source = WORKFLOW.read_text(encoding="utf-8")
    assert "actions/runs?head_sha=${EXACT_HEAD}&per_page=100" in source
    assert 'run.get("event") != "push"' in source


def test_scheduled_failure_cannot_override_exact_sha_push_authority(
    tmp_path: Path,
) -> None:
    block = _release_selector_block()
    required = sorted(DEFAULT_REQUIRED_WORKFLOWS)
    runs = [
        _run(
            name=name,
            run_number=100 + index,
            run_id=10_000 + index,
        )
        for index, name in enumerate(required)
    ]

    security_name = "Security Quality Gate"
    push_security = next(run for run in runs if run["name"] == security_name)
    runs.append(
        _run(
            name=security_name,
            run_number=99_999,
            run_id=99_999,
            event="schedule",
            conclusion="failure",
        )
    )

    (tmp_path / "required-workflows.json").write_text(
        json.dumps(required) + "\n",
        encoding="utf-8",
    )
    (tmp_path / "workflow-runs-pages.json").write_text(
        json.dumps([{"workflow_runs": runs}]) + "\n",
        encoding="utf-8",
    )

    environment = os.environ.copy()
    environment["EXACT_HEAD"] = EXACT_SHA
    completed = subprocess.run(  # noqa: S603 - fixed interpreter, isolated fixture input
        [sys.executable, "-c", block],
        cwd=tmp_path,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, (
        f"stdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
    )
    state = json.loads(
        (tmp_path / "workflow-wait-state.json").read_text(encoding="utf-8")
    )
    assert state == {"failed": [], "missing": [], "pending": []}

    evidence = json.loads(
        (tmp_path / "workflow-evidence.json").read_text(encoding="utf-8")
    )
    selected = next(
        item for item in evidence if item["workflow_name"] == security_name
    )
    assert selected["run_id"] == push_security["id"]
