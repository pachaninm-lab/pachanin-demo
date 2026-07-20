from __future__ import annotations

import hashlib
import json
from datetime import datetime
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import quote

from tai.model_bundle_v2 import (
    InventoryDisposition,
    ModelBundleAuthority,
    ModelBundlePlan,
    SourceFileRole,
    authority_sha256_v2,
    load_model_bundle_authority_v2,
)

_REMOTE_SCHEMA = "tai.remote-model-inventory-evidence.v1"
_SOURCE_SCHEMA = "tai.model-source-manifest.v1"
_LEGAL_PACKET_SCHEMA = "tai.model-legal-review-packet.v1"
_RESTORE_SCHEMA = "tai.model-source-restore-verification.v1"
_REPORT_SCHEMA = "tai.model-source-acquisition-report.v1"


def reconcile_huggingface_inventory(
    *,
    authority_path: Path,
    model_id: str,
    revision: str,
    api_response_path: Path,
    observed_at: str,
) -> dict[str, object]:
    authority = load_model_bundle_authority_v2(authority_path)
    plan = _model_plan(authority, model_id, revision)
    observed = _strict_json_object(api_response_path)
    _timestamp(observed_at)

    if observed.get("sha") != revision:
        raise ValueError("Hugging Face API revision does not match authority")
    card_data = observed.get("cardData")
    if not isinstance(card_data, dict):
        raise ValueError("Hugging Face API cardData is missing")
    upstream_license = card_data.get("license")
    if not isinstance(upstream_license, str):
        raise ValueError("Hugging Face API license metadata is missing")
    if upstream_license.casefold() != plan.license_spdx.casefold():
        raise ValueError("Hugging Face API license metadata does not match authority")

    siblings = observed.get("siblings")
    if not isinstance(siblings, list):
        raise ValueError("Hugging Face API siblings are missing")
    by_path: dict[str, dict[str, Any]] = {}
    for raw in siblings:
        if not isinstance(raw, dict):
            raise ValueError("Hugging Face API sibling must be an object")
        path = raw.get("rfilename")
        if not isinstance(path, str) or not path:
            raise ValueError("Hugging Face API sibling path is invalid")
        if path in by_path:
            raise ValueError("Hugging Face API sibling paths must be unique")
        by_path[path] = raw

    prefix = _inventory_prefix(plan)
    entries: list[dict[str, object]] = []
    selected_total = 0
    for entry in plan.inventory:
        if not entry.path.startswith(prefix):
            raise ValueError("authority inventory path does not match model prefix")
        remote_path = entry.path.removeprefix(prefix)
        raw = by_path.get(remote_path)
        if raw is None:
            raise ValueError(f"authority path is absent upstream: {remote_path}")
        size_bytes = _remote_size(raw, remote_path)
        identity = _remote_identity(raw)
        disposition = entry.disposition.value
        record: dict[str, object] = {
            "path": entry.path,
            "remote_path": remote_path,
            "role": entry.role.value,
            "disposition": disposition,
            "exclusion_reason": entry.exclusion_reason,
            "size_bytes": size_bytes,
            "remote_identity": identity,
            "download_uri": _download_uri(model_id, revision, remote_path),
        }
        entries.append(record)
        if entry.disposition is InventoryDisposition.SELECTED:
            selected_total += size_bytes

    authority_remote_paths = {str(item["remote_path"]) for item in entries}
    upstream_paths = set(by_path)
    if authority_remote_paths != upstream_paths:
        missing = sorted(authority_remote_paths - upstream_paths)
        ungoverned = sorted(upstream_paths - authority_remote_paths)
        raise ValueError(
            "upstream inventory drift: "
            f"missing={missing!r}, ungoverned={ungoverned!r}"
        )

    payload: dict[str, object] = {
        "schema_version": _REMOTE_SCHEMA,
        "status": "RECONCILED",
        "authority_sha256": authority_sha256_v2(authority),
        "model_id": model_id,
        "revision": revision,
        "source_uri": plan.source_uri,
        "observed_at": observed_at,
        "upstream_license_metadata": upstream_license,
        "api_response_sha256": _sha256_file(api_response_path),
        "selected_total_bytes": selected_total,
        "entries": sorted(entries, key=lambda item: str(item["path"])),
    }
    payload["inventory_sha256"] = _canonical_sha256(payload)
    return payload


def download_plan(remote_inventory: dict[str, object]) -> dict[str, object]:
    _expect_schema(remote_inventory, _REMOTE_SCHEMA)
    selected = [
        item
        for item in _object_array(remote_inventory, "entries")
        if item.get("disposition") == InventoryDisposition.SELECTED.value
    ]
    if not selected:
        raise ValueError("remote inventory has no selected files")
    return {
        "schema_version": "tai.model-source-download-plan.v1",
        "model_id": _string(remote_inventory, "model_id"),
        "revision": _string(remote_inventory, "revision"),
        "selected_total_bytes": _integer(remote_inventory, "selected_total_bytes"),
        "entries": [
            {
                "path": _string(item, "path"),
                "download_uri": _string(item, "download_uri"),
                "size_bytes": _integer(item, "size_bytes"),
                "role": _string(item, "role"),
            }
            for item in selected
        ],
    }


def collect_source_manifest(
    *,
    authority_path: Path,
    model_id: str,
    revision: str,
    remote_inventory: dict[str, object],
    source_root: Path,
) -> dict[str, object]:
    authority = load_model_bundle_authority_v2(authority_path)
    plan = _model_plan(authority, model_id, revision)
    _expect_identity(remote_inventory, model_id, revision, _REMOTE_SCHEMA)
    if _string(remote_inventory, "authority_sha256") != authority_sha256_v2(authority):
        raise ValueError("remote inventory authority digest mismatch")

    expected_remote = {
        _string(item, "path"): item
        for item in _object_array(remote_inventory, "entries")
        if item.get("disposition") == InventoryDisposition.SELECTED.value
    }
    expected_paths = {item.path for item in plan.selected_inventory}
    if set(expected_remote) != expected_paths:
        raise ValueError("remote inventory selected paths do not match authority")

    source_root = source_root.resolve(strict=True)
    observed_files = {
        path.relative_to(source_root).as_posix()
        for path in source_root.rglob("*")
        if path.is_file()
    }
    if observed_files != expected_paths:
        raise ValueError("local source file set does not match authority")

    files: list[dict[str, object]] = []
    for entry in sorted(plan.selected_inventory, key=lambda item: item.path):
        path = _bounded_regular_file(source_root, entry.path)
        expected_size = _integer(expected_remote[entry.path], "size_bytes")
        size_bytes = path.stat().st_size
        if size_bytes != expected_size:
            raise ValueError(f"source size mismatch: {entry.path}")
        files.append(
            {
                "path": entry.path,
                "role": entry.role.value,
                "size_bytes": size_bytes,
                "sha256": _sha256_file(path),
            }
        )

    shard_index = next(
        item for item in files if item["role"] == SourceFileRole.SHARD_INDEX.value
    )
    _verify_shard_index(
        source_root / str(shard_index["path"]),
        {
            PurePosixPath(str(item["path"])).name
            for item in files
            if item["role"] == SourceFileRole.WEIGHT_SHARD.value
        },
    )
    payload: dict[str, object] = {
        "schema_version": _SOURCE_SCHEMA,
        "status": "COLLECTED",
        "authority_sha256": authority_sha256_v2(authority),
        "model_id": model_id,
        "revision": revision,
        "remote_inventory_sha256": _canonical_sha256(remote_inventory),
        "files": files,
    }
    payload["source_files_sha256"] = _canonical_sha256(files)
    payload["manifest_sha256"] = _canonical_sha256(payload)
    return payload


def build_legal_review_packet(
    *,
    authority_path: Path,
    model_id: str,
    revision: str,
    source_manifest: dict[str, object],
    source_root: Path,
    license_text_path: Path,
    license_text_uri: str,
    prepared_at: str,
) -> dict[str, object]:
    authority = load_model_bundle_authority_v2(authority_path)
    plan = _model_plan(authority, model_id, revision)
    _expect_identity(source_manifest, model_id, revision, _SOURCE_SCHEMA)
    _timestamp(prepared_at)
    if not license_text_uri.startswith("https://"):
        raise ValueError("license text URI must use HTTPS")

    model_card = next(
        item
        for item in _object_array(source_manifest, "files")
        if item.get("role") == SourceFileRole.MODEL_CARD.value
    )
    model_card_path = _bounded_regular_file(
        source_root.resolve(strict=True), _string(model_card, "path")
    )
    if _sha256_file(model_card_path) != _string(model_card, "sha256"):
        raise ValueError("model card digest changed after source collection")
    if not license_text_path.is_file() or license_text_path.is_symlink():
        raise ValueError("license text must be a regular non-symlink file")

    return {
        "schema_version": _LEGAL_PACKET_SCHEMA,
        "status": "PENDING_HUMAN_DECISION",
        "model_id": model_id,
        "revision": revision,
        "role": plan.role.value,
        "prepared_at": prepared_at,
        "upstream_license_metadata": plan.license_spdx,
        "model_card": _declared_file(model_card_path, _string(model_card, "path")),
        "license_text": {
            **_declared_file(license_text_path, "legal/LICENSE-2.0.txt"),
            "source_uri": license_text_uri,
        },
        "required_human_record": {
            "schema_version": "tai.model-legal-review-record.v1",
            "decision": None,
            "reviewer_type": "HUMAN",
            "reviewer_id": None,
            "reviewer_name": None,
            "reviewed_at": None,
            "license_spdx": plan.license_spdx,
            "decision_basis": None,
            "conditions": [],
            "record_type": None,
            "attestation_reference": None,
            "license_text_sha256": _sha256_file(license_text_path),
        },
        "automation_boundary": "AUTOMATION_MUST_NOT_APPROVE_OR_REJECT",
    }


def verify_restored_sources(
    *, source_manifest: dict[str, object], restored_root: Path
) -> dict[str, object]:
    _expect_schema(source_manifest, _SOURCE_SCHEMA)
    restored_root = restored_root.resolve(strict=True)
    expected = {
        _string(item, "path"): item
        for item in _object_array(source_manifest, "files")
    }
    observed_files = {
        path.relative_to(restored_root).as_posix()
        for path in restored_root.rglob("*")
        if path.is_file()
    }
    if observed_files != set(expected):
        raise ValueError("restored source file set does not match manifest")

    verified: list[str] = []
    for relative_path, declared in sorted(expected.items()):
        path = _bounded_regular_file(restored_root, relative_path)
        if path.stat().st_size != _integer(declared, "size_bytes"):
            raise ValueError(f"restored source size mismatch: {relative_path}")
        if _sha256_file(path) != _string(declared, "sha256"):
            raise ValueError(f"restored source digest mismatch: {relative_path}")
        verified.append(relative_path)

    payload: dict[str, object] = {
        "schema_version": _RESTORE_SCHEMA,
        "status": "VERIFIED_SOURCE_RESTORED",
        "model_id": _string(source_manifest, "model_id"),
        "revision": _string(source_manifest, "revision"),
        "source_manifest_sha256": _canonical_sha256(source_manifest),
        "verified_files": verified,
        "reasons": [],
    }
    payload["report_sha256"] = _canonical_sha256(payload)
    return payload


def assemble_acquisition_report(
    *,
    remote_inventory: dict[str, object],
    source_manifest: dict[str, object],
    legal_packet: dict[str, object],
    restore_report: dict[str, object],
    repository_sha: str,
    workflow_run_id: str,
    workflow_run_attempt: str,
) -> dict[str, object]:
    model_id = _string(source_manifest, "model_id")
    revision = _string(source_manifest, "revision")
    _expect_identity(remote_inventory, model_id, revision, _REMOTE_SCHEMA)
    _expect_identity(legal_packet, model_id, revision, _LEGAL_PACKET_SCHEMA)
    _expect_identity(restore_report, model_id, revision, _RESTORE_SCHEMA)
    if _string(restore_report, "status") != "VERIFIED_SOURCE_RESTORED":
        raise ValueError("source restore report is not verified")
    if _string(legal_packet, "status") != "PENDING_HUMAN_DECISION":
        raise ValueError("source acquisition must not manufacture a legal decision")

    payload: dict[str, object] = {
        "schema_version": _REPORT_SCHEMA,
        "status": "VERIFIED_SOURCE_RESTORED_LEGAL_PENDING",
        "model_id": model_id,
        "revision": revision,
        "repository_sha": repository_sha,
        "workflow_run_id": workflow_run_id,
        "workflow_run_attempt": workflow_run_attempt,
        "remote_inventory_sha256": _canonical_sha256(remote_inventory),
        "source_manifest_sha256": _canonical_sha256(source_manifest),
        "source_files_sha256": _string(source_manifest, "source_files_sha256"),
        "legal_packet_sha256": _canonical_sha256(legal_packet),
        "restore_report_sha256": _canonical_sha256(restore_report),
        "legal_review_status": "PENDING_HUMAN_DECISION",
        "conversion_status": "NOT_RUN",
        "quantization_status": "NOT_RUN",
        "model_admission_status": "NOT_DONE",
        "production_operational_status": "NOT_ATTESTED",
        "reasons": [],
    }
    payload["report_sha256"] = _canonical_sha256(payload)
    return payload


def _model_plan(
    authority: ModelBundleAuthority, model_id: str, revision: str
) -> ModelBundlePlan:
    matches = [
        plan
        for plan in authority.models
        if plan.model_id == model_id and plan.revision == revision
    ]
    if len(matches) != 1:
        raise ValueError("model identity is not uniquely present in authority")
    return matches[0]


def _inventory_prefix(plan: ModelBundlePlan) -> str:
    prefixes = {
        "/".join(PurePosixPath(item.path).parts[:2]) + "/"
        for item in plan.inventory
    }
    if len(prefixes) != 1:
        raise ValueError("authority inventory must use one model source prefix")
    return prefixes.pop()


def _remote_size(raw: dict[str, Any], path: str) -> int:
    size = raw.get("size")
    lfs = raw.get("lfs")
    if not isinstance(size, int) and isinstance(lfs, dict):
        size = lfs.get("size")
    if not isinstance(size, int) or size < 1:
        raise ValueError(f"upstream size is missing for {path}")
    return size


def _remote_identity(raw: dict[str, Any]) -> str:
    lfs = raw.get("lfs")
    if not isinstance(lfs, dict):
        lfs = {}
    value = {
        "blob_id": raw.get("blobId"),
        "lfs_oid": lfs.get("oid"),
        "lfs_pointer_size": lfs.get("pointerSize"),
    }
    rendered = json.dumps(value, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    if len(rendered) > 300:
        raise ValueError("remote identity exceeds bounded length")
    return rendered


def _download_uri(model_id: str, revision: str, remote_path: str) -> str:
    return (
        f"https://huggingface.co/{model_id}/resolve/{revision}/"
        + quote(remote_path, safe="/")
    )


def _verify_shard_index(path: Path, expected_shards: set[str]) -> None:
    payload = _strict_json_object(path)
    weight_map = payload.get("weight_map")
    if not isinstance(weight_map, dict) or not weight_map:
        raise ValueError("shard index weight_map is missing")
    actual = set()
    for value in weight_map.values():
        if not isinstance(value, str) or not value:
            raise ValueError("shard index contains an invalid shard name")
        if PurePosixPath(value).name != value:
            raise ValueError("shard index must use bounded shard basenames")
        actual.add(value)
    if actual != expected_shards:
        raise ValueError("shard index does not reference the exact selected shard set")


def _bounded_regular_file(root: Path, relative_path: str) -> Path:
    pure = PurePosixPath(relative_path)
    if pure.is_absolute() or ".." in pure.parts or not pure.parts:
        raise ValueError("file path must be bounded and relative")
    path = root.joinpath(*pure.parts)
    if path.is_symlink():
        raise ValueError("evidence file must be a regular non-symlink file")
    try:
        resolved = path.resolve(strict=True)
    except FileNotFoundError as error:
        raise ValueError(f"required file is missing: {relative_path}") from error
    if not resolved.is_relative_to(root):
        raise ValueError("file path escapes evidence root")
    if not resolved.is_file():
        raise ValueError("evidence file must be a regular non-symlink file")
    return resolved


def _declared_file(path: Path, relative_path: str) -> dict[str, object]:
    return {
        "path": relative_path,
        "sha256": _sha256_file(path),
        "size_bytes": path.stat().st_size,
    }


def _strict_json_object(path: Path) -> dict[str, Any]:
    def reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result

    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=reject_duplicates
        )
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"invalid JSON evidence: {path}") from error
    if not isinstance(value, dict):
        raise ValueError("JSON evidence must be an object")
    return value


def _expect_identity(
    value: dict[str, object], model_id: str, revision: str, schema: str
) -> None:
    _expect_schema(value, schema)
    if _string(value, "model_id") != model_id or _string(value, "revision") != revision:
        raise ValueError("model evidence identity mismatch")


def _expect_schema(value: dict[str, object], schema: str) -> None:
    if _string(value, "schema_version") != schema:
        raise ValueError(f"unsupported evidence schema: {schema}")


def _object_array(value: dict[str, object], key: str) -> list[dict[str, object]]:
    raw = value.get(key)
    if not isinstance(raw, list):
        raise ValueError(f"{key} must be an array")
    result: list[dict[str, object]] = []
    for item in raw:
        if not isinstance(item, dict):
            raise ValueError(f"{key} entries must be objects")
        result.append(item)
    return result


def _string(value: dict[str, object], key: str) -> str:
    raw = value.get(key)
    if not isinstance(raw, str) or not raw:
        raise ValueError(f"{key} must be a non-empty string")
    return raw


def _integer(value: dict[str, object], key: str) -> int:
    raw = value.get(key)
    if not isinstance(raw, int) or isinstance(raw, bool) or raw < 0:
        raise ValueError(f"{key} must be a non-negative integer")
    return raw


def _timestamp(value: str) -> None:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError("timestamp must use ISO 8601") from error
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError("timestamp must include a timezone")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_sha256(value: object) -> str:
    rendered = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return hashlib.sha256(rendered).hexdigest()
