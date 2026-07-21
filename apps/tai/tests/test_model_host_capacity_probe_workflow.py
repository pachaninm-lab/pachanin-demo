from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-host-capacity-probe.yml"
SCOPE_PATH = (
    Path(__file__).parents[1]
    / "governance"
    / "scopes"
    / "ap-13b3-model-host-probe-2835.json"
)

EXPECTED_PATHS = {
    ".github/workflows/tai-model-host-capacity-probe.yml",
    "apps/tai/governance/scopes/ap-13b3-model-host-probe-2835.json",
    "apps/tai/tests/test_model_host_capacity_probe_workflow.py",
}
COMMAND = "/tai probe model-host exact-main"
QWEN_REVISION = "895c8d171bc03c30e113cd7a28c02494b5e068b7"
MISTRAL_REVISION = "c170c708c41dac9275d15a8fff4eca08d52bab71"


def _scope() -> dict[str, Any]:
    return json.loads(SCOPE_PATH.read_text(encoding="utf-8"))


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def _remote_script(workflow: str) -> str:
    start_marker = "remote_script=\"$(cat <<'REMOTE'"
    end_marker = "          REMOTE\n          )\""
    start = workflow.index(start_marker) + len(start_marker)
    end = workflow.index(end_marker, start)
    return workflow[start:end]


def test_scope_is_exact_and_preserves_the_maturity_boundary() -> None:
    scope = _scope()

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3-model-host-probe"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2835
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "model, tokenizer, weight, license or GGUF download" in scope[
        "forbidden_capabilities"
    ]
    assert "production readiness or operational attestation claim" in scope[
        "forbidden_capabilities"
    ]


def test_workflow_is_owner_only_issue_bound_exact_main_and_non_automatic() -> None:
    workflow = _workflow()

    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "pull_request:" not in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "workflow_dispatch:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.pull_request == null" in workflow
    assert "github.event.issue.number == 2835" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.event.comment.user.login == github.repository_owner" in workflow
    assert "cancel-in-progress: false" in workflow
    assert 'test "$(git rev-parse refs/remotes/origin/main)" = "$GITHUB_SHA"' in workflow


def test_workflow_permissions_and_credentials_are_bounded() -> None:
    workflow = _workflow()

    assert "permissions:\n  contents: read\n  actions: read\n  issues: write" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    assert "id-token: write" not in workflow
    assert "packages: write" not in workflow
    for secret_name in (
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_USER",
        "TAI_MODEL_SSH_PORT",
        "TAI_MODEL_SSH_KEY",
        "TAI_MODEL_SSH_PASSWORD",
    ):
        assert secret_name in workflow
    for forbidden_secret in (
        "PC_PROD_HOST",
        "PC_PROD_SSH_USER",
        "PC_PROD_SSH_PORT",
        "PC_PROD_SSH_KEY",
        "PC_PROD_SSH_PRIVATE_KEY",
        "PC_PROD_SSH_PASSWORD",
        "VPS_SSH_KEY",
        "VPS_SSH_PASSWORD",
    ):
        assert forbidden_secret not in workflow
    assert "persist-credentials: false" in workflow
    assert (
        "No supported protected TAI model-host SSH credential is configured"
        in workflow
    )


def test_remote_script_is_read_only_and_probes_exact_revision_endpoints() -> None:
    workflow = _workflow()
    remote = _remote_script(workflow)

    assert "MUTATION_MODE=READ_ONLY" in remote
    assert "PROBE_COMPLETE=true" in remote
    assert "docker info" in remote
    assert "df -P -B1" in remote
    assert "curl -sSIL" in remote
    assert QWEN_REVISION in remote
    assert MISTRAL_REVISION in remote
    for command_name in (
        "curl",
        "git",
        "python3",
        "sha256sum",
        "tar",
        "gzip",
        "zstd",
        "cmake",
        "ninja",
        "cc",
        "c++",
        "docker",
        "jq",
    ):
        assert command_name in remote

    forbidden_remote_tokens = (
        "mkdir ",
        "rm ",
        "mv ",
        "cp ",
        "touch ",
        "chmod ",
        "chown ",
        "apt-get",
        "dnf ",
        "yum ",
        "docker pull",
        "docker run",
        "docker compose",
        "docker restart",
        "systemctl ",
        "service ",
        "curl --output",
        "curl -o ",
    )
    for token in forbidden_remote_tokens:
        assert token not in remote


def test_workflow_emits_bounded_evidence_and_fails_closed() -> None:
    workflow = _workflow()

    assert "tai.model-host-capacity-probe.v1" in workflow
    assert "model-host-capacity-probe.v1.json" in workflow
    assert "actions/upload-artifact@v4" in workflow
    assert "retention-days: 30" in workflow
    assert "compression-level: 0" in workflow
    assert "overwrite: false" in workflow
    assert "include-hidden-files: false" in workflow
    assert "status': 'COMPLETE' if completed else 'FAILED_CLOSED'" in workflow
    assert "model_acquisition': 'PENDING_ACQUISITION'" in workflow
    assert "legal_review': 'NOT_DONE'" in workflow
    assert "conversion': 'NOT_DONE'" in workflow
    assert "quantization': 'NOT_DONE'" in workflow
    assert "production_operational_status': 'NOT_ATTESTED'" in workflow
    assert "assert report['status'] == 'COMPLETE'" in workflow
    assert "assert report['mutation_mode'] == 'READ_ONLY'" in workflow
    assert "assert report['remote_exit_code'] == 0" in workflow


def test_issue_summary_does_not_publish_credentials_or_remote_stderr() -> None:
    workflow = _workflow()
    summary = workflow[
        workflow.index("      - name: Publish bounded issue summary") : workflow.index(
            "      - name: Enforce completed read-only probe"
        )
    ]

    assert "SSH_PASSWORD" not in summary
    assert "SSH_KEY" not in summary
    assert "stderr" not in summary
    assert "No directory, package, model, container or production service was changed" in summary
    assert "issues/2835/comments" in summary
