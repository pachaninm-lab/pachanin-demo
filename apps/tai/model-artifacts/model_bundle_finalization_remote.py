from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sys
import tarfile
from collections.abc import Sequence
from pathlib import Path, PurePosixPath
from typing import Any, BinaryIO, cast

from tai.model_bundle_external_storage import verify_external_model_bundle
from tai.model_bundle_v2 import authority_sha256_v2, load_model_bundle_authority_v2

_CHUNK_SIZE = 1024 * 1024


def prepare_bundle(
    *,
    bundle_authority_path: Path,
    conversion_authority_path: Path,
    conversion_root: Path,
    control_root: Path,
    work_root: Path,
    model_key: str,
) -> dict[str, object]:
    bundle_authority = load_model_bundle_authority_v2(bundle_authority_path)
    conversion_authority = _load_json(conversion_authority_path)
    model = _model_record(conversion_authority, model_key)
    plan = next(
        (
            item
            for item in bundle_authority.models
            if item.model_id == model["model_id"] and item.revision == model["revision"]
        ),
        None,
    )
    if plan is None:
        raise ValueError("model is absent from bundle authority")
    _verify_completed_conversion(conversion_authority, conversion_root)

    model_root = work_root / "models" / model_key
    original_root = model_root / "original"
    if model_root.exists():
        _safe_remove_tree(model_root, work_root)
    original_root.mkdir(parents=True, mode=0o700)

    source_metadata = control_root / "source-metadata" / model_key
    source_manifest = _load_json(source_metadata / "source-manifest.json")
    remote_inventory = _load_json(source_metadata / "remote-inventory.json")
    if source_manifest.get("model_id") != plan.model_id:
        raise ValueError("source manifest model identity mismatch")
    if source_manifest.get("revision") != plan.revision:
        raise ValueError("source manifest revision mismatch")
    if source_manifest.get("source_files_sha256") != model["source_files_sha256"]:
        raise ValueError("source manifest digest mismatch")

    source_files: list[dict[str, object]] = []
    for item in _objects(source_manifest.get("files")):
        relative = _text(item.get("path"))
        role = _text(item.get("role"))
        source = conversion_root / relative
        target = original_root / relative
        _hardlink_large(source, target)
        declared = _declared_file(target, relative)
        if declared["sha256"] != item.get("sha256"):
            raise ValueError(f"source SHA-256 mismatch: {relative}")
        if declared["size_bytes"] != item.get("size_bytes"):
            raise ValueError(f"source size mismatch: {relative}")
        source_files.append({**declared, "role": role})

    normalized_remote = {
        "schema_version": "tai.remote-model-inventory-evidence.v1",
        "model_id": plan.model_id,
        "revision": plan.revision,
        "source_uri": plan.source_uri,
        "observed_at": remote_inventory.get("observed_at"),
        "entries": [
            {
                "path": item.get("path"),
                "remote_identity": item.get("remote_identity"),
                "size_bytes": item.get("size_bytes"),
            }
            for item in _objects(remote_inventory.get("entries"))
        ],
    }
    remote_path = original_root / "evidence/remote-inventory.json"
    _write_json(remote_path, normalized_remote)
    remote_declared = _declared_file(remote_path, "evidence/remote-inventory.json")

    review = _load_json(control_root / "legal-reviews" / model_key / "review-record.json")
    if review.get("decision") != "APPROVED" or review.get("reviewer_type") != "HUMAN":
        raise ValueError("legal review is not an approved human decision")
    license_source = source_metadata / "legal/LICENSE-2.0.txt"
    license_target = original_root / "legal/LICENSE-2.0.txt"
    _copy_small(license_source, license_target)
    license_declared = _declared_file(license_target, "legal/LICENSE-2.0.txt")
    if license_declared["sha256"] != review.get("license_text_sha256"):
        raise ValueError("license text does not match legal review")
    review_target = original_root / "legal/review-record.json"
    _copy_small(control_root / "legal-reviews" / model_key / "review-record.json", review_target)
    review_declared = _declared_file(review_target, "legal/review-record.json")

    toolchain_acceptance = _load_json(control_root / "llama-cpp-build-acceptance.v1.json")
    package_source = conversion_root / "control/toolchain/llama-cpp-b9637-evidence.tar.gz"
    package_target = original_root / "toolchain/package.tar.gz"
    _hardlink_large(package_source, package_target)
    package_declared = _declared_file(package_target, "toolchain/package.tar.gz")
    accepted_package = _mapping(
        _mapping(toolchain_acceptance.get("external_artifacts")).get("package_artifact")
    )
    if package_declared["sha256"] != accepted_package.get("payload_sha256"):
        raise ValueError("toolchain package SHA-256 mismatch")
    if package_declared["size_bytes"] != accepted_package.get("payload_size_bytes"):
        raise ValueError("toolchain package size mismatch")

    build_source = (
        conversion_root / "toolchain/restore/llama-evidence/evidence/llama-cpp-build.v1.json"
    )
    verification_source = (
        conversion_root / "toolchain/restore/llama-evidence/evidence/llama-cpp-verification.v1.json"
    )
    build_target = original_root / "toolchain/build-manifest.json"
    verification_target = original_root / "toolchain/verification-report.json"
    _copy_small(build_source, build_target)
    _copy_small(verification_source, verification_target)
    build_declared = _declared_file(build_target, "toolchain/build-manifest.json")
    verification_declared = _declared_file(
        verification_target, "toolchain/verification-report.json"
    )
    accepted_evidence = _mapping(toolchain_acceptance.get("evidence"))
    if build_declared["sha256"] != _mapping(accepted_evidence.get("build_manifest")).get("sha256"):
        raise ValueError("toolchain build manifest mismatch")
    if verification_declared["sha256"] != _mapping(
        accepted_evidence.get("verification_report")
    ).get("sha256"):
        raise ValueError("toolchain verification report mismatch")

    binaries: list[dict[str, object]] = []
    accepted_binaries = {
        _text(item.get("target")): item for item in _objects(accepted_evidence.get("binaries"))
    }
    for name in bundle_authority.toolchain.required_binaries:
        source = conversion_root / "toolchain/bin" / name
        target = original_root / "toolchain/bin" / name
        _hardlink_large(source, target)
        declared = _declared_file(target, f"toolchain/bin/{name}")
        accepted = accepted_binaries.get(name)
        if accepted is None:
            raise ValueError(f"accepted toolchain binary missing: {name}")
        if declared["sha256"] != accepted.get("sha256"):
            raise ValueError(f"toolchain binary SHA-256 mismatch: {name}")
        if declared["size_bytes"] != accepted.get("size_bytes"):
            raise ValueError(f"toolchain binary size mismatch: {name}")
        binaries.append({"name": name, "file": declared})

    converter_source = conversion_root / "toolchain/source/convert_hf_to_gguf.py"
    converter_target = original_root / plan.conversion.converter_path
    _hardlink_large(converter_source, converter_target)
    converter_declared = _declared_file(converter_target, plan.conversion.converter_path)

    dependencies_source = conversion_root / "evidence/python-dependencies.txt"
    dependencies_target = original_root / "conversion/python-dependencies.txt"
    _copy_small(dependencies_source, dependencies_target)
    dependencies_declared = _declared_file(
        dependencies_target, "conversion/python-dependencies.txt"
    )

    convert_step_key = f"{model_key}-convert"
    conversion_step = _load_json(conversion_root / "evidence/steps" / f"{convert_step_key}.json")
    _require_complete_step(conversion_step, convert_step_key)
    conversion_log_source = conversion_root / "logs" / f"{convert_step_key}.log"
    conversion_log_target = original_root / "conversion/convert.log"
    _hardlink_large(conversion_log_source, conversion_log_target)
    conversion_log_declared = _declared_file(conversion_log_target, "conversion/convert.log")
    if conversion_log_declared["sha256"] != _mapping(conversion_step.get("log")).get("sha256"):
        raise ValueError("conversion log mismatch")

    intermediate_relative = plan.conversion.intermediate_path
    intermediate_source = conversion_root / intermediate_relative
    intermediate_target = original_root / intermediate_relative
    _hardlink_large(intermediate_source, intermediate_target)
    intermediate_declared = _declared_file(intermediate_target, intermediate_relative)
    if intermediate_declared["sha256"] != _mapping(conversion_step.get("output")).get("sha256"):
        raise ValueError("conversion intermediate mismatch")

    quantizations: list[dict[str, object]] = []
    quantize_sha = next(
        _text(_mapping(item.get("file")).get("sha256"))
        for item in binaries
        if item.get("name") == "llama-quantize"
    )
    for index, quantization in enumerate(plan.quantizations, start=1):
        suffix = quantization.quantization.lower().replace("_", "-")
        step_key = f"{model_key}-{suffix}"
        step = _load_json(conversion_root / "evidence/steps" / f"{step_key}.json")
        _require_complete_step(step, step_key)
        log_relative = f"quantization/{index}-{quantization.quantization}.log"
        log_target = original_root / log_relative
        _hardlink_large(conversion_root / "logs" / f"{step_key}.log", log_target)
        log_declared = _declared_file(log_target, log_relative)
        output_relative = quantization.output_path
        output_target = original_root / output_relative
        _hardlink_large(conversion_root / output_relative, output_target)
        output_declared = _declared_file(output_target, output_relative)
        if log_declared["sha256"] != _mapping(step.get("log")).get("sha256"):
            raise ValueError(f"quantization log mismatch: {step_key}")
        if output_declared["sha256"] != _mapping(step.get("output")).get("sha256"):
            raise ValueError(f"quantization output mismatch: {step_key}")
        quantizations.append(
            {
                "runtime_class": quantization.runtime_class.value,
                "quantization": quantization.quantization,
                "argv": list(quantization.argv),
                "log": log_declared,
                "output": output_declared,
                "input_sha256": intermediate_declared["sha256"],
                "quantize_binary_sha256": quantize_sha,
            }
        )

    source_files_sorted = sorted(source_files, key=lambda item: _text(item.get("path")))
    package_locator = (
        "gh-actions://pachaninm-lab/pachanin-demo/actions/artifacts/"
        f"{accepted_package.get('id')}@sha256:{package_declared['sha256']}"
    )
    manifest: dict[str, object] = {
        "schema_version": "tai.external-model-bundle.v1",
        "lifecycle": "COMPLETE",
        "role": plan.role.value,
        "model_id": plan.model_id,
        "revision": plan.revision,
        "authority_sha256": authority_sha256_v2(bundle_authority),
        "remote_inventory": {
            "model_id": plan.model_id,
            "revision": plan.revision,
            "source_uri": plan.source_uri,
            "observed_at": normalized_remote["observed_at"],
            "entries": normalized_remote["entries"],
            "evidence_file": remote_declared,
        },
        "source_files": source_files_sorted,
        "legal_review": {
            "decision": review.get("decision"),
            "reviewer_type": review.get("reviewer_type"),
            "reviewer_id": review.get("reviewer_id"),
            "reviewer_name": review.get("reviewer_name"),
            "reviewed_at": review.get("reviewed_at"),
            "license_spdx": review.get("license_spdx"),
            "decision_basis": review.get("decision_basis"),
            "conditions": review.get("conditions"),
            "record_type": review.get("record_type"),
            "attestation_reference": review.get("attestation_reference"),
            "license_text": license_declared,
            "review_record": review_declared,
        },
        "toolchain_package": {
            "name": bundle_authority.toolchain.name,
            "release": bundle_authority.toolchain.release,
            "commit": bundle_authority.toolchain.commit,
            "profile": bundle_authority.toolchain.profile,
            "authority_sha256": bundle_authority.toolchain.authority_sha256,
            "package": package_declared,
            "build_manifest": build_declared,
            "verification_report": verification_declared,
            "verification_status": "VERIFIED",
            "immutable_locator": package_locator,
            "binaries": binaries,
        },
        "conversion": {
            "python_identity": _python_identity(conversion_root),
            "python_dependencies": dependencies_declared,
            "converter": converter_declared,
            "argv": list(plan.conversion.argv),
            "log": conversion_log_declared,
            "intermediate": intermediate_declared,
            "source_files_sha256": _canonical_sha256(
                [
                    {
                        "path": item["path"],
                        "role": item["role"],
                        "sha256": item["sha256"],
                        "size_bytes": item["size_bytes"],
                    }
                    for item in source_files_sorted
                ]
            ),
            "toolchain_package_sha256": package_declared["sha256"],
        },
        "quantizations": quantizations,
        "storage": None,
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }

    declarations = _payload_declarations(manifest)
    payload_entries = [
        {
            "path": item["path"],
            "sha256": item["sha256"],
            "size_bytes": item["size_bytes"],
        }
        for item in sorted(declarations, key=lambda item: _text(item.get("path")))
    ]
    payload_index = {
        "schema_version": "tai.model-bundle-payload-index.v1",
        "model_id": plan.model_id,
        "revision": plan.revision,
        "entries": payload_entries,
    }
    payload_index_path = original_root / "storage/payload-index.json"
    _write_json(payload_index_path, payload_index)
    _write_json(model_root / "manifest.pre-storage.json", manifest)
    (model_root / "payload-paths.txt").write_text(
        "\n".join(_text(item["path"]) for item in payload_entries) + "\n",
        encoding="utf-8",
    )
    report: dict[str, object] = {
        "schema_version": "tai.model-bundle-prepare-report.v1",
        "status": "PREPARED_FOR_STREAMING",
        "model_key": model_key,
        "model_id": plan.model_id,
        "revision": plan.revision,
        "payload_files": len(payload_entries),
        "payload_bytes": sum(cast(int, item["size_bytes"]) for item in payload_entries),
        "original_root": str(original_root),
        "payload_paths": str(model_root / "payload-paths.txt"),
        "local_archive_copy": False,
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    report["report_sha256"] = _canonical_sha256(report)
    _write_json(model_root / "prepare-report.json", report)
    return report


def extract_stream(
    *, payload_index_path: Path, restore_root: Path, observation_path: Path
) -> dict[str, object]:
    index = _load_json(payload_index_path)
    if index.get("schema_version") != "tai.model-bundle-payload-index.v1":
        raise ValueError("payload index schema invalid")
    expected = {_text(item.get("path")): item for item in _objects(index.get("entries"))}
    if not expected:
        raise ValueError("payload index is empty")
    if restore_root.exists():
        if any(restore_root.iterdir()):
            raise ValueError("clean restore root is not empty")
    else:
        restore_root.mkdir(parents=True, mode=0o700)

    reader = _HashingReader(sys.stdin.buffer)
    observed: dict[str, dict[str, object]] = {}
    try:
        with tarfile.open(fileobj=cast(BinaryIO, reader), mode="r|") as archive:
            for member in archive:
                relative = _safe_relative(member.name)
                if relative is None:
                    raise ValueError(f"unsafe archive member path: {member.name}")
                if not member.isreg():
                    raise ValueError(f"archive member is not regular: {relative}")
                if relative in observed:
                    raise ValueError(f"duplicate archive member: {relative}")
                declared = expected.get(relative)
                if declared is None:
                    raise ValueError(f"archive member is not declared: {relative}")
                if member.size != _integer(declared.get("size_bytes")):
                    raise ValueError(f"archive member size mismatch: {relative}")
                source = archive.extractfile(member)
                if source is None:
                    raise ValueError(f"archive member cannot be read: {relative}")
                target = restore_root / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                digest = hashlib.sha256()
                written = 0
                with target.open("xb") as output:
                    while chunk := source.read(_CHUNK_SIZE):
                        output.write(chunk)
                        digest.update(chunk)
                        written += len(chunk)
                if written != member.size:
                    raise ValueError(f"archive member truncated: {relative}")
                value = digest.hexdigest()
                if value != _text(declared.get("sha256")):
                    raise ValueError(f"archive member SHA-256 mismatch: {relative}")
                observed[relative] = {
                    "path": relative,
                    "size_bytes": written,
                    "sha256": value,
                }
        while reader.read(_CHUNK_SIZE):
            pass
        if set(observed) != set(expected):
            missing = sorted(set(expected) - set(observed))
            raise ValueError(f"archive payload incomplete: {missing}")
        report: dict[str, object] = {
            "schema_version": "tai.model-bundle-archive-observation.v1",
            "archive_sha256": reader.hexdigest(),
            "archive_size_bytes": reader.size_bytes,
            "entries": [observed[path] for path in sorted(observed)],
        }
        _write_json(observation_path, report)
        return report
    except Exception:
        _safe_remove_tree(restore_root, restore_root.parent)
        raise


def seal_bundle(
    *,
    bundle_authority_path: Path,
    model_root: Path,
    object_record_path: Path,
) -> dict[str, object]:
    manifest = _load_json(model_root / "manifest.pre-storage.json")
    object_record = _load_json(object_record_path)
    observation_path = model_root / "archive-observation.json"
    observation = _load_json(observation_path)
    original_root = model_root / "original"
    restore_root = model_root / "clean-restore"
    archive_sha256 = _text(object_record.get("archive_sha256"))
    archive_size = _integer(object_record.get("archive_size_bytes"))
    if observation.get("archive_sha256") != archive_sha256:
        raise ValueError("restored archive SHA-256 differs from uploaded archive")
    if observation.get("archive_size_bytes") != archive_size:
        raise ValueError("restored archive size differs from uploaded archive")

    storage_object = {
        "endpoint_host": object_record.get("endpoint_host"),
        "region": object_record.get("region"),
        "bucket": object_record.get("bucket"),
        "key": object_record.get("key"),
        "version_id": object_record.get("version_id"),
        "etag": object_record.get("etag"),
    }
    locator = _text(object_record.get("immutable_locator"))
    upload = {
        "schema_version": "tai.model-bundle-upload-record.v2",
        "archive_sha256": archive_sha256,
        "archive_size_bytes": archive_size,
        "immutable_locator": locator,
        "object": storage_object,
        "uploaded_at": object_record.get("uploaded_at"),
        "retention_mode": "COMPLIANCE",
        "retention_days": 90,
        "retention_expires_at": object_record.get("retention_expires_at"),
    }
    upload_path = original_root / "storage/upload-record.json"
    _write_json(upload_path, upload)
    restore = {
        "schema_version": "tai.model-bundle-restore-record.v2",
        "archive_sha256": archive_sha256,
        "archive_size_bytes": archive_size,
        "immutable_locator": locator,
        "object": storage_object,
        "restored_at": object_record.get("restored_at"),
        "archive_observation_sha256": _canonical_sha256(observation),
    }
    restore_path = original_root / "storage/restore-record.json"
    _write_json(restore_path, restore)
    payload_index_path = original_root / "storage/payload-index.json"
    manifest["storage"] = {
        "archive": {
            "sha256": archive_sha256,
            "size_bytes": archive_size,
            "media_type": "application/x-tar",
        },
        "payload_index": _declared_file(payload_index_path, "storage/payload-index.json"),
        "immutable_locator": locator,
        "object": storage_object,
        "uploaded_at": object_record.get("uploaded_at"),
        "retention_mode": "COMPLIANCE",
        "retention_days": 90,
        "retention_expires_at": object_record.get("retention_expires_at"),
        "restored_at": object_record.get("restored_at"),
        "upload_record": _declared_file(upload_path, "storage/upload-record.json"),
        "restore_record": _declared_file(restore_path, "storage/restore-record.json"),
    }
    manifest_path = model_root / "manifest.json"
    _write_json(manifest_path, manifest)
    verification = verify_external_model_bundle(
        authority_path=bundle_authority_path,
        manifest_path=manifest_path,
        original_root=original_root,
        restored_root=restore_root,
        archive_observation_path=observation_path,
    )
    _write_json(model_root / "verification-report.json", verification)
    if verification["status"] != "VERIFIED":
        raise ValueError(f"external bundle verification rejected: {verification['reasons']}")
    return verification


class _HashingReader:
    def __init__(self, source: BinaryIO) -> None:
        self._source = source
        self._digest = hashlib.sha256()
        self.size_bytes = 0

    def read(self, size: int = -1) -> bytes:
        data = self._source.read(size)
        if data:
            self._digest.update(data)
            self.size_bytes += len(data)
        return data

    def hexdigest(self) -> str:
        return self._digest.hexdigest()


def _verify_completed_conversion(authority: dict[str, Any], root: Path) -> None:
    status = _load_json(root / "status.json")
    report = _load_json(root / "evidence/conversion-report.json")
    if status.get("state") != "COMPLETE":
        raise ValueError("conversion run is not complete")
    if report.get("status") != _mapping(authority.get("result")).get("complete_status"):
        raise ValueError("conversion report status mismatch")
    if report.get("benchmark_status") != "NOT_RUN":
        raise ValueError("unexpected benchmark status")
    if report.get("model_admission_status") != "NOT_DONE":
        raise ValueError("unexpected model admission status")
    if report.get("production_operational_status") != "NOT_ATTESTED":
        raise ValueError("unexpected production operational status")


def _require_complete_step(step: dict[str, Any], expected_key: str) -> None:
    if step.get("step_key") != expected_key or step.get("status") != "COMPLETE":
        raise ValueError(f"conversion step is not complete: {expected_key}")
    if step.get("exit_code") != 0:
        raise ValueError(f"conversion step exit code is non-zero: {expected_key}")


def _model_record(authority: dict[str, Any], key: str) -> dict[str, Any]:
    matches = [item for item in _objects(authority.get("models")) if item.get("key") == key]
    if len(matches) != 1:
        raise ValueError(f"conversion authority model cardinality invalid: {key}")
    return matches[0]


def _payload_declarations(manifest: dict[str, object]) -> list[dict[str, object]]:
    result: list[dict[str, object]] = list(_objects(manifest.get("source_files")))
    remote = _mapping(manifest.get("remote_inventory"))
    result.append(_mapping(remote.get("evidence_file")))
    legal = _mapping(manifest.get("legal_review"))
    result.extend([_mapping(legal.get("license_text")), _mapping(legal.get("review_record"))])
    toolchain = _mapping(manifest.get("toolchain_package"))
    result.extend(
        [
            _mapping(toolchain.get("package")),
            _mapping(toolchain.get("build_manifest")),
            _mapping(toolchain.get("verification_report")),
        ]
    )
    result.extend(_mapping(item.get("file")) for item in _objects(toolchain.get("binaries")))
    conversion = _mapping(manifest.get("conversion"))
    result.extend(
        [
            _mapping(conversion.get("python_dependencies")),
            _mapping(conversion.get("converter")),
            _mapping(conversion.get("log")),
            _mapping(conversion.get("intermediate")),
        ]
    )
    for item in _objects(manifest.get("quantizations")):
        result.extend([_mapping(item.get("log")), _mapping(item.get("output"))])
    return result


def _python_identity(conversion_root: Path) -> str:
    version_path = conversion_root / "evidence/python-version.txt"
    return version_path.read_text(encoding="utf-8").strip()


def _hardlink_large(source: Path, target: Path) -> None:
    source = source.resolve(strict=True)
    if not source.is_file() or source.is_symlink():
        raise ValueError(f"large payload source is not a regular file: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(source, target)
    except OSError as error:
        raise ValueError(f"large payload hardlink failed: {source}") from error


def _copy_small(source: Path, target: Path) -> None:
    source = source.resolve(strict=True)
    if not source.is_file() or source.is_symlink():
        raise ValueError(f"metadata source is not a regular file: {source}")
    if source.stat().st_size > 50_000_000:
        raise ValueError(f"metadata file exceeds bounded copy limit: {source}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    target.chmod(0o600)


def _declared_file(path: Path, relative: str) -> dict[str, object]:
    path = path.resolve(strict=True)
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"declared path is not a regular file: {relative}")
    return {
        "path": relative,
        "size_bytes": path.stat().st_size,
        "sha256": _sha256_file(path),
    }


def _safe_remove_tree(path: Path, boundary: Path) -> None:
    if not path.exists():
        return
    resolved_boundary = boundary.resolve(strict=True)
    resolved = path.resolve(strict=True)
    if resolved == resolved_boundary or resolved_boundary not in resolved.parents:
        raise ValueError(f"cleanup path escapes boundary: {path}")
    shutil.rmtree(resolved)


def _safe_relative(value: str) -> str | None:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        return None
    return value if path.as_posix() == value else None


def _load_json(path: Path) -> dict[str, Any]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON root is not an object: {path}")
    return payload


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    path.chmod(0o600)


def _mapping(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _objects(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _text(value: object) -> str:
    return value if isinstance(value, str) else ""


def _integer(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(_CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_sha256(value: object) -> str:
    rendered = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(rendered.encode()).hexdigest()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="TAI external model-bundle remote operations")
    subparsers = parser.add_subparsers(dest="command", required=True)

    prepare = subparsers.add_parser("prepare")
    prepare.add_argument("bundle_authority", type=Path)
    prepare.add_argument("conversion_authority", type=Path)
    prepare.add_argument("conversion_root", type=Path)
    prepare.add_argument("control_root", type=Path)
    prepare.add_argument("work_root", type=Path)
    prepare.add_argument("model_key")

    extract = subparsers.add_parser("extract")
    extract.add_argument("payload_index", type=Path)
    extract.add_argument("restore_root", type=Path)
    extract.add_argument("observation", type=Path)

    seal = subparsers.add_parser("seal")
    seal.add_argument("bundle_authority", type=Path)
    seal.add_argument("model_root", type=Path)
    seal.add_argument("object_record", type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = build_parser().parse_args(argv)
    if arguments.command == "prepare":
        prepare_bundle(
            bundle_authority_path=arguments.bundle_authority,
            conversion_authority_path=arguments.conversion_authority,
            conversion_root=arguments.conversion_root,
            control_root=arguments.control_root,
            work_root=arguments.work_root,
            model_key=arguments.model_key,
        )
        return 0
    if arguments.command == "extract":
        extract_stream(
            payload_index_path=arguments.payload_index,
            restore_root=arguments.restore_root,
            observation_path=arguments.observation,
        )
        return 0
    if arguments.command == "seal":
        seal_bundle(
            bundle_authority_path=arguments.bundle_authority,
            model_root=arguments.model_root,
            object_record_path=arguments.object_record,
        )
        return 0
    raise AssertionError("unreachable command")


if __name__ == "__main__":
    raise SystemExit(main())
