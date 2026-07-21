from __future__ import annotations

from pathlib import Path
from typing import Any

from tai.quality_scoring_contract import (
    QualityScoringError,
    as_array,
    as_int,
    as_object,
    as_relative_path,
    as_sha256,
    file_sha256,
    require_keys,
)

FILE_KEYS = {"path", "sha256", "size_bytes"}


def parse_file_records(
    value: object, authority: dict[str, Any]
) -> dict[str, dict[str, Any]]:
    plan = as_object(authority["evidence"], "authority.evidence")
    rows = as_array(value, "evidence_files")
    if len(rows) > as_int(plan["maximum_file_count"], "maximum_file_count", minimum=1):
        raise QualityScoringError("evidence file count exceeds authority")
    records: dict[str, dict[str, Any]] = {}
    total = 0
    for index, item in enumerate(rows):
        record = as_object(item, f"evidence_files[{index}]")
        require_keys(record, FILE_KEYS, f"evidence_files[{index}]")
        relative = as_relative_path(record["path"], f"evidence_files[{index}].path")
        if relative in records:
            raise QualityScoringError("duplicate evidence path")
        size = as_int(record["size_bytes"], "evidence size", minimum=1)
        if size > as_int(
            plan["maximum_file_size_bytes"], "maximum_file_size_bytes", minimum=1
        ):
            raise QualityScoringError("evidence file exceeds size authority")
        digest = as_sha256(record["sha256"], "evidence sha256")
        records[relative] = {"path": relative, "sha256": digest, "size_bytes": size}
        total += size
    if total > as_int(
        plan["maximum_total_size_bytes"], "maximum_total_size_bytes", minimum=1
    ):
        raise QualityScoringError("evidence total size exceeds authority")
    required = set(plan["required_files"])
    if set(records) != required:
        missing = sorted(required - set(records))
        unexpected = sorted(set(records) - required)
        raise QualityScoringError(
            f"evidence file set mismatch; missing={missing!r}, unexpected={unexpected!r}"
        )
    return records


def _regular_file(root: Path, relative: str) -> Path:
    path = root.joinpath(*relative.split("/"))
    try:
        root_resolved = root.resolve(strict=True)
        resolved = path.resolve(strict=True)
        if root_resolved not in resolved.parents:
            raise QualityScoringError("evidence path escapes root")
        if path.is_symlink() or not path.is_file():
            raise QualityScoringError("evidence path is not a regular non-symlink file")
    except OSError as exc:
        raise QualityScoringError(f"evidence path is unavailable: {relative}") from exc
    return path


def _actual_relative_files(root: Path) -> set[str]:
    try:
        rows = set()
        for path in root.rglob("*"):
            if path.is_dir():
                continue
            if path.is_symlink() or not path.is_file():
                raise QualityScoringError("evidence root contains non-regular file")
            rows.add(path.relative_to(root).as_posix())
        return rows
    except OSError as exc:
        raise QualityScoringError("cannot enumerate evidence root") from exc


def verify_evidence_roots(
    records: dict[str, dict[str, Any]], original_root: Path, restored_root: Path
) -> int:
    try:
        original_resolved = original_root.resolve(strict=True)
        restored_resolved = restored_root.resolve(strict=True)
    except OSError as exc:
        raise QualityScoringError("evidence roots must exist") from exc
    if original_resolved == restored_resolved:
        raise QualityScoringError(
            "original and restored evidence roots are not independent"
        )
    if _actual_relative_files(original_root) != set(records):
        raise QualityScoringError(
            "original evidence root contains undeclared or missing files"
        )
    if _actual_relative_files(restored_root) != set(records):
        raise QualityScoringError(
            "restored evidence root contains undeclared or missing files"
        )
    total = 0
    for relative, record in records.items():
        original = _regular_file(original_root, relative)
        restored = _regular_file(restored_root, relative)
        try:
            original_stat = original.stat()
            restored_stat = restored.stat()
        except OSError as exc:
            raise QualityScoringError("cannot stat evidence files") from exc
        if (original_stat.st_dev, original_stat.st_ino) == (
            restored_stat.st_dev,
            restored_stat.st_ino,
        ):
            raise QualityScoringError(
                "original and restored evidence files are hard-linked"
            )
        expected_size = int(record["size_bytes"])
        if (
            original_stat.st_size != expected_size
            or restored_stat.st_size != expected_size
        ):
            raise QualityScoringError(f"evidence size mismatch: {relative}")
        expected_digest = str(record["sha256"])
        if (
            file_sha256(original) != expected_digest
            or file_sha256(restored) != expected_digest
        ):
            raise QualityScoringError(f"evidence digest mismatch: {relative}")
        total += expected_size
    return total


def load_declared_json(
    root: Path, records: dict[str, dict[str, Any]], relative: str
) -> dict[str, Any]:
    from tai.quality_scoring_contract import load_json

    if relative not in records:
        raise QualityScoringError(f"undeclared semantic evidence: {relative}")
    return load_json(_regular_file(root, relative))
