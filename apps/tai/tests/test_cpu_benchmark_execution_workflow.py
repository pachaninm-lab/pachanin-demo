from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "tai-cpu-benchmark-execution-authority.yml"
AUTHORITY = TAI_ROOT / "model-artifacts" / "cpu-benchmark-execution-authority.v1.json"
RUNBOOK = TAI_ROOT / "model-artifacts" / "cpu-benchmark-execution-runbook.v1.md"
SCOPE = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13c1a-cpu-benchmark-authority-2977.json"
)
RUNTIME_FIX_SCOPE = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13c1b-exact-main-workflow-fix-2981.json"
)
COMMAND = "/tai benchmark cpu-fallback exact-main"
EXPECTED_PATHS = {
    ".gitleaksignore",
    ".github/workflows/tai-cpu-benchmark-execution-authority.yml",
    "apps/tai/governance/scopes/ap-13c1a-cpu-benchmark-authority-2977.json",
    "apps/tai/model-artifacts/cpu-benchmark-execution-authority.v1.json",
    "apps/tai/model-artifacts/cpu-benchmark-execution-runbook.v1.md",
    "apps/tai/tai/cpu_benchmark_execution.py",
    "apps/tai/tai/cpu_benchmark_execution_cli.py",
    "apps/tai/tests/test_cpu_benchmark_execution.py",
    "apps/tai/tests/test_cpu_benchmark_execution_cli.py",
    "apps/tai/tests/test_cpu_benchmark_execution_workflow.py",
    "apps/tai/tests/test_gitleaks_release_authority.py",
}
RUNTIME_FIX_PATHS = {
    ".github/workflows/tai-cpu-benchmark-execution-authority.yml",
    "apps/tai/governance/scopes/ap-13c1b-exact-main-workflow-fix-2981.json",
    "apps/tai/tests/test_cpu_benchmark_execution_workflow.py",
}


def _json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def test_scope_is_exact_and_preserves_maturity_boundary() -> None:
    scope = _json(SCOPE)
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13c1a-cpu-benchmark-authority"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2971,
        2977,
    )
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert ".gitleaksignore" in scope["allowed_paths"]
    assert "apps/tai/tests/test_gitleaks_release_authority.py" in scope["allowed_paths"]
    assert "broad secret-scanner suppression" in " ".join(
        scope["forbidden_capabilities"]
    )
    assert "model weights" in " ".join(scope["forbidden_capabilities"])
    assert "production_operational_status remains NOT_ATTESTED" in scope["acceptance"][-1]


def test_runtime_fix_scope_is_bounded_and_preserves_maturity() -> None:
    scope = _json(RUNTIME_FIX_SCOPE)
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13c1b-exact-main-workflow-fix"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2977,
        2981,
    )
    assert set(scope["allowed_paths"]) == RUNTIME_FIX_PATHS
    assert "weakening or removing exact-main SHA" in " ".join(
        scope["forbidden_capabilities"]
    )
    assert "production_operational_status remains NOT_ATTESTED" in scope["acceptance"][-1]


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
    assert "github.event.issue.number == 2977" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "actions: read\n  contents: read\n  issues: write" in workflow
    assert "contents: write" not in workflow
    assert "timeout-minutes: 30" in workflow


def test_exact_main_is_asserted_before_any_editable_install_mutation() -> None:
    workflow = WORKFLOW.read_text(encoding="utf-8")
    checkout = workflow.index("- name: Checkout exact main authority")
    exact_main = workflow.index("- name: Assert exact-main immutable checkout")
    setup = workflow.index("- name: Setup Python")
    install = workflow.index("- name: Install exact TAI authority package")
    validate = workflow.index("- name: Validate CPU benchmark execution authority")
    assert checkout < exact_main < setup < install < validate
    exact_block = workflow[exact_main:setup]
    assert 'test "$(git rev-parse HEAD)" = "$GITHUB_SHA"' in exact_block
    assert 'test "$(git rev-parse refs/remotes/origin/main)" = "$GITHUB_SHA"' in exact_block
    assert 'test -z "$(git status --porcelain=v1 --untracked-files=all)"' in exact_block
    assert "pip install" not in exact_block


def test_workflow_validates_only_readiness_and_never_touches_model_host() -> None:
    workflow = WORKFLOW.read_text(encoding="utf-8")
    assert "validate-authority" in workflow
    assert "gold-set-authority.mjs" in workflow
    assert "gold-authority-validation.json" in workflow
    assert "benchmark_prerequisite_matrix_cli" in workflow
    assert "evaluate-readiness" in workflow
    assert "READY_FOR_EXTERNAL_EXECUTION" in workflow
    assert "PENDING_BENCHMARK" in workflow
    assert "PENDING_ADMISSION" in workflow
    assert "NOT_ATTESTED" in workflow
    assert "test \"$(jq -r '.accepted' \"$gold\")\" = 'true'" in workflow
    assert "test \"$(jq -r '.counts.reviewed_cases' \"$gold\")\" = '58'" in workflow
    for forbidden in (
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_KEY",
        "TAI_BUNDLE_S3_SECRET_ACCESS_KEY",
        "ssh ",
        "scp ",
        "aws s3",
        "llama-cli",
        "llama-server",
        "llama-bench",
        "195.19.12.120",
        "netlify",
        "vercel",
    ):
        assert forbidden.casefold() not in workflow.casefold()


def test_only_bounded_metadata_can_enter_github_artifacts() -> None:
    workflow = WORKFLOW.read_text(encoding="utf-8")
    upload = workflow[workflow.index("Upload bounded readiness evidence") :]
    assert "authority-validation.json" in upload
    assert "gold-authority-validation.json" in upload
    assert "prerequisite-report.json" in upload
    assert "readiness.json" in upload
    assert "cpu-benchmark-execution-authority.v1.json" in upload
    assert "retention-days: 90" in upload
    assert "compression-level: 0" in upload
    assert "overwrite: false" in upload
    assert "include-hidden-files: false" in upload
    for forbidden in ("*.gguf", ".safetensors", ".tar", "sources/", "payload/"):
        assert forbidden not in upload


def test_runbook_documents_blockers_and_no_maturity_inflation() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    assert COMMAND in runbook
    assert "immutable model bundles have not yet been accepted" in runbook
    assert "AP-14C corpus remains `PENDING_REVIEW`" in runbook
    assert "must not start inference" in runbook
    assert "dedicated `tai-model` host" in runbook
    assert "one-hour soak" in runbook
    assert "No CPU result can satisfy the separate Qwen GPU/shared Q8_0 profile" in runbook
    assert "benchmark status: `PENDING_BENCHMARK`" in runbook
    assert "model admission: `PENDING_ADMISSION`" in runbook
    assert "production operational status: `NOT_ATTESTED`" in runbook


def test_authority_excludes_production_and_gpu_execution() -> None:
    authority = _json(AUTHORITY)
    assert authority["target"]["host_role"] == "DEDICATED_MODEL_HOST"
    assert authority["target"]["required_user"] == "tai-model"
    assert authority["target"]["production_fallback_allowed"] is False
    assert authority["target"]["network_egress"] == "S3_EXACT_VERSION_ONLY"
    assert {model["runtime_class"] for model in authority["models"]} == {"CPU"}
    assert {model["quantization"] for model in authority["models"]} == {"Q4_K_M"}
    assert authority["maturity_boundary"] == {
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
