from __future__ import annotations

import io
import json
import shutil
import tarfile
from pathlib import Path
from typing import Any, cast

from model_bundle_v2_support import (
    AUTHORITY_PATH,
    _manifest_payload,
    _sha256,
    _write,
    _write_json,
)

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
    storage["payload_index"] = _write(
        original, "storage/payload-index.json", content
    )


def _create_archive(
    original: Path, payload: dict[str, Any], *, malicious: bool = False
) -> None:
    storage = cast(dict[str, Any], payload["storage"])
    old_path = original / cast(dict[str, Any], storage["bundle_archive"])["path"]
    old_path.unlink(missing_ok=True)
    archive_path = original / "storage/bundle.tar"
    archive_path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, "w") as archive:
        for item in _payload_declarations(payload):
            relative = cast(str, item["path"])
            archive.add(original / relative, arcname=relative, recursive=False)
        if malicious:
            data = b"escape"
            member = tarfile.TarInfo("../escape")
            member.size = len(data)
            archive.addfile(member, io.BytesIO(data))
    content = archive_path.read_bytes()
    storage["bundle_archive"] = {
        "path": "storage/bundle.tar",
        "sha256": _sha256(content),
        "size_bytes": len(content),
    }
    storage["immutable_locator"] = (
        "file+sha256://tai-model-bundles/objects/bundle"
        f"@sha256:{storage['bundle_archive']['sha256']}"
    )


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


def _extract_payload_archive(
    original: Path, restored: Path, payload: dict[str, Any]
) -> None:
    storage = cast(dict[str, Any], payload["storage"])
    archive_path = original / cast(dict[str, Any], storage["bundle_archive"])["path"]
    restored.mkdir(parents=True)
    with tarfile.open(archive_path, "r:*") as archive:
        archive.extractall(restored, filter="data")


def _honest_bundle(tmp_path: Path) -> tuple[Path, Path, Path, dict[str, Any]]:
    manifest, original, restored, payload = _manifest_payload(tmp_path)
    shutil.rmtree(restored)
    _write_payload_index(original, payload)
    _create_archive(original, payload)
    _refresh_storage_records(original, payload)
    _write_json(manifest, payload)
    _extract_payload_archive(original, restored, payload)
    return manifest, original, restored, payload


def test_non_self_referential_archive_and_clean_restore_verify(
    tmp_path: Path,
) -> None:
    manifest, original, restored, payload = _honest_bundle(tmp_path)
    report = verify_bundle_storage_v2(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
    )
    assert report["status"] == "VERIFIED"
    assert report["reasons"] == []
    assert "storage/bundle.tar" not in {
        item["path"] for item in _payload_declarations(payload)
    }
    assert len(cast(list[str], report["verified_payload_files"])) == len(
        cast(list[str], report["restored_payload_files"])
    )


def test_copytree_restore_is_rejected_by_exact_payload_set(tmp_path: Path) -> None:
    manifest, original, restored, _ = _honest_bundle(tmp_path)
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


def test_archive_content_must_match_payload_index(tmp_path: Path) -> None:
    manifest, original, restored, payload = _honest_bundle(tmp_path)
    shutil.rmtree(restored)
    first = _payload_declarations(payload)[0]
    target = original / cast(str, first["path"])
    original_content = target.read_bytes()
    target.write_bytes(b"tampered")
    _create_archive(original, payload)
    target.write_bytes(original_content)
    _refresh_storage_records(original, payload)
    _write_json(manifest, payload)
    _extract_payload_archive(original, restored, payload)
    report = verify_bundle_storage_v2(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
    )
    assert report["status"] == "REJECTED"
    assert any(
        cast(str, reason).startswith("ARCHIVE_ENTRY_")
        for reason in cast(list[str], report["reasons"])
    )


def test_archive_path_traversal_is_rejected(tmp_path: Path) -> None:
    manifest, original, restored, payload = _honest_bundle(tmp_path)
    shutil.rmtree(restored)
    _create_archive(original, payload, malicious=True)
    _refresh_storage_records(original, payload)
    _write_json(manifest, payload)
    restored.mkdir()
    report = verify_bundle_storage_v2(
        authority_path=AUTHORITY_PATH,
        manifest_path=manifest,
        original_root=original,
        restored_root=restored,
    )
    assert report["status"] == "REJECTED"
    assert "ARCHIVE_MEMBER_UNSAFE:../escape" in report["reasons"]


def test_payload_index_is_semantic_and_cli_fails_closed(tmp_path: Path) -> None:
    manifest, original, restored, payload = _honest_bundle(tmp_path)
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
    report = json.loads(output.read_text())
    assert "PAYLOAD_INDEX_MISMATCH" in report["reasons"]
