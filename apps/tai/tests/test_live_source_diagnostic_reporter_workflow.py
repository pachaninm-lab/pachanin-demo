from __future__ import annotations

from pathlib import Path


def test_temporary_diagnostic_reporter_has_bounded_authority() -> None:
    workflow = (
        Path(__file__).parents[3]
        / ".github"
        / "workflows"
        / "tai-live-source-evidence-reporter.yml"
    ).read_text(encoding="utf-8")

    assert "workflow_run:" in workflow
    assert "TAI Live Official Source Evidence" in workflow
    assert "types:\n      - completed" in workflow
    assert "actions: read" in workflow
    assert "contents: read" in workflow
    assert "issues: write" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    assert "id-token: write" not in workflow
    assert "secrets." not in workflow
    assert "head_branch == 'main'" in workflow
    assert "actions/download-artifact@v4" in workflow
    assert "run-id: ${{ github.event.workflow_run.id }}" in workflow
    assert "issue_number: 2789" in workflow
    assert "github.rest.issues.createComment" in workflow
    assert "live-run-manifest.json" in workflow
    assert "source-observations.v1.json" in workflow
    assert "coverage-assessment.json" in workflow
    assert "Per-source diagnostic result" in workflow
    assert "Temporary reporter" in workflow
