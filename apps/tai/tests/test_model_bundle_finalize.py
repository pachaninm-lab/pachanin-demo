from __future__ import annotations

import io
import json
from pathlib import Path
from typing import Any, cast

import pytest
from model_bundle_v2_support import _manifest_payload, _write_json

from tai.model_bundle_finalize import (
    complete_storage_manifest,
    hash_stream,
    validate_finalization_authority,
)
from tai.model_bundle_v2 import load_local_model_bundle_v2

ROOT = Path(__file__).parents[3]
TAI_ROOT = Path(__file__).parents[1]
AUTHORITY_PATH = TAI_ROOT / "model-artifacts" / "model-bundle-upload-restore-authority.v1.json"
SCOPE_PATH = TAI_ROOT / "governance" / "scopes" / "ap-13b3h-bundle-upload-restore-2961.json"
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "tai-model-bundle-upload-restore.yml"
DRIVER_PATH = TAI_ROOT / "scripts" / "model-bundle-upload-restore-driver.v1.sh"
MULTIPART_PATH = TAI_ROOT / "scripts" / "model-bundle-s3-multipart.py"
STORAGE_PATH = TAI_ROOT / "tai" / "model_bundle_storage.py"
RUNBOOK_PATH = TAI_ROOT / "model-artifacts" / "model-bundle-upload-restore-runbook.v1.md"
COMMAND = "/tai finalize model-bundles exact-main"


def _json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(payload, dict)
    return cast(dict[str, Any], payload)


def test_authority_binds_exact_completed_conversion_and_maturity_boundary() -> None:
    authority = validate_finalization_authority(AUTHORITY_PATH)
    assert authority["command"] == COMMAND
    conversion = cast(dict[str, Any], authority["conversion_run"])
    assert conversion["exact_main_sha"] == "8bd494dc4954baaf699cffa243951392ff451ebb"
    assert conversion["workflow_run_id"] == 29810648430
    assert conversion["workflow_run_attempt"] == 1
    assert conversion["report_sha256"] == (
        "056c0203f382f6e3e1e57ebf145448cfddbff4718456fac7a2a84c6420185241"
    )
    assert conversion["evidence_artifact"] == {
        "id": 8488069541,
        "digest": ("sha256:be2ff447fe2495ce9d8d629c0e70b48eff3e796b38a626ba1841683aa7edab7e"),
    }
    models = cast(list[dict[str, Any]], authority["models"])
    assert {item["key"] for item in models} == {
        "qwen3-8b",
        "mistral-7b-instruct-v0.3",
    }
    assert sum(len(cast(list[object], item["outputs"])) for item in models) == 5
    assert authority["result"] == {
        "complete_status": "VERIFIED_BUNDLES_RESTORED",
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }


def test_authority_rejects_maturity_overstatement(tmp_path: Path) -> None:
    authority = _json(AUTHORITY_PATH)
    authority["result"]["production_operational_status"] = "ATTESTED"
    path = tmp_path / "authority.json"
    _write_json(path, authority)
    with pytest.raises(ValueError, match="maturity boundary mismatch"):
        validate_finalization_authority(path)


def test_scope_is_narrow_and_covers_actual_surfaces() -> None:
    scope = _json(SCOPE_PATH)
    assert scope["branch"] == "agent/tai-ap-13b3h-bundle-upload-restore"
    assert (scope["program_issue"], scope["parent_issue"], scope["issue"]) == (
        2726,
        2954,
        2961,
    )
    allowed = set(cast(list[str], scope["allowed_paths"]))
    assert {
        ".github/workflows/tai-model-bundle-upload-restore.yml",
        "apps/tai/scripts/model-bundle-s3-multipart.py",
        "apps/tai/scripts/model-bundle-upload-restore-driver.v1.sh",
        "apps/tai/tai/model_bundle_finalize.py",
        "apps/tai/tai/model_bundle_finalize_cli.py",
        "apps/tai/tai/model_bundle_storage.py",
        "apps/tai/tests/test_model_bundle_finalize.py",
        "apps/tai/tests/test_model_bundle_storage_contract.py",
    }.issubset(allowed)
    assert "apps/tai/scripts/model-bundle-upload-restore-orchestrator.v1.sh" not in allowed
    forbidden = "\n".join(cast(list[str], scope["forbidden_capabilities"]))
    assert "accepted S3 object or version deletion" in forbidden
    assert "production-readiness claim" in forbidden
    assert "local materialization of the complete immutable archive" in forbidden


def test_workflow_is_owner_only_exact_main_and_direct_fail_closed() -> None:
    workflow = WORKFLOW_PATH.read_text(encoding="utf-8")
    assert "issue_comment:" in workflow
    assert "workflow_dispatch:" not in workflow
    assert "schedule:" not in workflow
    assert "github.ref == 'refs/heads/main'" in workflow
    assert "github.actor == github.repository_owner" in workflow
    assert "github.triggering_actor == github.repository_owner" in workflow
    assert "github.event.issue.number == 2961" in workflow
    assert f"github.event.comment.body == '{COMMAND}'" in workflow
    assert "github.event.comment.author_association == 'OWNER'" in workflow
    assert "TAI Release Acceptance" in workflow
    assert "READY_FOR_BUNDLE_UPLOAD" in workflow
    assert "control-manifest.sha256" in workflow
    assert "BatchMode=yes" in workflow
    assert "StrictHostKeyChecking=yes" in workflow
    assert "Execute exact bundle finalization on dedicated model host" in workflow
    assert "Enforce final accepted result" in workflow
    assert "VERIFIED_BUNDLES_RESTORED" in workflow
    assert "continue-on-error: true" not in workflow
    for secret in (
        "TAI_MODEL_HOST",
        "TAI_MODEL_SSH_USER",
        "TAI_MODEL_SSH_PORT",
        "TAI_MODEL_SSH_KEY",
        "TAI_BUNDLE_S3_ENDPOINT",
        "TAI_BUNDLE_S3_ACCESS_KEY_ID",
        "TAI_BUNDLE_S3_SECRET_ACCESS_KEY",
    ):
        assert secret in workflow
    for forbidden in (
        "PC_PROD_HOST",
        "PC_PROD_SSH_KEY",
        "VPS_SSH_KEY",
        "SSH_PASSWORD",
        "195.19.12.120",
        "contents: write",
        "actions: write",
        "model-bundle-upload-restore-orchestrator.v1.sh",
    ):
        assert forbidden not in workflow


def test_driver_binds_semantic_conversion_report_and_exact_version() -> None:
    driver = DRIVER_PATH.read_text(encoding="utf-8")
    assert "report['report_sha256'] == expected['report_sha256']" in driver
    assert (
        "hashlib.sha256(report_path.read_bytes()).hexdigest() == expected['report_sha256']"
        not in driver
    )
    assert driver.count('tar_stream "$original_root"') == 2
    assert '--expected-sha256 "$archive_sha"' in driver
    assert '--expected-size-bytes "$archive_size"' in driver
    assert '--version-id "$version_id"' in driver
    assert 'head_version_path="$model_work/head-version.json"' in driver
    assert 'download_url="$(python3 -c' in driver
    assert "extract-stream" in driver
    assert 'rm -f "$original_root/storage/archive-files.txt"' in driver
    assert "model_bundle_storage_cli" in driver
    assert 'rm -rf "$model_work"' in driver
    assert "DeleteObject" not in driver
    assert "aws s3 cp" not in driver
    assert "bundle.tar >" not in driver


def test_multipart_transport_aborts_before_completion_on_stream_drift() -> None:
    transport = MULTIPART_PATH.read_text(encoding="utf-8")
    completion = transport.index('ET.Element("CompleteMultipartUpload")')
    assert transport.index("actual_sha256 != expected_sha256") < completion
    assert transport.index("total != expected_size_bytes") < completion
    assert "_read_part(stream, part_size)" in transport
    assert '"sha256": actual_sha256' in transport
    assert '"last_modified": headers.get("last-modified")' in transport
    assert 'abort_url = _query_url(base, {"uploadId": upload_id})' in transport
    assert '["--request", "DELETE"' in transport
    assert "delete-object" not in transport
    assert "delete-object-version" not in transport


def test_external_archive_verifier_does_not_duplicate_payload() -> None:
    source = STORAGE_PATH.read_text(encoding="utf-8")
    assert "copytree" not in source
    assert "TemporaryDirectory" not in source
    assert "ARCHIVE_LOCATOR_VERSION_ID_MISSING" in source
    assert "storage.bundle_archive" in source
    assert "_verify_non_storage_bundle_contract" in source


def test_complete_storage_manifest_binds_version_and_archive_digest(tmp_path: Path) -> None:
    _, original, _, payload = _manifest_payload(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    payload["storage"] = None
    state = {
        "schema_version": "tai.model-bundle-finalization-state.v1",
        "model_key": "qwen3-8b",
        "model_id": payload["model_id"],
        "revision": payload["revision"],
        "archive_logical_path": "storage/qwen3-8b.bundle.tar",
        "manifest_without_storage": payload,
        "payload_index": storage["payload_index"],
        "payload_file_count": 1,
        "payload_size_bytes": 1,
        "archive_files_path": "storage/archive-files.txt",
    }
    state_path = tmp_path / "state.json"
    manifest_path = tmp_path / "complete.v2.json"
    _write_json(state_path, state)
    digest = "a" * 64
    summary = complete_storage_manifest(
        state_path=state_path,
        original_root=original,
        archive_sha256=digest,
        archive_size_bytes=123456,
        endpoint="https://s3.storage.selcloud.ru",
        region="ru-1",
        bucket="tai-model-bundles",
        object_key=f"tai/model-bundles/v1/qwen/sha256/{digest}/bundle.tar",
        version_id="3Lg8-version-id",
        etag="multipart-etag-2",
        uploaded_at="2026-07-21T10:00:00+00:00",
        retention_days=90,
        retention_expires_at="2026-10-19T10:00:00+00:00",
        restored_at="2026-07-21T10:30:00+00:00",
        output_manifest=manifest_path,
    )
    bundle = load_local_model_bundle_v2(manifest_path)
    assert bundle.storage is not None
    assert bundle.storage.bundle_archive.sha256 == digest
    assert "versionId=3Lg8-version-id" in bundle.storage.immutable_locator
    assert f"sha256:{digest}" in bundle.storage.immutable_locator
    assert summary["production_operational_status"] == "NOT_ATTESTED"


def test_complete_storage_rejects_retention_below_authority(tmp_path: Path) -> None:
    _, original, _, payload = _manifest_payload(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    payload["storage"] = None
    state_path = tmp_path / "state.json"
    _write_json(
        state_path,
        {
            "schema_version": "tai.model-bundle-finalization-state.v1",
            "archive_logical_path": "storage/bundle.tar",
            "manifest_without_storage": payload,
            "payload_index": storage["payload_index"],
        },
    )
    with pytest.raises(ValueError, match="at least 90 days"):
        complete_storage_manifest(
            state_path=state_path,
            original_root=original,
            archive_sha256="b" * 64,
            archive_size_bytes=10,
            endpoint="https://s3.example.test",
            region="ru-1",
            bucket="tai-model-bundles",
            object_key="objects/bundle.tar",
            version_id="version-1",
            etag="etag",
            uploaded_at="2026-07-21T10:00:00+00:00",
            retention_days=89,
            retention_expires_at="2026-10-18T10:00:00+00:00",
            restored_at="2026-07-21T10:30:00+00:00",
            output_manifest=tmp_path / "manifest.json",
        )


def test_hash_stream_is_exact_and_bounded() -> None:
    payload = b"governed-stream" * 1024
    result = hash_stream(io.BytesIO(payload))
    assert result.size_bytes == len(payload)
    assert len(result.sha256) == 64


def test_runbook_preserves_operational_boundaries() -> None:
    runbook = RUNBOOK_PATH.read_text(encoding="utf-8")
    assert COMMAND in runbook
    assert "FAILED_CLOSED" in runbook
    assert "VersionId" in runbook
    assert "CompleteMultipartUpload" in runbook
    assert "No source weights, GGUF" in runbook
    assert "NOT_ATTESTED" in runbook
    assert "must not be pasted" in runbook
