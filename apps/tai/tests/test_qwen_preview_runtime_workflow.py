from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "tai-qwen-preview-runtime.yml"
SCOPE = TAI_ROOT / "governance" / "scopes" / "ap-13c1f-qwen-preview-runtime-3003.json"
DRIVER = TAI_ROOT / "model-artifacts" / "qwen-preview-runtime-driver.v1.sh"
REMOTE = TAI_ROOT / "model-artifacts" / "qwen-preview-runtime-remote.v1.sh"
RUNBOOK = TAI_ROOT / "model-artifacts" / "qwen-preview-runtime-runbook.v1.md"
COMMAND = "/tai run qwen read-only preview exact-main"
EXPECTED_PATHS = {
    "docs/platform-v7/autopilot/autopilot-state.json",
    "apps/tai/governance/scopes/ap-13c1f-qwen-preview-runtime-3003.json",
    ".github/workflows/tai-qwen-preview-runtime.yml",
    "apps/tai/model-artifacts/qwen-preview-runtime-authority.v1.json",
    "apps/tai/model-artifacts/qwen-preview-runtime.schema.v1.json",
    "apps/tai/model-artifacts/qwen-preview-runtime.pending.json",
    "apps/tai/model-artifacts/qwen-preview-runtime-runbook.v1.md",
    "apps/tai/model-artifacts/qwen-preview-runtime-driver.v1.sh",
    "apps/tai/model-artifacts/qwen-preview-runtime-remote.v1.sh",
    "apps/tai/tai/qwen_preview_runtime.py",
    "apps/tai/tai/qwen_preview_runtime_cli.py",
    "apps/tai/tests/qwen_preview_runtime_fixtures.py",
    "apps/tai/tests/test_qwen_preview_runtime.py",
    "apps/tai/tests/test_qwen_preview_runtime_cli.py",
    "apps/tai/tests/test_qwen_preview_runtime_workflow.py",
}


def test_scope_is_exact_and_non_overlapping() -> None:
    scope = json.loads(SCOPE.read_text(encoding="utf-8"))
    assert scope["schema"] == "tai.concurrent-scope.v1"
    assert scope["issue"] == 3003
    assert scope["branch"] == "agent/tai-ap-13c1f-qwen-preview-runtime"
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    forbidden = " ".join(scope["forbidden"])
    assert "quality-scoring" in forbidden
    assert "web UI" in forbidden
    assert "Mistral or GPU" in forbidden
    assert "tool or write activation" in forbidden


def test_workflow_is_owner_only_exact_main_and_issue_bound() -> None:
    workflow = WORKFLOW.read_text(encoding="utf-8")
    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "workflow_dispatch:" not in workflow
    assert "schedule:" not in workflow
    assert "push:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.number == 3003" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "actions: read\n  contents: read\n  issues: write" in workflow
    assert "contents: write" not in workflow


def test_exact_main_and_tests_precede_protected_access() -> None:
    workflow = WORKFLOW.read_text(encoding="utf-8")
    checkout = workflow.index("- name: Checkout exact main authority")
    exact_main = workflow.index("- name: Assert exact-main immutable checkout")
    setup = workflow.index("- name: Setup Python")
    validate = workflow.index("- name: Validate authority before protected access")
    execute = workflow.index("- name: Execute governed dedicated-host Qwen preview")
    assert checkout < exact_main < setup < validate < execute
    protected = workflow[execute:]
    for secret in (
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_USER",
        "TAI_MODEL_SSH_PORT",
        "TAI_MODEL_SSH_KEY",
    ):
        assert secret in protected
        assert secret not in workflow[:execute]
    for forbidden in (
        "PC_PROD_HOST",
        "PC_PROD_SSH_USER",
        "PC_PROD_SSH_KEY",
        "TAI_MODEL_SSH_PASSWORD",
        "VPS_SSH_PASSWORD",
    ):
        assert forbidden not in workflow


def test_artifact_is_bounded_and_never_contains_raw_material() -> None:
    workflow = WORKFLOW.read_text(encoding="utf-8")
    upload = workflow[workflow.index("Upload bounded preview evidence") :]
    assert "qwen-preview-runtime-evidence.json" in upload
    assert "verified-report.json" in upload
    assert "retention-days: 90" in upload
    assert "compression-level: 0" in upload
    assert "overwrite: false" in upload
    assert "include-hidden-files: false" in upload
    for forbidden in ("*.gguf", "raw/", "response-", "prompt-", "llama-server.log"):
        assert forbidden not in upload


def test_driver_uses_only_dedicated_model_host_and_bounded_evidence() -> None:
    driver = DRIVER.read_text(encoding="utf-8")
    assert '[[ "$MODEL_SSH_USER" == "tai-model" ]]' in driver
    assert "/srv/tai-models/preview-runs/" in driver
    assert "ssh-keyscan" in driver
    assert "StrictHostKeyChecking=yes" in driver
    assert "qwen-preview-runtime-evidence.json" in driver
    assert "verify-evidence" in driver
    for forbidden in (
        "sudo ",
        "systemctl ",
        "docker run",
        "docker pull",
        "PC_PROD_",
        "netlify",
        "vercel",
    ):
        assert forbidden.casefold() not in driver.casefold()


def test_remote_is_loopback_read_only_and_cleans_up() -> None:
    remote = REMOTE.read_text(encoding="utf-8")
    assert "HOST=127.0.0.1" in remote
    assert "PORT=18080" in remote
    assert "--parallel 1" in remote
    assert "--ctx-size 4096" in remote
    assert '"max_tokens": 128' in remote
    assert '"enable_thinking": False' in remote
    assert "listener_already_present" in remote
    assert "public_listener_detected" in remote
    assert "rm -rf \"$RAW_ROOT\"" in remote
    assert "listener_cleanup_failed" in remote
    assert "rollback_verified" in remote
    assert "RU\t" in remote and "EN\t" in remote and "ZH\t" in remote
    for forbidden in (
        "0.0.0.0",
        "--host ::",
        "systemctl",
        "sudo ",
    ):
        assert forbidden.casefold() not in remote.casefold()


def test_runbook_preserves_maturity_and_documents_rollback() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    assert COMMAND in runbook
    assert "READ_ONLY_OPERATIONAL_PREVIEW_PENDING_EXTERNAL_IMMUTABILITY" in runbook
    assert "PENDING_BENCHMARK" in runbook
    assert "PENDING_ADMISSION" in runbook
    assert "NOT_ACTIVATED" in runbook
    assert "NOT_ATTESTED" in runbook
    assert "raw" in runbook
    assert "Cleanup and rollback" in runbook
