from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-legal-review.yml"
SCOPE_PATH = (
    Path(__file__).parents[1]
    / "governance"
    / "scopes"
    / "ap-13b3c-human-legal-intake-2877.json"
)

EXPECTED_PATHS = {
    ".github/workflows/tai-model-legal-review.yml",
    "apps/tai/governance/scopes/ap-13b3c-human-legal-intake-2877.json",
    "apps/tai/model-artifacts/model-legal-review-authority.v1.json",
    "apps/tai/model-artifacts/model-legal-review-record.schema.v1.json",
    "apps/tai/model-artifacts/model-legal-review-attestation.schema.v1.json",
    "apps/tai/model-artifacts/model-legal-review-runbook.v1.md",
    "apps/tai/tai/model_legal_review.py",
    "apps/tai/tai/model_legal_review_authority.py",
    "apps/tai/tai/model_legal_review_authority_parse.py",
    "apps/tai/tai/model_legal_review_cli.py",
    "apps/tai/tai/model_legal_review_evidence.py",
    "apps/tai/tai/model_legal_review_evidence_parse.py",
    "apps/tai/tai/model_legal_review_source.py",
    "apps/tai/tai/model_legal_review_verify.py",
    "apps/tai/tests/test_model_legal_review.py",
    "apps/tai/tests/test_model_legal_review_workflow.py",
}


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def _scope() -> dict[str, Any]:
    return json.loads(SCOPE_PATH.read_text(encoding="utf-8"))


def test_scope_is_exact_and_preserves_human_decision_boundary() -> None:
    scope = _scope()

    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3c-human-legal-intake"
    assert scope["status"] == "active"
    assert scope["program_issue"] == 2726
    assert scope["parent_issue"] == 2835
    assert scope["issue"] == 2877
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert len(scope["allowed_paths"]) == len(EXPECTED_PATHS)
    assert "automated legal decision generation or mutation" in scope[
        "forbidden_capabilities"
    ]
    assert "conversion, quantization or model admission" in scope[
        "forbidden_capabilities"
    ]


def test_workflow_is_pull_request_only_and_read_only() -> None:
    workflow = _workflow()

    assert "pull_request:" in workflow
    assert "issue_comment:" not in workflow
    assert "workflow_dispatch:" not in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "permissions:\n  contents: read" in workflow
    assert "contents: write" not in workflow
    assert "issues: write" not in workflow
    assert "pull-requests: write" not in workflow
    assert "packages: write" not in workflow
    assert "id-token: write" not in workflow
    assert "secrets." not in workflow


def test_workflow_checks_exact_head_and_authorized_review_paths() -> None:
    workflow = _workflow()

    assert "ref: ${{ github.event.pull_request.head.sha }}" in workflow
    assert 'test "$(git rev-parse HEAD)" = "$HEAD_SHA"' in workflow
    assert 'git cat-file -e "$BASE_SHA^{commit}"' in workflow
    assert 'git diff --name-only "$BASE_SHA" "$HEAD_SHA"' in workflow
    assert "authorized_review_paths" in workflow
    assert "unauthorized legal-review paths" in workflow
    assert "incomplete legal-review pair" in workflow
    assert "legal-review paths changed without a completed pair" in workflow


def test_workflow_validates_but_never_authors_human_decisions() -> None:
    workflow = _workflow()

    assert "load_model_legal_review_authority" in workflow
    assert "validate_source_acceptance" in workflow
    assert "evaluate_model_review" in workflow
    assert "evaluate_all_model_reviews" in workflow
    assert "DECISION_READ_ONLY_HUMAN_AUTHORED" in workflow
    assert "APPROVED_FOR_CONVERSION" in workflow
    assert "HumanLegalReviewStatus.REJECTED" in workflow
    assert "model-artifacts/legal-reviews/" in workflow
    assert "write_text" in workflow
    assert "legal-review-evidence/pr-evaluation.json" in workflow
    assert "review-record.v1.json').write_text" not in workflow
    assert "review-attestation.v1.json').write_text" not in workflow
    assert "gh api" not in workflow


def test_workflow_never_downloads_or_converts_models() -> None:
    workflow = _workflow()

    forbidden = (
        "huggingface.co",
        ".safetensors",
        ".gguf",
        "convert_hf_to_gguf.py",
        "llama-quantize",
        "docker pull",
        "docker push",
        "oras push",
        "ADMITTED",
        "production_operational_status=ATTESTED",
    )
    for token in forbidden:
        assert token not in workflow


def test_workflow_uploads_only_bounded_evaluation_artifact() -> None:
    workflow = _workflow()

    assert "actions/upload-artifact@v4" in workflow
    assert "path: legal-review-evidence" in workflow
    assert "retention-days: 30" in workflow
    assert "compression-level: 0" in workflow
    assert "overwrite: false" in workflow
    assert "production_operational_status': 'NOT_ATTESTED'" in workflow
