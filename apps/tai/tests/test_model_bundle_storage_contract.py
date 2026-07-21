from __future__ import annotations

import io
import json
import shutil
import tarfile
from pathlib import Path
from typing import Any, cast

import pytest
from model_bundle_v2_support import (
    AUTHORITY_PATH,
    _manifest_payload,
    _sha256,
    _write,
    _write_json,
)

from tai.model_bundle_finalize import extract_streamed_archive
from tai.model_bundle_storage import verify_bundle_storage_v2
from tai.model_bundle_storage_cli import main


def _payload_declarations(payload: dict[str, Any]) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    result.extend(cast(list[dict[str, object]], payload["source_files"]))
    remote = cast(dict[str, Any], payload["remote_inventory"])
    result.append(cast(dict[str, object], remote["evidence_file"]))
    legal = cast(dict[str, Any], payload["legal_review"])
    result.extend(
        [
            cast(dict[str, object], legal["license_text"]),
            cast(dict[str, object], legal["review_record"]),
        ]
    )
    toolchain = cast(dict[str, Any], payload["toolchain_package"])
    result.extend(
        [
            cast(dict[str, object], toolchain["package"]),
            cast(dict[str, object], toolchain["build_manifest"]),
            cast(dict[str, object], toolchain["verification_report"]),
        ]
    )
    for binary in cast(list[dict[str, Any]], toolchain["binaries"]):
        result.append(cast(dict[str, object], binary["file"]))
    conversion = cast(dict[str, Any], payload["conversion"])
    result.extend(
        [
            cast(dict[str, object], conversion["python_dependencies"]),
            cast(dict[str, object], conversion["converter"]),
            cast(dict[str, object], conversion["log"]),
            cast(dict[str, object], conversion["intermediate"]),
        ]
    )
    for quantization in cast(list[dict[str, Any]], payload["quantizations"]):
        result.extend(
            [
                cast(dict[str, object], quantization["log"]),
                cast(dict[str, object], quantization["output"]),
            ]
        )
    return sorted(result, key=lambda item: cast(str, item["path"]))


def _write_payload_index(original: Path, payload: dict[str, Any]) -> None:
    entries = [
        {
            "path": item["path"],
            "sha256": item["sha256"],
            "size_bytes": item["size_bytes"],
        }
        for item in _payload_declarations(payload)
    ]
    content = json.dumps(
        {
            "schema_version": "tai.model-bundle-payload-index.v1",
            "model_id": payload["model_id"],
            "revision": payload["revision"],
            "entries": entries,
        },
        sort_keys=True,
    ).encode()
    storage = cast(dict[str, Any], payload["storage"])
    storage["payload_index"] = _write(original, "storage/payload-index.json", content)


def _archive_bytes(
    original: Path,
    payload: dict[str, Any],
    *,
    extra_member: tarfile.TarInfo | None = None,
    extra_content: bytes = b"",
) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w") as archive:
        for item in _payload_declarations(payload):
            relative = cast(str, item["path"])
            archive.add(original / relative, arcname=relative, recursive=False)
        if extra_member is not None:
            extra_member.size = len(extra_content)
            archive.addfile(extra_member, io.BytesIO(extra_content))
    return output.getvalue()


def _refresh_storage_records(original: Path, payload: dict[str, Any]) -> None:
    storage = cast(dict[str, Any], payload["storage"])
    upload = {
        "schema_version": "tai.model-bundle-upload-record.v1",
        "archive_sha256": storage["bundle_archive"]["sha256"],
        "immutable_locator": storage["immutable_locator"],
        "uploaded_at": storage["uploaded_at"],
        "retention_days": storage["retention_days"],
        "retention_expires_at": storage["retention_expires_at"],
    }
    restore = {
        "schema_version": "tai.model-bundle-restore-record.v1",
        "archive_sha256": storage["bundle_archive"]["sha256"],
        "immutable_locator": storage["immutable_locator"],
        "restored_at": storage["restored_at"],
    }
    storage["upload_record"] = _write(
        original,
        "storage/upload-record.json",
        json.dumps(upload, sort_keys=True).encode(),
    )
    storage["restore_record"] = _write(
        original,
        "storage/restore-record.json",
        json.dumps(restore, sort_keys=True).encode(),
    )


def _external_bundle(
    tmp_path: Path,
) -> tuple[Path, Path, Path, dict[str, Any], bytes]:
    manifest, original, restored, payload = _manifest_payload(tmp_path)
    shutil.rmtree(restored)
    storage = cast(dict[str, Any], payload["storage"])
    old_archive = cast(dict[str, Any], storage["bundle_archive"])
    (original / cast(str, old_archive["path"])).unlink()
    _write_payload_index(original, payload)
    archive = _archive_bytes(original, payload)
    digest = _sha256(archive)
    storage["bundle_archive"] = {
        "path": "storage/model.bundle.tar",
        "sha256": digest,
        "size_bytes": len(archive),
    }
    storage["immutable_locator"] = (
        "s3+https://s3.example.test/tai-bundles/"
        f"objects/{digest}?versionId=version-001#sha256:{digest}"
    )
    storage["uploaded_at"] = "2026-07-20T02:00:00+00:00"
    storage["retention_days"] = 90
    storage["retention_expires_at"] = "2026-10-18T02:00:00+00:00"
    storage["restored_at"] = "2026-07-20T02:30:00+00:00"
    _refresh_storage_records(original, payload)
    _write_json(manifest, payload)
    extract_streamed_archive(
        payload_index_path=original / "storage/payload-index.json",
        restore_root=restored,
        stream=io.BytesIO(archive),
    )
    return manifest, original, restored, payload, archive


def test_external_archive_metadata_and_clean_restore_verify(tmp_path: Path) -> None:
    manifest, original, restored, payload, archive = _external_bundle(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    archive_path = original / cast(dict[str, Any], storage["bundle_archive"])["path"]
    assert not archive_path.exists()
    assert len(archive) == storage["bundle_archive"]["size_bytes"]
    report = verify_bundle_storage_v2(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
    )
    assert report["status"] == "VERIFIED"
    assert report["reasons"] == []
    assert report["archive_sha256"] == storage["bundle_archive"]["sha256"]


def test_copytree_restore_is_rejected_by_exact_payload_set(tmp_path: Path) -> None:
    manifest, original, restored, _, _ = _external_bundle(tmp_path)
    shutil.rmtree(restored)
    shutil.copytree(original, restored)
    report = verify_bundle_storage_v2(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
    )
    assert report["status"] == "REJECTED"
    assert any(
        cast(str, reason).startswith("RESTORED_FILE_EXTRA:storage/")
        for reason in cast(list[str], report["reasons"])
    )


def test_payload_index_drift_is_rejected_semantically(tmp_path: Path) -> None:
    manifest, original, restored, payload, _ = _external_bundle(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    index_path = original / cast(dict[str, Any], storage["payload_index"])["path"]
    index = json.loads(index_path.read_text())
    index["entries"].pop()
    storage["payload_index"] = _write(
        original,
        "storage/payload-index.json",
        json.dumps(index, sort_keys=True).encode(),
    )
    _write_json(manifest, payload)
    report = verify_bundle_storage_v2(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
    )
    assert report["status"] == "REJECTED"
    assert "PAYLOAD_INDEX_MISMATCH" in report["reasons"]


def test_immutable_locator_requires_exact_version_id(tmp_path: Path) -> None:
    manifest, original, restored, payload, _ = _external_bundle(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    digest = storage["bundle_archive"]["sha256"]
    storage["immutable_locator"] = f"s3+https://s3.example.test/object#sha256:{digest}"
    _refresh_storage_records(original, payload)
    _write_json(manifest, payload)
    report = verify_bundle_storage_v2(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
    )
    assert "ARCHIVE_LOCATOR_VERSION_ID_MISSING" in report["reasons"]


def test_upload_sidecar_semantic_mismatch_is_rejected(tmp_path: Path) -> None:
    manifest, original, restored, payload, _ = _external_bundle(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    upload_path = original / cast(dict[str, Any], storage["upload_record"])["path"]
    upload = json.loads(upload_path.read_text())
    upload["retention_days"] = 89
    storage["upload_record"] = _write(
        original,
        "storage/upload-record.json",
        json.dumps(upload, sort_keys=True).encode(),
    )
    _write_json(manifest, payload)
    report = verify_bundle_storage_v2(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
    )
    assert "UPLOAD_RECORD_MISMATCH" in report["reasons"]


def test_stream_extractor_rejects_path_traversal(tmp_path: Path) -> None:
    _, original, restored, payload, _ = _external_bundle(tmp_path)
    shutil.rmtree(restored)
    malicious = tarfile.TarInfo("../escape")
    archive = _archive_bytes(original, payload, extra_member=malicious, extra_content=b"escape")
    with pytest.raises(ValueError, match="unsafe archive member path"):
        extract_streamed_archive(
            payload_index_path=original / "storage/payload-index.json",
            restore_root=restored,
            stream=io.BytesIO(archive),
        )
    assert not restored.exists()


def test_stream_extractor_rejects_links(tmp_path: Path) -> None:
    _, original, restored, payload, _ = _external_bundle(tmp_path)
    shutil.rmtree(restored)
    link = tarfile.TarInfo("unsafe-link")
    link.type = tarfile.SYMTYPE
    link.linkname = "sources/qwen3-8b/config.json"
    archive = _archive_bytes(original, payload, extra_member=link)
    with pytest.raises(ValueError, match="unsafe archive member type"):
        extract_streamed_archive(
            payload_index_path=original / "storage/payload-index.json",
            restore_root=restored,
            stream=io.BytesIO(archive),
        )


def test_storage_cli_fails_closed(tmp_path: Path) -> None:
    manifest, original, restored, payload, _ = _external_bundle(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    storage["immutable_locator"] = "s3+https://s3.example.test/object?versionId=v1#sha256:bad"
    _refresh_storage_records(original, payload)
    _write_json(manifest, payload)
    output = tmp_path / "report.json"
    assert (
        main(
            [
                str(AUTHORITY_PATH),
                str(manifest),
                str(original),
                str(restored),
                "--output",
                str(output),
            ]
        )
        == 2
    )
    assert json.loads(output.read_text())["status"] == "REJECTED"
