from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-conversion-diagnostics.yml"
SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3d2-conversion-diagnostics-2932.json"
)
COMMAND = "/tai diagnose model-conversion exact-main"
EXPECTED_PATHS = {
    ".github/workflows/tai-model-conversion-diagnostics.yml",
    "apps/tai/governance/scopes/ap-13b3d2-conversion-diagnostics-2932.json",
    "apps/tai/tests/test_model_conversion_diagnostics_workflow.py",
}
REQUIRED_WORKFLOWS = {
    "Auction Atomic Execution Acceptance",
    "CI",
    "Dependency Review",
    "Disputes PostgreSQL Authority Acceptance",
    "Node CI",
    "Optional Runtime Retirement Gate",
    "Outbox PostgreSQL Authority Acceptance",
    "Runtime Context Security Gate",
    "Security Abuse and Evidence Acceptance",
    "Security Quality Gate",
    "Security Scan",
    "TAI Foundation",
}


def _scope() -> dict[str, object]:
    payload = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_diagnostics_scope_is_narrow_and_preserves_maturity() -> None:
    scope = _scope()
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "fix/tai-conversion-diagnostics"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2835,
        2932,
    )
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert "model-host mutation or conversion execution" in scope[
        "forbidden_capabilities"
    ]
    assert "production_operational_status remains NOT_ATTESTED" in scope[
        "acceptance"
    ]


def test_diagnostics_is_owner_only_exact_main_and_non_automatic() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "workflow_dispatch:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.number == 2932" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "actions: read\n  contents: read\n  issues: write" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow


def test_diagnostics_reports_release_acceptance_and_all_required_gates() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "TAI Release Acceptance" in workflow
    assert ".github/workflows/tai-release-acceptance.yml" in workflow
    assert "release_acceptance" in workflow
    assert "required_workflows" in workflow
    assert "failed required gates" in workflow
    assert "missing required gates" in workflow
    assert "pending required gates" in workflow
    for name in REQUIRED_WORKFLOWS:
        assert name in workflow


def test_model_host_transport_is_key_only_and_has_no_production_fallback() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
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


def test_remote_diagnostics_is_read_only_and_bounded() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    start = workflow.index("remote_script=\"$(cat <<'REMOTE'")
    end = workflow.index("          REMOTE", start)
    remote = workflow[start:end]
    assert "MUTATION_MODE=READ_ONLY" in remote
    assert "/srv/tai-models/conversion-runs" in remote
    assert "find \"$root\"" in remote
    assert "-name status.json" in remote
    assert "tail -n 40" in remote
    assert "head -5" in remote
    assert "head -c 4000" in remote
    assert "head -c 12000" in remote
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
    ):
        assert forbidden not in remote
    assert "stat -c %s \"$REPORT_ROOT/diagnostics.json\"" in workflow
    assert "-le 100000" in workflow
    assert "stat -c %s \"$REPORT_ROOT/summary.md\"" in workflow
    assert "-le 50000" in workflow


def test_diagnostics_keeps_large_artifacts_and_maturity_out_of_scope() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    upload = workflow[workflow.index("Upload bounded diagnostic evidence") :]
    assert "model-conversion-diagnostics" in upload
    assert "*.gguf" not in upload
    assert "safetensors" not in upload
    assert "sources/" not in upload
    assert "retention-days: 30" in upload
    assert "compression-level: 0" in upload
    assert "overwrite: false" in upload
    assert "benchmark: `NOT_RUN`" in workflow
    assert "model admission: `NOT_DONE`" in workflow
    assert "production operational status: `NOT_ATTESTED`" in workflow
