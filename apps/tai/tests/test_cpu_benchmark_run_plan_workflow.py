from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
WORKFLOW = ROOT / ".github/workflows/tai-cpu-benchmark-run-plan-authority.yml"
AUTHORITY = ROOT / "apps/tai/model-artifacts/cpu-benchmark-run-plan-authority.v1.json"
SCHEMA = ROOT / "apps/tai/model-artifacts/cpu-benchmark-run-plan.schema.v1.json"
SCOPE = ROOT / "apps/tai/governance/scopes/ap-13c1c0-run-plan-2991.json"


def test_workflow_is_owner_only_and_pre_protected_access() -> None:
    text = WORKFLOW.read_text(encoding="utf-8")
    assert "issue_comment:" in text
    assert "github.event.issue.number == 2991" in text
    assert (
        "github.event.comment.body == "
        "'/tai compile cpu-fallback run-plan exact-main'"
    ) in text
    assert "github.event.comment.author_association == 'OWNER'" in text
    assert "github.ref == 'refs/heads/main'" in text
    assert "workflow_dispatch:" not in text
    assert "\n  schedule:" not in text
    assert "\n  push:" not in text
    assert "${{ secrets." not in text
    for forbidden in ("ssh-keyscan", "\n          ssh ", "\n          scp ", "s3api", "aws s3"):
        assert forbidden not in text
    assert "actions: read" in text
    assert "persist-credentials: false" in text
    assert "compiler_performed_protected_access" in text
    assert "s3_mutation_allowed" in text
    assert "PENDING_BENCHMARK" in text
    assert "PENDING_ADMISSION" in text
    assert "NOT_ATTESTED" in text


def test_authority_schema_and_scope_preserve_boundaries() -> None:
    authority = json.loads(AUTHORITY.read_text(encoding="utf-8"))
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    scope = json.loads(SCOPE.read_text(encoding="utf-8"))
    assert authority["issue"] == 2991
    assert authority["runner_issue"] == 2990
    assert authority["command"] == "/tai compile cpu-fallback run-plan exact-main"
    assert authority["plan_policy"]["compiler_protected_access_allowed"] is False
    assert authority["plan_policy"]["raw_payload_in_github_allowed"] is False
    assert authority["maturity_boundary"] == {
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }
    assert schema["$id"].endswith("tai.cpu-benchmark-run-plan.v1.json")
    assert WORKFLOW.relative_to(ROOT).as_posix() in scope["allowed_paths"]
    assert AUTHORITY.relative_to(ROOT).as_posix() in scope["allowed_paths"]
    assert SCHEMA.relative_to(ROOT).as_posix() in scope["allowed_paths"]
