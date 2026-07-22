from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

from tai.model_bundle_v2 import (
    InventoryDisposition,
    authority_sha256_v2,
    load_model_bundle_authority_v2,
)

_MANIFEST_SCHEMA = "tai.external-model-bundle.v1"
_INDEX_SCHEMA = "tai.model-bundle-payload-index.v1"
_OBSERVATION_SCHEMA = "tai.model-bundle-archive-observation.v1"
_REPORT_SCHEMA = "tai.external-model-bundle-verification-report.v1"
_UPLOAD_SCHEMA = "tai.model-bundle-upload-record.v2"
_RESTORE_SCHEMA = "tai.model-bundle-restore-record.v2"
_CHUNK_SIZE = 1024 * 1024


def verify_external_model_bundle(
    *,
    authority_path: Path,
    manifest_path: Path,
    original_root: Path,
    restored_root: Path,
    archive_observation_path: Path,
) -> dict[str, object]:
    """Verify a clean restore without requiring a second local copy of the large archive."""

    authority = load_model_bundle_authority_v2(authority_path)
    manifest = _load_json(manifest_path)
    observation = _load_json(archive_observation_path)
    reasons: list[str] = []

    _verify_top_level(manifest, observation, reasons)
    model_id = _text(manifest.get("model_id"))
    revision = _text(manifest.get("revision"))
    plan = next(
        (
            item
            for item in authority.models
            if item.model_id == model_id and item.revision == revision
        ),
        None,
    )
    if plan is None:
        reasons.append("MODEL_NOT_AUTHORIZED")
    else:
        if manifest.get("role") != plan.role.value:
            reasons.append("MODEL_ROLE_MISMATCH")
        _verify_authority_contract(authority, plan, manifest, original_root, reasons)
    if manifest.get("authority_sha256") != authority_sha256_v2(authority):
        reasons.append("AUTHORITY_SHA256_MISMATCH")

    payload = _payload_declarations(manifest, reasons)
    controls = _control_declarations(manifest, reasons)
    payload_by_path = _unique_by_path(payload, "PAYLOAD", reasons)
    control_by_path = _unique_by_path(controls, "CONTROL", reasons)
    for path in sorted(set(payload_by_path) & set(control_by_path)):
        reasons.append(f"PAYLOAD_CONTROL_PATH_ALIAS:{path}")

    verified_original = _verify_root(
        root=original_root,
        expected={**payload_by_path, **control_by_path},
        prefix="ORIGINAL",
        reasons=reasons,
    )
    verified_restored = _verify_root(
        root=restored_root,
        expected=payload_by_path,
        prefix="RESTORED",
        reasons=reasons,
    )

    storage = _mapping(manifest.get("storage"))
    archive = _mapping(storage.get("archive"))
    archive_sha256 = _text(archive.get("sha256"))
    archive_size = _integer(archive.get("size_bytes"))
    if archive.get("media_type") != "application/x-tar":
        reasons.append("ARCHIVE_MEDIA_TYPE_INVALID")
    if not _is_sha256(archive_sha256):
        reasons.append("ARCHIVE_SHA256_INVALID")
    if archive_size is None or archive_size < 1:
        reasons.append("ARCHIVE_SIZE_INVALID")

    if observation.get("archive_sha256") != archive_sha256:
        reasons.append("ARCHIVE_OBSERVATION_SHA256_MISMATCH")
    if observation.get("archive_size_bytes") != archive_size:
        reasons.append("ARCHIVE_OBSERVATION_SIZE_MISMATCH")
    observed_members = {
        _text(item.get("path")): (
            _integer(item.get("size_bytes")),
            _text(item.get("sha256")),
        )
        for item in _objects(observation.get("entries"))
    }
    expected_members = {
        path: (_integer(item.get("size_bytes")), _text(item.get("sha256")))
        for path, item in payload_by_path.items()
    }
    if observed_members != expected_members:
        reasons.append("ARCHIVE_MEMBER_MAP_MISMATCH")

    index_declared = _declared(storage.get("payload_index"), "payload index", reasons)
    index = _load_declared_json(original_root, index_declared, "PAYLOAD_INDEX", reasons)
    expected_index = {
        "schema_version": _INDEX_SCHEMA,
        "model_id": model_id,
        "revision": revision,
        "entries": [
            {
                "path": path,
                "sha256": _text(item.get("sha256")),
                "size_bytes": _integer(item.get("size_bytes")),
            }
            for path, item in sorted(payload_by_path.items())
        ],
    }
    if index != expected_index:
        reasons.append("PAYLOAD_INDEX_MISMATCH")

    _verify_storage(storage, original_root, observation, reasons)
    unique_reasons = sorted(set(reasons))
    report: dict[str, object] = {
        "schema_version": _REPORT_SCHEMA,
        "status": "VERIFIED" if not unique_reasons else "REJECTED",
        "reasons": unique_reasons,
        "model_id": model_id,
        "revision": revision,
        "authority_sha256": authority_sha256_v2(authority),
        "manifest_sha256": _sha256_file(manifest_path),
        "archive_sha256": archive_sha256 or None,
        "archive_size_bytes": archive_size,
        "verified_original_files": verified_original,
        "verified_restored_files": verified_restored,
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    report["report_sha256"] = _canonical_sha256(report)
    return report


def _verify_top_level(
    manifest: dict[str, Any], observation: dict[str, Any], reasons: list[str]
) -> None:
    if manifest.get("schema_version") != _MANIFEST_SCHEMA:
        reasons.append("MANIFEST_SCHEMA_INVALID")
    if observation.get("schema_version") != _OBSERVATION_SCHEMA:
        reasons.append("ARCHIVE_OBSERVATION_SCHEMA_INVALID")
    if manifest.get("lifecycle") != "COMPLETE":
        reasons.append("BUNDLE_LIFECYCLE_NOT_COMPLETE")
    boundaries = {
        "benchmark_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
    }
    for key, expected in boundaries.items():
        if manifest.get(key) != expected:
            reasons.append(f"MATURITY_BOUNDARY_INVALID:{key}")


def _verify_authority_contract(
    authority: Any,
    plan: Any,
    manifest: dict[str, Any],
    original_root: Path,
    reasons: list[str],
) -> None:
    source_files = _objects(manifest.get("source_files"))
    expected_sources = {
        (entry.path, entry.role.value)
        for entry in plan.inventory
        if entry.disposition is InventoryDisposition.SELECTED
    }
    observed_sources = {(_text(item.get("path")), _text(item.get("role"))) for item in source_files}
    if observed_sources != expected_sources:
        reasons.append("SOURCE_FILE_SET_MISMATCH")

    remote = _mapping(manifest.get("remote_inventory"))
    if (
        remote.get("model_id"),
        remote.get("revision"),
        remote.get("source_uri"),
    ) != (plan.model_id, plan.revision, plan.source_uri):
        reasons.append("REMOTE_INVENTORY_AUTHORITY_MISMATCH")
    remote_entries = _objects(remote.get("entries"))
    if {_text(item.get("path")) for item in remote_entries} != {
        entry.path for entry in plan.inventory
    }:
        reasons.append("REMOTE_INVENTORY_SET_MISMATCH")
    remote_file = _declared(remote.get("evidence_file"), "remote inventory", reasons)
    expected_remote = {
        "schema_version": "tai.remote-model-inventory-evidence.v1",
        "model_id": plan.model_id,
        "revision": plan.revision,
        "source_uri": plan.source_uri,
        "observed_at": remote.get("observed_at"),
        "entries": remote_entries,
    }
    if (
        _load_declared_json(original_root, remote_file, "REMOTE_INVENTORY", reasons)
        != expected_remote
    ):
        reasons.append("REMOTE_INVENTORY_EVIDENCE_MISMATCH")

    legal = _mapping(manifest.get("legal_review"))
    if legal.get("decision") != "APPROVED":
        reasons.append("LEGAL_REVIEW_NOT_APPROVED")
    if legal.get("reviewer_type") != "HUMAN":
        reasons.append("LEGAL_REVIEWER_NOT_HUMAN")
    if legal.get("license_spdx") != plan.license_spdx:
        reasons.append("LICENSE_SPDX_MISMATCH")
    license_file = _declared(legal.get("license_text"), "license text", reasons)
    review_file = _declared(legal.get("review_record"), "legal review", reasons)
    expected_review = {
        "schema_version": "tai.model-legal-review-record.v1",
        "decision": "APPROVED",
        "reviewer_type": "HUMAN",
        "reviewer_id": legal.get("reviewer_id"),
        "reviewer_name": legal.get("reviewer_name"),
        "reviewed_at": legal.get("reviewed_at"),
        "license_spdx": plan.license_spdx,
        "decision_basis": legal.get("decision_basis"),
        "conditions": legal.get("conditions"),
        "record_type": legal.get("record_type"),
        "attestation_reference": legal.get("attestation_reference"),
        "license_text_sha256": license_file.get("sha256"),
    }
    if _load_declared_json(original_root, review_file, "LEGAL_REVIEW", reasons) != expected_review:
        reasons.append("LEGAL_REVIEW_RECORD_MISMATCH")

    toolchain = _mapping(manifest.get("toolchain_package"))
    expected_toolchain = authority.toolchain
    observed_identity = (
        toolchain.get("name"),
        toolchain.get("release"),
        toolchain.get("commit"),
        toolchain.get("profile"),
        toolchain.get("authority_sha256"),
    )
    expected_identity = (
        expected_toolchain.name,
        expected_toolchain.release,
        expected_toolchain.commit,
        expected_toolchain.profile,
        expected_toolchain.authority_sha256,
    )
    if observed_identity != expected_identity:
        reasons.append("TOOLCHAIN_PACKAGE_AUTHORITY_MISMATCH")
    binaries = _objects(toolchain.get("binaries"))
    if {_text(item.get("name")) for item in binaries} != set(expected_toolchain.required_binaries):
        reasons.append("TOOLCHAIN_BINARY_SET_MISMATCH")
    toolchain_report = _declared(
        toolchain.get("verification_report"), "toolchain verification report", reasons
    )
    report = _load_declared_json(original_root, toolchain_report, "TOOLCHAIN_REPORT", reasons)
    if report.get("status") != "VERIFIED":
        reasons.append("TOOLCHAIN_VERIFICATION_REPORT_NOT_VERIFIED")
    if report.get("authority_sha256") != expected_toolchain.authority_sha256:
        reasons.append("TOOLCHAIN_VERIFICATION_REPORT_AUTHORITY_MISMATCH")
    targets = report.get("verified_targets")
    if not isinstance(targets, list) or set(targets) != set(expected_toolchain.required_binaries):
        reasons.append("TOOLCHAIN_VERIFICATION_REPORT_TARGET_SET_MISMATCH")

    conversion = _mapping(manifest.get("conversion"))
    if conversion.get("argv") != list(plan.conversion.argv):
        reasons.append("CONVERSION_ARGV_MISMATCH")
    if _mapping(conversion.get("converter")).get("path") != plan.conversion.converter_path:
        reasons.append("CONVERTER_PATH_MISMATCH")
    if _mapping(conversion.get("intermediate")).get("path") != plan.conversion.intermediate_path:
        reasons.append("INTERMEDIATE_PATH_MISMATCH")
    source_digest_payload = [
        {
            "path": item.get("path"),
            "role": item.get("role"),
            "sha256": item.get("sha256"),
            "size_bytes": item.get("size_bytes"),
        }
        for item in sorted(source_files, key=lambda value: _text(value.get("path")))
    ]
    if conversion.get("source_files_sha256") != _canonical_sha256(source_digest_payload):
        reasons.append("CONVERSION_SOURCE_BINDING_MISMATCH")
    package_sha = _mapping(toolchain.get("package")).get("sha256")
    if conversion.get("toolchain_package_sha256") != package_sha:
        reasons.append("CONVERSION_TOOLCHAIN_BINDING_MISMATCH")

    observed_quantizations = _objects(manifest.get("quantizations"))
    expected_quantizations = {
        (item.runtime_class.value, item.quantization): item for item in plan.quantizations
    }
    quantizations = {
        (_text(item.get("runtime_class")), _text(item.get("quantization"))): item
        for item in observed_quantizations
    }
    if set(quantizations) != set(expected_quantizations):
        reasons.append("QUANTIZATION_SET_MISMATCH")
    input_sha = _mapping(conversion.get("intermediate")).get("sha256")
    quantize_sha = next(
        (
            _mapping(item.get("file")).get("sha256")
            for item in binaries
            if item.get("name") == "llama-quantize"
        ),
        None,
    )
    for identity, item in quantizations.items():
        expected_item = expected_quantizations.get(identity)
        if expected_item is None:
            continue
        if item.get("argv") != list(expected_item.argv):
            reasons.append(f"QUANTIZATION_ARGV_MISMATCH:{identity[0]}:{identity[1]}")
        if _mapping(item.get("output")).get("path") != expected_item.output_path:
            reasons.append(f"QUANTIZATION_OUTPUT_PATH_MISMATCH:{identity[0]}:{identity[1]}")
        if item.get("input_sha256") != input_sha:
            reasons.append(f"QUANTIZATION_INPUT_BINDING_MISMATCH:{identity[0]}:{identity[1]}")
        if item.get("quantize_binary_sha256") != quantize_sha:
            reasons.append(f"QUANTIZATION_BINARY_BINDING_MISMATCH:{identity[0]}:{identity[1]}")


def _payload_declarations(manifest: dict[str, Any], reasons: list[str]) -> list[dict[str, Any]]:
    result = [
        _declared(item, "source file", reasons) for item in _objects(manifest.get("source_files"))
    ]
    remote = _mapping(manifest.get("remote_inventory"))
    result.append(_declared(remote.get("evidence_file"), "remote inventory", reasons))
    legal = _mapping(manifest.get("legal_review"))
    result.extend(
        [
            _declared(legal.get("license_text"), "license text", reasons),
            _declared(legal.get("review_record"), "legal review", reasons),
        ]
    )
    toolchain = _mapping(manifest.get("toolchain_package"))
    result.extend(
        [
            _declared(toolchain.get("package"), "toolchain package", reasons),
            _declared(toolchain.get("build_manifest"), "toolchain build manifest", reasons),
            _declared(toolchain.get("verification_report"), "toolchain report", reasons),
        ]
    )
    result.extend(
        _declared(item.get("file"), "toolchain binary", reasons)
        for item in _objects(toolchain.get("binaries"))
    )
    conversion = _mapping(manifest.get("conversion"))
    result.extend(
        [
            _declared(conversion.get("python_dependencies"), "python dependencies", reasons),
            _declared(conversion.get("converter"), "converter", reasons),
            _declared(conversion.get("log"), "conversion log", reasons),
            _declared(conversion.get("intermediate"), "intermediate", reasons),
        ]
    )
    for item in _objects(manifest.get("quantizations")):
        result.extend(
            [
                _declared(item.get("log"), "quantization log", reasons),
                _declared(item.get("output"), "quantization output", reasons),
            ]
        )
    return result


def _control_declarations(manifest: dict[str, Any], reasons: list[str]) -> list[dict[str, Any]]:
    storage = _mapping(manifest.get("storage"))
    return [
        _declared(storage.get("payload_index"), "payload index", reasons),
        _declared(storage.get("upload_record"), "upload record", reasons),
        _declared(storage.get("restore_record"), "restore record", reasons),
    ]


def _verify_storage(
    storage: dict[str, Any],
    original_root: Path,
    observation: dict[str, Any],
    reasons: list[str],
) -> None:
    archive = _mapping(storage.get("archive"))
    object_record = _mapping(storage.get("object"))
    digest = _text(archive.get("sha256"))
    locator = _text(storage.get("immutable_locator"))
    if f"sha256={digest}" not in locator and f"sha256:{digest}" not in locator:
        reasons.append("STORAGE_LOCATOR_ARCHIVE_SHA256_MISMATCH")
    if digest not in _text(object_record.get("key")):
        reasons.append("OBJECT_KEY_NOT_CONTENT_ADDRESSED")
    version_id = _text(object_record.get("version_id"))
    if not version_id or version_id.lower() == "null":
        reasons.append("OBJECT_VERSION_ID_MISSING")
    if storage.get("retention_mode") != "COMPLIANCE":
        reasons.append("RETENTION_MODE_INVALID")

    uploaded = _timestamp(storage.get("uploaded_at"), "uploaded_at", reasons)
    expires = _timestamp(storage.get("retention_expires_at"), "retention_expires_at", reasons)
    restored = _timestamp(storage.get("restored_at"), "restored_at", reasons)
    retention_days = _integer(storage.get("retention_days"))
    if (
        uploaded is not None
        and expires is not None
        and retention_days is not None
        and uploaded + timedelta(days=retention_days) != expires
    ):
        reasons.append("RETENTION_INTERVAL_MISMATCH")
    if restored is not None and expires is not None and restored > expires:
        reasons.append("RESTORE_OUTSIDE_RETENTION")

    upload_file = _declared(storage.get("upload_record"), "upload record", reasons)
    restore_file = _declared(storage.get("restore_record"), "restore record", reasons)
    expected_upload = {
        "schema_version": _UPLOAD_SCHEMA,
        "archive_sha256": digest,
        "archive_size_bytes": archive.get("size_bytes"),
        "immutable_locator": locator,
        "object": object_record,
        "uploaded_at": storage.get("uploaded_at"),
        "retention_mode": storage.get("retention_mode"),
        "retention_days": retention_days,
        "retention_expires_at": storage.get("retention_expires_at"),
    }
    if _load_declared_json(original_root, upload_file, "UPLOAD_RECORD", reasons) != expected_upload:
        reasons.append("UPLOAD_RECORD_MISMATCH")
    expected_restore = {
        "schema_version": _RESTORE_SCHEMA,
        "archive_sha256": digest,
        "archive_size_bytes": archive.get("size_bytes"),
        "immutable_locator": locator,
        "object": object_record,
        "restored_at": storage.get("restored_at"),
        "archive_observation_sha256": _canonical_sha256(observation),
    }
    if (
        _load_declared_json(original_root, restore_file, "RESTORE_RECORD", reasons)
        != expected_restore
    ):
        reasons.append("RESTORE_RECORD_MISMATCH")


def _unique_by_path(
    declarations: list[dict[str, Any]], prefix: str, reasons: list[str]
) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for item in declarations:
        path = _text(item.get("path"))
        if path in result:
            reasons.append(f"{prefix}_PATH_DUPLICATE:{path}")
        result[path] = item
    return result


def _verify_root(
    *,
    root: Path,
    expected: dict[str, dict[str, Any]],
    prefix: str,
    reasons: list[str],
) -> list[str]:
    if not root.is_dir() or root.is_symlink():
        reasons.append(f"{prefix}_ROOT_INVALID")
        return []
    observed: set[str] = set()
    for current, directories, files in os.walk(root, followlinks=False):
        current_path = Path(current)
        safe_directories: list[str] = []
        for name in directories:
            candidate = current_path / name
            if candidate.is_symlink():
                reasons.append(
                    f"{prefix}_FILE_UNSAFE:{candidate.relative_to(root).as_posix()}:symlink"
                )
            else:
                safe_directories.append(name)
        directories[:] = safe_directories
        for name in files:
            candidate = current_path / name
            relative = candidate.relative_to(root).as_posix()
            if candidate.is_symlink() or not candidate.is_file():
                reasons.append(f"{prefix}_FILE_UNSAFE:{relative}:non-regular")
            else:
                observed.add(relative)
    expected_paths = set(expected)
    for path in sorted(expected_paths - observed):
        reasons.append(f"{prefix}_FILE_MISSING:{path}")
    for path in sorted(observed - expected_paths):
        reasons.append(f"{prefix}_FILE_EXTRA:{path}")

    verified: list[str] = []
    seen_inodes: set[tuple[int, int]] = set()
    for relative in sorted(expected_paths & observed):
        candidate_path = _safe_file(root, relative)
        if candidate_path is None:
            reasons.append(f"{prefix}_FILE_UNSAFE:{relative}")
            continue
        metadata = candidate_path.stat()
        inode = (metadata.st_dev, metadata.st_ino)
        if inode in seen_inodes:
            reasons.append(f"{prefix}_FILE_INODE_ALIAS:{relative}")
            continue
        seen_inodes.add(inode)
        declared = expected[relative]
        if metadata.st_size != _integer(declared.get("size_bytes")):
            reasons.append(f"{prefix}_FILE_SIZE_MISMATCH:{relative}")
        elif _sha256_file(candidate_path) != _text(declared.get("sha256")):
            reasons.append(f"{prefix}_FILE_SHA256_MISMATCH:{relative}")
        else:
            verified.append(relative)
    return verified


def _load_declared_json(
    root: Path,
    declared: dict[str, Any],
    prefix: str,
    reasons: list[str],
) -> dict[str, Any]:
    relative = _text(declared.get("path"))
    path = _safe_file(root, relative)
    if path is None:
        reasons.append(f"{prefix}_FILE_MISSING:{relative}")
        return {}
    if path.stat().st_size != _integer(declared.get("size_bytes")):
        reasons.append(f"{prefix}_FILE_SIZE_MISMATCH")
    if _sha256_file(path) != _text(declared.get("sha256")):
        reasons.append(f"{prefix}_FILE_SHA256_MISMATCH")
    try:
        return _load_json(path)
    except ValueError as error:
        reasons.append(f"{prefix}_JSON_INVALID:{error}")
        return {}


def _declared(value: object, label: str, reasons: list[str]) -> dict[str, Any]:
    item = _mapping(value)
    path = _text(item.get("path"))
    digest = _text(item.get("sha256"))
    size = _integer(item.get("size_bytes"))
    if _safe_relative(path) is None:
        reasons.append(f"DECLARED_PATH_INVALID:{label}")
    if not _is_sha256(digest):
        reasons.append(f"DECLARED_SHA256_INVALID:{label}")
    if size is None or size < 1:
        reasons.append(f"DECLARED_SIZE_INVALID:{label}")
    return item


def _safe_file(root: Path, relative: str) -> Path | None:
    if _safe_relative(relative) is None:
        return None
    candidate = root / relative
    try:
        resolved_root = root.resolve(strict=True)
        resolved = candidate.resolve(strict=True)
    except OSError:
        return None
    if resolved_root not in resolved.parents or candidate.is_symlink() or not candidate.is_file():
        return None
    return candidate


def _safe_relative(value: str) -> str | None:
    path = PurePosixPath(value)
    if path.is_absolute() or not path.parts or any(part in {"", ".", ".."} for part in path.parts):
        return None
    return value if path.as_posix() == value else None


def _load_json(path: Path) -> dict[str, Any]:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    payload = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates)
    if not isinstance(payload, dict):
        raise ValueError("JSON root must be an object")
    return payload


def _timestamp(value: object, label: str, reasons: list[str]) -> datetime | None:
    if not isinstance(value, str):
        reasons.append(f"TIMESTAMP_INVALID:{label}")
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        reasons.append(f"TIMESTAMP_INVALID:{label}")
        return None
    if parsed.tzinfo is None:
        reasons.append(f"TIMESTAMP_TIMEZONE_MISSING:{label}")
        return None
    return parsed


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


def _is_sha256(value: str) -> bool:
    return len(value) == 64 and all(character in "0123456789abcdef" for character in value)


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(_CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_sha256(value: object) -> str:
    rendered = json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(rendered.encode()).hexdigest()
