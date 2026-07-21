from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import tarfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO, cast
from urllib.parse import quote, urlsplit

from tai.model_bundle_v2 import (
    authority_sha256_v2,
    load_local_model_bundle_v2,
    load_model_bundle_authority_v2,
)

_FINALIZE_SCHEMA = "tai.model-bundle-upload-restore-authority.v1"
_STATE_SCHEMA = "tai.model-bundle-finalization-state.v1"
_PAYLOAD_INDEX_SCHEMA = "tai.model-bundle-payload-index.v1"
_STREAM_REPORT_SCHEMA = "tai.model-bundle-stream-extract-report.v1"
_CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True, slots=True)
class StreamDigest:
    sha256: str
    size_bytes: int


def validate_finalization_authority(path: Path) -> dict[str, object]:
    payload = _strict_json(path)
    if payload.get("schema_version") != _FINALIZE_SCHEMA:
        raise ValueError("unsupported finalization authority schema")
    if (payload.get("program_issue"), payload.get("parent_issue"), payload.get("issue")) != (
        2726,
        2954,
        2961,
    ):
        raise ValueError("finalization issue lineage mismatch")
    if payload.get("command") != "/tai finalize model-bundles exact-main":
        raise ValueError("finalization command mismatch")
    conversion = _mapping(payload.get("conversion_run"), "conversion_run")
    if conversion.get("status") != "CONVERSION_AND_QUANTIZATION_COMPLETE_PENDING_BUNDLE_RESTORE":
        raise ValueError("conversion status is not finalization-ready")
    if conversion.get("remote_root") != (
        "/srv/tai-models/conversion-runs/"
        f"{conversion.get('exact_main_sha')}/"
        f"{conversion.get('workflow_run_id')}-{conversion.get('workflow_run_attempt')}"
    ):
        raise ValueError("conversion remote root is not exact-run bound")
    storage = _mapping(payload.get("storage_authority"), "storage_authority")
    expected_storage = {
        "provider_profile": "SELECTEL_S3_2026",
        "required_preflight_status": "READY_FOR_BUNDLE_UPLOAD",
        "required_versioning_status": "Enabled",
        "required_object_lock_status": "Enabled",
        "required_retention_mode": "COMPLIANCE",
        "minimum_retention_days": 90,
        "content_addressed_locator": True,
        "accepted_object_delete": False,
    }
    for key, expected in expected_storage.items():
        if storage.get(key) != expected:
            raise ValueError(f"storage authority mismatch: {key}")
    models = _object_array(payload, "models")
    if {str(item.get("key")) for item in models} != {
        "qwen3-8b",
        "mistral-7b-instruct-v0.3",
    }:
        raise ValueError("finalization model set mismatch")
    for model in models:
        if not isinstance(model.get("outputs"), list) or not model.get("outputs"):
            raise ValueError("model outputs are missing")
        for output in _object_array(model, "outputs"):
            _sha256(_string(output, "sha256"), "output sha256")
            if _integer(output, "size_bytes") < 1:
                raise ValueError("output size must be positive")
    execution = _mapping(payload.get("execution"), "execution")
    for flag in (
        "owner_only",
        "exact_main_required",
        "stream_archive_without_local_duplicate",
        "restore_one_model_at_a_time",
        "clean_restore_root_required",
        "verify_archive_sha256_before_extract",
        "verify_safe_archive_members",
        "verify_bundle_storage_v2_required",
        "remove_temporary_restore_after_evidence",
    ):
        if execution.get(flag) is not True:
            raise ValueError(f"execution authority mismatch: {flag}")
    if execution.get("delete_accepted_s3_objects") is not False:
        raise ValueError("accepted object deletion must be false")
    result = _mapping(payload.get("result"), "result")
    if result != {
        "complete_status": "VERIFIED_BUNDLES_RESTORED",
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }:
        raise ValueError("maturity boundary mismatch")
    return payload


def prepare_model_bundle(
    *,
    finalization_authority_path: Path,
    bundle_authority_path: Path,
    conversion_authority_path: Path,
    toolchain_acceptance_path: Path,
    source_evidence_root: Path,
    legal_review_record_path: Path,
    license_text_path: Path,
    conversion_root: Path,
    toolchain_extract_root: Path,
    model_key: str,
    original_root: Path,
    state_output: Path,
) -> dict[str, object]:
    finalization = validate_finalization_authority(finalization_authority_path)
    bundle_authority_raw = _strict_json(bundle_authority_path)
    conversion_authority = _strict_json(conversion_authority_path)
    toolchain_acceptance = _strict_json(toolchain_acceptance_path)
    bundle_authority = load_model_bundle_authority_v2(bundle_authority_path)
    authority_sha = authority_sha256_v2(bundle_authority)

    model = _model_by_key(finalization, model_key)
    conversion_model = _model_by_key(conversion_authority, model_key)
    plan = _model_plan(bundle_authority_raw, _string(model, "model_id"), _string(model, "revision"))
    _validate_model_continuity(model, conversion_model, plan)

    _require_empty_directory(original_root)
    source_manifest = _strict_json(source_evidence_root / "source-manifest.json")
    remote_inventory_raw = _strict_json(source_evidence_root / "remote-inventory.json")
    review_record = _strict_json(legal_review_record_path)
    _validate_source_and_legal(
        model=model,
        plan=plan,
        source_manifest=source_manifest,
        remote_inventory=remote_inventory_raw,
        review_record=review_record,
        license_text_path=license_text_path,
    )

    source_files: list[dict[str, object]] = []
    for item in _object_array(source_manifest, "files"):
        relative = _string(item, "path")
        source = conversion_root / relative
        declared = _link_declared(source, original_root, relative)
        source_files.append({**declared, "role": _string(item, "role")})

    normalized_remote = {
        "schema_version": "tai.remote-model-inventory-evidence.v1",
        "model_id": _string(model, "model_id"),
        "revision": _string(model, "revision"),
        "source_uri": _string(plan, "source_uri"),
        "observed_at": _string(remote_inventory_raw, "observed_at"),
        "entries": [
            {
                "path": _string(item, "path"),
                "remote_identity": _string(item, "remote_identity"),
                "size_bytes": _integer(item, "size_bytes"),
            }
            for item in sorted(
                _object_array(remote_inventory_raw, "entries"),
                key=lambda value: _string(value, "path"),
            )
        ],
    }
    remote_evidence = _write_json_declared(
        original_root,
        "evidence/remote-inventory.json",
        normalized_remote,
    )

    license_text = _copy_declared(
        license_text_path,
        original_root,
        "legal/LICENSE-2.0.txt",
    )
    review_record_declared = _write_json_declared(
        original_root,
        "legal/review-record.json",
        review_record,
    )

    toolchain = _mapping(bundle_authority_raw.get("toolchain"), "toolchain")
    package_source = conversion_root / "control/toolchain/llama-cpp-b9637-evidence.tar.gz"
    package = _link_declared(
        package_source,
        original_root,
        "toolchain/package/llama-cpp-b9637-evidence.tar.gz",
    )
    _validate_toolchain_package(package, toolchain_acceptance)
    build_manifest = _link_declared(
        toolchain_extract_root / "llama-evidence/evidence/llama-cpp-build.v1.json",
        original_root,
        "toolchain/evidence/llama-cpp-build.v1.json",
    )
    verification_report = _link_declared(
        toolchain_extract_root / "llama-evidence/evidence/llama-cpp-verification.v1.json",
        original_root,
        "toolchain/evidence/llama-cpp-verification.v1.json",
    )
    binaries: list[dict[str, object]] = []
    binary_sha: dict[str, str] = {}
    for name in _string_array(toolchain, "required_binaries"):
        declared = _link_declared(
            toolchain_extract_root / f"llama-evidence/build/llama.cpp-b9637/bin/{name}",
            original_root,
            f"toolchain/bin/{name}",
        )
        _validate_toolchain_binary(name, declared, toolchain_acceptance)
        binaries.append({"name": name, "file": declared})
        binary_sha[name] = _string(declared, "sha256")

    converter_relative = _string(_mapping(plan.get("conversion"), "conversion"), "converter_path")
    converter = _link_declared(
        conversion_root / converter_relative,
        original_root,
        converter_relative,
    )
    python_dependencies = _link_declared(
        conversion_root / "evidence/python-dependencies.txt",
        original_root,
        "conversion/python-dependencies.txt",
    )
    python_identity = _read_bounded_text(conversion_root / "evidence/python-version.txt", 500)

    step_records = _conversion_steps(conversion_root)
    conversion_plan = _mapping(plan.get("conversion"), "conversion")
    intermediate_relative = _string(conversion_plan, "intermediate_path")
    intermediate_step = _step_for_output(step_records, intermediate_relative)
    intermediate = _link_declared(
        conversion_root / intermediate_relative,
        original_root,
        intermediate_relative,
    )
    _validate_declared_against_authority(intermediate, model, intermediate_relative)
    conversion_log = _link_declared(
        conversion_root / _absolute_step_log_relative(conversion_root, intermediate_step),
        original_root,
        f"conversion/{_string(intermediate_step, 'step_key')}.log",
    )

    quantizations: list[dict[str, object]] = []
    for quantization in _object_array(plan, "quantizations"):
        output_relative = _string(quantization, "output_path")
        step = _step_for_output(step_records, output_relative)
        output = _link_declared(
            conversion_root / output_relative,
            original_root,
            output_relative,
        )
        _validate_declared_against_authority(output, model, output_relative)
        log = _link_declared(
            conversion_root / _absolute_step_log_relative(conversion_root, step),
            original_root,
            f"quantization/{_string(step, 'step_key')}.log",
        )
        quantizations.append(
            {
                "runtime_class": _string(quantization, "runtime_class"),
                "quantization": _string(quantization, "quantization"),
                "argv": _string_array(quantization, "argv"),
                "log": log,
                "output": output,
                "input_sha256": _string(intermediate, "sha256"),
                "quantize_binary_sha256": binary_sha["llama-quantize"],
            }
        )

    toolchain_package_sha = _string(package, "sha256")
    manifest: dict[str, object] = {
        "schema_version": "tai.local-model-artifact-bundle.v2",
        "lifecycle": "COMPLETE",
        "role": _string(model, "role"),
        "model_id": _string(model, "model_id"),
        "revision": _string(model, "revision"),
        "authority_sha256": authority_sha,
        "remote_inventory": {
            "model_id": _string(model, "model_id"),
            "revision": _string(model, "revision"),
            "source_uri": _string(plan, "source_uri"),
            "observed_at": _string(remote_inventory_raw, "observed_at"),
            "evidence_file": remote_evidence,
            "entries": normalized_remote["entries"],
        },
        "source_files": source_files,
        "legal_review": {
            "decision": _string(review_record, "decision"),
            "reviewer_type": _string(review_record, "reviewer_type"),
            "reviewer_id": _string(review_record, "reviewer_id"),
            "reviewer_name": _string(review_record, "reviewer_name"),
            "reviewed_at": _string(review_record, "reviewed_at"),
            "license_spdx": _string(review_record, "license_spdx"),
            "decision_basis": _string(review_record, "decision_basis"),
            "conditions": _string_array(review_record, "conditions"),
            "record_type": _string(review_record, "record_type"),
            "attestation_reference": _string(review_record, "attestation_reference"),
            "license_text": license_text,
            "review_record": review_record_declared,
        },
        "toolchain_package": {
            "name": _string(toolchain, "name"),
            "release": _string(toolchain, "release"),
            "commit": _string(toolchain, "commit"),
            "profile": _string(toolchain, "profile"),
            "authority_sha256": _string(toolchain, "authority_sha256"),
            "package": package,
            "build_manifest": build_manifest,
            "verification_report": verification_report,
            "verification_status": "VERIFIED",
            "immutable_locator": (
                "gh-actions://pachaninm-lab/pachanin-demo/actions/artifacts/"
                f"{_toolchain_artifact_id(toolchain_acceptance)}"
                f"@sha256:{toolchain_package_sha}"
            ),
            "binaries": binaries,
        },
        "conversion": {
            "python_identity": python_identity,
            "python_dependencies": python_dependencies,
            "converter": converter,
            "argv": _string_array(conversion_plan, "argv"),
            "log": conversion_log,
            "intermediate": intermediate,
            "source_files_sha256": _string(source_manifest, "source_files_sha256"),
            "toolchain_package_sha256": toolchain_package_sha,
        },
        "quantizations": quantizations,
        "storage": None,
    }

    expected_source_digest = _string(conversion_model, "source_files_sha256")
    if _string(_mapping(manifest["conversion"], "conversion"), "source_files_sha256") != expected_source_digest:
        raise ValueError("source-files digest does not match conversion authority")

    payload_entries = _manifest_payload_declarations(manifest)
    payload_index = {
        "schema_version": _PAYLOAD_INDEX_SCHEMA,
        "model_id": manifest["model_id"],
        "revision": manifest["revision"],
        "entries": payload_entries,
    }
    payload_index_declared = _write_json_declared(
        original_root,
        "storage/payload-index.json",
        payload_index,
    )
    archive_files = original_root / "storage/archive-files.txt"
    archive_files.write_text(
        "".join(f"{_string(item, 'path')}\n" for item in payload_entries),
        encoding="utf-8",
    )

    state: dict[str, object] = {
        "schema_version": _STATE_SCHEMA,
        "model_key": model_key,
        "model_id": manifest["model_id"],
        "revision": manifest["revision"],
        "archive_logical_path": _string(model, "archive_path"),
        "manifest_without_storage": manifest,
        "payload_index": payload_index_declared,
        "payload_file_count": len(payload_entries),
        "payload_size_bytes": sum(_integer(item, "size_bytes") for item in payload_entries),
        "archive_files_path": archive_files.relative_to(original_root).as_posix(),
    }
    _write_json(state_output, state)
    temporary_manifest = state_output.parent / f".{model_key}.pre-storage-manifest.json"
    _write_json(temporary_manifest, manifest)
    try:
        load_local_model_bundle_v2(temporary_manifest)
    finally:
        temporary_manifest.unlink(missing_ok=True)
    return state


def complete_storage_manifest(
    *,
    state_path: Path,
    original_root: Path,
    archive_sha256: str,
    archive_size_bytes: int,
    endpoint: str,
    region: str,
    bucket: str,
    object_key: str,
    version_id: str,
    etag: str,
    uploaded_at: str,
    retention_days: int,
    retention_expires_at: str,
    restored_at: str,
    output_manifest: Path,
) -> dict[str, object]:
    state = _strict_json(state_path)
    if state.get("schema_version") != _STATE_SCHEMA:
        raise ValueError("unsupported finalization state schema")
    _sha256(archive_sha256, "archive sha256")
    if archive_size_bytes < 1:
        raise ValueError("archive size must be positive")
    if retention_days < 90:
        raise ValueError("retention must be at least 90 days")
    endpoint_parts = urlsplit(endpoint)
    if endpoint_parts.scheme != "https" or not endpoint_parts.hostname:
        raise ValueError("S3 endpoint must be HTTPS")
    for value, name in (
        (region, "region"),
        (bucket, "bucket"),
        (object_key, "object key"),
        (version_id, "version id"),
        (etag, "etag"),
    ):
        if not value or "\x00" in value or "\n" in value:
            raise ValueError(f"{name} is invalid")
    locator = (
        f"s3+https://{endpoint_parts.hostname}/{quote(bucket, safe='')}/"
        f"{quote(object_key, safe='/')}?region={quote(region, safe='')}&"
        f"versionId={quote(version_id, safe='')}#sha256:{archive_sha256}"
    )
    upload = {
        "schema_version": "tai.model-bundle-upload-record.v1",
        "archive_sha256": archive_sha256,
        "immutable_locator": locator,
        "uploaded_at": uploaded_at,
        "retention_days": retention_days,
        "retention_expires_at": retention_expires_at,
    }
    restore = {
        "schema_version": "tai.model-bundle-restore-record.v1",
        "archive_sha256": archive_sha256,
        "immutable_locator": locator,
        "restored_at": restored_at,
    }
    upload_declared = _write_json_declared(
        original_root,
        "storage/upload-record.json",
        upload,
    )
    restore_declared = _write_json_declared(
        original_root,
        "storage/restore-record.json",
        restore,
    )
    manifest = _mapping(state.get("manifest_without_storage"), "manifest_without_storage")
    manifest["storage"] = {
        "bundle_archive": {
            "path": _string(state, "archive_logical_path"),
            "sha256": archive_sha256,
            "size_bytes": archive_size_bytes,
        },
        "payload_index": _mapping(state.get("payload_index"), "payload_index"),
        "immutable_locator": locator,
        "uploaded_at": uploaded_at,
        "retention_days": retention_days,
        "retention_expires_at": retention_expires_at,
        "restored_at": restored_at,
        "upload_record": upload_declared,
        "restore_record": restore_declared,
    }
    _write_json(output_manifest, manifest)
    load_local_model_bundle_v2(output_manifest)
    summary: dict[str, object] = {
        "schema_version": "tai.model-bundle-storage-locator.v1",
        "status": "READY_FOR_STORAGE_VERIFICATION",
        "model_id": manifest["model_id"],
        "revision": manifest["revision"],
        "archive_sha256": archive_sha256,
        "archive_size_bytes": archive_size_bytes,
        "endpoint_host": endpoint_parts.hostname,
        "region": region,
        "bucket": bucket,
        "object_key": object_key,
        "version_id": version_id,
        "etag": etag,
        "immutable_locator": locator,
        "retention_days": retention_days,
        "retention_expires_at": retention_expires_at,
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    summary["summary_sha256"] = _canonical_sha256(summary)
    return summary


def hash_stream(stream: BinaryIO) -> StreamDigest:
    digest = hashlib.sha256()
    size = 0
    for chunk in iter(lambda: stream.read(_CHUNK_SIZE), b""):
        digest.update(chunk)
        size += len(chunk)
    return StreamDigest(digest.hexdigest(), size)


def extract_streamed_archive(
    *,
    payload_index_path: Path,
    restore_root: Path,
    stream: BinaryIO,
) -> dict[str, object]:
    payload = _strict_json(payload_index_path)
    if payload.get("schema_version") != _PAYLOAD_INDEX_SCHEMA:
        raise ValueError("unsupported payload-index schema")
    expected = {
        _string(item, "path"): (
            _integer(item, "size_bytes"),
            _string(item, "sha256"),
        )
        for item in _object_array(payload, "entries")
    }
    if not expected:
        raise ValueError("payload index is empty")
    if len(expected) != len(_object_array(payload, "entries")):
        raise ValueError("payload index contains duplicate paths")
    _require_empty_directory(restore_root)

    reader = _HashingReader(stream)
    observed: dict[str, tuple[int, str]] = {}
    try:
        with tarfile.open(fileobj=reader, mode="r|*") as archive:
            for member in archive:
                relative = _safe_member_path(member)
                if relative in observed:
                    raise ValueError(f"duplicate archive member: {relative}")
                if relative not in expected:
                    raise ValueError(f"unexpected archive member: {relative}")
                expected_size, expected_sha = expected[relative]
                if member.size != expected_size:
                    raise ValueError(f"archive member size mismatch: {relative}")
                source = archive.extractfile(member)
                if source is None:
                    raise ValueError(f"archive member is unreadable: {relative}")
                target = restore_root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                digest = hashlib.sha256()
                size = 0
                with target.open("xb") as destination:
                    os.chmod(target, 0o600)
                    for chunk in iter(lambda: source.read(_CHUNK_SIZE), b""):
                        destination.write(chunk)
                        digest.update(chunk)
                        size += len(chunk)
                actual_sha = digest.hexdigest()
                if size != expected_size or actual_sha != expected_sha:
                    raise ValueError(f"archive member digest mismatch: {relative}")
                observed[relative] = (size, actual_sha)
        while reader.read(_CHUNK_SIZE):
            pass
    except Exception:
        shutil.rmtree(restore_root, ignore_errors=True)
        raise
    if set(observed) != set(expected):
        missing = sorted(set(expected) - set(observed))
        raise ValueError(f"archive members missing: {missing!r}")
    report: dict[str, object] = {
        "schema_version": _STREAM_REPORT_SCHEMA,
        "status": "VERIFIED_AND_EXTRACTED",
        "model_id": payload.get("model_id"),
        "revision": payload.get("revision"),
        "archive_sha256": reader.sha256,
        "archive_size_bytes": reader.size_bytes,
        "verified_files": sorted(observed),
        "reasons": [],
    }
    report["report_sha256"] = _canonical_sha256(report)
    return report


class _HashingReader(io.RawIOBase):
    def __init__(self, source: BinaryIO) -> None:
        self._source = source
        self._digest = hashlib.sha256()
        self._size = 0

    def readable(self) -> bool:
        return True

    def read(self, size: int = -1) -> bytes:
        chunk = self._source.read(size)
        if chunk:
            self._digest.update(chunk)
            self._size += len(chunk)
        return chunk

    def readinto(self, buffer: bytearray | memoryview) -> int:
        chunk = self.read(len(buffer))
        count = len(chunk)
        buffer[:count] = chunk
        return count

    @property
    def sha256(self) -> str:
        return self._digest.hexdigest()

    @property
    def size_bytes(self) -> int:
        return self._size


def _safe_member_path(member: tarfile.TarInfo) -> str:
    path = PurePosixPath(member.name)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError(f"unsafe archive member path: {member.name}")
    if not member.isfile() or member.islnk() or member.issym():
        raise ValueError(f"unsafe archive member type: {member.name}")
    return path.as_posix()


def _manifest_payload_declarations(manifest: dict[str, object]) -> list[dict[str, object]]:
    result: list[dict[str, object]] = []
    result.extend(cast(list[dict[str, object]], manifest["source_files"]))
    remote = _mapping(manifest.get("remote_inventory"), "remote_inventory")
    result.append(_mapping(remote.get("evidence_file"), "remote evidence"))
    legal = _mapping(manifest.get("legal_review"), "legal_review")
    result.extend(
        [
            _mapping(legal.get("license_text"), "license_text"),
            _mapping(legal.get("review_record"), "review_record"),
        ]
    )
    toolchain = _mapping(manifest.get("toolchain_package"), "toolchain_package")
    result.extend(
        [
            _mapping(toolchain.get("package"), "toolchain package"),
            _mapping(toolchain.get("build_manifest"), "build_manifest"),
            _mapping(toolchain.get("verification_report"), "verification_report"),
        ]
    )
    for binary in _object_array(toolchain, "binaries"):
        result.append(_mapping(binary.get("file"), "toolchain binary"))
    conversion = _mapping(manifest.get("conversion"), "conversion")
    result.extend(
        [
            _mapping(conversion.get("python_dependencies"), "python_dependencies"),
            _mapping(conversion.get("converter"), "converter"),
            _mapping(conversion.get("log"), "conversion log"),
            _mapping(conversion.get("intermediate"), "intermediate"),
        ]
    )
    for quantization in _object_array(manifest, "quantizations"):
        result.extend(
            [
                _mapping(quantization.get("log"), "quantization log"),
                _mapping(quantization.get("output"), "quantization output"),
            ]
        )
    by_path = {_string(item, "path"): item for item in result}
    if len(by_path) != len(result):
        raise ValueError("payload declaration paths are duplicated")
    return [
        {
            "path": path,
            "sha256": _string(item, "sha256"),
            "size_bytes": _integer(item, "size_bytes"),
        }
        for path, item in sorted(by_path.items())
    ]


def _validate_model_continuity(
    model: dict[str, Any], conversion_model: dict[str, Any], plan: dict[str, Any]
) -> None:
    identity = (_string(model, "model_id"), _string(model, "revision"), _string(model, "role"))
    if identity != (
        _string(conversion_model, "model_id"),
        _string(conversion_model, "revision"),
        _string(conversion_model, "role"),
    ):
        raise ValueError("conversion model identity mismatch")
    if identity != (_string(plan, "model_id"), _string(plan, "revision"), _string(plan, "role")):
        raise ValueError("bundle authority model identity mismatch")


def _validate_source_and_legal(
    *,
    model: dict[str, Any],
    plan: dict[str, Any],
    source_manifest: dict[str, object],
    remote_inventory: dict[str, object],
    review_record: dict[str, object],
    license_text_path: Path,
) -> None:
    identity = (_string(model, "model_id"), _string(model, "revision"))
    for payload, name in (
        (source_manifest, "source manifest"),
        (remote_inventory, "remote inventory"),
    ):
        if (_string(payload, "model_id"), _string(payload, "revision")) != identity:
            raise ValueError(f"{name} identity mismatch")
    if source_manifest.get("status") != "COLLECTED":
        raise ValueError("source manifest is not collected")
    selected = {
        _string(item, "path")
        for item in _object_array(plan, "source_inventory")
        if item.get("disposition") == "SELECTED"
    }
    observed = {_string(item, "path") for item in _object_array(source_manifest, "files")}
    if observed != selected:
        raise ValueError("selected source file set mismatch")
    all_inventory = {_string(item, "path") for item in _object_array(plan, "source_inventory")}
    remote_paths = {_string(item, "path") for item in _object_array(remote_inventory, "entries")}
    if remote_paths != all_inventory:
        raise ValueError("remote inventory set mismatch")
    if review_record.get("decision") != "APPROVED" or review_record.get("reviewer_type") != "HUMAN":
        raise ValueError("legal review is not human-approved")
    if review_record.get("license_spdx") != plan.get("license_spdx"):
        raise ValueError("legal SPDX mismatch")
    expected_license_sha = _string(review_record, "license_text_sha256")
    if _file_sha256(license_text_path) != expected_license_sha:
        raise ValueError("license text digest mismatch")


def _validate_toolchain_package(
    declared: dict[str, object], acceptance: dict[str, object]
) -> None:
    external = _mapping(acceptance.get("external_artifacts"), "external_artifacts")
    package = _mapping(external.get("package_artifact"), "package_artifact")
    if _string(declared, "sha256") != _string(package, "payload_sha256"):
        raise ValueError("toolchain package digest mismatch")
    if _integer(declared, "size_bytes") != _integer(package, "payload_size_bytes"):
        raise ValueError("toolchain package size mismatch")


def _validate_toolchain_binary(
    name: str, declared: dict[str, object], acceptance: dict[str, object]
) -> None:
    evidence = _mapping(acceptance.get("evidence"), "evidence")
    binaries = {
        _string(item, "target"): item for item in _object_array(evidence, "binaries")
    }
    expected = binaries.get(name)
    if expected is None:
        raise ValueError(f"toolchain binary absent from acceptance: {name}")
    if (
        _string(declared, "sha256"),
        _integer(declared, "size_bytes"),
    ) != (
        _string(expected, "sha256"),
        _integer(expected, "size_bytes"),
    ):
        raise ValueError(f"toolchain binary mismatch: {name}")


def _validate_declared_against_authority(
    declared: dict[str, object], model: dict[str, Any], relative: str
) -> None:
    expected = next(
        (
            item
            for item in _object_array(model, "outputs")
            if _string(item, "path") == relative
        ),
        None,
    )
    if expected is None:
        raise ValueError(f"output is not authorized: {relative}")
    if (
        _string(declared, "sha256"),
        _integer(declared, "size_bytes"),
    ) != (
        _string(expected, "sha256"),
        _integer(expected, "size_bytes"),
    ):
        raise ValueError(f"output evidence mismatch: {relative}")


def _conversion_steps(conversion_root: Path) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for path in sorted((conversion_root / "evidence/steps").glob("*.json")):
        if path.name.endswith(".argv.json"):
            continue
        payload = _strict_json(path)
        if payload.get("status") != "COMPLETE":
            raise ValueError(f"conversion step is not complete: {path.name}")
        result.append(cast(dict[str, Any], payload))
    if len(result) != 5:
        raise ValueError("exactly five conversion steps are required")
    return result


def _step_for_output(
    steps: list[dict[str, Any]], relative: str
) -> dict[str, Any]:
    matches = [
        item
        for item in steps
        if _mapping(item.get("output"), "step output").get("path") == relative
    ]
    if len(matches) != 1:
        raise ValueError(f"conversion output step mismatch: {relative}")
    return matches[0]


def _absolute_step_log_relative(
    conversion_root: Path, step: dict[str, Any]
) -> str:
    raw = _string(_mapping(step.get("log"), "step log"), "path")
    path = Path(raw)
    try:
        return path.resolve(strict=True).relative_to(conversion_root.resolve(strict=True)).as_posix()
    except (OSError, ValueError) as error:
        raise ValueError("conversion step log escapes exact run root") from error


def _model_by_key(payload: dict[str, object], key: str) -> dict[str, Any]:
    matches = [item for item in _object_array(payload, "models") if item.get("key") == key]
    if len(matches) != 1:
        raise ValueError(f"model key is not uniquely authorized: {key}")
    return matches[0]


def _model_plan(
    authority: dict[str, object], model_id: str, revision: str
) -> dict[str, Any]:
    matches = [
        item
        for item in _object_array(authority, "models")
        if (item.get("model_id"), item.get("revision")) == (model_id, revision)
    ]
    if len(matches) != 1:
        raise ValueError("model plan is not uniquely authorized")
    return matches[0]


def _link_declared(source: Path, root: Path, relative: str) -> dict[str, object]:
    _safe_relative(relative)
    if not source.is_file() or source.is_symlink():
        raise ValueError(f"source is not a regular file: {source}")
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(source, target)
    except OSError as error:
        raise ValueError(f"hard-link assembly failed for {relative}") from error
    return _declared(target, relative)


def _copy_declared(source: Path, root: Path, relative: str) -> dict[str, object]:
    _safe_relative(relative)
    if not source.is_file() or source.is_symlink():
        raise ValueError(f"source is not a regular file: {source}")
    target = root / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    with source.open("rb") as reader, target.open("xb") as writer:
        shutil.copyfileobj(reader, writer, length=_CHUNK_SIZE)
    os.chmod(target, 0o600)
    return _declared(target, relative)


def _write_json_declared(
    root: Path, relative: str, payload: object
) -> dict[str, object]:
    _safe_relative(relative)
    path = root / relative
    _write_json(path, payload)
    return _declared(path, relative)


def _declared(path: Path, relative: str) -> dict[str, object]:
    return {
        "path": relative,
        "sha256": _file_sha256(path),
        "size_bytes": path.stat().st_size,
    }


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.chmod(path, 0o600)


def _require_empty_directory(path: Path) -> None:
    if path.exists():
        if path.is_symlink() or not path.is_dir():
            raise ValueError("target root must be a directory")
        if any(path.iterdir()):
            raise ValueError("target root must be empty")
    else:
        path.mkdir(parents=True, mode=0o700)
    os.chmod(path, 0o700)


def _read_bounded_text(path: Path, maximum: int) -> str:
    value = path.read_text(encoding="utf-8", errors="strict").strip()
    if not value or len(value) > maximum or "\x00" in value:
        raise ValueError("bounded text evidence is invalid")
    return value


def _toolchain_artifact_id(acceptance: dict[str, object]) -> int:
    external = _mapping(acceptance.get("external_artifacts"), "external_artifacts")
    package = _mapping(external.get("package_artifact"), "package_artifact")
    return _integer(package, "id")


def _strict_json(path: Path) -> dict[str, object]:
    def reject_duplicate(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    try:
        payload = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicate)
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot load JSON: {path}") from error
    if not isinstance(payload, dict):
        raise ValueError("JSON root must be an object")
    return payload


def _mapping(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be an object")
    return cast(dict[str, Any], value)


def _object_array(payload: dict[str, object] | dict[str, Any], key: str) -> list[dict[str, Any]]:
    value = payload.get(key)
    if not isinstance(value, list) or any(not isinstance(item, dict) for item in value):
        raise ValueError(f"{key} must be an object array")
    return cast(list[dict[str, Any]], value)


def _string_array(payload: dict[str, object] | dict[str, Any], key: str) -> list[str]:
    value = payload.get(key)
    if not isinstance(value, list) or any(not isinstance(item, str) or not item for item in value):
        raise ValueError(f"{key} must be a string array")
    return cast(list[str], value)


def _string(payload: dict[str, object] | dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{key} must be a non-empty string")
    return value


def _integer(payload: dict[str, object] | dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{key} must be an integer")
    return value


def _safe_relative(value: str) -> None:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError("path must be a safe relative POSIX path")


def _sha256(value: str, name: str) -> None:
    if len(value) != 64 or any(character not in "0123456789abcdef" for character in value):
        raise ValueError(f"{name} must be a lowercase SHA-256")


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(_CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_sha256(payload: object) -> str:
    rendered = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(rendered.encode()).hexdigest()
