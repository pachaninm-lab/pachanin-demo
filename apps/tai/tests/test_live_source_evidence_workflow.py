from __future__ import annotations

from pathlib import Path


def test_live_evidence_workflow_is_read_only_exact_main_and_non_merge_blocking() -> None:
    workflow = (
        Path(__file__).parents[3]
        / ".github"
        / "workflows"
        / "tai-live-source-evidence.yml"
    ).read_text(encoding="utf-8")

    assert "workflow_dispatch:" in workflow
    assert "schedule:" in workflow
    assert "pull_request:" not in workflow
    assert "push:" not in workflow
    assert "permissions:\n  contents: read" in workflow
    assert "actions: read" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    assert "id-token: write" not in workflow
    assert "secrets." not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert 'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"' in workflow
    assert 'test "$(git rev-parse refs/remotes/origin/main)" = "$GITHUB_SHA"' in workflow
    assert "select(.workflow_run.head_branch == \"main\")" in workflow
    assert "gh api --paginate --slurp" in workflow
    assert "ref: ${{ github.sha }}" in workflow
    assert "ref: main" not in workflow
    assert "mkdir -p live-evidence" in workflow
    assert '--repository-sha "$GITHUB_SHA"' in workflow
    assert "actions/upload-artifact@v4" in workflow
    assert "tai-live-official-source-v2-${{ github.sha }}" in workflow
    assert workflow.index("Upload exact-main live evidence") < workflow.index(
        "Enforce collector structural validity"
    )
    assert "test -f live-evidence/live-run-manifest.json" in workflow
    assert "source-health-history.v1.json" in workflow
    assert "source-health-dashboard.v1.json" in workflow
    assert "active-alerts.v1.json" in workflow
    assert "knowledge-acceptance.v1.json" in workflow
    assert "evidence-bundle-index.v1.json" in workflow
    assert "--require-complete-coverage" in workflow
    assert "github.token" in workflow
    assert "continue-on-error" not in workflow
