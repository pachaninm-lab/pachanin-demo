from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-hf-exact-inventory.yml"
AUTHORITY_PATH = TAI_ROOT / "model-artifacts" / "model-bundle-authority.v2.json"
SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3-exact-inventory-evidence-2835.json"
)

EXPECTED_PATHS = {
    ".github/workflows/tai-hf-exact-inventory.yml",
    "apps/tai/governance/scopes/ap-13b3-exact-inventory-evidence-2835.json",
    "apps/tai/tests/test_hf_exact_inventory_workflow.py",
}
EXPECTED_MODELS = {
    "Qwen/Qwen3-8B": "PRIMARY",
    "mistralai/Mistral-7B-Instruct-v0.3": "FALLBACK",
}


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def _authority_plans() -> dict[str, Any]:
    authority = _load(AUTHORITY_PATH)
    assert authority["schema_version"] == "tai.model-bundle-authority.v2"
    return {item["model_id"]: item for item in authority["models"]}


def test_scope_is_exact_and_forbids_maturity_inflation() -> None:
    scope = _load(SCOPE_PATH)

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3-exact-inventory-evidence"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2835
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert (
        "model weight, tokenizer, configuration, model-card or GGUF byte download"
        in scope["forbidden_capabilities"]
    )
    assert (
        "automatic legal approval or legal decision inference"
        in scope["forbidden_capabilities"]
    )
    assert (
        "production readiness or operational attestation claim"
        in scope["forbidden_capabilities"]
    )


def test_authority_contains_only_two_exact_immutable_candidates() -> None:
    plans = _authority_plans()

    assert {model_id: plan["role"] for model_id, plan in plans.items()} == EXPECTED_MODELS
    revisions = [plan["revision"] for plan in plans.values()]
    assert len(revisions) == len(set(revisions)) == 2
    for plan in plans.values():
        revision = plan["revision"]
        assert isinstance(revision, str)
        assert len(revision) == 40
        assert all(character in "0123456789abcdef" for character in revision)
        assert revision in plan["source_uri"]
        assert revision in plan["model_card_uri"]


def test_workflow_is_owner_only_exact_main_and_command_bound() -> None:
    workflow = _workflow()

    assert "workflow_dispatch:" in workflow
    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "\n  pull_request:" not in workflow
    assert "\n  push:" not in workflow
    assert "\n  schedule:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.pull_request == null" in workflow
    assert "github.event.issue.number == 2835" in workflow
    assert (
        "github.event.comment.body == "
        "'/tai collect model-inventory exact-main'"
        in workflow
    )
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.event.comment.user.login == github.repository_owner" in workflow
    assert "cancel-in-progress: false" in workflow


def test_workflow_has_bounded_permissions_and_exact_checkout() -> None:
    workflow = _workflow()

    permissions = "permissions:\n  actions: read\n  contents: read\n  issues: write"
    assert permissions in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    assert "packages: write" not in workflow
    assert "id-token: write" not in workflow
    assert "persist-credentials: false" in workflow
    assert "ref: ${{ github.sha }}" in workflow
    assert 'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"' in workflow
    assert 'test "$GITHUB_REF" = \'refs/heads/main\'' in workflow
    assert (
        'test "$(git rev-parse refs/remotes/origin/main)" = "$GITHUB_SHA"'
        in workflow
    )


def test_workflow_derives_exact_revisions_from_the_accepted_authority() -> None:
    workflow = _workflow()
    plans = _authority_plans()

    assert "model_id: Qwen/Qwen3-8B" in workflow
    assert "model_id: mistralai/Mistral-7B-Instruct-v0.3" in workflow
    for plan in plans.values():
        assert plan["revision"] not in workflow
    assert 'plan = next(item for item in authority["models"]' in workflow
    assert 'revision = plan["revision"]' in workflow
    assert "len(revision) == 40" in workflow
    assert 'env_file.write(f"REVISION={revision}\\n")' in workflow
    assert "/revision/$REVISION?blobs=true" in workflow
    assert "EXACT_REVISION_MISMATCH" in workflow
    assert "AUTHORITY_PATH_ABSENT_UPSTREAM" in workflow
    assert "AUTHORITY_PATHS_MISSING" in workflow
    assert "UNGOVERNED_UPSTREAM_PATHS" in workflow
    assert "UPSTREAM_PATH_DUPLICATE" in workflow


def test_remote_inventory_matches_the_existing_v2_verifier_contract() -> None:
    workflow = _workflow()

    assert '"schema_version": "tai.remote-model-inventory-evidence.v1"' in workflow
    for key in (
        '"model_id": model_id',
        '"revision": revision',
        '"source_uri": plan["source_uri"]',
        '"observed_at": observed_at',
        '"entries": remote_entries',
        '"path": full_path',
        '"remote_identity": remote_identity',
        '"size_bytes": size',
    ):
        assert key in workflow
    assert "REMOTE_INVENTORY_ORDER_OR_SET_MISMATCH" in workflow
    assert "REMOTE_INVENTORY_TIMESTAMP_MISMATCH" in workflow


def test_selected_model_files_are_head_probed_not_downloaded() -> None:
    workflow = _workflow()
    step = workflow[
        workflow.index("      - name: Probe selected exact file endpoints with HEAD") :
        workflow.index("      - name: Finalize bounded inventory evidence")
    ]

    assert "curl --silent --show-error --location --head" in step
    assert "--output /dev/null" in step
    assert "test \"$status\" = '200'" in step
    assert "model-00001-of-00005.safetensors" not in step
    assert "model-00001-of-00003.safetensors" not in step
    for forbidden in (
        "snapshot_download",
        "huggingface-cli",
        "git lfs",
        "wget ",
        "docker pull",
        "curl --remote-name",
        "curl -O",
    ):
        assert forbidden not in workflow


def test_workflow_distinguishes_remote_identity_from_local_hash_evidence() -> None:
    workflow = _workflow()

    assert '"license_spdx_metadata": plan["license_spdx"]' in workflow
    assert '"local_source_hashes": "ABSENT"' in workflow
    assert '"model_acquisition": "NOT_RUN"' in workflow
    assert '"api_response_sha256"' in workflow
    assert '"remote_identity": remote_identity' in workflow
    assert "No model bytes were downloaded" in workflow
    assert "local SHA-256" in workflow


def test_artifacts_are_hashed_retained_and_independently_aggregated() -> None:
    workflow = _workflow()

    assert workflow.count("retention-days: 90") == 2
    assert "compression-level: 0" in workflow
    assert "overwrite: false" in workflow
    assert "tai.hf-exact-inventory-artifact-index.v1" in workflow
    assert "needs: collect" in workflow
    assert "Download exact run artifacts by API identity" in workflow
    assert "all(.expired == false and (.digest | startswith(\"sha256:\")))" in workflow
    assert "DECLARED_SIZE_MISMATCH" in workflow
    assert "DECLARED_SHA256_MISMATCH" in workflow
    assert "MODEL_CARDINALITY_OR_IDENTITY_MISMATCH" in workflow
    assert "tai.hf-exact-inventory-handoff.v1" in workflow
    assert "EXACT_REMOTE_INVENTORIES_RECONCILED" in workflow


def test_issue_handoff_is_bounded_and_does_not_close_the_acquisition_issue() -> None:
    workflow = _workflow()

    assert '"/repos/$GITHUB_REPOSITORY/issues/2835/comments"' in workflow
    assert "AP-13B.3 exact remote inventory handoff" in workflow
    assert "selected bytes" in workflow
    assert "exact endpoints HTTP 200" in workflow
    assert "legal approval" in workflow
    assert "model admission remain absent" in workflow
    assert "issues/2835/comments" in workflow
    assert "issues/2835" not in workflow.replace("issues/2835/comments", "")
    assert "--method PATCH" not in workflow
    assert '"state": "closed"' not in workflow


def test_maturity_boundary_remains_fail_closed() -> None:
    workflow = _workflow()
    required = (
        '"model_acquisition": "NOT_RUN"',
        '"local_source_hashes": "ABSENT"',
        '"legal_review": "NOT_DONE"',
        '"conversion": "NOT_DONE"',
        '"quantization": "NOT_DONE"',
        '"benchmarks": "NOT_DONE"',
        '"model_admission": "NOT_DONE"',
        '"production_operational_status": "NOT_ATTESTED"',
    )
    for value in required:
        assert value in workflow

    assert '"legal_review": "APPROVED"' not in workflow
    assert '"model_admission": "ADMITTED"' not in workflow
    assert '"production_operational_status": "ATTESTED"' not in workflow
