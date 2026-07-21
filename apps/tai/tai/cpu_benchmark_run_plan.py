from __future__ import annotations

import copy
import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from tai import cpu_benchmark_execution as execution
from tai import model_benchmark_admission_v2 as benchmark_v2
from tai.model_bundle_v2 import authority_sha256_v2, load_model_bundle_authority_v2

MATURITY = {
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}
MODEL_KEYS = ("qwen3-8b", "mistral-7b-instruct-v0.3")
PLAN_STATUS = "RUN_PLAN_VERIFIED_READY_FOR_PROTECTED_ACCESS"
PENDING_STATUS = "PENDING_EXTERNAL_RUN_PLAN_INPUTS"


class RunPlanError(ValueError):
    pass


def expected_authority() -> dict[str, Any]:
    return {
        "schema_version": "tai.cpu-benchmark-run-plan-authority.v1",
        "program_issue": 2726,
        "parent_issue": 2971,
        "runner_issue": 2990,
        "issue": 2991,
        "command": "/tai compile cpu-fallback run-plan exact-main",
        "execution_authority": {
            "path": "apps/tai/model-artifacts/cpu-benchmark-execution-authority.v1.json",
            "schema_version": "tai.cpu-benchmark-execution-authority.v1",
            "git_blob_sha1": "becf915cae4075c8d519048c050d381fb542b4ef",
        },
        "model_bundle_authority": {
            "path": "apps/tai/model-artifacts/model-bundle-authority.v2.json",
            "schema_version": "tai.model-bundle-authority.v2",
            "git_blob_sha1": "238b194af5d8b32422d2c539b0e826fc282d065e",
        },
        "benchmark_authority": {
            "path": "apps/tai/model-artifacts/model-benchmark-admission-authority.v2.json",
            "schema_version": "tai.model-benchmark-admission-authority.v2",
            "issue": 2862,
            "git_blob_sha1": "06d9d95ae2d1aaddc7edb01136a5f8cdee530cab",
        },
        "finalization_authority": {
            "path": "apps/tai/model-artifacts/model-bundle-finalization-authority.v1.json",
            "schema_version": "tai.model-bundle-finalization-authority.v1",
            "issue": 2961,
            "git_blob_sha1": "c1d37d82697c4cb9fa2d02a2977dd436eeb4853f",
        },
        "readiness": {
            "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
            "required_status": "READY_FOR_EXTERNAL_EXECUTION",
            "maximum_age_hours": 24,
        },
        "finalization": {
            "schema_version": "tai.model-bundle-finalization-report.v1",
            "required_status": "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED",
            "workflow_name": "TAI Immutable Model Bundle Finalization",
            "maximum_age_days": 90,
            "required_model_count": 2,
            "verification_status": "VERIFIED",
            "retention_mode": "COMPLIANCE",
            "retention_days": 90,
        },
        "input_policy": {
            "schema_version": "tai.cpu-benchmark-run-plan-inputs.v1",
            "maximum_file_size_bytes": 10_000_000,
            "required_model_keys": list(MODEL_KEYS),
            "github_artifact_digest_prefix": "sha256:",
        },
        "target": {
            "host_role": "DEDICATED_MODEL_HOST",
            "required_user": "tai-model",
            "workspace_root": "/srv/tai-models/benchmark-runs",
            "production_fallback_allowed": False,
            "protected_access_status": PLAN_STATUS,
        },
        "plan_policy": {
            "validity_hours": 24,
            "minimum_retention_grace_hours": 1,
            "bounded_metadata_only": True,
            "compiler_protected_access_allowed": False,
            "raw_payload_in_github_allowed": False,
            "required_quantization": "Q4_K_M",
            "required_runtime_class": "CPU",
        },
        "maturity_boundary": MATURITY,
    }


def load_authority(path: Path) -> dict[str, Any]:
    raw = _load_json(path)
    if raw != expected_authority():
        raise RunPlanError("run-plan authority differs from the governed contract")
    value = copy.deepcopy(raw)
    value["authority_sha256"] = execution.canonical_sha256(value)
    return value


def _load_json(path: Path) -> dict[str, Any]:
    try:
        return execution.load_json(path)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    try:
        execution._require_keys(value, expected, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _text(value: object, name: str) -> str:
    try:
        return execution._text(value, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _identity(value: object, name: str) -> str:
    try:
        return execution._identity(value, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _commit(value: object, name: str) -> str:
    try:
        return execution._commit(value, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _sha256(value: object, name: str) -> str:
    try:
        return execution._sha256(value, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _integer(value: object, name: str, *, minimum: int = 0) -> int:
    try:
        return execution._integer(value, name, minimum=minimum)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _boolean(value: object, name: str) -> bool:
    try:
        return execution._boolean(value, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _object(value: object, name: str) -> dict[str, Any]:
    try:
        return execution._object(value, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _array(value: object, name: str) -> list[Any]:
    try:
        return execution._array(value, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _timestamp(value: object, name: str) -> datetime:
    try:
        return execution._timestamp(value, name)
    except execution.ExecutionContractError as exc:
        raise RunPlanError(str(exc)) from exc


def _git_blob_sha1(path: Path) -> str:
    payload = path.read_bytes()
    header = f"blob {len(payload)}\0".encode()
    return hashlib.sha1(header + payload).hexdigest()  # noqa: S324


def _file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _self_digest(value: dict[str, Any], field: str, name: str) -> str:
    digest = _sha256(value.get(field), f"{name}.{field}")
    expected = execution.canonical_sha256(
        {key: item for key, item in value.items() if key != field}
    )
    if digest != expected:
        raise RunPlanError(f"{name} digest mismatch")
    return digest


def _relative(value: object, name: str) -> str:
    text = _text(value, name)
    path = PurePosixPath(text)
    if (
        path.is_absolute()
        or not path.parts
        or any(part in {"", ".", ".."} for part in path.parts)
        or text.startswith("~")
        or "\\" in text
    ):
        raise RunPlanError(f"{name} must be a bounded relative POSIX path")
    return text


def _planned_root(value: object, name: str, workspace: str) -> str:
    text = _text(value, name)
    path = PurePosixPath(text)
    if (
        not path.is_absolute()
        or any(part in {"", ".", ".."} for part in path.parts)
        or "\\" in text
        or "//" in text
        or str(path) != text
        or not text.startswith(f"{workspace}/")
    ):
        raise RunPlanError(f"{name} is outside the governed benchmark workspace")
    return text


def _safe_file(root: Path, relative: str) -> Path:
    root_resolved = root.resolve(strict=True)
    current = root_resolved
    for part in PurePosixPath(relative).parts:
        current /= part
        if current.is_symlink():
            raise RunPlanError("run-plan input symlink is rejected")
    if not current.is_file():
        raise RunPlanError(f"run-plan input is absent: {relative}")
    resolved = current.resolve(strict=True)
    if root_resolved not in resolved.parents:
        raise RunPlanError("run-plan input escapes its evidence root")
    return current


def _load_ref(
    root: Path, raw: object, name: str, maximum_size: int
) -> tuple[dict[str, Any], Path, str]:
    ref = _object(raw, name)
    _keys(ref, {"path", "sha256", "size_bytes"}, name)
    relative = _relative(ref["path"], f"{name}.path")
    declared_sha = _sha256(ref["sha256"], f"{name}.sha256")
    declared_size = _integer(ref["size_bytes"], f"{name}.size_bytes", minimum=1)
    if declared_size > maximum_size:
        raise RunPlanError(f"{name} exceeds the governed size limit")
    path = _safe_file(root, relative)
    if path.stat().st_size != declared_size or _file_sha256(path) != declared_sha:
        raise RunPlanError(f"{name} no longer matches its declared file identity")
    return _load_json(path), path, declared_sha


def _verify_pinned_file(path: Path, spec: dict[str, Any], name: str) -> str:
    if _git_blob_sha1(path) != spec["git_blob_sha1"]:
        raise RunPlanError(f"{name} Git blob identity mismatch")
    return _file_sha256(path)


def _load_readiness(
    value: dict[str, Any],
    *,
    exact_main: str,
    now: datetime,
    authority: dict[str, Any],
    execution_authority_sha: str,
) -> dict[str, Any]:
    _keys(
        value,
        {
            "schema_version",
            "status",
            "ready",
            "exact_main",
            "evaluated_at",
            "authority_sha256",
            "prerequisite_report_sha256",
            "gold_corpus_sha256",
            "gold_assessment_sha256",
            "required_profiles",
            "reasons",
            "benchmark_status",
            "model_admission_status",
            "production_operational_status",
            "report_sha256",
        },
        "readiness report",
    )
    _self_digest(value, "report_sha256", "readiness report")
    policy = authority["readiness"]
    evaluated = _timestamp(value["evaluated_at"], "readiness.evaluated_at")
    reasons = _array(value["reasons"], "readiness.reasons")
    profiles = [
        _identity(item, "readiness.required_profiles")
        for item in _array(value["required_profiles"], "readiness.required_profiles")
    ]
    if (
        value["schema_version"] != policy["schema_version"]
        or value["status"] != policy["required_status"]
        or _boolean(value["ready"], "readiness.ready") is not True
        or _commit(value["exact_main"], "readiness.exact_main") != exact_main
        or value["authority_sha256"] != execution_authority_sha
        or reasons
        or profiles
        != ["qwen3-8b-cpu-q4-k-m", "mistral-7b-fallback-cpu-q4-k-m"]
        or {key: value[key] for key in MATURITY} != MATURITY
    ):
        raise RunPlanError("execution readiness is not accepted for this exact main")
    if evaluated > now + timedelta(minutes=5):
        raise RunPlanError("execution readiness is from the future")
    if now - evaluated > timedelta(hours=int(policy["maximum_age_hours"])):
        raise RunPlanError("execution readiness is stale")
    return value


def _load_assessment(
    value: dict[str, Any], execution_authority: dict[str, Any]
) -> dict[str, Any]:
    _keys(
        value,
        {
            "schema_version",
            "version",
            "accepted",
            "status",
            "corpus_sha256",
            "component_sha256",
            "counts",
            "quality_targets",
            "blocking_reasons",
            "missing_review_case_ids",
            "assessment_sha256",
        },
        "gold assessment",
    )
    _self_digest(value, "assessment_sha256", "gold assessment")
    counts = _object(value["counts"], "gold assessment.counts")
    required = execution_authority["evaluation"]
    if (
        value["schema_version"] != required["assessment_schema"]
        or value["status"] != required["required_status"]
        or _boolean(value["accepted"], "gold assessment.accepted") is not True
        or _integer(counts.get("total_cases"), "counts.total_cases") != 58
        or _integer(counts.get("critical_cases"), "counts.critical_cases") != 23
        or _integer(counts.get("reviewed_cases"), "counts.reviewed_cases") != 58
        or _integer(counts.get("unreviewed_cases"), "counts.unreviewed_cases") != 0
        or _array(value["blocking_reasons"], "blocking_reasons")
        or _array(value["missing_review_case_ids"], "missing_review_case_ids")
    ):
        raise RunPlanError("AP-14C assessment is not fully accepted")
    _sha256(value["corpus_sha256"], "gold assessment.corpus_sha256")
    return value


def _load_finalization(
    value: dict[str, Any], *, now: datetime, authority: dict[str, Any]
) -> dict[str, Any]:
    _keys(
        value,
        {
            "schema_version",
            "status",
            "completed_at",
            "models",
            "local_archive_copy_retained",
            "benchmark_status",
            "model_admission_status",
            "production_operational_status",
            "reasons",
            "report_sha256",
        },
        "bundle finalization report",
    )
    _self_digest(value, "report_sha256", "bundle finalization report")
    policy = authority["finalization"]
    completed = _timestamp(value["completed_at"], "finalization.completed_at")
    models = _array(value["models"], "finalization.models")
    if (
        value["schema_version"] != policy["schema_version"]
        or value["status"] != policy["required_status"]
        or len(models) != policy["required_model_count"]
        or _boolean(
            value["local_archive_copy_retained"],
            "finalization.local_archive_copy_retained",
        )
        is not False
        or value["benchmark_status"] != "NOT_RUN"
        or value["model_admission_status"] != "NOT_DONE"
        or value["production_operational_status"] != "NOT_ATTESTED"
        or _array(value["reasons"], "finalization.reasons")
    ):
        raise RunPlanError("bundle finalization is not accepted")
    if completed > now + timedelta(minutes=5):
        raise RunPlanError("bundle finalization is from the future")
    if now - completed > timedelta(days=int(policy["maximum_age_days"])):
        raise RunPlanError("bundle finalization is stale")
    seen: set[str] = set()
    for index, raw_model in enumerate(models):
        model = _object(raw_model, f"finalization.models[{index}]")
        _keys(
            model,
            {
                "key",
                "model_id",
                "revision",
                "archive_sha256",
                "archive_size_bytes",
                "immutable_locator",
                "version_id",
                "verification_report_sha256",
            },
            f"finalization.models[{index}]",
        )
        key = _identity(model["key"], f"finalization.models[{index}].key")
        if key in seen:
            raise RunPlanError("finalization model keys must be unique")
        seen.add(key)
        _identity(model["model_id"], "finalization.model_id")
        _commit(model["revision"], "finalization.revision")
        _sha256(model["archive_sha256"], "finalization.archive_sha256")
        _integer(
            model["archive_size_bytes"],
            "finalization.archive_size_bytes",
            minimum=1,
        )
        _text(model["immutable_locator"], "finalization.immutable_locator")
        _text(model["version_id"], "finalization.version_id")
        _sha256(
            model["verification_report_sha256"],
            "finalization.verification_report_sha256",
        )
    if seen != set(MODEL_KEYS):
        raise RunPlanError("finalization model coverage is incomplete")
    return value


def _finalization_run(value: object, authority: dict[str, Any]) -> dict[str, Any]:
    run = _object(value, "finalization_run")
    _keys(
        run,
        {
            "workflow_name",
            "workflow_run_id",
            "workflow_run_attempt",
            "head_sha",
            "head_branch",
            "event",
            "conclusion",
            "artifact_id",
            "artifact_name",
            "artifact_digest",
        },
        "finalization_run",
    )
    digest = _text(run["artifact_digest"], "finalization_run.artifact_digest")
    prefix = authority["input_policy"]["github_artifact_digest_prefix"]
    if not digest.startswith(prefix) or len(digest) != len(prefix) + 64:
        raise RunPlanError("finalization artifact digest is invalid")
    _sha256(digest[len(prefix) :], "finalization artifact digest")
    head_sha = _commit(run["head_sha"], "finalization_run.head_sha")
    artifact_name = _text(run["artifact_name"], "artifact_name")
    if (
        run["workflow_name"] != authority["finalization"]["workflow_name"]
        or _integer(run["workflow_run_id"], "workflow_run_id", minimum=1) < 1
        or _integer(run["workflow_run_attempt"], "workflow_run_attempt", minimum=1)
        < 1
        or run["head_branch"] != "main"
        or run["event"] != "issue_comment"
        or run["conclusion"] != "success"
        or _integer(run["artifact_id"], "artifact_id", minimum=1) < 1
        or not artifact_name.startswith(f"tai-model-bundle-finalization-{head_sha}-")
    ):
        raise RunPlanError("finalization workflow run is not accepted")
    return run


def _locator(value: object, record: dict[str, Any], name: str) -> str:
    locator = _text(value, name)
    parsed = urlsplit(locator)
    query = parse_qs(parsed.query, strict_parsing=True)
    path = unquote(parsed.path.lstrip("/"))
    expected_path = f"{record['bucket']}/{record['key']}"
    if (
        parsed.scheme != "s3+version"
        or parsed.netloc != record["endpoint_host"]
        or path != expected_path
        or query != {"versionId": [record["version_id"]]}
        or parsed.fragment != f"sha256={record['archive_sha256']}"
    ):
        raise RunPlanError(f"{name} is not the exact immutable object locator")
    return locator


def _declared(value: object, name: str) -> dict[str, Any]:
    item = _object(value, name)
    _keys(item, {"path", "sha256", "size_bytes"}, name)
    return {
        "path": _relative(item["path"], f"{name}.path"),
        "sha256": _sha256(item["sha256"], f"{name}.sha256"),
        "size_bytes": _integer(item["size_bytes"], f"{name}.size_bytes", minimum=1),
    }


def _model_evidence(
    *,
    key: str,
    manifest: dict[str, Any],
    manifest_file_sha: str,
    record: dict[str, Any],
    report: dict[str, Any],
    finalization: dict[str, Any],
    execution_model: dict[str, Any],
    bundle_authority_sha: str,
    toolchain: Any,
    roots: dict[str, str],
    plan_expires: datetime,
    authority: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, tuple[str, int]]]:
    _keys(
        manifest,
        {
            "schema_version",
            "lifecycle",
            "role",
            "model_id",
            "revision",
            "authority_sha256",
            "remote_inventory",
            "source_files",
            "legal_review",
            "toolchain_package",
            "conversion",
            "quantizations",
            "storage",
            "benchmark_status",
            "model_admission_status",
            "production_operational_status",
        },
        f"{key}.manifest",
    )
    manifest_maturity = {
        field: manifest[field]
        for field in (
            "benchmark_status",
            "model_admission_status",
            "production_operational_status",
        )
    }
    if (
        manifest["schema_version"] != "tai.external-model-bundle.v1"
        or manifest["lifecycle"] != "COMPLETE"
        or manifest["role"] != execution_model["role"]
        or manifest["model_id"] != execution_model["model_id"]
        or manifest["revision"] != execution_model["revision"]
        or manifest["authority_sha256"] != bundle_authority_sha
        or manifest_maturity
        != {
            "benchmark_status": "NOT_RUN",
            "model_admission_status": "NOT_DONE",
            "production_operational_status": "NOT_ATTESTED",
        }
    ):
        raise RunPlanError(f"{key} manifest is not bound to the governed model authority")

    legal = _object(manifest["legal_review"], f"{key}.legal_review")
    if legal.get("decision") != "APPROVED" or legal.get("reviewer_type") != "HUMAN":
        raise RunPlanError(f"{key} legal review is not an approved human decision")

    package = _object(manifest["toolchain_package"], f"{key}.toolchain_package")
    _keys(
        package,
        {
            "name",
            "release",
            "commit",
            "profile",
            "authority_sha256",
            "package",
            "build_manifest",
            "verification_report",
            "verification_status",
            "immutable_locator",
            "binaries",
        },
        f"{key}.toolchain_package",
    )
    if (
        package["name"] != toolchain.name
        or package["release"] != toolchain.release
        or package["commit"] != toolchain.commit
        or package["profile"] != toolchain.profile
        or package["authority_sha256"] != toolchain.authority_sha256
        or package["verification_status"] != "VERIFIED"
    ):
        raise RunPlanError(f"{key} toolchain package identity mismatch")
    binary_map: dict[str, tuple[str, int]] = {}
    for index, raw_binary in enumerate(_array(package["binaries"], f"{key}.binaries")):
        binary = _object(raw_binary, f"{key}.binaries[{index}]")
        _keys(binary, {"name", "file"}, f"{key}.binaries[{index}]")
        name = _text(binary["name"], f"{key}.binary.name")
        if name in binary_map:
            raise RunPlanError(f"{key} contains duplicate toolchain binaries")
        file = _declared(binary["file"], f"{key}.binary.{name}.file")
        binary_map[name] = (file["sha256"], file["size_bytes"])
    if set(binary_map) != set(toolchain.required_binaries):
        raise RunPlanError(f"{key} toolchain binary coverage mismatch")

    q4: dict[str, Any] | None = None
    for index, raw_quantization in enumerate(
        _array(manifest["quantizations"], f"{key}.quantizations")
    ):
        quantization = _object(raw_quantization, f"{key}.quantizations[{index}]")
        _keys(
            quantization,
            {
                "runtime_class",
                "quantization",
                "argv",
                "log",
                "output",
                "input_sha256",
                "quantize_binary_sha256",
            },
            f"{key}.quantizations[{index}]",
        )
        if (
            quantization["runtime_class"]
            == authority["plan_policy"]["required_runtime_class"]
            and quantization["quantization"]
            == authority["plan_policy"]["required_quantization"]
        ):
            if q4 is not None:
                raise RunPlanError(f"{key} has duplicate governed Q4_K_M outputs")
            q4 = {
                "runtime_class": quantization["runtime_class"],
                "quantization": quantization["quantization"],
                "output": _declared(quantization["output"], f"{key}.q4.output"),
                "quantize_binary_sha256": _sha256(
                    quantization["quantize_binary_sha256"],
                    f"{key}.quantize_binary_sha256",
                ),
            }
    if q4 is None:
        raise RunPlanError(f"{key} Q4_K_M artifact is absent")
    if (
        q4["output"]["path"] != execution_model["artifact_path"]
        or q4["quantize_binary_sha256"] != binary_map["llama-quantize"][0]
    ):
        raise RunPlanError(f"{key} Q4_K_M artifact binding mismatch")

    storage = _object(manifest["storage"], f"{key}.storage")
    _keys(
        storage,
        {
            "archive",
            "payload_index",
            "immutable_locator",
            "object",
            "uploaded_at",
            "retention_mode",
            "retention_days",
            "retention_expires_at",
            "restored_at",
            "upload_record",
            "restore_record",
        },
        f"{key}.storage",
    )
    archive = _object(storage["archive"], f"{key}.storage.archive")
    _keys(archive, {"sha256", "size_bytes", "media_type"}, f"{key}.storage.archive")
    archive_sha = _sha256(archive["sha256"], f"{key}.archive.sha256")
    archive_size = _integer(archive["size_bytes"], f"{key}.archive.size", minimum=1)
    if archive["media_type"] != "application/x-tar":
        raise RunPlanError(f"{key} archive media type is invalid")
    storage_object = _object(storage["object"], f"{key}.storage.object")
    _keys(
        storage_object,
        {"endpoint_host", "region", "bucket", "key", "version_id", "etag"},
        f"{key}.storage.object",
    )
    _keys(
        record,
        {
            "endpoint_host",
            "region",
            "bucket",
            "key",
            "version_id",
            "etag",
            "archive_sha256",
            "archive_size_bytes",
            "uploaded_at",
            "retention_expires_at",
            "restored_at",
            "immutable_locator",
        },
        f"{key}.object_record",
    )
    for field in ("endpoint_host", "region", "bucket", "key", "version_id", "etag"):
        if storage_object[field] != record[field]:
            raise RunPlanError(f"{key} object record differs from bundle storage")
    object_key = _relative(record["key"], f"{key}.object_record.key")
    if object_key != record["key"]:
        raise RunPlanError(f"{key} object key is not normalized")
    if (
        record["archive_sha256"] != archive_sha
        or record["archive_size_bytes"] != archive_size
        or storage["immutable_locator"] != record["immutable_locator"]
        or storage["retention_mode"] != authority["finalization"]["retention_mode"]
        or storage["retention_days"] != authority["finalization"]["retention_days"]
        or storage["uploaded_at"] != record["uploaded_at"]
        or storage["retention_expires_at"] != record["retention_expires_at"]
        or storage["restored_at"] != record["restored_at"]
    ):
        raise RunPlanError(f"{key} immutable storage binding mismatch")
    locator = _locator(record["immutable_locator"], record, f"{key}.immutable_locator")
    uploaded = _timestamp(record["uploaded_at"], f"{key}.uploaded_at")
    retention = _timestamp(
        record["retention_expires_at"], f"{key}.retention_expires_at"
    )
    if (
        retention - uploaded
        < timedelta(days=int(authority["finalization"]["retention_days"]))
        or retention
        < plan_expires
        + timedelta(
            hours=int(authority["plan_policy"]["minimum_retention_grace_hours"])
        )
    ):
        raise RunPlanError(f"{key} retention does not cover the execution plan window")

    _keys(
        report,
        {
            "schema_version",
            "status",
            "reasons",
            "model_id",
            "revision",
            "authority_sha256",
            "manifest_sha256",
            "archive_sha256",
            "archive_size_bytes",
            "verified_original_files",
            "verified_restored_files",
            "benchmark_status",
            "model_admission_status",
            "production_operational_status",
            "report_sha256",
        },
        f"{key}.verification_report",
    )
    _self_digest(report, "report_sha256", f"{key} verification report")
    if (
        report["schema_version"]
        != "tai.external-model-bundle-verification-report.v1"
        or report["status"] != authority["finalization"]["verification_status"]
        or _array(report["reasons"], f"{key}.verification.reasons")
        or report["model_id"] != execution_model["model_id"]
        or report["revision"] != execution_model["revision"]
        or report["authority_sha256"] != bundle_authority_sha
        or report["manifest_sha256"] != manifest_file_sha
        or report["archive_sha256"] != archive_sha
        or report["archive_size_bytes"] != archive_size
        or report["benchmark_status"] != "NOT_RUN"
        or report["model_admission_status"] != "NOT_DONE"
        or report["production_operational_status"] != "NOT_ATTESTED"
    ):
        raise RunPlanError(f"{key} verification report is not accepted")

    finalization_models = {
        item["key"]: item for item in _array(finalization["models"], "finalization.models")
    }
    summary = _object(finalization_models.get(key), f"finalization.{key}")
    if (
        summary["model_id"] != execution_model["model_id"]
        or summary["revision"] != execution_model["revision"]
        or summary["archive_sha256"] != archive_sha
        or summary["archive_size_bytes"] != archive_size
        or summary["immutable_locator"] != locator
        or summary["version_id"] != record["version_id"]
        or summary["verification_report_sha256"] != report["report_sha256"]
    ):
        raise RunPlanError(f"{key} finalization summary differs from model evidence")

    return (
        {
            "model_key": key,
            "role": execution_model["role"],
            "model_id": execution_model["model_id"],
            "revision": execution_model["revision"],
            "runtime_profile_id": execution_model["runtime_profile_id"],
            "runtime_class": execution_model["runtime_class"],
            "quantization": execution_model["quantization"],
            "artifact": q4["output"],
            "archive_sha256": archive_sha,
            "archive_size_bytes": archive_size,
            "immutable_locator": locator,
            "object": {
                "endpoint_host": record["endpoint_host"],
                "region": record["region"],
                "bucket": record["bucket"],
                "key": record["key"],
                "version_id": record["version_id"],
            },
            "verification_report_sha256": report["report_sha256"],
            "toolchain_binaries": [
                {"name": name, "sha256": digest, "size_bytes": size}
                for name, (digest, size) in sorted(binary_map.items())
            ],
            "original_root": roots["original_root"],
            "restored_root": roots["restored_root"],
            "retention_expires_at": retention.isoformat(),
        },
        binary_map,
    )


def compile_run_plan(
    *,
    authority_path: Path,
    input_root: Path,
    input_index_path: Path,
    execution_authority_path: Path,
    model_bundle_authority_path: Path,
    benchmark_authority_path: Path,
    finalization_authority_path: Path,
    exact_main: str,
    evaluated_at: str,
) -> dict[str, Any]:
    authority = load_authority(authority_path)
    exact_commit = _commit(exact_main, "exact_main")
    now = _timestamp(evaluated_at, "evaluated_at")
    plan_expires = now + timedelta(hours=int(authority["plan_policy"]["validity_hours"]))

    execution_sha = _verify_pinned_file(
        execution_authority_path,
        authority["execution_authority"],
        "execution authority",
    )
    bundle_file_sha = _verify_pinned_file(
        model_bundle_authority_path,
        authority["model_bundle_authority"],
        "model bundle authority",
    )
    benchmark_file_sha = _verify_pinned_file(
        benchmark_authority_path,
        authority["benchmark_authority"],
        "benchmark authority",
    )
    finalization_authority_sha = _verify_pinned_file(
        finalization_authority_path,
        authority["finalization_authority"],
        "finalization authority",
    )
    try:
        execution_authority = execution.load_execution_authority(execution_authority_path)
        bundle_authority = load_model_bundle_authority_v2(model_bundle_authority_path)
        benchmark_authority = benchmark_v2.load_authority(benchmark_authority_path)
    except (execution.ExecutionContractError, benchmark_v2.ContractError, ValueError) as exc:
        raise RunPlanError(f"prerequisite authority invalid: {exc}") from exc
    bundle_authority_sha = authority_sha256_v2(bundle_authority)
    finalization_authority = _load_json(finalization_authority_path)
    storage_authority = _object(
        finalization_authority.get("storage"), "finalization authority.storage"
    )
    if (
        finalization_authority.get("schema_version")
        != authority["finalization_authority"]["schema_version"]
        or finalization_authority.get("issue")
        != authority["finalization_authority"]["issue"]
        or storage_authority.get("retention_mode")
        != authority["finalization"]["retention_mode"]
        or storage_authority.get("retention_days")
        != authority["finalization"]["retention_days"]
    ):
        raise RunPlanError("finalization authority binding mismatch")

    index = _load_json(input_index_path)
    _keys(
        index,
        {
            "schema_version",
            "finalization_run",
            "readiness",
            "gold_assessment",
            "finalization_report",
            "models",
            "planned_roots",
        },
        "run-plan input index",
    )
    if index["schema_version"] != authority["input_policy"]["schema_version"]:
        raise RunPlanError("unsupported run-plan input index schema")
    maximum_size = int(authority["input_policy"]["maximum_file_size_bytes"])
    readiness, _, readiness_file_sha = _load_ref(
        input_root, index["readiness"], "readiness", maximum_size
    )
    assessment, _, assessment_file_sha = _load_ref(
        input_root, index["gold_assessment"], "gold_assessment", maximum_size
    )
    finalization, _, finalization_file_sha = _load_ref(
        input_root, index["finalization_report"], "finalization_report", maximum_size
    )
    run = _finalization_run(index["finalization_run"], authority)
    readiness = _load_readiness(
        readiness,
        exact_main=exact_commit,
        now=now,
        authority=authority,
        execution_authority_sha=str(execution_authority["authority_sha256"]),
    )
    assessment = _load_assessment(assessment, execution_authority)
    if (
        readiness["gold_corpus_sha256"] != assessment["corpus_sha256"]
        or readiness["gold_assessment_sha256"] != assessment["assessment_sha256"]
    ):
        raise RunPlanError("readiness is not bound to the accepted AP-14C assessment")
    finalization = _load_finalization(finalization, now=now, authority=authority)

    roots_by_key: dict[str, dict[str, str]] = {}
    all_roots: set[str] = set()
    for index_number, raw_root in enumerate(_array(index["planned_roots"], "planned_roots")):
        root = _object(raw_root, f"planned_roots[{index_number}]")
        _keys(root, {"model_key", "original_root", "restored_root"}, "planned root")
        key = _identity(root["model_key"], "planned root.model_key")
        if key in roots_by_key:
            raise RunPlanError("planned model roots must be unique")
        original = _planned_root(
            root["original_root"],
            "planned root.original_root",
            authority["target"]["workspace_root"],
        )
        restored = _planned_root(
            root["restored_root"],
            "planned root.restored_root",
            authority["target"]["workspace_root"],
        )
        if original == restored or original in all_roots or restored in all_roots:
            raise RunPlanError("planned restore roots must be independent")
        all_roots.update({original, restored})
        roots_by_key[key] = {"original_root": original, "restored_root": restored}
    if set(roots_by_key) != set(MODEL_KEYS):
        raise RunPlanError("planned root coverage is incomplete")

    evidence_by_key: dict[str, dict[str, Any]] = {}
    for index_number, raw_model in enumerate(_array(index["models"], "models")):
        model = _object(raw_model, f"models[{index_number}]")
        _keys(
            model,
            {"model_key", "manifest", "object_record", "verification_report"},
            f"models[{index_number}]",
        )
        key = _identity(model["model_key"], f"models[{index_number}].model_key")
        if key in evidence_by_key:
            raise RunPlanError("model evidence keys must be unique")
        manifest, _, manifest_file_sha = _load_ref(
            input_root, model["manifest"], f"{key}.manifest", maximum_size
        )
        record, _, _ = _load_ref(
            input_root, model["object_record"], f"{key}.object_record", maximum_size
        )
        report, _, _ = _load_ref(
            input_root,
            model["verification_report"],
            f"{key}.verification_report",
            maximum_size,
        )
        evidence_by_key[key] = {
            "manifest": manifest,
            "manifest_file_sha": manifest_file_sha,
            "record": record,
            "report": report,
        }
    if set(evidence_by_key) != set(MODEL_KEYS):
        raise RunPlanError("model evidence coverage is incomplete")

    execution_models = {str(item["key"]): item for item in execution_authority["models"]}
    bundle_plans = {plan.model_id: plan for plan in bundle_authority.models}
    plan_models: list[dict[str, Any]] = []
    binary_maps: list[dict[str, tuple[str, int]]] = []
    for key in MODEL_KEYS:
        execution_model = execution_models[key]
        if execution_model["model_id"] not in bundle_plans:
            raise RunPlanError(f"{key} is absent from the exact model bundle authority")
        model_plan, binary_map = _model_evidence(
            key=key,
            manifest=evidence_by_key[key]["manifest"],
            manifest_file_sha=evidence_by_key[key]["manifest_file_sha"],
            record=evidence_by_key[key]["record"],
            report=evidence_by_key[key]["report"],
            finalization=finalization,
            execution_model=execution_model,
            bundle_authority_sha=bundle_authority_sha,
            toolchain=bundle_authority.toolchain,
            roots=roots_by_key[key],
            plan_expires=plan_expires,
            authority=authority,
        )
        plan_models.append(model_plan)
        binary_maps.append(binary_map)
    if binary_maps[0] != binary_maps[1]:
        raise RunPlanError("toolchain binary identities differ across model bundles")
    locators = [model["immutable_locator"] for model in plan_models]
    versions = [model["object"]["version_id"] for model in plan_models]
    archives = [model["archive_sha256"] for model in plan_models]
    if len(set(locators)) != 2 or len(set(versions)) != 2 or len(set(archives)) != 2:
        raise RunPlanError("cross-model immutable evidence aliases are rejected")

    required_cpu_profiles = set(readiness["required_profiles"])
    observed_cpu_profiles = {
        item["profile_id"]
        for item in benchmark_authority["runtime_profiles"]
        if item["profile_id"] in required_cpu_profiles
    }
    if observed_cpu_profiles != required_cpu_profiles:
        raise RunPlanError("benchmark authority CPU profile coverage mismatch")
    if (
        benchmark_authority["suite_policy"]["suite_id"]
        != execution_authority["evaluation"]["suite_id"]
        or benchmark_authority["suite_policy"]["required_total_cases"] != 58
        or benchmark_authority["suite_policy"]["required_critical_cases"] != 23
    ):
        raise RunPlanError("benchmark authority suite binding mismatch")

    plan: dict[str, Any] = {
        "schema_version": "tai.cpu-benchmark-run-plan.v1",
        "status": PLAN_STATUS,
        "accepted": True,
        "exact_main": exact_commit,
        "compiled_at": now.isoformat(),
        "expires_at": plan_expires.isoformat(),
        "authority_sha256": authority["authority_sha256"],
        "execution_authority": {
            "file_sha256": execution_sha,
            "authority_sha256": execution_authority["authority_sha256"],
        },
        "model_bundle_authority": {
            "file_sha256": bundle_file_sha,
            "authority_sha256": bundle_authority_sha,
        },
        "benchmark_authority": {
            "file_sha256": benchmark_file_sha,
            "authority_sha256": benchmark_authority["authority_sha256"],
        },
        "finalization_authority": {"file_sha256": finalization_authority_sha},
        "input_evidence": {
            "readiness_file_sha256": readiness_file_sha,
            "readiness_report_sha256": readiness["report_sha256"],
            "gold_assessment_file_sha256": assessment_file_sha,
            "gold_assessment_sha256": assessment["assessment_sha256"],
            "gold_corpus_sha256": assessment["corpus_sha256"],
            "finalization_file_sha256": finalization_file_sha,
            "finalization_report_sha256": finalization["report_sha256"],
            "finalization_run": run,
        },
        "target": execution_authority["target"],
        "corpus": {
            "suite_id": execution_authority["evaluation"]["suite_id"],
            "total_cases": 58,
            "critical_cases": 23,
            "locales": ["ru", "en", "zh"],
        },
        "models": plan_models,
        "execution_policy": {
            "measurements": execution_authority["measurements"],
            "fallback": execution_authority["fallback"],
            "soak": execution_authority["soak"],
            "benchmark_cpu_profiles": [
                item
                for item in benchmark_authority["runtime_profiles"]
                if item["profile_id"] in required_cpu_profiles
            ],
        },
        "protected_access_policy": {
            "compiler_performed_protected_access": False,
            "runner_access_allowed_after_status": PLAN_STATUS,
            "ssh_allowed_before_plan": False,
            "s3_read_allowed_before_plan": False,
            "s3_mutation_allowed": False,
        },
        **MATURITY,
    }
    plan["plan_sha256"] = execution.canonical_sha256(plan)
    return plan


def load_pending(path: Path) -> dict[str, Any]:
    value = _load_json(path)
    _keys(
        value,
        {
            "schema_version",
            "lifecycle",
            "status",
            "pending_reason",
            "exact_main",
            "authority_sha256",
            "input_evidence",
            "models",
            "compiled_at",
            "expires_at",
            "benchmark_status",
            "model_admission_status",
            "production_operational_status",
            "plan_sha256",
        },
        "pending run plan",
    )
    _self_digest(value, "plan_sha256", "pending run plan")
    if (
        value["schema_version"] != "tai.cpu-benchmark-run-plan.v1"
        or value["lifecycle"] != "PENDING_INPUTS"
        or value["status"] != PENDING_STATUS
        or not _text(value["pending_reason"], "pending_reason")
        or value["exact_main"] is not None
        or value["authority_sha256"] is not None
        or value["input_evidence"] is not None
        or value["models"] != []
        or value["compiled_at"] is not None
        or value["expires_at"] is not None
        or {key: value[key] for key in MATURITY} != MATURITY
    ):
        raise RunPlanError("pending run-plan baseline is contaminated")
    return value


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
