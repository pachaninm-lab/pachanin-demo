from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
WORKFLOW = ROOT / ".github" / "workflows" / "tai-model-bundle-finalization.yml"
DRIVER = TAI_ROOT / "model-artifacts" / "model-bundle-finalization-driver.v1.sh"
REMOTE = TAI_ROOT / "model-artifacts" / "model-bundle-finalization-remote.v1.sh"
REMOTE_PYTHON = TAI_ROOT / "model-artifacts" / "model_bundle_finalization_remote.py"
AUTHORITY = TAI_ROOT / "model-artifacts" / "model-bundle-finalization-authority.v1.json"
RUNBOOK = TAI_ROOT / "model-artifacts" / "model-bundle-finalization-runbook.v1.md"
SCOPE = TAI_ROOT / "governance" / "scopes" / "ap-13b3h-bundle-finalization-2961.json"
COMMAND = "/tai finalize model-bundles exact-main"
CONVERSION_SHA = "8bd494dc4954baaf699cffa243951392ff451ebb"
CONVERSION_RUN = 29810648430
EXPECTED_PATHS = {
    ".gitleaksignore",
    ".github/workflows/tai-model-bundle-finalization.yml",
    "apps/tai/governance/scopes/ap-13b3h-bundle-finalization-2961.json",
    "apps/tai/model-artifacts/model-bundle-finalization-authority.v1.json",
    "apps/tai/model-artifacts/model-bundle-finalization-driver.v1.sh",
    "apps/tai/model-artifacts/model-bundle-finalization-remote.v1.sh",
    "apps/tai/model-artifacts/model-bundle-finalization-runbook.v1.md",
    "apps/tai/tai/model_bundle_external_storage.py",
    "apps/tai/tai/model_bundle_external_storage_cli.py",
    "apps/tai/model-artifacts/model_bundle_finalization_remote.py",
    "apps/tai/tests/test_model_bundle_external_storage.py",
    "apps/tai/tests/test_model_bundle_finalization_workflow.py",
}


def _json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return payload


def test_scope_is_exact_and_preserves_maturity_boundary() -> None:
    scope = _json(SCOPE)
    assert scope["schema_version"] == "tai.concurrent-scope.v1"
    assert scope["branch"] == "agent/tai-ap-13b3h-bundle-finalization"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2954,
        2961,
    )
    assert set(scope["allowed_paths"]) == EXPECTED_PATHS
    assert "benchmark, admission, activation" in " ".join(scope["forbidden_capabilities"])
    assert "production_operational_status remains NOT_ATTESTED" in scope["acceptance"][-1]


def test_authority_binds_completed_conversion_and_external_storage() -> None:
    authority = _json(AUTHORITY)
    assert authority["schema_version"] == "tai.model-bundle-finalization-authority.v1"
    assert authority["command"] == COMMAND
    assert authority["conversion_run"] == {
        "exact_main_sha": CONVERSION_SHA,
        "workflow_run_id": CONVERSION_RUN,
        "workflow_run_attempt": 1,
        "root": f"/srv/tai-models/conversion-runs/{CONVERSION_SHA}/{CONVERSION_RUN}-1",
        "required_state": "COMPLETE",
        "required_result": "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE",
        "rerun_allowed": False,
    }
    storage = authority["storage"]
    assert storage["provider_profile"] == "SELECTEL_S3_2026"
    assert storage["versioning_status"] == "Enabled"
    assert storage["object_lock_status"] == "Enabled"
    assert storage["retention_mode"] == "COMPLIANCE"
    assert storage["retention_days"] == 90
    assert storage["delete_allowed"] is False
    assert storage["retention_shortening_allowed"] is False
    archive = authority["archive"]
    assert archive["stream_passes"] == 2
    assert archive["local_archive_copy_allowed"] is False
    assert archive["compression"] == "NONE"
    restore = authority["restore"]
    assert restore["one_model_at_a_time"] is True
    assert restore["exact_version_required"] is True
    assert restore["same_root_copy_allowed"] is False
    assert {model["key"] for model in authority["models"]} == {
        "qwen3-8b",
        "mistral-7b-instruct-v0.3",
    }
    result = authority["result"]
    assert result["benchmark_status"] == "NOT_RUN"
    assert result["model_admission_status"] == "NOT_DONE"
    assert result["production_operational_status"] == "NOT_ATTESTED"


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
    assert "github.event.issue.number == 2961" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "actions: read\n  contents: read\n  issues: write" in workflow
    assert "contents: write" not in workflow
    for secret in (
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_USER",
        "TAI_MODEL_SSH_PORT",
        "TAI_MODEL_SSH_KEY",
        "TAI_BUNDLE_S3_ENDPOINT",
        "TAI_BUNDLE_S3_REGION",
        "TAI_BUNDLE_S3_BUCKET",
        "TAI_BUNDLE_S3_ACCESS_KEY_ID",
        "TAI_BUNDLE_S3_SECRET_ACCESS_KEY",
        "TAI_BUNDLE_S3_PREFIX",
        "TAI_BUNDLE_S3_CAPACITY_BYTES",
        "TAI_BUNDLE_S3_PRINCIPAL_ID",
    ):
        assert secret in workflow
    assert "retention-days: 90" in workflow
    assert "compression-level: 0" in workflow
    assert "overwrite: false" in workflow
    assert "include-hidden-files: false" in workflow


def test_driver_fails_before_mutation_when_protected_inputs_are_missing() -> None:
    driver = DRIVER.read_text(encoding="utf-8")
    missing_index = driver.index("required_inputs=(")
    failure_index = driver.index("no S3 mutation attempted")
    preflight_index = driver.index("run_read_only head_bucket")
    remote_index = driver.index('ssh_command "install -d')
    assert missing_index < failure_index < preflight_index < remote_index
    assert "READY_FOR_BUNDLE_UPLOAD" in driver
    assert "TAI Release Acceptance" in driver
    assert "tai-release-attestation-" in driver
    assert "artifact['expired'] is False" in driver
    assert "source-artifacts.tsv" in driver
    assert "control-manifest.sha256" in driver
    assert "sha256sum -c control-package.tar.gz.sha256" in driver
    assert 'test "$MODEL_SSH_USER" = "tai-model"' in driver
    for forbidden in (
        "PC_PROD_HOST",
        "PC_PROD_SSH_KEY",
        "PC_PROD_SSH_PASSWORD",
        "VPS_SSH_KEY",
        "VPS_SSH_PASSWORD",
        "195.19.12.120",
        "netlify",
        "vercel",
    ):
        assert forbidden.casefold() not in driver.casefold()


def test_remote_python_driver_is_syntactically_valid() -> None:
    source = REMOTE_PYTHON.read_text(encoding="utf-8")
    compile(source, str(REMOTE_PYTHON), "exec")


def test_remote_execution_streams_twice_and_restores_exact_version() -> None:
    remote = REMOTE.read_text(encoding="utf-8")
    assert "for model_key in qwen3-8b mistral-7b-instruct-v0.3" in remote
    assert 'tar_stream "$original_root" "$payload_paths" | measure_stream' in remote
    assert 'tar_stream "$original_root" "$payload_paths" | \\' in remote
    assert 's3 cp - "s3://$S3_BUCKET/$object_key"' in remote
    assert '--expected-size "$archive_size"' in remote
    assert "objects/sha256/$archive_sha256/$model_key.tar" in remote
    assert "head-object" in remote
    assert "get-object-retention" in remote
    assert 'test "$retention_mode" = "COMPLIANCE"' in remote
    assert 'test -n "$version_id"' in remote
    assert '--version-id "$version_id"' in remote
    assert "mkfifo -m 600" in remote
    assert 'python3 "$REMOTE_SCRIPT" extract' in remote
    assert 'rm -rf "$model_root"' in remote
    assert "abort-multipart-upload" in remote
    assert "delete-object" not in remote
    assert "delete-objects" not in remote
    assert "rm s3://" not in remote
    assert "bundle.tar" not in remote
    assert "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED" in remote
    assert "production_operational_status': 'NOT_ATTESTED'" in remote


def test_only_bounded_metadata_returns_to_github() -> None:
    workflow = WORKFLOW.read_text(encoding="utf-8")
    upload = workflow[workflow.index("Upload bounded finalization evidence") :]
    assert "manifest.json" in upload
    assert "object-record.json" in upload
    assert "archive-observation.json" in upload
    assert "verification-report.json" in upload
    assert "*.gguf" not in upload
    assert "sources/" not in upload
    assert "model-bundle-finalization-authority.v1.json" in upload
    driver = DRIVER.read_text(encoding="utf-8")
    assert "BOUNDED_EVIDENCE_SIZE_EXCEEDED" in driver
    assert "GGUF_ENTERED_GITHUB_EVIDENCE" in driver
    assert "path.stat().st_size > 10_000_000" in driver


def test_runbook_documents_human_checkpoint_and_no_maturity_inflation() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    assert COMMAND in runbook
    assert "Never place credential values" in runbook
    assert "Before any S3 mutation" in runbook
    assert "deterministic tar stream once" in runbook
    assert "second time directly into multipart S3 upload" in runbook
    assert "exact object version" in runbook
    assert "retaining no downloaded archive file" in runbook
    assert "benchmark: `NOT_RUN`" in runbook
    assert "model admission: `NOT_DONE`" in runbook
    assert "production operational status: `NOT_ATTESTED`" in runbook
