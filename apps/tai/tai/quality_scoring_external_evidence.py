from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

from tai.quality_scoring_contract import (
    QualityScoringError,
    as_array,
    as_identity,
    as_int,
    as_object,
    as_sha256,
    as_text,
    as_timestamp,
    canonical_sha256,
    load_json,
    require_keys,
    self_digest,
)

STORAGE_KEYS = {
    "provider",
    "bucket",
    "retention_days",
    "retention_until",
    "immutability_status",
    "original_root_id",
    "restored_root_id",
    "annotations_sha256",
    "identity_assertions_sha256",
    "evidence_manifest_relative_path",
    "evidence_manifest_object_key",
    "evidence_manifest_object_version_id",
    "evidence_manifest_size_bytes",
    "evidence_manifest_file_sha256",
    "evidence_manifest_sha256",
}
MANIFEST_KEYS = {
    "schema_version",
    "provider",
    "bucket",
    "manifest_object_key",
    "manifest_object_version_id",
    "retention_until",
    "original_root_id",
    "restored_root_id",
    "files",
    "manifest_sha256",
}
RECORD_KEYS = {
    "annotation_id",
    "relative_path",
    "sha256",
    "size_bytes",
    "object_key",
    "object_version_id",
    "retention_until",
}
RECEIPT_KEYS = {
    "schema_version",
    "issuer",
    "audience",
    "provider",
    "bucket",
    "issued_at",
    "expires_at",
    "key_id",
    "original_root_id",
    "restored_root_id",
    "manifest",
    "objects",
    "signature",
}
RECEIPT_MANIFEST_KEYS = {
    "object_key",
    "object_version_id",
    "sha256",
    "size_bytes",
    "retention_until",
    "immutability_status",
}
RECEIPT_OBJECT_KEYS = {
    "annotation_id",
    "object_key",
    "object_version_id",
    "sha256",
    "size_bytes",
    "retention_until",
    "immutability_status",
}
TRUSTED_CONFIG_SOURCE = "OPERATOR_TRUSTED_CONFIG"


def _canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _safe_file(root: Path, relative_value: object, name: str) -> Path:
    relative = as_text(relative_value, name, 500)
    if "\\" in relative:
        raise QualityScoringError(f"{name} must use POSIX separators")
    pure = PurePosixPath(relative)
    if pure.is_absolute() or not pure.parts or any(
        part in {"", ".", ".."} for part in pure.parts
    ):
        raise QualityScoringError(f"{name} is not a safe relative path")
    if root.is_symlink() or not root.is_dir():
        raise QualityScoringError(f"{name} root must be a regular directory")
    try:
        root_resolved = root.resolve(strict=True)
    except OSError as exc:
        raise QualityScoringError(f"{name} root is unavailable") from exc
    candidate = root.joinpath(*pure.parts)
    current = root
    for part in pure.parts:
        current = current / part
        if current.is_symlink():
            raise QualityScoringError(f"{name} contains a symlink")
    try:
        resolved = candidate.resolve(strict=True)
        resolved.relative_to(root_resolved)
    except (OSError, ValueError) as exc:
        raise QualityScoringError(f"{name} escapes or is missing from root") from exc
    if not resolved.is_file():
        raise QualityScoringError(f"{name} must resolve to a regular file")
    return resolved


def _facts(path: Path, name: str) -> tuple[bytes, int, str]:
    if path.is_symlink() or not path.is_file():
        raise QualityScoringError(f"{name} must be a regular file")
    try:
        payload = path.read_bytes()
    except OSError as exc:
        raise QualityScoringError(f"{name} is unreadable") from exc
    return payload, len(payload), hashlib.sha256(payload).hexdigest()


def _trusted_secret(path: Path, expected_sha256: str) -> bytes:
    expected = as_sha256(expected_sha256, "trusted provider inventory secret digest")
    payload, size, digest = _facts(path, "provider inventory signing secret")
    if not 32 <= size <= 4096:
        raise QualityScoringError("provider inventory signing secret size is invalid")
    if digest != expected:
        raise QualityScoringError("provider inventory secret trust anchor mismatch")
    return payload


def _annotation_completion(
    annotations: list[Any],
    manifest_scored_at: datetime,
) -> datetime:
    if not annotations:
        raise QualityScoringError("reviewer annotations are absent")
    completion: datetime | None = None
    for number, item in enumerate(annotations):
        annotation = as_object(item, f"annotations[{number}]")
        scored_at = as_timestamp(
            annotation["scored_at"],
            f"annotations[{number}].scored_at",
        )
        if completion is None or scored_at > completion:
            completion = scored_at
    if completion is None:
        raise QualityScoringError("reviewer annotation completion is unavailable")
    if manifest_scored_at != completion:
        raise QualityScoringError(
            "manifest scored_at does not match authenticated annotation completion"
        )
    return completion


def _storage(
    value: object,
    policy: dict[str, Any],
    annotations: list[Any],
    identity_assertions: list[Any],
    completion_at: datetime,
) -> dict[str, Any]:
    storage = as_object(value, "storage")
    require_keys(storage, STORAGE_KEYS, "storage")
    if storage["provider"] != policy["provider"]:
        raise QualityScoringError("quality evidence storage provider mismatch")
    if storage["immutability_status"] != "IMMUTABLE_VERSIONED":
        raise QualityScoringError("quality evidence is not immutable")
    minimum_days = as_int(
        policy["minimum_retention_days"],
        "evidence policy minimum retention",
        minimum=1,
    )
    if as_int(storage["retention_days"], "storage.retention_days") < minimum_days:
        raise QualityScoringError("quality evidence retention is insufficient")
    retention_until = as_timestamp(
        storage["retention_until"],
        "storage.retention_until",
    )
    if retention_until < completion_at + timedelta(days=minimum_days):
        raise QualityScoringError("quality evidence retention deadline is insufficient")
    for field in (
        "bucket",
        "original_root_id",
        "restored_root_id",
        "evidence_manifest_relative_path",
        "evidence_manifest_object_key",
        "evidence_manifest_object_version_id",
    ):
        as_identity(storage[field], f"storage.{field}")
    if storage["original_root_id"] == storage["restored_root_id"]:
        raise QualityScoringError("quality evidence restore roots are not independent")
    if storage["annotations_sha256"] != canonical_sha256(annotations):
        raise QualityScoringError("annotation payload digest mismatch")
    if storage["identity_assertions_sha256"] != canonical_sha256(identity_assertions):
        raise QualityScoringError("identity assertion payload digest mismatch")
    as_int(
        storage["evidence_manifest_size_bytes"],
        "storage.evidence_manifest_size_bytes",
        minimum=2,
    )
    as_sha256(
        storage["evidence_manifest_file_sha256"],
        "storage.evidence_manifest_file_sha256",
    )
    as_sha256(
        storage["evidence_manifest_sha256"],
        "storage.evidence_manifest_sha256",
    )
    return dict(storage)


def _verify_provider_inventory_receipt(
    receipt_path: Path,
    secret_path: Path,
    trusted_secret_sha256: str,
    policy: dict[str, Any],
    storage: dict[str, Any],
    records: dict[str, dict[str, Any]],
    completion_at: datetime,
    evaluated_at: datetime,
) -> str:
    receipt_policy = as_object(
        policy["provider_inventory_receipt"],
        "provider inventory receipt policy",
    )
    require_keys(
        receipt_policy,
        {
            "schema_version",
            "signature_algorithm",
            "issuer",
            "audience",
            "key_id",
            "maximum_lifetime_seconds",
            "trusted_secret_digest_source",
        },
        "provider inventory receipt policy",
    )
    if receipt_policy["signature_algorithm"] != "HMAC-SHA256":
        raise QualityScoringError("unsupported provider inventory signature algorithm")
    if receipt_policy["trusted_secret_digest_source"] != TRUSTED_CONFIG_SOURCE:
        raise QualityScoringError("provider inventory trust source is not operator-owned")

    receipt = load_json(receipt_path)
    require_keys(receipt, RECEIPT_KEYS, "provider inventory receipt")
    if receipt["schema_version"] != receipt_policy["schema_version"]:
        raise QualityScoringError("provider inventory receipt schema mismatch")
    for field in (
        "issuer",
        "audience",
        "provider",
        "bucket",
        "key_id",
        "original_root_id",
        "restored_root_id",
    ):
        as_identity(receipt[field], f"provider inventory receipt.{field}")
    if receipt["issuer"] != receipt_policy["issuer"]:
        raise QualityScoringError("provider inventory receipt issuer mismatch")
    if receipt["audience"] != receipt_policy["audience"]:
        raise QualityScoringError("provider inventory receipt audience mismatch")
    if receipt["key_id"] != receipt_policy["key_id"]:
        raise QualityScoringError("provider inventory receipt key id mismatch")
    for field in ("provider", "bucket", "original_root_id", "restored_root_id"):
        if receipt[field] != storage[field]:
            raise QualityScoringError(f"provider inventory receipt {field} mismatch")

    issued_at = as_timestamp(receipt["issued_at"], "provider inventory receipt.issued_at")
    expires_at = as_timestamp(
        receipt["expires_at"],
        "provider inventory receipt.expires_at",
    )
    if issued_at < completion_at:
        raise QualityScoringError("provider inventory receipt predates scoring completion")
    if issued_at > evaluated_at:
        raise QualityScoringError("provider inventory receipt is from the future")
    if expires_at < evaluated_at:
        raise QualityScoringError("provider inventory receipt is expired")
    lifetime = int((expires_at - issued_at).total_seconds())
    if lifetime <= 0 or lifetime > as_int(
        receipt_policy["maximum_lifetime_seconds"],
        "provider inventory maximum lifetime",
        minimum=1,
    ):
        raise QualityScoringError("provider inventory receipt lifetime is invalid")

    signature = as_sha256(receipt["signature"], "provider inventory receipt.signature")
    secret = _trusted_secret(secret_path, trusted_secret_sha256)
    expected_signature = hmac.new(
        secret,
        _canonical_bytes(
            {key: value for key, value in receipt.items() if key != "signature"}
        ),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        raise QualityScoringError("provider inventory receipt signature is invalid")

    minimum_days = as_int(
        policy["minimum_retention_days"],
        "evidence policy minimum retention",
        minimum=1,
    )
    receipt_manifest = as_object(receipt["manifest"], "provider inventory manifest")
    require_keys(
        receipt_manifest,
        RECEIPT_MANIFEST_KEYS,
        "provider inventory manifest",
    )
    manifest_bindings = {
        "object_key": "evidence_manifest_object_key",
        "object_version_id": "evidence_manifest_object_version_id",
        "sha256": "evidence_manifest_file_sha256",
        "size_bytes": "evidence_manifest_size_bytes",
        "retention_until": "retention_until",
        "immutability_status": "immutability_status",
    }
    for receipt_field, storage_field in manifest_bindings.items():
        if receipt_manifest[receipt_field] != storage[storage_field]:
            raise QualityScoringError(
                f"provider inventory manifest {receipt_field} mismatch"
            )
    if as_timestamp(
        receipt_manifest["retention_until"],
        "provider inventory manifest retention",
    ) < completion_at + timedelta(days=minimum_days):
        raise QualityScoringError("provider inventory manifest retention is insufficient")
    if receipt_manifest["immutability_status"] != "IMMUTABLE_VERSIONED":
        raise QualityScoringError("provider inventory manifest is not immutable")
    as_sha256(receipt_manifest["sha256"], "provider inventory manifest sha256")
    as_int(receipt_manifest["size_bytes"], "provider inventory manifest size", minimum=2)

    receipt_objects: dict[str, dict[str, Any]] = {}
    for number, item in enumerate(
        as_array(receipt["objects"], "provider inventory objects")
    ):
        inventory = as_object(item, f"provider inventory objects[{number}]")
        require_keys(
            inventory,
            RECEIPT_OBJECT_KEYS,
            f"provider inventory objects[{number}]",
        )
        annotation_id = as_identity(
            inventory["annotation_id"],
            "provider inventory annotation id",
        )
        if annotation_id in receipt_objects:
            raise QualityScoringError("duplicate provider inventory annotation id")
        receipt_objects[annotation_id] = dict(inventory)
    if set(receipt_objects) != set(records):
        raise QualityScoringError("provider inventory object coverage is incomplete")

    for annotation_id, record in records.items():
        inventory = receipt_objects[annotation_id]
        for field in (
            "object_key",
            "object_version_id",
            "sha256",
            "size_bytes",
            "retention_until",
        ):
            if inventory[field] != record[field]:
                raise QualityScoringError(
                    f"provider inventory object {field} mismatch"
                )
        if inventory["immutability_status"] != "IMMUTABLE_VERSIONED":
            raise QualityScoringError("provider inventory object is not immutable")
        if as_timestamp(
            inventory["retention_until"],
            "provider inventory object retention",
        ) < completion_at + timedelta(days=minimum_days):
            raise QualityScoringError("provider inventory object retention is insufficient")
        as_identity(inventory["object_key"], "provider inventory object key")
        as_identity(
            inventory["object_version_id"],
            "provider inventory object version id",
        )
        as_sha256(inventory["sha256"], "provider inventory object sha256")
        as_int(inventory["size_bytes"], "provider inventory object size", minimum=1)

    return canonical_sha256(receipt)


def verify_external_reviewer_evidence(
    manifest_path: Path,
    original_root: Path,
    restored_root: Path,
    provider_receipt_path: Path,
    provider_receipt_secret_path: Path,
    trusted_provider_receipt_secret_sha256: str,
    storage_value: object,
    annotations_value: object,
    identity_assertions_value: object,
    policy_value: object,
    *,
    scored_at: datetime,
    evaluated_at: datetime,
) -> dict[str, object]:
    policy = as_object(policy_value, "evidence policy")
    annotations = as_array(annotations_value, "annotations")
    identity_assertions = as_array(
        identity_assertions_value,
        "identity_assertions",
    )
    completion_at = _annotation_completion(annotations, scored_at)
    storage = _storage(
        storage_value,
        policy,
        annotations,
        identity_assertions,
        completion_at,
    )

    supplied_bytes, supplied_size, supplied_file_sha = _facts(
        manifest_path,
        "reviewer evidence manifest",
    )
    if supplied_size != storage["evidence_manifest_size_bytes"]:
        raise QualityScoringError("reviewer evidence manifest size mismatch")
    if supplied_file_sha != storage["evidence_manifest_file_sha256"]:
        raise QualityScoringError("reviewer evidence manifest file digest mismatch")

    relative_manifest = storage["evidence_manifest_relative_path"]
    original_manifest = _safe_file(
        original_root,
        relative_manifest,
        "original reviewer evidence manifest",
    )
    restored_manifest = _safe_file(
        restored_root,
        relative_manifest,
        "restored reviewer evidence manifest",
    )
    original_bytes, _, original_sha = _facts(
        original_manifest,
        "original reviewer evidence manifest",
    )
    restored_bytes, _, restored_sha = _facts(
        restored_manifest,
        "restored reviewer evidence manifest",
    )
    if supplied_bytes != original_bytes or supplied_bytes != restored_bytes:
        raise QualityScoringError("reviewer evidence manifest was not reproduced")
    if supplied_file_sha != original_sha or supplied_file_sha != restored_sha:
        raise QualityScoringError("reviewer evidence manifest restore digest mismatch")

    manifest = load_json(manifest_path)
    require_keys(manifest, MANIFEST_KEYS, "reviewer evidence manifest")
    if manifest["schema_version"] != policy["manifest_schema_version"]:
        raise QualityScoringError("reviewer evidence manifest schema mismatch")
    manifest_sha = self_digest(
        manifest,
        "manifest_sha256",
        "reviewer evidence manifest",
    )
    if manifest_sha != storage["evidence_manifest_sha256"]:
        raise QualityScoringError("reviewer evidence manifest canonical digest mismatch")
    bindings = {
        "provider": "provider",
        "bucket": "bucket",
        "manifest_object_key": "evidence_manifest_object_key",
        "manifest_object_version_id": "evidence_manifest_object_version_id",
        "retention_until": "retention_until",
        "original_root_id": "original_root_id",
        "restored_root_id": "restored_root_id",
    }
    for manifest_field, storage_field in bindings.items():
        if manifest[manifest_field] != storage[storage_field]:
            raise QualityScoringError(
                f"reviewer evidence manifest {manifest_field} mismatch"
            )

    annotation_map: dict[str, dict[str, Any]] = {}
    for number, item in enumerate(annotations):
        annotation = as_object(item, f"annotations[{number}]")
        annotation_id = as_identity(
            annotation["annotation_id"],
            f"annotations[{number}].annotation_id",
        )
        if annotation_id in annotation_map:
            raise QualityScoringError("duplicate annotation id in evidence binding")
        annotation_map[annotation_id] = annotation

    records: dict[str, dict[str, Any]] = {}
    object_keys: set[str] = set()
    relative_paths: set[str] = set()
    minimum_days = as_int(
        policy["minimum_retention_days"],
        "evidence policy minimum retention",
        minimum=1,
    )
    for number, item in enumerate(as_array(manifest["files"], "evidence files")):
        record = as_object(item, f"evidence files[{number}]")
        require_keys(record, RECORD_KEYS, f"evidence files[{number}]")
        annotation_id = as_identity(
            record["annotation_id"],
            "evidence record annotation id",
        )
        if annotation_id in records:
            raise QualityScoringError("duplicate reviewer evidence annotation id")
        if annotation_id not in annotation_map:
            raise QualityScoringError("reviewer evidence references unknown annotation")
        relative_path = as_text(
            record["relative_path"],
            "evidence record relative path",
            500,
        )
        object_key = as_identity(record["object_key"], "evidence record object key")
        as_identity(
            record["object_version_id"],
            "evidence record object version id",
        )
        if relative_path in relative_paths or object_key in object_keys:
            raise QualityScoringError("reviewer evidence object identity is duplicated")
        relative_paths.add(relative_path)
        object_keys.add(object_key)
        record_retention = as_timestamp(
            record["retention_until"],
            "evidence record retention until",
        )
        if record_retention < completion_at + timedelta(days=minimum_days):
            raise QualityScoringError("reviewer evidence file retention is insufficient")
        as_sha256(record["sha256"], "evidence record sha256")
        as_int(record["size_bytes"], "evidence record size", minimum=1)
        records[annotation_id] = dict(record)

    if set(records) != set(annotation_map):
        raise QualityScoringError("reviewer evidence coverage is incomplete")

    provider_receipt_sha256 = _verify_provider_inventory_receipt(
        provider_receipt_path,
        provider_receipt_secret_path,
        trusted_provider_receipt_secret_sha256,
        policy,
        storage,
        records,
        completion_at,
        evaluated_at,
    )

    for annotation_id, annotation in annotation_map.items():
        record = records[annotation_id]
        expected_pairs = (
            ("evidence_sha256", "sha256"),
            ("evidence_size_bytes", "size_bytes"),
            ("evidence_object_key", "object_key"),
            ("evidence_object_version_id", "object_version_id"),
        )
        for annotation_field, record_field in expected_pairs:
            if annotation[annotation_field] != record[record_field]:
                raise QualityScoringError(
                    f"annotation external evidence {annotation_field} mismatch"
                )
        original_file = _safe_file(
            original_root,
            record["relative_path"],
            f"original evidence for {annotation_id}",
        )
        restored_file = _safe_file(
            restored_root,
            record["relative_path"],
            f"restored evidence for {annotation_id}",
        )
        original_payload, original_size, original_digest = _facts(
            original_file,
            f"original evidence for {annotation_id}",
        )
        restored_payload, restored_size, restored_digest = _facts(
            restored_file,
            f"restored evidence for {annotation_id}",
        )
        if original_payload != restored_payload:
            raise QualityScoringError("reviewer evidence restore payload mismatch")
        if original_size != record["size_bytes"] or restored_size != record["size_bytes"]:
            raise QualityScoringError("reviewer evidence file size mismatch")
        if original_digest != record["sha256"] or restored_digest != record["sha256"]:
            raise QualityScoringError("reviewer evidence file digest mismatch")

    return {
        "manifest_sha256": manifest_sha,
        "manifest_file_sha256": supplied_file_sha,
        "manifest_size_bytes": supplied_size,
        "provider_inventory_receipt_sha256": provider_receipt_sha256,
        "annotation_completion_at": completion_at.isoformat(),
        "verified_evidence_files": len(records),
        "original_root_id": storage["original_root_id"],
        "restored_root_id": storage["restored_root_id"],
    }
