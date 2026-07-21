from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-selectel-s3-provision.yml"
AUTHORITY_PATH = (
    TAI_ROOT
    / "model-artifacts"
    / "selectel-s3-provisioning-authority.v1.json"
)
RUNBOOK_PATH = (
    TAI_ROOT
    / "model-artifacts"
    / "selectel-s3-provisioning-runbook.v1.md"
)
SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3g-selectel-s3-provisioning-2958.json"
)
COMMAND = "/tai provision selectel-bundle-storage exact-main"


def _json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_selectel_provisioning_authority_is_exact_and_fail_closed() -> None:
    authority = _json(AUTHORITY_PATH)
    assert authority["schema_version"] == "tai.selectel-s3-provisioning-authority.v1"
    assert (authority["program_issue"], authority["parent_issue"], authority["issue"]) == (
        2726,
        2954,
        2958,
    )
    assert authority["command"] == COMMAND
    assert authority["provider_profile"] == "SELECTEL_S3_2026"
    assert authority["bucket"]["versioning_status"] == "Enabled"
    assert authority["bucket"]["object_lock_status"] == "Enabled"
    assert authority["bucket"]["default_retention"] == {
        "mode": "COMPLIANCE",
        "days": 90,
    }
    assert authority["bucket"]["unsupported_s3_apis"] == [
        "Bucket Encryption",
        "Public Access Block",
    ]
    assert authority["policy"]["deny_actions"] == [
        "s3:DeleteObject",
        "s3:DeleteObjectVersion",
    ]
    assert authority["smoke"]["payload_size_bytes"] == 4096
    assert authority["smoke"]["delete_after_verification"] is False
    assert authority["result"]["bundle_upload_status"] == "NOT_RUN"
    assert authority["result"]["bundle_restore_status"] == "NOT_RUN"
    assert authority["result"]["production_operational_status"] == "NOT_ATTESTED"


def test_provisioning_workflow_is_owner_only_and_selectel_compatible() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "github.event.issue.number == 2958" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "github.event.comment.user.login == github.repository_owner" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "actions: read\n  contents: read\n  issues: write" in workflow
    for secret in _json(AUTHORITY_PATH)["required_secret_names"]:
        assert secret in workflow
    for required in (
        "create-bucket",
        "put-bucket-versioning",
        "put-object-lock-configuration",
        "put-bucket-policy",
        "get-object-lock-configuration",
        "get-object-retention",
        "VersionId",
        "COMPLIANCE",
        "DenyBundleDeletionForAllPrincipals",
        "DenyInsecureTransport",
        "anonymous_list_http_status",
        "READY_FOR_BUNDLE_UPLOAD",
        "NOT_ATTESTED",
    ):
        assert required in workflow
    for forbidden in (
        "PC_PROD_",
        "VPS_SSH_",
        "195.19.12.120",
        "put-public-access-block",
        "get-public-access-block",
        "put-bucket-encryption",
        "get-bucket-encryption",
        "/srv/tai-models",
        "model-conversion",
        "model-bundles exact-main",
        "s3api delete-object",
        "s3 rm",
    ):
        assert forbidden not in workflow


def test_provisioning_workflow_preserves_bounded_evidence() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "payload_size_bytes" in AUTHORITY_PATH.read_text(encoding="utf-8")
    assert "4096" in workflow
    assert "rm -f \"$REPORT_ROOT/raw/smoke.bin\"" in workflow
    assert "find \"$REPORT_ROOT\" -type f -size +50000000c" in workflow
    assert "smoke deletion: `false`" in workflow
    assert "model bundle upload: `NOT_RUN`" in workflow
    assert "clean model restore: `NOT_RUN`" in workflow


def test_runbook_names_only_human_account_actions_and_exact_command() -> None:
    runbook = RUNBOOK_PATH.read_text(encoding="utf-8")
    assert COMMAND in runbook
    assert "TAI_BUNDLE_S3_PRINCIPAL_ID" in runbook
    assert "Do not paste credential values" in runbook
    assert "SELECTEL_S3_2026" in runbook
    assert "Public Access Block" in runbook
    assert "Bucket Encryption" in runbook
    assert "bundle upload: NOT_RUN" in runbook
    assert "production operational status: NOT_ATTESTED" in runbook


def test_scope_is_exact_and_preserves_maturity_boundary() -> None:
    scope = _json(SCOPE_PATH)
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3g-selectel-provisioning"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2954,
        2958,
    )
    assert set(scope["allowed_paths"]) == {
        ".github/workflows/tai-bundle-s3-preflight.yml",
        ".github/workflows/tai-selectel-s3-provision.yml",
        "apps/tai/governance/scopes/ap-13b3g-selectel-s3-provisioning-2958.json",
        "apps/tai/model-artifacts/model-bundle-s3-preflight-requirements.v1.json",
        "apps/tai/model-artifacts/selectel-s3-provisioning-authority.v1.json",
        "apps/tai/model-artifacts/selectel-s3-provisioning-runbook.v1.md",
        "apps/tai/tai/model_bundle_s3_preflight.py",
        "apps/tai/tests/test_model_bundle_s3_preflight.py",
        "apps/tai/tests/test_selectel_s3_provisioning.py",
    }
    assert "production_operational_status remains NOT_ATTESTED" in scope["acceptance"]
