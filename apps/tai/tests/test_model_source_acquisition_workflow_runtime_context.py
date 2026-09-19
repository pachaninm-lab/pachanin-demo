from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-source-acquisition.yml"
SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3-source-acquisition-workflow-fix-2835.json"
)

EXPECTED_PATHS = {
    ".github/workflows/tai-model-source-acquisition.yml",
    "apps/tai/governance/scopes/ap-13b3-source-acquisition-workflow-fix-2835.json",
    "apps/tai/tests/test_model_source_acquisition_workflow_runtime_context.py",
}


def _load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def test_repair_scope_is_exact_and_does_not_expand_maturity() -> None:
    scope = _load(SCOPE_PATH)

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3-source-acquisition-workflow-fix"
    assert scope["status"] == "active"
    assert scope["parent_issue"] == 2726
    assert scope["issue"] == 2835
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "automated legal approval or rejection" in scope["forbidden_capabilities"]
    assert (
        "production readiness or operational attestation claim"
        in scope["forbidden_capabilities"]
    )


def test_job_env_does_not_use_runner_context() -> None:
    workflow = _workflow()
    env_block = workflow[
        workflow.index("    env:\n") : workflow.index("\n\n    steps:\n")
    ]

    assert "${{ runner.temp }}" not in workflow
    assert "ORIGINAL_ROOT:" not in env_block
    assert "RESTORE_ROOT:" not in env_block
    assert "EVIDENCE_ROOT: model-source-evidence/${{ matrix.key }}" in env_block
    assert "SELECTED_MARGIN_BYTES: 25000000000" in env_block


def test_ephemeral_roots_are_exported_at_step_runtime() -> None:
    workflow = _workflow()
    start = workflow.index("      - name: Prepare ephemeral source roots")
    end = workflow.index("\n\n      - name: Setup Python", start)
    step = workflow[start:end]

    assert '"$RUNNER_TEMP/tai-${{ matrix.key }}-original"' in step
    assert '"$RUNNER_TEMP/tai-${{ matrix.key }}-restore"' in step
    assert '>> "$GITHUB_ENV"' in step
    assert "ORIGINAL_ROOT=%s" in step
    assert "RESTORE_ROOT=%s" in step


def test_owner_trigger_and_exact_main_guard_remain_unchanged() -> None:
    workflow = _workflow()

    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.number == 2835" in workflow
    assert (
        "github.event.comment.body == '/tai acquire model-sources exact-main'"
        in workflow
    )
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.event.comment.user.login == github.repository_owner" in workflow
    assert 'test "$GITHUB_REF" = \'refs/heads/main\'' in workflow
    assert (
        'test "$(git -C repository rev-parse refs/remotes/origin/main)" = '
        '"$GITHUB_SHA"'
        in workflow
    )


def test_acquisition_evidence_and_cleanup_contract_remain_intact() -> None:
    workflow = _workflow()

    required_tokens = (
        "reconcile-inventory",
        "download-plan",
        "collect-source",
        "legal-packet",
        "verify-restore",
        "assemble-report",
        "selected_bytes * 2 + SELECTED_MARGIN_BYTES",
        'rm -rf "$ORIGINAL_ROOT" "$RESTORE_ROOT"',
        "Large source bytes entered the metadata evidence directory.",
        "PENDING_HUMAN_DECISION",
        "AUTOMATION_MUST_NOT_APPROVE_OR_REJECT",
        "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING",
        "production_operational_status'] == 'NOT_ATTESTED'",
    )
    for token in required_tokens:
        assert token in workflow

    assert workflow.count("--continue-at - --output") == 2
    assert workflow.count("retention-days: 90") == 2
    assert workflow.count("compression-level: 0") == 2
    assert workflow.count("overwrite: false") == 2


def test_fix_does_not_add_model_execution_or_admission() -> None:
    workflow = _workflow()

    forbidden = (
        "convert_hf_to_gguf.py",
        "llama-quantize",
        "docker push",
        "oras push",
        "production_operational_status=ATTESTED",
    )
    for token in forbidden:
        assert token not in workflow
