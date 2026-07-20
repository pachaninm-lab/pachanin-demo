from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).parents[3]
WORKFLOW_PATH = (
    ROOT / ".github" / "workflows" / "tai-llama-toolchain-acceptance-handoff.yml"
)
SCOPE_PATH = (
    Path(__file__).parents[1]
    / "governance"
    / "scopes"
    / "ap-13b2b-acceptance-handoff-2832.json"
)

EXPECTED_PATHS = {
    ".github/workflows/tai-llama-toolchain-acceptance-handoff.yml",
    "apps/tai/governance/scopes/ap-13b2b-acceptance-handoff-2832.json",
    "apps/tai/tests/test_llama_toolchain_acceptance_handoff_workflow.py",
}
AUTHORITY_SHA256 = "3064250e63baed7bdcfd20851e1d3ea2c86fc33f087b69a2a4fcff18c384374b"
LLAMA_COMMIT = "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3"


def workflow_text() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def test_scope_is_exact_and_preserves_the_acceptance_boundary() -> None:
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b2b-build-acceptance-handoff"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2832
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert any(
        "separate exact-head and exact-main acceptance PR" in item
        for item in scope["acceptance"]
    )
    assert "production readiness or operational attestation claim" in scope[
        "forbidden_capabilities"
    ]


def test_handoff_is_bound_only_to_the_trusted_completed_build_workflow() -> None:
    workflow = workflow_text()

    assert "workflow_run:" in workflow
    assert "TAI llama.cpp Exact Source Build" in workflow
    assert "types:\n      - completed" in workflow
    assert "pull_request:" not in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "workflow_dispatch:" not in workflow
    assert "issue_comment:" not in workflow.split("permissions:", 1)[0]
    assert "github.event.workflow_run.conclusion == 'success'" in workflow
    assert "github.event.workflow_run.status == 'completed'" in workflow
    assert "github.event.workflow_run.event == 'issue_comment'" in workflow
    assert "github.event.workflow_run.head_branch == 'main'" in workflow
    assert "SOURCE_WORKFLOW_PATH: .github/workflows/tai-llama-toolchain-build.yml" in workflow


def test_handoff_has_only_required_read_and_issue_comment_permissions() -> None:
    workflow = workflow_text()

    assert "permissions:\n  contents: read\n  actions: read\n  issues: write" in workflow
    for forbidden in (
        "contents: write",
        "pull-requests: write",
        "packages: write",
        "id-token: write",
        "secrets.",
    ):
        assert forbidden not in workflow
    assert workflow.count("persist-credentials: false") == 1


def test_source_run_and_artifact_identity_are_checked_fail_closed() -> None:
    workflow = workflow_text()

    required = (
        "SOURCE_RUN_ID_MISMATCH",
        "SOURCE_WORKFLOW_NAME_MISMATCH",
        "SOURCE_WORKFLOW_PATH_MISMATCH",
        "SOURCE_RUN_NOT_COMPLETED",
        "SOURCE_RUN_NOT_SUCCESSFUL",
        "SOURCE_EVENT_NOT_ISSUE_COMMENT",
        "SOURCE_BRANCH_NOT_MAIN",
        "SOURCE_HEAD_SHA_EVENT_MISMATCH",
        "SOURCE_REPOSITORY_MISMATCH",
        "SOURCE_HEAD_REPOSITORY_MISMATCH",
        "SOURCE_ACTOR_NOT_OWNER",
        "SOURCE_TRIGGERING_ACTOR_NOT_OWNER",
        "SOURCE_RUN_NOT_CURRENT_EXACT_MAIN",
        "CHECKOUT_SHA_MISMATCH",
        "CHECKOUT_NOT_CLEAN",
        "LOCATOR_ARTIFACT_CARDINALITY_INVALID",
        "PACKAGE_ARTIFACT_CARDINALITY_INVALID",
    )
    for reason in required:
        assert reason in workflow
    assert 're.fullmatch(r"[0-9a-f]{40}", expected_head_sha)' in workflow
    assert "repos/$REPOSITORY/git/ref/heads/main" in workflow
    assert "actions/runs/$RUN_ID/artifacts?per_page=100" in workflow


def test_handoff_downloads_only_the_small_locator_artifact() -> None:
    workflow = workflow_text()
    download_step = workflow[
        workflow.index("      - name: Download only the locator artifact") :
        workflow.index("      - name: Verify restored locator and create acceptance handoff")
    ]

    assert 'actions/artifacts/$LOCATOR_ID/zip' in download_step
    assert "locator.zip" in download_step
    assert "package-index.v1.json" in download_step
    assert "restored-verification.v1.json" in download_step
    assert "llama-cpp-build-artifact-locator.v1.json" in download_step
    assert "PACKAGE_ARTIFACT_ID" not in download_step
    assert "llama-cpp-b9637-evidence.tar.gz" not in download_step
    assert "llama-cli" not in download_step
    assert "llama-server" not in download_step
    assert "llama-quantize" not in download_step
    assert "llama-bench" not in download_step


def test_locator_restore_and_exact_authority_are_independently_verified() -> None:
    workflow = workflow_text()

    assert "tai.llama-cpp-build-artifact-locator.v1" in workflow
    assert "VERIFIED_RESTORED" in workflow
    assert "tai.llama-cpp-build-package-index.v1" in workflow
    assert "PACKAGED" in workflow
    assert "RESTORED_STATUS_INVALID" in workflow
    assert 'restored.get("reasons") == []' in workflow
    assert AUTHORITY_SHA256 in workflow
    assert "LLAMA_RELEASE: b9637" in workflow
    assert f"LLAMA_COMMIT: {LLAMA_COMMIT}" in workflow
    assert "BUILD_PROFILE: linux-x86_64-cpu-release-static-v1" in workflow
    for target in ("llama-bench", "llama-cli", "llama-quantize", "llama-server"):
        assert f'"{target}"' in workflow
    assert "PACKAGE_INDEX_HASH_MISMATCH" in workflow
    assert "RESTORED_REPORT_HASH_MISMATCH" in workflow
    assert "LOCATOR_PACKAGE_API_DIGEST_MISMATCH" in workflow


def test_handoff_is_machine_readable_duplicate_safe_and_not_an_acceptance_claim() -> None:
    workflow = workflow_text()

    assert "tai.llama-cpp-build-acceptance-handoff.v1" in workflow
    assert "VERIFIED_BUILD_READY_FOR_ACCEPTANCE_PR" in workflow
    assert "separate_pull_request_required" in workflow
    assert "exact_head_and_exact_main_gates_required" in workflow
    assert "close_issue_only_after_merge" in workflow
    assert "tai-llama-cpp-build-acceptance-handoff:v1" in workflow
    assert 'test "$duplicate_count" = \'0\'' in workflow
    assert "len(body.encode(\"utf-8\")) < 60000" in workflow
    assert '"production_operational_status": "NOT_ATTESTED"' in workflow
    assert '"model_admission_status": "NOT_DONE"' in workflow
    assert '"model_acquisition_status": "PENDING_ACQUISITION"' in workflow
    assert "ADMITTED" not in workflow
    assert "contents: write" not in workflow
    assert "gh pr create" not in workflow
    assert "git push" not in workflow
