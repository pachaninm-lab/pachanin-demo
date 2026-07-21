from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any, cast

from model_bundle_v2_support import AUTHORITY_PATH, _manifest_payload, _sha256, _write, _write_json

from tai.model_bundle_external_storage import verify_external_model_bundle
from tai.model_bundle_external_storage_cli import main


def _payload_declarations(payload: dict[str, Any]) -> list[dict[str, Any]]:
    result = list(cast(list[dict[str, Any]], payload["source_files"]))
    remote = cast(dict[str, Any], payload["remote_inventory"])
    result.append(cast(dict[str, Any], remote["evidence_file"]))
    legal = cast(dict[str, Any], payload["legal_review"])
    result.extend(
        [
            cast(dict[str, Any], legal["license_text"]),
            cast(dict[str, Any], legal["review_record"]),
        ]
    )
    toolchain = cast(dict[str, Any], payload["toolchain_package"])
    result.extend(
        [
            cast(dict[str, Any], toolchain["package"]),
            cast(dict[str, Any], toolchain["build_manifest"]),
            cast(dict[str, Any], toolchain["verification_report"]),
        ]
    )
    for binary in cast(list[dict[str, Any]], toolchain["binaries"]):
        result.append(cast(dict[str, Any], binary["file"]))
    conversion = cast(dict[str, Any], payload["conversion"])
    result.extend(
        [
            cast(dict[str, Any], conversion["python_dependencies"]),
            cast(dict[str, Any], conversion["converter"]),
            cast(dict[str, Any], conversion["log"]),
            cast(dict[str, Any], conversion["intermediate"]),
        ]
    )
    for quantization in cast(list[dict[str, Any]], payload["quantizations"]):
        result.extend(
            [
                cast(dict[str, Any], quantization["log"]),
                cast(dict[str, Any], quantization["output"]),
            ]
        )
    return sorted(result, key=lambda item: cast(str, item["path"]))


def _canonical_sha256(value: object) -> str:
    rendered = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return _sha256(rendered.encode())


def _external_bundle(
    tmp_path: Path,
) -> tuple[Path, Path, Path, Path, dict[str, Any]]:
    manifest_path, original, old_restored, payload = _manifest_payload(tmp_path)
    shutil.rmtree(old_restored)
    shutil.rmtree(original / "storage")

    declarations = _payload_declarations(payload)
    entries = [
        {
            "path": item["path"],
            "sha256": item["sha256"],
            "size_bytes": item["size_bytes"],
        }
        for item in declarations
    ]
    archive_sha256 = _canonical_sha256(entries)
    archive_size = sum(cast(int, item["size_bytes"]) for item in declarations) + 10240
    object_record = {
        "endpoint_host": "s3.storage.selcloud.ru",
        "region": "ru-1",
        "bucket": "tai-model-bundles",
        "key": f"governed/objects/sha256/{archive_sha256}/qwen3-8b.tar",
        "version_id": "3HL4kqtJlcpXroDTDmJ+rmSpXd3dIbrHY",
        "etag": '"0123456789abcdef0123456789abcdef-128"',
    }
    uploaded_at = "2026-07-21T12:00:00+00:00"
    expires_at = "2026-10-19T12:00:00+00:00"
    restored_at = "2026-07-21T13:00:00+00:00"
    locator = (
        "s3+version://s3.storage.selcloud.ru/tai-model-bundles/"
        f"{object_record['key']}?versionId={object_record['version_id']}"
        f"#sha256={archive_sha256}"
    )

    index = {
        "schema_version": "tai.model-bundle-payload-index.v1",
        "model_id": payload["model_id"],
        "revision": payload["revision"],
        "entries": entries,
    }
    index_file = _write(
        original,
        "storage/payload-index.json",
        json.dumps(index, ensure_ascii=False, sort_keys=True).encode(),
    )
    upload = {
        "schema_version": "tai.model-bundle-upload-record.v2",
        "archive_sha256": archive_sha256,
        "archive_size_bytes": archive_size,
        "immutable_locator": locator,
        "object": object_record,
        "uploaded_at": uploaded_at,
        "retention_mode": "COMPLIANCE",
        "retention_days": 90,
        "retention_expires_at": expires_at,
    }
    upload_file = _write(
        original,
        "storage/upload-record.json",
        json.dumps(upload, ensure_ascii=False, sort_keys=True).encode(),
    )
    observation = {
        "schema_version": "tai.model-bundle-archive-observation.v1",
        "archive_sha256": archive_sha256,
        "archive_size_bytes": archive_size,
        "entries": entries,
    }
    observation_path = tmp_path / "archive-observation.json"
    _write_json(observation_path, observation)
    restore = {
        "schema_version": "tai.model-bundle-restore-record.v2",
        "archive_sha256": archive_sha256,
        "archive_size_bytes": archive_size,
        "immutable_locator": locator,
        "object": object_record,
        "restored_at": restored_at,
        "archive_observation_sha256": _canonical_sha256(observation),
    }
    restore_file = _write(
        original,
        "storage/restore-record.json",
        json.dumps(restore, ensure_ascii=False, sort_keys=True).encode(),
    )

    payload["schema_version"] = "tai.external-model-bundle.v1"
    payload["benchmark_status"] = "NOT_RUN"
    payload["model_admission_status"] = "NOT_DONE"
    payload["production_operational_status"] = "NOT_ATTESTED"
    payload["storage"] = {
        "archive": {
            "sha256": archive_sha256,
            "size_bytes": archive_size,
            "media_type": "application/x-tar",
        },
        "payload_index": index_file,
        "immutable_locator": locator,
        "object": object_record,
        "uploaded_at": uploaded_at,
        "retention_mode": "COMPLIANCE",
        "retention_days": 90,
        "retention_expires_at": expires_at,
        "restored_at": restored_at,
        "upload_record": upload_file,
        "restore_record": restore_file,
    }
    _write_json(manifest_path, payload)

    restored = tmp_path / "clean-restore"
    for item in declarations:
        relative = cast(str, item["path"])
        target = restored / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(original / relative, target)
    return manifest_path, original, restored, observation_path, payload


def test_external_bundle_verifies_without_local_archive(tmp_path: Path) -> None:
    manifest, original, restored, observation, _ = _external_bundle(tmp_path)
    report = verify_external_model_bundle(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
        archive_observation_path=observation,
    )
    assert report["status"] == "VERIFIED"
    assert report["reasons"] == []
    assert not any(path.name.endswith(".tar") for path in original.rglob("*"))
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_restored_payload_drift_fails_closed(tmp_path: Path) -> None:
    manifest, original, restored, observation, payload = _external_bundle(tmp_path)
    first = _payload_declarations(payload)[0]
    (restored / cast(str, first["path"])).write_bytes(b"tampered")
    report = verify_external_model_bundle(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
        archive_observation_path=observation,
    )
    assert report["status"] == "REJECTED"
    assert any(
        cast(str, reason).startswith("RESTORED_FILE_")
        for reason in cast(list[str], report["reasons"])
    )


def test_copy_of_original_is_not_a_clean_restore(tmp_path: Path) -> None:
    manifest, original, restored, observation, _ = _external_bundle(tmp_path)
    shutil.rmtree(restored)
    shutil.copytree(original, restored)
    report = verify_external_model_bundle(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
        archive_observation_path=observation,
    )
    assert report["status"] == "REJECTED"
    assert any(
        cast(str, reason).startswith("RESTORED_FILE_EXTRA:storage/")
        for reason in cast(list[str], report["reasons"])
    )


def test_version_identity_and_archive_observation_are_mandatory(tmp_path: Path) -> None:
    manifest, original, restored, observation, payload = _external_bundle(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    object_record = cast(dict[str, Any], storage["object"])
    object_record["version_id"] = "null"
    _write_json(manifest, payload)
    observed = json.loads(observation.read_text())
    observed["archive_sha256"] = "0" * 64
    _write_json(observation, observed)
    output = tmp_path / "report.json"
    assert (
        main(
            [
                str(AUTHORITY_PATH),
                str(manifest),
                str(original),
                str(restored),
                str(observation),
                "--output",
                str(output),
            ]
        )
        == 2
    )
    reasons = cast(list[str], json.loads(output.read_text())["reasons"])
    assert "OBJECT_VERSION_ID_MISSING" in reasons
    assert "ARCHIVE_OBSERVATION_SHA256_MISMATCH" in reasons
