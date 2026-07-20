from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-source-acquisition.yml"
SCOPE_PATH = (
    Path(__file__).parents[1]
    / "governance"
    / "scopes"
    / "ap-13b3-source-acquisition-2835.json"
)

EXPECTED_PATHS = {
    ".github/workflows/tai-model-source-acquisition.yml",
    "apps/tai/governance/scopes/ap-13b3-source-acquisition-2835.json",
    "apps/tai/tai/model_source_acquisition.py",
    "apps/tai/tai/model_source_acquisition_cli.py",
    "apps/tai/tests/test_model_source_acquisition.py",
    "apps/tai/tests/test_model_source_acquisition_workflow.py",
}
COMMAND = "/tai acquire model-sources exact-main"


def _scope() -> dict[str, Any]:
    return json.loads(SCOPE_PATH.read_text(encoding="utf-8"))


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def test_scope_is_exact_and_preserves_legal_and_maturity_boundaries() -> None:
    scope = _scope()

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3-source-acquisition"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2835
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "automated APPROVED or REJECTED legal decision" in scope[
        "forbidden_capabilities"
    ]
    assert "production readiness or operational attestation claim" in scope[
        "forbidden_capabilities"
    ]


def test_workflow_is_owner_only_exact_main_and_issue_bound() -> None:
    workflow = _workflow()

    assert "workflow_dispatch:" in workflow
    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "pull_request:" not in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.pull_request == null" in workflow
    assert "github.event.issue.number == 2835" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.event.comment.user.login == github.repository_owner" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "test \"$(git -C repository rev-parse refs/remotes/origin/main)\" = \"$GITHUB_SHA\"" in workflow


def test_workflow_has_bounded_permissions_and_exact_model_matrix() -> None:
    workflow = _workflow()

    assert "permissions:\n  actions: read\n  contents: read\n  issues: write" in workflow
    assert "contents: write" not in workflow
    assert "packages: write" not in workflow
    assert "id-token: write" not in workflow
    assert "secrets." not in workflow
    assert "Qwen/Qwen3-8B" in workflow
    assert "895c8d171bc03c30e113cd7a28c02494b5e068b7" in workflow
    assert "mistralai/Mistral-7B-Instruct-v0.3" in workflow
    assert "c170c708c41dac9275d15a8fff4eca08d52bab71" in workflow
    assert "https://www.apache.org/licenses/LICENSE-2.0.txt" in workflow


def test_workflow_reconciles_downloads_hashes_and_cleanly_restores() -> None:
    workflow = _workflow()

    assert "reconcile-inventory" in workflow
    assert "download-plan" in workflow
    assert "collect-source" in workflow
    assert "legal-packet" in workflow
    assert "verify-restore" in workflow
    assert "assemble-report" in workflow
    assert workflow.count("--continue-at - --output") == 2
    assert workflow.count("--proto '=https' --tlsv1.2") >= 4
    assert "selected_bytes + SELECTED_MARGIN_BYTES" in workflow
    assert "test \"$available_bytes\" -ge \"$required_bytes\"" in workflow
    assert "test \"$memory_total_bytes\" -ge 12000000000" in workflow
    assert "test -z \"$(find \"$RESTORE_ROOT\" -mindepth 1 -print -quit)\"" in workflow
    assert "VERIFIED_SOURCE_RESTORED" in workflow


def test_workflow_never_uploads_source_bytes_and_keeps_legal_pending() -> None:
    workflow = _workflow()

    assert "rm -rf \"$ORIGINAL_ROOT\" \"$RESTORE_ROOT\"" in workflow
    assert "Large source bytes entered the metadata evidence directory." in workflow
    assert "actions/upload-artifact@v4" in workflow
    assert workflow.count("retention-days: 90") == 2
    assert workflow.count("compression-level: 0") == 2
    assert workflow.count("overwrite: false") == 2
    assert "source weights copied to Git or Actions artifact: `false`" in workflow
    assert "PENDING_HUMAN_DECISION" in workflow
    assert "AUTOMATION_MUST_NOT_APPROVE_OR_REJECT" in workflow
    assert "conversion_status'] == 'NOT_RUN'" in workflow
    assert "quantization_status'] == 'NOT_RUN'" in workflow
    assert "model_admission_status'] == 'NOT_DONE'" in workflow
    assert "production_operational_status'] == 'NOT_ATTESTED'" in workflow


def test_workflow_does_not_contain_conversion_quantization_or_model_publication() -> None:
    workflow = _workflow()

    forbidden = (
        "convert_hf_to_gguf.py",
        "llama-quantize",
        "oras push",
        "docker push",
        "ghcr.io/",
        "ADMITTED",
        "APPROVED",
        "REJECTED",
        "production_operational_status=ATTESTED",
    )
    for token in forbidden:
        assert token not in workflow
