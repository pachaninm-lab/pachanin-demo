from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

from tai.cpu_runtime_contract import (
    RuntimeEvidenceError,
    as_int,
    as_object,
    as_relative_path,
    as_sha256,
    as_text,
    as_timestamp,
    load_json,
    require_keys,
)


def parse_file_records(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise RuntimeEvidenceError("evidence_files must be an array")
    result: list[dict[str, Any]] = []
    for index, raw in enumerate(value):
        name = f"evidence_files[{index}]"
        item = as_object(raw, name)
        require_keys(item, {"path", "sha256", "size_bytes"}, name)
        result.append(
            {
                "path": as_relative_path(item["path"], f"{name}.path"),
                "sha256": as_sha256(item["sha256"], f"{name}.sha256"),
                "size_bytes": as_int(
                    item["size_bytes"], f"{name}.size_bytes", minimum=1
                ),
            }
        )
    return result


def _safe_file(root: Path, relative: str, name: str) -> Path:
    root_resolved = root.resolve(strict=True)
    if not root_resolved.is_dir():
        raise RuntimeEvidenceError(f"{name} root must be a directory")
    current = root
    for part in PurePosixPath(relative).parts:
        current = current / part
        if current.is_symlink():
            raise RuntimeEvidenceError(f"{name} contains a symlink: {relative}")
    resolved = (root / PurePosixPath(relative)).resolve(strict=True)
    if not resolved.is_relative_to(root_resolved):
        raise RuntimeEvidenceError(f"{name} escapes its evidence root: {relative}")
    if not resolved.is_file() or resolved.is_symlink():
        raise RuntimeEvidenceError(f"{name} must be a regular file: {relative}")
    return resolved


def _sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def verify_declared_files(
    authority: dict[str, Any],
    files: list[dict[str, Any]],
    original_root: Path,
    restored_root: Path,
) -> tuple[dict[str, dict[str, Any]], list[str], int]:
    if original_root.resolve(strict=True) == restored_root.resolve(strict=True):
        raise RuntimeEvidenceError(
            "original and restored evidence roots must be independent"
        )
    limits = as_object(authority["evidence"], "authority.evidence")
    if len(files) > as_int(
        limits["maximum_file_count"], "maximum_file_count", minimum=1
    ):
        raise RuntimeEvidenceError("evidence file count exceeds authority limit")
    by_path: dict[str, dict[str, Any]] = {}
    reasons: list[str] = []
    total = 0
    maximum_file_size = as_int(
        limits["maximum_file_size_bytes"],
        "maximum_file_size_bytes",
        minimum=1,
    )
    maximum_total_size = as_int(
        limits["maximum_total_size_bytes"],
        "maximum_total_size_bytes",
        minimum=1,
    )
    for index, record in enumerate(files):
        relative = as_relative_path(
            record["path"], f"evidence_files[{index}].path"
        )
        if relative in by_path:
            raise RuntimeEvidenceError(f"duplicate evidence path: {relative}")
        by_path[relative] = record
        size = as_int(
            record["size_bytes"],
            f"evidence_files[{index}].size_bytes",
            minimum=1,
        )
        declared = as_sha256(
            record["sha256"], f"evidence_files[{index}].sha256"
        )
        total += size
        if size > maximum_file_size:
            reasons.append(f"EVIDENCE_FILE_TOO_LARGE:{relative}")
        original = _safe_file(
            original_root, relative, f"evidence_files[{index}].original"
        )
        restored = _safe_file(
            restored_root, relative, f"evidence_files[{index}].restored"
        )
        if original.stat().st_size != size:
            reasons.append(f"ORIGINAL_SIZE_MISMATCH:{relative}")
        if restored.stat().st_size != size:
            reasons.append(f"RESTORED_SIZE_MISMATCH:{relative}")
        original_sha = _sha(original)
        restored_sha = _sha(restored)
        if original_sha != declared:
            reasons.append(f"ORIGINAL_DIGEST_MISMATCH:{relative}")
        if restored_sha != declared:
            reasons.append(f"RESTORED_DIGEST_MISMATCH:{relative}")
        if original_sha != restored_sha:
            reasons.append(f"RESTORE_DRIFT:{relative}")
    if total > maximum_total_size:
        reasons.append("EVIDENCE_TOTAL_SIZE_EXCEEDED")
    return by_path, reasons, total


def load_semantic(
    root: Path,
    records: dict[str, dict[str, Any]],
    relative: str,
    name: str,
) -> dict[str, Any]:
    if relative not in records:
        raise RuntimeEvidenceError(
            f"required semantic evidence is undeclared: {relative}"
        )
    return load_json(_safe_file(root, relative, name))


def require_declared_text(
    root: Path,
    records: dict[str, dict[str, Any]],
    relative: str,
    name: str,
) -> None:
    if relative not in records:
        raise RuntimeEvidenceError(f"{name} is undeclared")
    _safe_file(root, relative, name)


def parse_storage(
    value: object,
    authority: dict[str, Any],
    measured_at: datetime,
) -> tuple[dict[str, Any], list[str]]:
    item = as_object(value, "storage")
    require_keys(
        item,
        {
            "immutable_locator",
            "archive_sha256",
            "archive_size_bytes",
            "version_id",
            "uploaded_at",
            "retention_expires_at",
            "restored_at",
        },
        "storage",
    )
    locator = as_text(item["immutable_locator"], "storage.immutable_locator")
    archive_sha = as_sha256(item["archive_sha256"], "storage.archive_sha256")
    uploaded = as_timestamp(item["uploaded_at"], "storage.uploaded_at")
    retention = as_timestamp(
        item["retention_expires_at"], "storage.retention_expires_at"
    )
    restored = as_timestamp(item["restored_at"], "storage.restored_at")
    parsed: dict[str, Any] = {
        "immutable_locator": locator,
        "archive_sha256": archive_sha,
        "archive_size_bytes": as_int(
            item["archive_size_bytes"], "storage.archive_size_bytes", minimum=1
        ),
        "version_id": as_text(item["version_id"], "storage.version_id"),
        "uploaded_at": uploaded,
        "retention_expires_at": retention,
        "restored_at": restored,
    }
    reasons: list[str] = []
    if (
        not locator.startswith("s3+version://")
        or "versionId=" not in locator
        or f"#sha256={archive_sha}" not in locator
    ):
        reasons.append("RUNTIME_STORAGE_LOCATOR_NOT_IMMUTABLE")
    if restored < uploaded:
        reasons.append("RUNTIME_STORAGE_RESTORE_PRECEDES_UPLOAD")
    if uploaded < measured_at - timedelta(minutes=5):
        reasons.append("RUNTIME_STORAGE_UPLOAD_PRECEDES_MEASUREMENT")
    evidence = as_object(authority["evidence"], "authority.evidence")
    minimum_days = as_int(
        evidence["minimum_external_retention_days"],
        "minimum_external_retention_days",
        minimum=1,
    )
    if retention - uploaded < timedelta(days=minimum_days):
        reasons.append("RUNTIME_STORAGE_RETENTION_TOO_SHORT")
    return parsed, reasons
