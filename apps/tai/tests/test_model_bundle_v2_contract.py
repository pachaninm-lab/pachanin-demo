from __future__ import annotations

import json
import os
import shutil
from pathlib import Path
from typing import Any, cast

import pytest
from model_bundle_v2_support import (
    AUTHORITY_PATH,
    MODEL_ARTIFACTS,
    _manifest_payload,
    _sha256,
    _verify,
    _write_json,
)

from tai.model_artifact_registry_cli import main
from tai.model_bundle_v2 import (
    BundleVerificationStatus,
    InventoryDisposition,
    load_local_model_bundle_v2,
    load_model_bundle_authority_v2,
    source_files_sha256_v2,
    verify_local_model_bundle_v2,
)


def test_repository_authority_has_exact_qwen_and_mistral_inputs() -> None:
    authority = load_model_bundle_authority_v2(AUTHORITY_PATH)
    qwen, mistral = authority.models
    qwen_selected = {item.path for item in qwen.selected_inventory}
    assert {
        "sources/qwen3-8b/README.md",
        "sources/qwen3-8b/config.json",
        "sources/qwen3-8b/generation_config.json",
        "sources/qwen3-8b/merges.txt",
        "sources/qwen3-8b/tokenizer.json",
        "sources/qwen3-8b/tokenizer_config.json",
        "sources/qwen3-8b/vocab.json",
    }.issubset(qwen_selected)
    mistral_selected = {item.path for item in mistral.selected_inventory}
    assert "sources/mistral-7b-instruct-v0.3/tokenizer.model" in mistral_selected
    consolidated = next(
        item for item in mistral.inventory if item.path.endswith("consolidated.safetensors")
    )
    assert consolidated.disposition is InventoryDisposition.EXCLUDED
    assert consolidated.exclusion_reason is not None
    assert "shard/index" in consolidated.exclusion_reason


def test_pending_baselines_are_honest_and_cannot_verify() -> None:
    authority = load_model_bundle_authority_v2(AUTHORITY_PATH)
    for name in (
        "qwen3-8b.bundle.v2.pending.json",
        "mistral-7b-instruct-v0.3.bundle.v2.pending.json",
    ):
        bundle = load_local_model_bundle_v2(MODEL_ARTIFACTS / name)
        report = verify_local_model_bundle_v2(
            authority=authority,
            bundle=bundle,
            bundle_root=MODEL_ARTIFACTS,
            restored_root=None,
        )
        assert report.status is BundleVerificationStatus.PENDING_ACQUISITION
        assert report.reasons == ("ACQUISITION_PENDING",)
        assert not report.verified


def test_complete_bundle_verifies_only_with_original_and_restore(tmp_path: Path) -> None:
    report, payload, manifest, _, _ = _verify(tmp_path)
    bundle = load_local_model_bundle_v2(manifest)
    assert report.status is BundleVerificationStatus.VERIFIED
    assert report.reasons == ()
    assert report.verified
    assert report.manifest_sha256 == _sha256(
        json.dumps(
            payload,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode()
    )
    assert report.authority_sha256 == bundle.authority_sha256
    assert set(report.verified_files) - set(report.restored_files) == {
        "storage/upload-record.json",
        "storage/restore-record.json",
    }
    assert "storage/payload-index.json" in report.restored_files
    assert len(report.report_sha256) == 64
    assert (
        source_files_sha256_v2(bundle.source_files) == payload["conversion"]["source_files_sha256"]
    )


def test_archive_is_external_metadata_and_payload_index_is_exact(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    archive = cast(dict[str, Any], storage["bundle_archive"])
    assert set(archive) == {"media_type", "sha256", "size_bytes"}
    assert "path" not in archive

    payload_index = cast(dict[str, Any], storage["payload_index"])
    index_path = root / cast(str, payload_index["path"])
    index_payload = json.loads(index_path.read_text(encoding="utf-8"))
    cast(list[dict[str, Any]], index_payload["files"]).pop()
    content = json.dumps(index_payload, sort_keys=True).encode()
    index_path.write_bytes(content)
    (restored / cast(str, payload_index["path"])).write_bytes(content)
    payload_index["sha256"] = _sha256(content)
    payload_index["size_bytes"] = len(content)
    _write_json(manifest, payload)

    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert report.status is BundleVerificationStatus.REJECTED
    assert "PAYLOAD_INDEX_MISMATCH" in report.reasons


def test_archive_payload_path_is_rejected(tmp_path: Path) -> None:
    _, payload, manifest, _, _ = _verify(tmp_path)
    storage = cast(dict[str, Any], payload["storage"])
    archive = cast(dict[str, Any], storage["bundle_archive"])
    archive["path"] = "storage/bundle.tar.zst"
    _write_json(manifest, payload)
    with pytest.raises(ValueError, match="unknown keys"):
        load_local_model_bundle_v2(manifest)


def test_duplicate_and_unknown_json_keys_are_rejected(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text(
        '{"schema_version":"tai.local-model-artifact-bundle.v2",'
        '"schema_version":"tai.local-model-artifact-bundle.v2"}',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="duplicate JSON key"):
        load_local_model_bundle_v2(duplicate)

    manifest, _, _, payload = _manifest_payload(tmp_path / "unknown")
    cast(dict[str, Any], payload["legal_review"])["automated_approval"] = True
    _write_json(manifest, payload)
    with pytest.raises(ValueError, match="unknown keys"):
        load_local_model_bundle_v2(manifest)


def test_source_weight_and_exact_input_set_are_fail_closed(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    source_files = cast(list[dict[str, Any]], payload["source_files"])
    source_files[:] = [item for item in source_files if item["role"] != "WEIGHT_SHARD"]
    cast(dict[str, Any], payload["conversion"])["source_files_sha256"] = "0" * 64
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert report.status is BundleVerificationStatus.REJECTED
    assert "SOURCE_WEIGHT_SHARDS_MISSING" in report.reasons
    assert "SOURCE_FILE_SET_MISMATCH" in report.reasons


def test_mistral_requires_tokenizer_model_and_excluded_consolidated_inventory(
    tmp_path: Path,
) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path, model_index=1)
    source_files = cast(list[dict[str, Any]], payload["source_files"])
    source_files[:] = [
        item for item in source_files if not cast(str, item["path"]).endswith("tokenizer.model")
    ]
    entries = cast(dict[str, Any], payload["remote_inventory"])["entries"]
    cast(list[dict[str, Any]], entries)[:] = [
        item
        for item in cast(list[dict[str, Any]], entries)
        if not cast(str, item["path"]).endswith("consolidated.safetensors")
    ]
    cast(dict[str, Any], payload["conversion"])["source_files_sha256"] = "1" * 64
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "SOURCE_FILE_SET_MISMATCH" in report.reasons
    assert "REMOTE_INVENTORY_SET_MISMATCH" in report.reasons


def test_legal_review_must_be_human_approved(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    legal = cast(dict[str, Any], payload["legal_review"])
    legal["decision"] = "PENDING"
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert report.status is BundleVerificationStatus.REJECTED
    assert "LEGAL_REVIEW_NOT_APPROVED" in report.reasons

    legal["decision"] = "APPROVED"
    legal["reviewer_type"] = "BOT"
    _write_json(manifest, payload)
    with pytest.raises(ValueError):
        load_local_model_bundle_v2(manifest)


def test_toolchain_report_and_four_binary_contract_are_enforced(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    package = cast(dict[str, Any], payload["toolchain_package"])
    binaries = cast(list[dict[str, Any]], package["binaries"])
    binaries.pop()
    _write_json(manifest, payload)
    with pytest.raises(ValueError, match="exactly four"):
        load_local_model_bundle_v2(manifest)

    _, payload, manifest, root, restored = _verify(tmp_path / "report")
    report_path = (
        root / cast(dict[str, Any], payload["toolchain_package"])["verification_report"]["path"]
    )
    report_path.write_text(
        json.dumps(
            {
                "authority_sha256": (
                    "3064250e63baed7bdcfd20851e1d3ea2c86fc33f087b69a2a4fcff18c384374b"
                ),
                "status": "VERIFIED",
                "verified_targets": ["llama-cli"],
            }
        ),
        encoding="utf-8",
    )
    declaration = cast(dict[str, Any], payload["toolchain_package"])["verification_report"]
    content = report_path.read_bytes()
    cast(dict[str, Any], declaration)["sha256"] = _sha256(content)
    cast(dict[str, Any], declaration)["size_bytes"] = len(content)
    shutil.copy2(report_path, restored / cast(dict[str, Any], declaration)["path"])
    _write_json(manifest, payload)
    verification = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "TOOLCHAIN_VERIFICATION_REPORT_TARGET_SET_MISMATCH" in verification.reasons


def test_conversion_and_quantization_are_transitively_bound(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    conversion = cast(dict[str, Any], payload["conversion"])
    cast(list[str], conversion["argv"])[-1] = "f32"
    quantization = cast(list[dict[str, Any]], payload["quantizations"])[0]
    quantization["input_sha256"] = "2" * 64
    quantization["quantize_binary_sha256"] = "3" * 64
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "CONVERSION_ARGV_MISMATCH" in report.reasons
    assert any(
        reason.startswith("QUANTIZATION_INPUT_BINDING_MISMATCH") for reason in report.reasons
    )
    assert any(
        reason.startswith("QUANTIZATION_BINARY_BINDING_MISMATCH") for reason in report.reasons
    )


def test_shard_index_symlink_inode_and_restore_tampering_are_rejected(
    tmp_path: Path,
) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    source_files = cast(list[dict[str, Any]], payload["source_files"])
    index = next(item for item in source_files if item["role"] == "SHARD_INDEX")
    index_path = root / cast(str, index["path"])
    broken_index = json.dumps({"weight_map": {"tensor": "missing.safetensors"}}).encode()
    index_path.write_bytes(broken_index)
    index["sha256"] = _sha256(broken_index)
    index["size_bytes"] = len(broken_index)
    shutil.copy2(index_path, restored / cast(str, index["path"]))

    first_source = source_files[0]
    source_path = root / cast(str, first_source["path"])
    source_path.unlink()
    source_path.symlink_to(index_path)

    restored_target = restored / cast(str, source_files[1]["path"])
    restored_target.write_bytes(b"tampered restored payload")
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "SHARD_INDEX_SHARD_SET_MISMATCH" in report.reasons
    assert any("FILE_UNSAFE" in reason and "symlink" in reason for reason in report.reasons)
    assert any(reason.startswith("RESTORED_FILE_") for reason in report.reasons)


def test_hardlink_alias_is_rejected(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    source_files = cast(list[dict[str, Any]], payload["source_files"])
    first, second = source_files[:2]
    first_path = root / cast(str, first["path"])
    second_path = root / cast(str, second["path"])
    second_path.unlink()
    os.link(first_path, second_path)
    second["sha256"] = first["sha256"]
    second["size_bytes"] = first["size_bytes"]
    cast(dict[str, Any], payload["conversion"])["source_files_sha256"] = "4" * 64
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert any(reason.startswith("FILE_INODE_ALIAS:") for reason in report.reasons)


def test_wrong_authority_digest_rejects_even_pending_baseline(tmp_path: Path) -> None:
    payload = json.loads(
        (MODEL_ARTIFACTS / "qwen3-8b.bundle.v2.pending.json").read_text(encoding="utf-8")
    )
    payload["authority_sha256"] = "f" * 64
    path = tmp_path / "pending.json"
    _write_json(path, payload)
    bundle = load_local_model_bundle_v2(path)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=bundle,
        bundle_root=tmp_path,
        restored_root=None,
    )
    assert report.status is BundleVerificationStatus.REJECTED
    assert report.reasons == ("AUTHORITY_SHA256_MISMATCH",)


def test_cli_returns_zero_only_for_complete_verified_bundle(tmp_path: Path) -> None:
    manifest, root, restored, _ = _manifest_payload(tmp_path / "complete")
    output = tmp_path / "complete-report.json"
    result = main(
        [
            "verify-bundle-v2",
            str(AUTHORITY_PATH),
            str(manifest),
            str(root),
            str(restored),
            "--output",
            str(output),
        ]
    )
    assert result == 0
    assert json.loads(output.read_text(encoding="utf-8"))["status"] == "VERIFIED"

    pending_output = tmp_path / "pending-report.json"
    pending_result = main(
        [
            "verify-bundle-v2",
            str(AUTHORITY_PATH),
            str(MODEL_ARTIFACTS / "qwen3-8b.bundle.v2.pending.json"),
            str(tmp_path),
            str(tmp_path),
            "--output",
            str(pending_output),
        ]
    )
    assert pending_result == 2
    assert json.loads(pending_output.read_text(encoding="utf-8"))["status"] == "PENDING_ACQUISITION"
