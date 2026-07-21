from __future__ import annotations

import hashlib
import json
import os
from dataclasses import replace
from pathlib import Path, PurePosixPath

from tai.model_bundle_v2 import (
    BundleVerificationStatus,
    DeclaredFile,
    LocalModelBundleV2,
    ModelBundleAuthority,
    load_local_model_bundle_v2,
    load_model_bundle_authority_v2,
    report_payload_v2,
    verify_local_model_bundle_v2,
)

_PAYLOAD_INDEX_SCHEMA = "tai.model-bundle-payload-index.v1"
_REPORT_SCHEMA = "tai.model-bundle-storage-verification-report.v1"
_CHUNK_SIZE = 1024 * 1024
_ALLOWED_NON_STORAGE_REASONS = {"MANIFEST_SECTION_MISSING:STORAGE"}


def verify_bundle_storage_v2(
    *,
    authority_path: Path,
    manifest_path: Path,
    original_root: Path,
    restored_root: Path,
) -> dict[str, object]:
    authority = load_model_bundle_authority_v2(authority_path)
    bundle = load_local_model_bundle_v2(manifest_path)
    return verify_loaded_bundle_storage_v2(
        authority=authority,
        bundle=bundle,
        original_root=original_root,
        restored_root=restored_root,
    )


def verify_loaded_bundle_storage_v2(
    *,
    authority: ModelBundleAuthority,
    bundle: LocalModelBundleV2,
    original_root: Path,
    restored_root: Path,
) -> dict[str, object]:
    reasons: list[str] = []
    payload_files = _payload_declared_files(bundle)
    payload_by_path = {item.path: item for item in payload_files}
    if len(payload_by_path) != len(payload_files):
        reasons.append("PAYLOAD_DECLARED_FILE_PATH_DUPLICATE")

    storage = bundle.storage
    if storage is None:
        reasons.append("STORAGE_SECTION_MISSING")
        return _report(bundle, reasons, (), (), None, None, None)

    sidecars = (storage.payload_index, storage.upload_record, storage.restore_record)
    expected_original = set(payload_by_path) | {item.path for item in sidecars}
    expected_restored = set(payload_by_path)
    original_paths = _safe_root_file_set(original_root, "ORIGINAL", reasons)
    restored_paths = _safe_root_file_set(restored_root, "RESTORED", reasons)
    _compare_file_set("ORIGINAL", original_paths, expected_original, reasons)
    _compare_file_set("RESTORED", restored_paths, expected_restored, reasons)

    index_payload = _load_payload_index(
        original_root=original_root,
        declared=storage.payload_index,
        bundle=bundle,
        expected=payload_by_path,
        reasons=reasons,
    )
    index_entries = _index_entries(index_payload)
    original_entries = _hash_declared_root(
        root=original_root,
        declared=payload_files,
        prefix="ORIGINAL",
        reasons=reasons,
    )
    restored_entries = _hash_declared_root(
        root=restored_root,
        declared=payload_files,
        prefix="RESTORED",
        reasons=reasons,
    )
    _compare_entry_map("ORIGINAL", original_entries, index_entries, reasons)
    _compare_entry_map("RESTORED", restored_entries, index_entries, reasons)

    _verify_external_archive_metadata(bundle, reasons)
    _verify_storage_sidecars(bundle, original_root, reasons)
    legacy_report_sha256 = _verify_non_storage_bundle_contract(
        authority=authority,
        bundle=bundle,
        original_root=original_root,
        restored_root=restored_root,
        reasons=reasons,
    )
    return _report(
        bundle,
        reasons,
        tuple(sorted(original_entries)),
        tuple(sorted(restored_entries)),
        storage.payload_index.sha256,
        storage.bundle_archive.sha256,
        legacy_report_sha256,
    )


def _payload_declared_files(bundle: LocalModelBundleV2) -> tuple[DeclaredFile, ...]:
    files: list[DeclaredFile] = [item.file for item in bundle.source_files]
    if bundle.remote_inventory is not None:
        files.append(bundle.remote_inventory.evidence_file)
    if bundle.legal_review is not None:
        files.extend([bundle.legal_review.license_text, bundle.legal_review.review_record])
    if bundle.toolchain_package is not None:
        package = bundle.toolchain_package
        files.extend([package.package, package.build_manifest, package.verification_report])
        files.extend(item.file for item in package.binaries)
    if bundle.conversion is not None:
        conversion = bundle.conversion
        files.extend(
            [
                conversion.python_dependencies,
                conversion.converter,
                conversion.log,
                conversion.intermediate,
            ]
        )
    for quantization in bundle.quantizations:
        files.extend([quantization.log, quantization.output])
    return tuple(files)


def _safe_root_file_set(root: Path, prefix: str, reasons: list[str]) -> set[str]:
    if not root.is_dir() or root.is_symlink():
        reasons.append(f"{prefix}_ROOT_INVALID")
        return set()
    found: set[str] = set()
    for current, directories, files in os.walk(root, followlinks=False):
        current_path = Path(current)
        safe_directories: list[str] = []
        for name in directories:
            candidate = current_path / name
            relative = candidate.relative_to(root).as_posix()
            if candidate.is_symlink():
                reasons.append(f"{prefix}_FILE_UNSAFE:{relative}:symlink")
            else:
                safe_directories.append(name)
        directories[:] = safe_directories
        for name in files:
            candidate = current_path / name
            relative = candidate.relative_to(root).as_posix()
            if candidate.is_symlink() or not candidate.is_file():
                reasons.append(f"{prefix}_FILE_UNSAFE:{relative}:non-regular")
                continue
            found.add(relative)
    return found


def _compare_file_set(
    prefix: str,
    observed: set[str],
    expected: set[str],
    reasons: list[str],
) -> None:
    for path in sorted(expected - observed):
        reasons.append(f"{prefix}_FILE_MISSING:{path}")
    for path in sorted(observed - expected):
        reasons.append(f"{prefix}_FILE_EXTRA:{path}")


def _declared_file_path(
    root: Path,
    declared: DeclaredFile,
    prefix: str,
    reasons: list[str],
) -> Path | None:
    candidate = root / declared.path
    try:
        resolved_root = root.resolve(strict=True)
        resolved = candidate.resolve(strict=True)
    except OSError:
        reasons.append(f"{prefix}_FILE_MISSING:{declared.path}")
        return None
    if resolved_root not in resolved.parents or candidate.is_symlink() or not candidate.is_file():
        reasons.append(f"{prefix}_FILE_UNSAFE:{declared.path}")
        return None
    metadata = candidate.stat()
    digest = _file_sha256(candidate)
    if metadata.st_size != declared.size_bytes:
        reasons.append(f"{prefix}_FILE_SIZE_MISMATCH:{declared.path}")
    if digest != declared.sha256:
        reasons.append(f"{prefix}_FILE_SHA256_MISMATCH:{declared.path}")
    return candidate


def _load_payload_index(
    *,
    original_root: Path,
    declared: DeclaredFile,
    bundle: LocalModelBundleV2,
    expected: dict[str, DeclaredFile],
    reasons: list[str],
) -> dict[str, object] | None:
    path = _declared_file_path(original_root, declared, "PAYLOAD_INDEX", reasons)
    if path is None:
        return None
    try:
        payload = _strict_json(path)
    except ValueError as error:
        reasons.append(f"PAYLOAD_INDEX_INVALID:{error}")
        return None
    expected_payload: dict[str, object] = {
        "schema_version": _PAYLOAD_INDEX_SCHEMA,
        "model_id": bundle.model_id,
        "revision": bundle.revision,
        "entries": [
            {
                "path": item.path,
                "sha256": item.sha256,
                "size_bytes": item.size_bytes,
            }
            for item in sorted(expected.values(), key=lambda value: value.path)
        ],
    }
    if payload != expected_payload:
        reasons.append("PAYLOAD_INDEX_MISMATCH")
    return payload


def _index_entries(payload: dict[str, object] | None) -> dict[str, tuple[int, str]]:
    if payload is None:
        return {}
    entries = payload.get("entries")
    if not isinstance(entries, list):
        return {}
    result: dict[str, tuple[int, str]] = {}
    for item in entries:
        if not isinstance(item, dict):
            continue
        path = item.get("path")
        size = item.get("size_bytes")
        digest = item.get("sha256")
        if isinstance(path, str) and isinstance(size, int) and isinstance(digest, str):
            result[path] = (size, digest)
    return result


def _hash_declared_root(
    *,
    root: Path,
    declared: tuple[DeclaredFile, ...],
    prefix: str,
    reasons: list[str],
) -> dict[str, tuple[int, str]]:
    observed: dict[str, tuple[int, str]] = {}
    seen_inodes: set[tuple[int, int]] = set()
    for item in declared:
        path = _declared_file_path(root, item, prefix, reasons)
        if path is None:
            continue
        metadata = path.stat()
        inode = (metadata.st_dev, metadata.st_ino)
        if inode in seen_inodes:
            reasons.append(f"{prefix}_FILE_INODE_ALIAS:{item.path}")
            continue
        seen_inodes.add(inode)
        observed[item.path] = (metadata.st_size, _file_sha256(path))
    return observed


def _compare_entry_map(
    prefix: str,
    observed: dict[str, tuple[int, str]],
    expected: dict[str, tuple[int, str]],
    reasons: list[str],
) -> None:
    observed_paths = set(observed)
    expected_paths = set(expected)
    for path in sorted(expected_paths - observed_paths):
        reasons.append(f"{prefix}_ENTRY_MISSING:{path}")
    for path in sorted(observed_paths - expected_paths):
        reasons.append(f"{prefix}_ENTRY_EXTRA:{path}")
    for path in sorted(observed_paths & expected_paths):
        actual_size, actual_digest = observed[path]
        expected_size, expected_digest = expected[path]
        if actual_size != expected_size:
            reasons.append(f"{prefix}_ENTRY_SIZE_MISMATCH:{path}")
        if actual_digest != expected_digest:
            reasons.append(f"{prefix}_ENTRY_SHA256_MISMATCH:{path}")


def _verify_external_archive_metadata(
    bundle: LocalModelBundleV2,
    reasons: list[str],
) -> None:
    storage = bundle.storage
    if storage is None:
        return
    archive = storage.bundle_archive
    path = PurePosixPath(archive.path)
    if path.is_absolute() or not path.parts or ".." in path.parts:
        reasons.append("ARCHIVE_LOGICAL_PATH_INVALID")
    if archive.size_bytes < 1:
        reasons.append("ARCHIVE_SIZE_INVALID")
    if f"sha256:{archive.sha256}" not in storage.immutable_locator:
        reasons.append("ARCHIVE_LOCATOR_SHA256_MISMATCH")
    if "versionId=" not in storage.immutable_locator:
        reasons.append("ARCHIVE_LOCATOR_VERSION_ID_MISSING")


def _verify_storage_sidecars(
    bundle: LocalModelBundleV2,
    original_root: Path,
    reasons: list[str],
) -> None:
    storage = bundle.storage
    if storage is None:
        return
    expected_upload: dict[str, object] = {
        "schema_version": "tai.model-bundle-upload-record.v1",
        "archive_sha256": storage.bundle_archive.sha256,
        "immutable_locator": storage.immutable_locator,
        "uploaded_at": storage.uploaded_at,
        "retention_days": storage.retention_days,
        "retention_expires_at": storage.retention_expires_at,
    }
    expected_restore: dict[str, object] = {
        "schema_version": "tai.model-bundle-restore-record.v1",
        "archive_sha256": storage.bundle_archive.sha256,
        "immutable_locator": storage.immutable_locator,
        "restored_at": storage.restored_at,
    }
    _verify_json_sidecar(
        root=original_root,
        declared=storage.upload_record,
        expected=expected_upload,
        prefix="UPLOAD_RECORD",
        reasons=reasons,
    )
    _verify_json_sidecar(
        root=original_root,
        declared=storage.restore_record,
        expected=expected_restore,
        prefix="RESTORE_RECORD",
        reasons=reasons,
    )


def _verify_json_sidecar(
    *,
    root: Path,
    declared: DeclaredFile,
    expected: dict[str, object],
    prefix: str,
    reasons: list[str],
) -> None:
    path = _declared_file_path(root, declared, prefix, reasons)
    if path is None:
        return
    try:
        payload = _strict_json(path)
    except ValueError as error:
        reasons.append(f"{prefix}_INVALID:{error}")
        return
    if payload != expected:
        reasons.append(f"{prefix}_MISMATCH")


def _verify_non_storage_bundle_contract(
    *,
    authority: ModelBundleAuthority,
    bundle: LocalModelBundleV2,
    original_root: Path,
    restored_root: Path,
    reasons: list[str],
) -> str | None:
    non_storage_bundle = replace(bundle, storage=None)
    report = verify_local_model_bundle_v2(
        authority=authority,
        bundle=non_storage_bundle,
        bundle_root=original_root,
        restored_root=restored_root,
    )
    payload = report_payload_v2(report)
    actual_reasons = set(report.reasons)
    unexpected = sorted(actual_reasons - _ALLOWED_NON_STORAGE_REASONS)
    if report.status is not BundleVerificationStatus.REJECTED:
        reasons.append("LEGACY_V2_NON_STORAGE_STATUS_INVALID")
    if not _ALLOWED_NON_STORAGE_REASONS.issubset(actual_reasons):
        reasons.append("LEGACY_V2_STORAGE_BOUNDARY_NOT_OBSERVED")
    reasons.extend(f"LEGACY_V2:{reason}" for reason in unexpected)
    report_sha = payload.get("report_sha256")
    return report_sha if isinstance(report_sha, str) else None


def _strict_json(path: Path) -> dict[str, object]:
    def reject_duplicate(pairs: list[tuple[str, object]]) -> dict[str, object]:
        result: dict[str, object] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    try:
        payload = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=reject_duplicate,
        )
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"cannot load JSON: {path}") from error
    if not isinstance(payload, dict):
        raise ValueError("JSON root must be an object")
    return payload


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(_CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_json(payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _report(
    bundle: LocalModelBundleV2,
    reasons: list[str],
    verified_payload_files: tuple[str, ...],
    restored_payload_files: tuple[str, ...],
    payload_index_sha256: str | None,
    archive_sha256: str | None,
    legacy_report_sha256: str | None,
) -> dict[str, object]:
    unique_reasons = sorted(set(reasons))
    payload: dict[str, object] = {
        "schema_version": _REPORT_SCHEMA,
        "model_id": bundle.model_id,
        "revision": bundle.revision,
        "status": "VERIFIED" if not unique_reasons else "REJECTED",
        "reasons": unique_reasons,
        "payload_index_sha256": payload_index_sha256,
        "archive_sha256": archive_sha256,
        "legacy_v2_report_sha256": legacy_report_sha256,
        "verified_payload_files": list(verified_payload_files),
        "restored_payload_files": list(restored_payload_files),
    }
    payload["report_sha256"] = hashlib.sha256(_canonical_json(payload).encode()).hexdigest()
    return payload
