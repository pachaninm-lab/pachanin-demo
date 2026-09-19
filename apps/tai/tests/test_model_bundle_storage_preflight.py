from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW_PATH = (
    ROOT / ".github" / "workflows" / "tai-model-bundle-storage-preflight.yml"
)
AUTHORITY_PATH = (
    TAI_ROOT / "model-artifacts" / "model-bundle-storage-authority.v1.json"
)
SCOPE_PATH = (
    TAI_ROOT
    / "governance"
    / "scopes"
    / "ap-13b3e1-storage-preflight-2953.json"
)
COMMAND = "/tai probe model-bundle-storage exact-main"
EXPECTED_PATHS = {
    ".github/workflows/tai-model-bundle-storage-preflight.yml",
    "apps/tai/governance/scopes/ap-13b3e1-storage-preflight-2953.json",
    "apps/tai/model-artifacts/model-bundle-storage-authority.v1.json",
    "apps/tai/tests/test_model_bundle_storage_preflight.py",
}


def _json(path: Path) -> dict[str, object]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def _workflow() -> str:
    return WORKFLOW_PATH.read_text(encoding="utf-8")


def test_storage_scope_is_narrow_and_preserves_maturity() -> None:
    scope = _json(SCOPE_PATH)
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "feat/tai-model-bundle-s3-finalization-2953"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2835,
        2953,
    )
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert "model-host access, model conversion or quantization" in scope[
        "forbidden_capabilities"
    ]
    assert "object deletion or retention shortening" in scope[
        "forbidden_capabilities"
    ]
    assert "production_operational_status remains NOT_ATTESTED" in scope[
        "acceptance"
    ]


def test_storage_authority_requires_external_compliance_retention() -> None:
    authority = _json(AUTHORITY_PATH)
    assert authority["schema_version"] == "tai.model-bundle-storage-authority.v1"
    assert (
        authority["program_issue"],
        authority["parent_issue"],
        authority["infrastructure_issue"],
        authority["issue"],
    ) == (2726, 2835, 2861, 2953)
    assert authority["command"] == COMMAND
    assert authority["storage_class"] == "EXTERNAL_S3_COMPATIBLE"
    assert authority["credential_boundary"] == "GITHUB_ACTIONS_ONLY"
    assert authority["endpoint_policy"] == {
        "required_scheme": "https",
        "production_server_fallback_allowed": False,
    }
    bucket_policy = authority["bucket_policy"]
    assert isinstance(bucket_policy, dict)
    assert bucket_policy["required_versioning_status"] == "Enabled"
    assert bucket_policy["required_object_lock_status"] == "Enabled"
    assert bucket_policy["required_default_retention_mode"] == "COMPLIANCE"
    assert bucket_policy["minimum_retention_days"] == 90
    smoke_policy = authority["smoke_policy"]
    assert isinstance(smoke_policy, dict)
    assert smoke_policy["payload_size_bytes"] == 4096
    assert smoke_policy["delete_after_verification"] is False
    result = authority["result"]
    assert isinstance(result, dict)
    assert result["benchmark_status"] == "NOT_RUN"
    assert result["model_admission_status"] == "NOT_DONE"
    assert result["production_operational_status"] == "NOT_ATTESTED"


def test_storage_probe_is_owner_only_exact_main_and_non_automatic() -> None:
    workflow = _workflow()
    assert "issue_comment:" in workflow
    assert "types: [created]" in workflow
    assert "push:" not in workflow
    assert "schedule:" not in workflow
    assert "workflow_dispatch:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.number == 2953" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "actions: read\n  contents: read\n  issues: write" in workflow
    assert "contents: write" not in workflow
    assert "actions: write" not in workflow
    assert '"repos/$REPOSITORY/issues/2953/comments"' in workflow


def test_storage_credentials_are_isolated_and_not_published() -> None:
    authority = _json(AUTHORITY_PATH)
    workflow = _workflow()
    required = authority["required_secrets"]
    assert isinstance(required, list)
    for secret in required:
        assert isinstance(secret, str)
        assert secret in workflow
    for forbidden in (
        "PC_PROD_HOST",
        "PC_PROD_SSH_USER",
        "PC_PROD_SSH_KEY",
        "PC_PROD_SSH_PASSWORD",
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_KEY",
        "VPS_SSH_KEY",
        "VPS_SSH_PASSWORD",
        "195.19.12.120",
        "sshpass",
    ):
        assert forbidden not in workflow
    upload = workflow[workflow.index("Upload bounded immutable-storage evidence") :]
    assert "smoke-object.json" not in upload
    assert "AWS_ACCESS_KEY_ID" not in upload
    assert "AWS_SECRET_ACCESS_KEY" not in upload
    assert "S3_SECRET_ACCESS_KEY" not in upload


def test_storage_probe_verifies_versioned_compliance_restore() -> None:
    workflow = _workflow()
    assert "get-bucket-versioning" in workflow
    assert "get-object-lock-configuration" in workflow
    assert 'versioning.get("Status") == policy["required_versioning_status"]' in workflow
    assert 'configuration.get("ObjectLockEnabled")' in workflow
    assert 'retention.get("Mode") == policy["required_default_retention_mode"]' in workflow
    assert "--object-lock-mode COMPLIANCE" in workflow
    assert "--object-lock-retain-until-date" in workflow
    assert "--checksum-algorithm SHA256" in workflow
    assert "VERSION_ID=" in workflow
    assert "head-object" in workflow
    assert "get-object" in workflow
    assert '--version-id "$VERSION_ID"' in workflow
    assert "original_sha == restored_sha" in workflow
    assert 'head.get("ObjectLockMode") == "COMPLIANCE"' in workflow
    assert "delete-object" not in workflow
    assert "delete-objects" not in workflow
    assert "put-bucket-versioning" not in workflow
    assert "put-object-lock-configuration" not in workflow


def test_storage_evidence_is_bounded_and_keeps_maturity_fail_closed() -> None:
    workflow = _workflow()
    upload = workflow[workflow.index("Upload bounded immutable-storage evidence") :]
    assert "retention-days: 90" in upload
    assert "compression-level: 9" in upload
    assert "overwrite: false" in upload
    assert "include-hidden-files: false" in upload
    assert "preflight-report.json" in upload
    assert "-le 1048576" in workflow
    assert "*.gguf" not in upload
    assert "safetensors" not in upload
    assert "model admission: `NOT_DONE`" in workflow
    assert "benchmark: `NOT_RUN`" in workflow
    assert "production operational status: `NOT_ATTESTED`" in workflow
