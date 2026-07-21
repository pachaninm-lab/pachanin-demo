from __future__ import annotations

import copy
import json
import shutil
from pathlib import Path
from typing import Any, cast

import pytest
from model_bundle_v2_support import (
    AUTHORITY_PATH,
    _sha256,
    _verify,
    _write_json,
)

from tai.model_artifact_registry_cli import main
from tai.model_bundle_v2 import (
    BundleVerificationStatus,
    load_local_model_bundle_v2,
    load_model_bundle_authority_v2,
    verify_local_model_bundle_v2,
)


def test_cli_validates_authority_and_emits_canonical_digest(tmp_path: Path) -> None:
    output = tmp_path / "authority-report.json"
    result = main(
        [
            "validate-bundle-authority-v2",
            str(AUTHORITY_PATH),
            "--output",
            str(output),
        ]
    )
    payload = json.loads(output.read_text(encoding="utf-8"))
    assert result == 0
    assert payload["status"] == "VALID"
    assert payload["model_count"] == 2
    assert len(payload["authority_sha256"]) == 64


def test_authority_parser_rejects_structurally_unsafe_variants(tmp_path: Path) -> None:
    original = json.loads(AUTHORITY_PATH.read_text(encoding="utf-8"))

    def selected_with_reason(payload: dict[str, Any]) -> None:
        payload["models"][0]["source_inventory"][1]["exclusion_reason"] = "not allowed"

    def excluded_without_reason(payload: dict[str, Any]) -> None:
        payload["models"][0]["source_inventory"][0]["exclusion_reason"] = None

    def unsupported_intermediate(payload: dict[str, Any]) -> None:
        payload["models"][0]["conversion"]["intermediate_format"] = "F32"

    def conversion_without_output(payload: dict[str, Any]) -> None:
        payload["models"][0]["conversion"]["argv"] = [
            "python3",
            "toolchain/source/convert_hf_to_gguf.py",
        ]

    def conversion_without_converter(payload: dict[str, Any]) -> None:
        payload["models"][0]["conversion"]["argv"] = [
            "python3",
            payload["models"][0]["conversion"]["intermediate_path"],
        ]

    def quantization_without_output(payload: dict[str, Any]) -> None:
        payload["models"][0]["quantizations"][0]["argv"] = ["Q4_K_M"]

    def quantization_without_identity(payload: dict[str, Any]) -> None:
        output = payload["models"][0]["quantizations"][0]["output_path"]
        payload["models"][0]["quantizations"][0]["argv"] = [output]

    def invalid_release(payload: dict[str, Any]) -> None:
        payload["toolchain"]["release"] = "not valid"

    def missing_binary(payload: dict[str, Any]) -> None:
        payload["toolchain"]["required_binaries"].pop()

    def duplicate_binary(payload: dict[str, Any]) -> None:
        payload["toolchain"]["required_binaries"].append("llama-cli")

    def mutable_source_uri(payload: dict[str, Any]) -> None:
        payload["models"][0]["source_uri"] = "https://huggingface.co/Qwen/Qwen3-8B/tree/main"

    def mutable_card_uri(payload: dict[str, Any]) -> None:
        payload["models"][0]["model_card_uri"] = "https://huggingface.co/Qwen/Qwen3-8B"

    def empty_inventory(payload: dict[str, Any]) -> None:
        payload["models"][0]["source_inventory"] = []

    def duplicate_inventory(payload: dict[str, Any]) -> None:
        payload["models"][0]["source_inventory"].append(
            copy.deepcopy(payload["models"][0]["source_inventory"][1])
        )

    def missing_required_role(payload: dict[str, Any]) -> None:
        payload["models"][0]["source_inventory"] = [
            item
            for item in payload["models"][0]["source_inventory"]
            if item["role"] != "MODEL_CARD"
        ]

    def duplicate_shard_index(payload: dict[str, Any]) -> None:
        extra = copy.deepcopy(payload["models"][0]["source_inventory"][10])
        extra["path"] = "sources/qwen3-8b/second.index.json"
        payload["models"][0]["source_inventory"].append(extra)

    def no_quantizations(payload: dict[str, Any]) -> None:
        payload["models"][0]["quantizations"] = []

    def duplicate_quantization_output(payload: dict[str, Any]) -> None:
        payload["models"][0]["quantizations"][1]["output_path"] = payload["models"][0][
            "quantizations"
        ][0]["output_path"]
        payload["models"][0]["quantizations"][1]["argv"] = payload["models"][0]["quantizations"][0][
            "argv"
        ]

    def duplicate_quantization_identity(payload: dict[str, Any]) -> None:
        payload["models"][0]["quantizations"][1]["runtime_class"] = "CPU"
        payload["models"][0]["quantizations"][1]["quantization"] = "Q4_K_M"
        payload["models"][0]["quantizations"][1]["argv"][-1] = "Q4_K_M"

    def no_cpu_quantization(payload: dict[str, Any]) -> None:
        payload["models"][0]["quantizations"][0]["runtime_class"] = "GPU_DEDICATED"

    def empty_models(payload: dict[str, Any]) -> None:
        payload["models"] = []

    def duplicate_model(payload: dict[str, Any]) -> None:
        payload["models"].append(copy.deepcopy(payload["models"][0]))

    def two_primaries(payload: dict[str, Any]) -> None:
        payload["models"][1]["role"] = "PRIMARY"

    def no_fallback(payload: dict[str, Any]) -> None:
        payload["models"] = [payload["models"][0]]

    mutations = [
        selected_with_reason,
        excluded_without_reason,
        unsupported_intermediate,
        conversion_without_output,
        conversion_without_converter,
        quantization_without_output,
        quantization_without_identity,
        invalid_release,
        missing_binary,
        duplicate_binary,
        mutable_source_uri,
        mutable_card_uri,
        empty_inventory,
        duplicate_inventory,
        missing_required_role,
        duplicate_shard_index,
        no_quantizations,
        duplicate_quantization_output,
        duplicate_quantization_identity,
        no_cpu_quantization,
        empty_models,
        duplicate_model,
        two_primaries,
        no_fallback,
    ]
    for index, mutation in enumerate(mutations):
        payload = copy.deepcopy(original)
        mutation(payload)
        path = tmp_path / f"invalid-authority-{index}.json"
        _write_json(path, payload)
        with pytest.raises(ValueError):
            load_model_bundle_authority_v2(path)


def test_complete_manifest_missing_sections_is_rejected(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    payload["remote_inventory"] = None
    payload["source_files"] = []
    payload["legal_review"] = None
    payload["toolchain_package"] = None
    payload["conversion"] = None
    payload["quantizations"] = []
    payload["storage"] = None
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert report.status is BundleVerificationStatus.REJECTED
    for section in (
        "REMOTE_INVENTORY",
        "SOURCE_FILES",
        "LEGAL_REVIEW",
        "TOOLCHAIN_PACKAGE",
        "CONVERSION",
        "QUANTIZATIONS",
        "STORAGE",
    ):
        assert f"MANIFEST_SECTION_MISSING:{section}" in report.reasons


def test_authority_and_transitive_contract_drift_reasons_are_complete(
    tmp_path: Path,
) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    payload["role"] = "FALLBACK"
    remote = cast(dict[str, Any], payload["remote_inventory"])
    cast(list[dict[str, Any]], remote["entries"])[1]["size_bytes"] += 1
    legal = cast(dict[str, Any], payload["legal_review"])
    legal["license_spdx"] = "MIT"
    toolchain = cast(dict[str, Any], payload["toolchain_package"])
    toolchain["profile"] = "linux-x86_64-drift"
    conversion = cast(dict[str, Any], payload["conversion"])
    conversion["converter"]["path"] = "toolchain/source/other.py"
    conversion["intermediate"]["path"] = "artifacts/other.gguf"
    conversion["source_files_sha256"] = "5" * 64
    conversion["toolchain_package_sha256"] = "6" * 64
    quantizations = cast(list[dict[str, Any]], payload["quantizations"])
    quantizations[0]["argv"] = [
        "toolchain/bin/llama-quantize",
        "wrong-input.gguf",
        quantizations[0]["output"]["path"],
        quantizations[0]["quantization"],
    ]
    quantizations[0]["output"]["path"] = "artifacts/wrong-output.gguf"
    quantizations.pop()
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "MODEL_ROLE_MISMATCH" in report.reasons
    assert any(reason.startswith("REMOTE_LOCAL_SIZE_MISMATCH") for reason in report.reasons)
    assert "LICENSE_SPDX_MISMATCH" in report.reasons
    assert "TOOLCHAIN_PACKAGE_AUTHORITY_MISMATCH" in report.reasons
    assert "CONVERTER_PATH_MISMATCH" in report.reasons
    assert "INTERMEDIATE_PATH_MISMATCH" in report.reasons
    assert "CONVERSION_SOURCE_BINDING_MISMATCH" in report.reasons
    assert "CONVERSION_TOOLCHAIN_BINDING_MISMATCH" in report.reasons
    assert "QUANTIZATION_SET_MISMATCH" in report.reasons


def test_missing_size_hash_and_restore_root_fail_closed(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    source = cast(list[dict[str, Any]], payload["source_files"])[0]
    source_path = root / cast(str, source["path"])
    source_path.unlink()
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=None,
    )
    assert any(reason.startswith("FILE_MISSING:") for reason in report.reasons)
    assert "RESTORED_ROOT_REQUIRED" in report.reasons

    _, payload, manifest, root, restored = _verify(tmp_path / "mismatch")
    source = cast(list[dict[str, Any]], payload["source_files"])[0]
    source_path = root / cast(str, source["path"])
    source_path.write_bytes(source_path.read_bytes() + b"x")
    restored_path = restored / cast(str, source["path"])
    restored_path.write_bytes(b"same-size-wrong".ljust(cast(int, source["size_bytes"]), b"x"))
    _write_json(manifest, payload)
    mismatch = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert any(reason.startswith("FILE_SIZE_MISMATCH:") for reason in mismatch.reasons)
    assert any(reason.startswith("RESTORED_FILE_SHA256_MISMATCH:") for reason in mismatch.reasons)


def test_shard_index_and_toolchain_report_parse_failures_are_rejected(
    tmp_path: Path,
) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    index = next(
        item
        for item in cast(list[dict[str, Any]], payload["source_files"])
        if item["role"] == "SHARD_INDEX"
    )
    index_path = root / cast(str, index["path"])
    index_path.write_text("{not-json", encoding="utf-8")
    index_content = index_path.read_bytes()
    index["sha256"] = _sha256(index_content)
    index["size_bytes"] = len(index_content)
    shutil.copy2(index_path, restored / cast(str, index["path"]))

    toolchain = cast(dict[str, Any], payload["toolchain_package"])
    toolchain_report = cast(dict[str, Any], toolchain["verification_report"])
    report_path = root / cast(str, toolchain_report["path"])
    report_path.write_text("{not-json", encoding="utf-8")
    report_content = report_path.read_bytes()
    toolchain_report["sha256"] = _sha256(report_content)
    toolchain_report["size_bytes"] = len(report_content)
    shutil.copy2(report_path, restored / cast(str, toolchain_report["path"]))
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert any(reason.startswith("SHARD_INDEX_INVALID:") for reason in report.reasons)
    assert any(
        reason.startswith("TOOLCHAIN_VERIFICATION_REPORT_INVALID:") for reason in report.reasons
    )


def test_non_regular_root_and_declared_directory_are_rejected(tmp_path: Path) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    symlink_root = tmp_path / "symlink-root"
    symlink_root.symlink_to(root, target_is_directory=True)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=symlink_root,
        restored_root=restored,
    )
    assert any("root must be a non-symlink directory" in reason for reason in report.reasons)

    source = cast(list[dict[str, Any]], payload["source_files"])[0]
    source_path = root / cast(str, source["path"])
    source_path.unlink()
    source_path.mkdir()
    directory_report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert any("path is not a regular file" in reason for reason in directory_report.reasons)


def test_remote_inventory_identity_and_evidence_content_are_bound(
    tmp_path: Path,
) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path / "identity")
    remote = cast(dict[str, Any], payload["remote_inventory"])
    remote["model_id"] = "other/model"
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "REMOTE_INVENTORY_AUTHORITY_MISMATCH" in report.reasons

    _, payload, manifest, root, restored = _verify(tmp_path / "record")
    remote = cast(dict[str, Any], payload["remote_inventory"])
    entries = cast(list[dict[str, Any]], remote["entries"])
    entries[0]["remote_identity"] = "drifted-remote-object"
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "REMOTE_INVENTORY_EVIDENCE_MISMATCH" in report.reasons


def test_legal_review_record_supports_signed_evidence_and_rejects_drift(
    tmp_path: Path,
) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    legal = cast(dict[str, Any], payload["legal_review"])
    legal["record_type"] = "SIGNED_RECORD"
    legal["attestation_reference"] = "evidence://legal/signed@sha256:" + "7" * 64
    review = cast(dict[str, Any], legal["review_record"])
    record_path = root / cast(str, review["path"])
    record_payload = json.loads(record_path.read_text(encoding="utf-8"))
    record_payload["record_type"] = legal["record_type"]
    record_payload["attestation_reference"] = legal["attestation_reference"]
    record_content = json.dumps(record_payload, sort_keys=True).encode()
    record_path.write_bytes(record_content)
    review["sha256"] = _sha256(record_content)
    review["size_bytes"] = len(record_content)
    shutil.copy2(record_path, restored / cast(str, review["path"]))

    storage = cast(dict[str, Any], payload["storage"])
    payload_index = cast(dict[str, Any], storage["payload_index"])
    payload_index_path = root / cast(str, payload_index["path"])
    payload_index_payload = json.loads(
        payload_index_path.read_text(encoding="utf-8")
    )
    indexed_files = cast(list[dict[str, Any]], payload_index_payload["files"])
    indexed_review = next(
        item for item in indexed_files if item["path"] == review["path"]
    )
    indexed_review["sha256"] = review["sha256"]
    indexed_review["size_bytes"] = review["size_bytes"]
    payload_index_content = json.dumps(
        payload_index_payload, sort_keys=True
    ).encode()
    payload_index_path.write_bytes(payload_index_content)
    (restored / cast(str, payload_index["path"])).write_bytes(
        payload_index_content
    )
    payload_index["sha256"] = _sha256(payload_index_content)
    payload_index["size_bytes"] = len(payload_index_content)
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert report.status is BundleVerificationStatus.VERIFIED

    legal["conditions"] = ["Condition changed after the human attestation."]
    _write_json(manifest, payload)
    drifted = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "LEGAL_REVIEW_RECORD_MISMATCH" in drifted.reasons


def test_locator_digest_and_retention_interval_drift_fail_closed(
    tmp_path: Path,
) -> None:
    _, payload, manifest, root, restored = _verify(tmp_path)
    toolchain = cast(dict[str, Any], payload["toolchain_package"])
    toolchain["immutable_locator"] = (
        "gh-actions://pachaninm-lab/pachanin-demo/actions/runs/1/artifacts/2@sha256:" + "8" * 64
    )
    storage = cast(dict[str, Any], payload["storage"])
    storage["immutable_locator"] = "oci://registry.example/tai/model-bundle@sha256:" + "9" * 64
    storage["retention_expires_at"] = "2026-10-17T02:00:00Z"
    storage["restored_at"] = "2026-10-19T02:00:00Z"
    _write_json(manifest, payload)
    report = verify_local_model_bundle_v2(
        authority=load_model_bundle_authority_v2(AUTHORITY_PATH),
        bundle=load_local_model_bundle_v2(manifest),
        bundle_root=root,
        restored_root=restored,
    )
    assert "TOOLCHAIN_PACKAGE_LOCATOR_SHA256_MISMATCH" in report.reasons
    assert "STORAGE_LOCATOR_ARCHIVE_SHA256_MISMATCH" in report.reasons
    assert "STORAGE_RETENTION_INTERVAL_MISMATCH" in report.reasons
    assert "STORAGE_RESTORE_OUTSIDE_RETENTION" in report.reasons
