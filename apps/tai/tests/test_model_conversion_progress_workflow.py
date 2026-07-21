from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-conversion-progress.yml"
SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3d3-conversion-progress-2932.json"
)
COMMAND = "/tai diagnose model-progress exact-main"
EXPECTED_PATHS = {
    ".github/workflows/tai-model-conversion-progress.yml",
    "apps/tai/governance/scopes/ap-13b3d3-conversion-progress-2932.json",
    "apps/tai/tests/test_model_conversion_progress_workflow.py",
}


def _scope() -> dict[str, object]:
    payload = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def _remote_script(workflow: str) -> str:
    start = workflow.index("remote_script=\"$(cat <<'REMOTE'")
    end = workflow.index("          REMOTE", start)
    return workflow[start:end]


def test_progress_scope_is_narrow_and_preserves_maturity() -> None:
    scope = _scope()
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "fix/tai-conversion-progress-feed-2950"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2932,
        2950,
    )
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert "model-host mutation, process signalling or conversion execution" in scope[
        "forbidden_capabilities"
    ]
    assert "command and bounded result are isolated in dedicated issue 2950" in scope[
        "acceptance"
    ]
    assert "production_operational_status remains NOT_ATTESTED" in scope[
        "acceptance"
    ]


def test_progress_is_owner_only_exact_main_and_non_automatic() -> None:
    workflow = _workflow()
    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "workflow_dispatch:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.number == 2950" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "contents: read\n  issues: write" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    assert '"repos/$REPOSITORY/issues/2950/comments"' in workflow
    assert '"repos/$REPOSITORY/issues/2932/comments"' not in workflow


def test_transport_is_key_only_and_has_no_production_fallback() -> None:
    workflow = _workflow()
    for secret in (
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_USER",
        "TAI_MODEL_SSH_PORT",
        "TAI_MODEL_SSH_KEY",
    ):
        assert secret in workflow
    for forbidden in (
        "TAI_MODEL_SSH_PASSWORD",
        "PC_PROD_HOST",
        "PC_PROD_SSH_USER",
        "PC_PROD_SSH_KEY",
        "PC_PROD_SSH_PASSWORD",
        "VPS_SSH_KEY",
        "VPS_SSH_PASSWORD",
        "195.19.12.120",
        "sshpass",
    ):
        assert forbidden not in workflow
    assert "test \"$user\" = 'tai-model'" in workflow
    assert "BatchMode=yes" in workflow
    assert "StrictHostKeyChecking=yes" in workflow


def test_remote_progress_probe_is_read_only_and_empty_state_safe() -> None:
    workflow = _workflow()
    remote = _remote_script(workflow)
    assert "MUTATION_MODE=READ_ONLY" in remote
    assert "/srv/tai-models/conversion-runs" in remote
    assert "sed -n '1p'" in remote
    assert "LATEST_RUN=ABSENT" in remote
    assert "kill -0" in remote
    assert "DRIVER_PID_STATE" in remote
    assert "SOURCE_FILES" in remote
    assert "SOURCE_BYTES" in remote
    assert "PARTIAL_FILES" in remote
    assert "PARTIAL_BYTES" in remote
    assert "ACTIVE_LOG_PATH" in remote
    assert "ACTIVE_LOG_LAST_LINE" in remote
    assert "STEP_COMPLETE" in remote
    assert "STEP_FAILED" in remote
    assert "while IFS= read -r record" in remote
    assert "ARTIFACT_COUNT" in remote
    assert "ARTIFACT_BYTES" in remote
    assert "ARTIFACT_LIST" in remote
    assert "cut -c1-1000" in remote
    assert "cut -c1-4000" in remote
    for forbidden in (
        " rm ",
        " mv ",
        " cp ",
        " mkdir ",
        " install ",
        " chmod ",
        " chown ",
        " touch ",
        " truncate ",
        " curl ",
        " wget ",
        " docker ",
        " systemctl ",
        " sudo ",
        "kill -1",
        "kill -2",
        "kill -9",
        "kill -15",
    ):
        assert forbidden not in remote


def test_progress_evidence_is_metadata_only_and_bounded() -> None:
    workflow = _workflow()
    upload = workflow[workflow.index("Upload bounded progress evidence") :]
    assert "model-conversion-progress" in upload
    assert "retention-days: 30" in upload
    assert "compression-level: 0" in upload
    assert "overwrite: false" in upload
    assert "include-hidden-files: false" in upload
    assert "stat -c %s \"$REPORT_ROOT/progress.json\"" in workflow
    assert "-le 50000" in workflow
    assert "stat -c %s \"$REPORT_ROOT/summary.md\"" in workflow
    assert "-le 15000" in workflow
    assert "*.gguf" not in upload
    assert "safetensors" not in upload
    assert "sources/" not in upload
    assert "benchmark: `NOT_RUN`" in workflow
    assert "model admission: `NOT_DONE`" in workflow
    assert "production operational status: `NOT_ATTESTED`" in workflow
