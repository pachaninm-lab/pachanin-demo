from __future__ import annotations

import hashlib
import json
import re
from datetime import UTC, datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from tai.cpu_benchmark_execution import load_execution_authority
from tai.model_benchmark_admission_v2 import load_authority as load_benchmark_authority
from tai.model_bundle_v2 import authority_sha256_v2, load_model_bundle_authority_v2

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_COMMIT = re.compile(r"^[0-9a-f]{40}$")
_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$")
_EXPECTED_MATURITY = {
    "benchmark_status": "PENDING_BENCHMARK",
    "model_admission_status": "PENDING_ADMISSION",
    "production_operational_status": "NOT_ATTESTED",
}


class ExternalRunPlanError(ValueError):
    pass


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ExternalRunPlanError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"), object_pairs_hook=_reject_duplicates
        )
    except (OSError, json.JSONDecodeError, ExternalRunPlanError) as exc:
        raise ExternalRunPlanError(f"invalid JSON {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ExternalRunPlanError(f"JSON root must be an object: {path}")
    return value


def canonical_sha256(value: object) -> str:
    encoded = json.dumps(
        value, ensure_ascii=False, separators=(",", ":"), sort_keys=True
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _require_keys(value: dict[str, Any], expected: set[str], name: str) -> None:
    observed = set(value)
    missing = sorted(expected - observed)
    unknown = sorted(observed - expected)
    if missing or unknown:
        raise ExternalRunPlanError(
            f"{name} keys invalid; missing={missing!r}, unknown={unknown!r}"
        )


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ExternalRunPlanError(f"{name} must be an object")
    return value


def _array(value: object, name: str) -> list[Any]:
    if not isinstance(value, list):
        raise ExternalRunPlanError(f"{name} must be an array")
    return value


def _text(value: object, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ExternalRunPlanError(f"{name} must be a non-blank string")
    return value


def _integer(value: object, name: str, *, minimum: int = 0) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise ExternalRunPlanError(f"{name} must be an integer >= {minimum}")
    return value


def _boolean(value: object, name: str) -> bool:
    if not isinstance(value, bool):
        raise ExternalRunPlanError(f"{name} must be a boolean")
    return value


def _sha256(value: object, name: str) -> str:
    text = _text(value, name)
    if _SHA256.fullmatch(text) is None:
        raise ExternalRunPlanError(f"{name} must be a lowercase SHA-256")
    return text


def _commit(value: object, name: str) -> str:
    text = _text(value, name)
    if _COMMIT.fullmatch(text) is None:
        raise ExternalRunPlanError(f"{name} must be an exact lowercase Git commit")
    return text


def _identity(value: object, name: str) -> str:
    text = _text(value, name)
    if _ID.fullmatch(text) is None:
        raise ExternalRunPlanError(f"{name} must be a portable bounded identity")
    return text


def _timestamp(value: object, name: str) -> datetime:
    text = _text(value, name)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ExternalRunPlanError(f"{name} must be an ISO-8601 timestamp") from exc
    if parsed.utcoffset() is None:
        raise ExternalRunPlanError(f"{name} must be timezone-aware")
    return parsed.astimezone(UTC)


def _relative_path(value: object, name: str) -> str:
    text = _text(value, name)
    path = PurePosixPath(text)
    if path.is_absolute() or not path.parts or "." in path.parts or ".." in path.parts:
        raise ExternalRunPlanError(f"{name} must be a bounded relative POSIX path")
    if "\\" in text or text.startswith("~"):
        raise ExternalRunPlanError(f"{name} contains forbidden traversal syntax")
    return text


def _digest_valid(value: dict[str, Any], digest_key: str, name: str) -> None:
    observed = _sha256(value[digest_key], f"{name}.{digest_key}")
    expected = canonical_sha256({key: item for key, item in value.items() if key != digest_key})
    if observed != expected:
        raise ExternalRunPlanError(f"{name} digest mismatch")


def _maturity(value: dict[str, Any], name: str) -> None:
    observed = {key: value.get(key) for key in _EXPECTED_MATURITY}
    if observed != _EXPECTED_MATURITY:
        raise ExternalRunPlanError(f"{name} maturity boundary is invalid")


def load_runner_authority(path: Path) -> dict[str, Any]:
    raw = load_json(path)
    expected_keys = {
        "schema_version",
        "program_issue",
        "parent_issue",
        "issue",
        "command",
        "readiness",
        "finalization",
        "authorities",
        "target",
        "toolchain",
        "models",
        "evaluation",
        "execution",
        "evidence",
        "maturity_boundary",
    }
    _require_keys(raw, expected_keys, "runner authority")
    if raw["schema_version"] != "tai.cpu-benchmark-external-runner-authority.v1":
        raise ExternalRunPlanError("unsupported runner authority schema_version")
    if (
        _integer(raw["program_issue"], "program_issue", minimum=1),
        _integer(raw["parent_issue"], "parent_issue", minimum=1),
        _integer(raw["issue"], "issue", minimum=1),
    ) != (2726, 2990, 2991):
        raise ExternalRunPlanError("runner authority issue binding mismatch")
    if raw["command"] != "/tai plan cpu-fallback-benchmark exact-main":
        raise ExternalRunPlanError("runner authority command mismatch")

    readiness = _object(raw["readiness"], "readiness")
    expected_readiness = {
        "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
        "execution_authority_schema_version": "tai.cpu-benchmark-execution-authority.v1",
        "required_status": "READY_FOR_EXTERNAL_EXECUTION",
        "maximum_age_hours": 6,
    }
    if readiness != expected_readiness:
        raise ExternalRunPlanError("readiness authority boundary mismatch")

    finalization = _object(raw["finalization"], "finalization")
    _require_keys(
        finalization,
        {
            "schema_version",
            "required_status",
            "minimum_retention_remaining_days",
            "required_model_keys",
            "source_schema_version",
            "repository",
            "workflow_name",
            "workflow_path",
            "artifact_name_prefix",
        },
        "finalization",
    )
    expected_finalization = {
        "schema_version": "tai.model-bundle-finalization-report.v1",
        "required_status": "BUNDLES_IMMUTABLY_STORED_AND_CLEANLY_RESTORED",
        "minimum_retention_remaining_days": 30,
        "required_model_keys": ["qwen3-8b", "mistral-7b-instruct-v0.3"],
        "source_schema_version": "tai.github-actions-evidence-source.v1",
        "repository": "pachaninm-lab/pachanin-demo",
        "workflow_name": "TAI Immutable Model Bundle Finalization",
        "workflow_path": ".github/workflows/tai-model-bundle-finalization.yml",
        "artifact_name_prefix": "tai-model-bundle-finalization-",
    }
    if finalization != expected_finalization:
        raise ExternalRunPlanError("finalization authority boundary mismatch")

    authorities = _object(raw["authorities"], "authorities")
    if authorities != {
        "bundle_schema_version": "tai.model-bundle-authority.v2",
        "benchmark_schema_version": "tai.model-benchmark-admission-authority.v2",
        "benchmark_issue": 2862,
    }:
        raise ExternalRunPlanError("model authority boundary mismatch")

    target = _object(raw["target"], "target")
    if target != {
        "host_role": "DEDICATED_MODEL_HOST",
        "required_user": "tai-model",
        "workspace_root": "/srv/tai-models/benchmark-runs",
        "production_fallback_allowed": False,
        "restore_root_template": (
            "/srv/tai-models/benchmark-runs/{exact_main}/{run_id}/restores/{model_key}"
        ),
        "evidence_root_template": (
            "/srv/tai-models/benchmark-runs/{exact_main}/{run_id}/evidence"
        ),
    }:
        raise ExternalRunPlanError("target boundary mismatch")

    toolchain = _object(raw["toolchain"], "toolchain")
    if toolchain != {
        "name": "ggml-org/llama.cpp",
        "release": "b9637",
        "commit": "aedb2a5e9ca3d4064148bbb919e0ddc0c1b70ab3",
        "profile": "linux-x86_64-cpu-release-static-v1",
        "required_binaries": [
            "llama-cli",
            "llama-server",
            "llama-quantize",
            "llama-bench",
        ],
        "benchmark_binaries": ["llama-cli", "llama-server", "llama-bench"],
    }:
        raise ExternalRunPlanError("toolchain boundary mismatch")

    models = _array(raw["models"], "models")
    expected_models = [
        {
            "key": "qwen3-8b",
            "role": "PRIMARY",
            "model_id": "Qwen/Qwen3-8B",
            "revision": "895c8d171bc03c30e113cd7a28c02494b5e068b7",
            "runtime_class": "CPU",
            "quantization": "Q4_K_M",
            "artifact_path": "artifacts/qwen3-8b-q4-k-m.gguf",
            "profile_id": "qwen3-8b-cpu-q4-k-m",
        },
        {
            "key": "mistral-7b-instruct-v0.3",
            "role": "FALLBACK",
            "model_id": "mistralai/Mistral-7B-Instruct-v0.3",
            "revision": "c170c708c41dac9275d15a8fff4eca08d52bab71",
            "runtime_class": "CPU",
            "quantization": "Q4_K_M",
            "artifact_path": "artifacts/mistral-7b-instruct-v0.3-q4-k-m.gguf",
            "profile_id": "mistral-7b-fallback-cpu-q4-k-m",
        },
    ]
    if models != expected_models:
        raise ExternalRunPlanError("model execution boundary mismatch")

    evaluation = _object(raw["evaluation"], "evaluation")
    if evaluation != {
        "suite_id": "tai-platform-agro-58-v1",
        "required_status": "ACCEPTED",
        "required_accepted": True,
        "required_total_cases": 58,
        "required_critical_cases": 23,
        "maximum_unreviewed_cases": 0,
    }:
        raise ExternalRunPlanError("evaluation boundary mismatch")

    execution = _object(raw["execution"], "execution")
    if execution != {
        "concurrency_levels": [1, 2, 4],
        "minimum_sample_count": 100,
        "deterministic_seed": 13001,
        "temperature_milli": 0,
        "maximum_output_tokens": 512,
        "minimum_fallback_triggers": 100,
        "minimum_soak_seconds": 3600,
        "minimum_soak_requests": 1000,
    }:
        raise ExternalRunPlanError("execution policy mismatch")

    evidence = _object(raw["evidence"], "evidence")
    if evidence != {
        "bounded_metadata_only": True,
        "maximum_github_file_bytes": 10_000_000,
        "forbidden_suffixes": [".gguf", ".safetensors", ".tar", ".bin"],
        "forbidden_path_fragments": ["sources/", "artifacts/", "payload/"],
        "independent_evidence_restore_required": True,
    }:
        raise ExternalRunPlanError("evidence boundary mismatch")
    if raw["maturity_boundary"] != _EXPECTED_MATURITY:
        raise ExternalRunPlanError("runner authority maturity boundary mismatch")

    result = {key: raw[key] for key in expected_keys}
    result["authority_sha256"] = canonical_sha256(result)
    return result


def _load_readiness(
    path: Path,
    *,
    execution_authority_sha256: str,
    exact_main: str,
    planned_at: datetime,
    maximum_age_hours: int,
) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
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
    if raw["schema_version"] != "tai.cpu-benchmark-execution-readiness.v1":
        raise ExternalRunPlanError("readiness schema mismatch")
    _digest_valid(raw, "report_sha256", "readiness report")
    if raw["status"] != "READY_FOR_EXTERNAL_EXECUTION" or raw["ready"] is not True:
        raise ExternalRunPlanError("readiness report is not ready")
    if raw["reasons"] != []:
        raise ExternalRunPlanError("readiness report contains blockers")
    if _commit(raw["exact_main"], "readiness exact_main") != exact_main:
        raise ExternalRunPlanError("readiness exact-main mismatch")
    if _sha256(raw["authority_sha256"], "readiness authority") != execution_authority_sha256:
        raise ExternalRunPlanError("readiness execution authority mismatch")
    evaluated = _timestamp(raw["evaluated_at"], "readiness evaluated_at")
    if evaluated > planned_at + timedelta(minutes=5):
        raise ExternalRunPlanError("readiness report is from the future")
    if planned_at - evaluated > timedelta(hours=maximum_age_hours):
        raise ExternalRunPlanError("readiness report is stale")
    if raw["required_profiles"] != [
        "qwen3-8b-cpu-q4-k-m",
        "mistral-7b-fallback-cpu-q4-k-m",
    ]:
        raise ExternalRunPlanError("readiness profile set mismatch")
    _sha256(raw["prerequisite_report_sha256"], "readiness prerequisite digest")
    _sha256(raw["gold_corpus_sha256"], "readiness corpus digest")
    _sha256(raw["gold_assessment_sha256"], "readiness assessment digest")
    _maturity(raw, "readiness report")
    return raw


def _load_gold(path: Path, readiness: dict[str, Any]) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
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
    if raw["schema_version"] != "tai.gold-set-assessment.v1":
        raise ExternalRunPlanError("gold assessment schema mismatch")
    _digest_valid(raw, "assessment_sha256", "gold assessment")
    if raw["accepted"] is not True or raw["status"] != "ACCEPTED":
        raise ExternalRunPlanError("gold assessment is not accepted")
    counts = _object(raw["counts"], "gold assessment counts")
    if (
        counts.get("total_cases"),
        counts.get("critical_cases"),
        counts.get("reviewed_cases"),
        counts.get("unreviewed_cases"),
    ) != (58, 23, 58, 0):
        raise ExternalRunPlanError("gold review coverage is incomplete")
    if raw["blocking_reasons"] != [] or raw["missing_review_case_ids"] != []:
        raise ExternalRunPlanError("gold assessment contains blockers")
    if raw["corpus_sha256"] != readiness["gold_corpus_sha256"]:
        raise ExternalRunPlanError("gold corpus differs from readiness")
    if raw["assessment_sha256"] != readiness["gold_assessment_sha256"]:
        raise ExternalRunPlanError("gold assessment differs from readiness")
    return raw


def _load_source(path: Path, authority: dict[str, Any], planned_at: datetime) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
        {
            "schema_version",
            "repository",
            "workflow_name",
            "workflow_path",
            "run_id",
            "run_attempt",
            "head_sha",
            "head_branch",
            "event",
            "conclusion",
            "artifact_id",
            "artifact_name",
            "artifact_digest",
            "artifact_expired",
            "downloaded_at",
        },
        "finalization source",
    )
    finalization = authority["finalization"]
    if raw["schema_version"] != finalization["source_schema_version"]:
        raise ExternalRunPlanError("finalization source schema mismatch")
    for key in ("repository", "workflow_name", "workflow_path"):
        if raw[key] != finalization[key]:
            raise ExternalRunPlanError(f"finalization source {key} mismatch")
    _integer(raw["run_id"], "source run_id", minimum=1)
    _integer(raw["run_attempt"], "source run_attempt", minimum=1)
    _commit(raw["head_sha"], "source head_sha")
    if raw["head_branch"] != "main" or raw["event"] != "issue_comment":
        raise ExternalRunPlanError("finalization source event boundary mismatch")
    if raw["conclusion"] != "success" or raw["artifact_expired"] is not False:
        raise ExternalRunPlanError("finalization source is not usable")
    _integer(raw["artifact_id"], "source artifact_id", minimum=1)
    artifact_name = _text(raw["artifact_name"], "source artifact_name")
    if not artifact_name.startswith(finalization["artifact_name_prefix"]):
        raise ExternalRunPlanError("finalization artifact name mismatch")
    digest = _text(raw["artifact_digest"], "source artifact_digest")
    if not digest.startswith("sha256:") or _SHA256.fullmatch(digest.removeprefix("sha256:")) is None:
        raise ExternalRunPlanError("finalization artifact digest is invalid")
    downloaded = _timestamp(raw["downloaded_at"], "source downloaded_at")
    if downloaded > planned_at + timedelta(minutes=5):
        raise ExternalRunPlanError("finalization source timestamp is in the future")
    return raw


def _parse_locator(locator: str) -> dict[str, str]:
    parsed = urlsplit(locator)
    if parsed.scheme != "s3+version" or not parsed.hostname:
        raise ExternalRunPlanError("immutable locator scheme or host is invalid")
    parts = [unquote(part) for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        raise ExternalRunPlanError("immutable locator bucket/key is invalid")
    query = parse_qs(parsed.query, keep_blank_values=True)
    versions = query.get("versionId", [])
    if len(versions) != 1 or not versions[0]:
        raise ExternalRunPlanError("immutable locator VersionId is invalid")
    if not parsed.fragment.startswith("sha256="):
        raise ExternalRunPlanError("immutable locator digest fragment is absent")
    digest = parsed.fragment.removeprefix("sha256=")
    if _SHA256.fullmatch(digest) is None:
        raise ExternalRunPlanError("immutable locator digest is invalid")
    key = "/".join(parts[1:])
    _relative_path(key, "immutable locator key")
    return {
        "endpoint_host": parsed.hostname,
        "bucket": parts[0],
        "key": key,
        "version_id": unquote(versions[0]),
        "archive_sha256": digest,
    }


def _declared_file(value: object, name: str) -> dict[str, Any]:
    item = _object(value, name)
    _require_keys(item, {"path", "sha256", "size_bytes"}, name)
    return {
        "path": _relative_path(item["path"], f"{name}.path"),
        "sha256": _sha256(item["sha256"], f"{name}.sha256"),
        "size_bytes": _integer(item["size_bytes"], f"{name}.size_bytes", minimum=1),
    }


def _load_finalization(path: Path, authority: dict[str, Any]) -> dict[str, Any]:
    raw = load_json(path)
    _require_keys(
        raw,
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
        "finalization report",
    )
    finalization = authority["finalization"]
    if raw["schema_version"] != finalization["schema_version"]:
        raise ExternalRunPlanError("finalization report schema mismatch")
    _digest_valid(raw, "report_sha256", "finalization report")
    if raw["status"] != finalization["required_status"] or raw["reasons"] != []:
        raise ExternalRunPlanError("finalization report is not accepted")
    if raw["local_archive_copy_retained"] is not False:
        raise ExternalRunPlanError("finalization retained a local archive")
    if (
        raw["benchmark_status"],
        raw["model_admission_status"],
        raw["production_operational_status"],
    ) != ("NOT_RUN", "NOT_DONE", "NOT_ATTESTED"):
        raise ExternalRunPlanError("finalization maturity boundary is invalid")
    _timestamp(raw["completed_at"], "finalization completed_at")
    models = _array(raw["models"], "finalization models")
    keys = [item.get("key") for item in models if isinstance(item, dict)]
    if keys != finalization["required_model_keys"]:
        raise ExternalRunPlanError("finalization model order or set mismatch")
    return raw


def _bundle_authority_raw(path: Path) -> tuple[dict[str, Any], str]:
    parsed = load_model_bundle_authority_v2(path)
    raw = load_json(path)
    if raw.get("schema_version") != "tai.model-bundle-authority.v2":
        raise ExternalRunPlanError("bundle authority schema mismatch")
    return raw, authority_sha256_v2(parsed)


def _benchmark_authority(path: Path) -> dict[str, Any]:
    try:
        authority = load_benchmark_authority(path)
    except ValueError as exc:
        raise ExternalRunPlanError(f"benchmark authority invalid: {exc}") from exc
    if authority.get("issue") != 2862:
        raise ExternalRunPlanError("benchmark authority issue mismatch")
    return authority


def _model_plan(raw_bundle_authority: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    matches = [
        item
        for item in _array(raw_bundle_authority.get("models"), "bundle authority models")
        if isinstance(item, dict)
        and item.get("model_id") == expected["model_id"]
        and item.get("revision") == expected["revision"]
    ]
    if len(matches) != 1:
        raise ExternalRunPlanError(f"bundle authority model cardinality invalid: {expected['key']}")
    return matches[0]


def _benchmark_profile(benchmark: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    matches = [
        item
        for item in benchmark["runtime_profiles"]
        if item["profile_id"] == expected["profile_id"]
        and item["model_id"] == expected["model_id"]
        and item["revision"] == expected["revision"]
    ]
    if len(matches) != 1:
        raise ExternalRunPlanError(f"benchmark profile cardinality invalid: {expected['key']}")
    profile = matches[0]
    if (
        profile["runtime_class"],
        profile["quantization"],
        profile["required_concurrency_levels"],
    ) != ("CPU", "Q4_K_M", [1, 2, 4]):
        raise ExternalRunPlanError(f"benchmark profile boundary mismatch: {expected['key']}")
    return profile


def _validate_object_record(value: dict[str, Any], name: str) -> dict[str, Any]:
    _require_keys(
        value,
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
        name,
    )
    result = {
        "endpoint_host": _text(value["endpoint_host"], f"{name}.endpoint_host"),
        "region": _text(value["region"], f"{name}.region"),
        "bucket": _text(value["bucket"], f"{name}.bucket"),
        "key": _relative_path(value["key"], f"{name}.key"),
        "version_id": _text(value["version_id"], f"{name}.version_id"),
        "etag": _text(value["etag"], f"{name}.etag"),
        "archive_sha256": _sha256(value["archive_sha256"], f"{name}.archive_sha256"),
        "archive_size_bytes": _integer(
            value["archive_size_bytes"], f"{name}.archive_size_bytes", minimum=1
        ),
        "uploaded_at": _timestamp(value["uploaded_at"], f"{name}.uploaded_at"),
        "retention_expires_at": _timestamp(
            value["retention_expires_at"], f"{name}.retention_expires_at"
        ),
        "restored_at": _timestamp(value["restored_at"], f"{name}.restored_at"),
        "immutable_locator": _text(value["immutable_locator"], f"{name}.immutable_locator"),
    }
    locator = _parse_locator(result["immutable_locator"])
    for key in ("endpoint_host", "bucket", "key", "version_id", "archive_sha256"):
        if locator[key] != result[key]:
            raise ExternalRunPlanError(f"{name} locator {key} mismatch")
    if result["restored_at"] < result["uploaded_at"]:
        raise ExternalRunPlanError(f"{name} restore predates upload")
    return result


def _validate_verification(
    value: dict[str, Any],
    *,
    expected_model: dict[str, Any],
    bundle_authority_sha256: str,
    manifest_sha256: str,
) -> dict[str, Any]:
    name = f"{expected_model['key']} verification report"
    _require_keys(
        value,
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
        name,
    )
    if value["schema_version"] != "tai.external-model-bundle-verification-report.v1":
        raise ExternalRunPlanError(f"{name} schema mismatch")
    _digest_valid(value, "report_sha256", name)
    if value["status"] != "VERIFIED" or value["reasons"] != []:
        raise ExternalRunPlanError(f"{name} is not VERIFIED")
    if (value["model_id"], value["revision"]) != (
        expected_model["model_id"],
        expected_model["revision"],
    ):
        raise ExternalRunPlanError(f"{name} model identity mismatch")
    if value["authority_sha256"] != bundle_authority_sha256:
        raise ExternalRunPlanError(f"{name} authority digest mismatch")
    if value["manifest_sha256"] != manifest_sha256:
        raise ExternalRunPlanError(f"{name} manifest digest mismatch")
    _sha256(value["archive_sha256"], f"{name}.archive_sha256")
    _integer(value["archive_size_bytes"], f"{name}.archive_size_bytes", minimum=1)
    if (
        value["benchmark_status"],
        value["model_admission_status"],
        value["production_operational_status"],
    ) != ("NOT_RUN", "NOT_DONE", "NOT_ATTESTED"):
        raise ExternalRunPlanError(f"{name} maturity boundary mismatch")
    return value


def _validate_manifest(
    value: dict[str, Any],
    *,
    expected_model: dict[str, Any],
    bundle_model_plan: dict[str, Any],
    bundle_authority_sha256: str,
    authority: dict[str, Any],
) -> dict[str, Any]:
    name = f"{expected_model['key']} manifest"
    _require_keys(
        value,
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
        name,
    )
    if value["schema_version"] != "tai.external-model-bundle.v1" or value["lifecycle"] != "COMPLETE":
        raise ExternalRunPlanError(f"{name} lifecycle mismatch")
    if (value["role"], value["model_id"], value["revision"]) != (
        expected_model["role"],
        expected_model["model_id"],
        expected_model["revision"],
    ):
        raise ExternalRunPlanError(f"{name} model identity mismatch")
    if value["authority_sha256"] != bundle_authority_sha256:
        raise ExternalRunPlanError(f"{name} bundle authority mismatch")
    _maturity(value, name)
    if value["benchmark_status"] != "NOT_RUN" or value["model_admission_status"] != "NOT_DONE":
        raise ExternalRunPlanError(f"{name} pre-benchmark maturity mismatch")

    toolchain = _object(value["toolchain_package"], f"{name}.toolchain_package")
    expected_toolchain = authority["toolchain"]
    for key in ("name", "release", "commit", "profile"):
        if toolchain.get(key) != expected_toolchain[key]:
            raise ExternalRunPlanError(f"{name} toolchain {key} mismatch")
    if toolchain.get("verification_status") != "VERIFIED":
        raise ExternalRunPlanError(f"{name} toolchain is not verified")
    binaries = _array(toolchain.get("binaries"), f"{name}.toolchain binaries")
    binary_map: dict[str, dict[str, Any]] = {}
    for index, item_value in enumerate(binaries):
        item = _object(item_value, f"{name}.binary[{index}]")
        _require_keys(item, {"name", "file"}, f"{name}.binary[{index}]")
        binary_name = _text(item["name"], f"{name}.binary[{index}].name")
        if binary_name in binary_map:
            raise ExternalRunPlanError(f"{name} duplicate toolchain binary")
        binary_map[binary_name] = _declared_file(item["file"], f"{name}.{binary_name}")
    if set(binary_map) != set(expected_toolchain["required_binaries"]):
        raise ExternalRunPlanError(f"{name} toolchain binary set mismatch")

    quantizations = _array(value["quantizations"], f"{name}.quantizations")
    selected = [
        item
        for item in quantizations
        if isinstance(item, dict)
        and item.get("runtime_class") == expected_model["runtime_class"]
        and item.get("quantization") == expected_model["quantization"]
    ]
    if len(selected) != 1:
        raise ExternalRunPlanError(f"{name} CPU Q4_K_M artifact cardinality invalid")
    quantization = selected[0]
    _require_keys(
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
        f"{name}.quantization",
    )
    artifact = _declared_file(quantization["output"], f"{name}.artifact")
    if artifact["path"] != expected_model["artifact_path"]:
        raise ExternalRunPlanError(f"{name} artifact path mismatch")
    if quantization["quantize_binary_sha256"] != binary_map["llama-quantize"]["sha256"]:
        raise ExternalRunPlanError(f"{name} quantizer digest mismatch")
    authority_quantizations = [
        item
        for item in _array(bundle_model_plan.get("quantizations"), "bundle model quantizations")
        if isinstance(item, dict)
        and item.get("runtime_class") == "CPU"
        and item.get("quantization") == "Q4_K_M"
    ]
    if len(authority_quantizations) != 1 or authority_quantizations[0].get("output_path") != artifact["path"]:
        raise ExternalRunPlanError(f"{name} artifact differs from bundle authority")

    storage = _object(value["storage"], f"{name}.storage")
    archive = _object(storage.get("archive"), f"{name}.storage.archive")
    if archive.get("media_type") != "application/x-tar":
        raise ExternalRunPlanError(f"{name} archive media type mismatch")
    _sha256(archive.get("sha256"), f"{name}.archive.sha256")
    _integer(archive.get("size_bytes"), f"{name}.archive.size_bytes", minimum=1)
    storage_object = _object(storage.get("object"), f"{name}.storage.object")
    if storage.get("retention_mode") != "COMPLIANCE" or storage.get("retention_days") != 90:
        raise ExternalRunPlanError(f"{name} retention policy mismatch")
    return {
        "artifact": artifact,
        "binaries": binary_map,
        "storage": storage,
        "storage_object": storage_object,
        "archive": archive,
    }


def compile_run_plan(
    authority_path: Path,
    execution_authority_path: Path,
    readiness_path: Path,
    gold_assessment_path: Path,
    bundle_authority_path: Path,
    benchmark_authority_path: Path,
    finalization_source_path: Path,
    finalization_root: Path,
    *,
    exact_main: str,
    run_id: str,
    planned_at: str,
) -> dict[str, object]:
    authority = load_runner_authority(authority_path)
    exact_commit = _commit(exact_main, "exact_main")
    portable_run_id = _identity(run_id, "run_id")
    now = _timestamp(planned_at, "planned_at")

    try:
        execution_authority = load_execution_authority(execution_authority_path)
    except ValueError as exc:
        raise ExternalRunPlanError(f"execution authority invalid: {exc}") from exc
    readiness = _load_readiness(
        readiness_path,
        execution_authority_sha256=str(execution_authority["authority_sha256"]),
        exact_main=exact_commit,
        planned_at=now,
        maximum_age_hours=int(authority["readiness"]["maximum_age_hours"]),
    )
    gold = _load_gold(gold_assessment_path, readiness)
    source = _load_source(finalization_source_path, authority, now)
    finalization_path = finalization_root / "finalization-report.json"
    finalization = _load_finalization(finalization_path, authority)

    raw_bundle_authority, bundle_authority_sha256 = _bundle_authority_raw(
        bundle_authority_path
    )
    benchmark = _benchmark_authority(benchmark_authority_path)

    summary_by_key = {
        _text(item.get("key"), "finalization model key"): item
        for item in _array(finalization["models"], "finalization models")
        if isinstance(item, dict)
    }
    model_plans: list[dict[str, object]] = []
    restore_roots: set[str] = set()
    for expected_value in authority["models"]:
        expected = _object(expected_value, "authority model")
        key = str(expected["key"])
        summary = _object(summary_by_key.get(key), f"{key} finalization summary")
        _require_keys(
            summary,
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
            f"{key} finalization summary",
        )
        model_root = finalization_root / "models" / key
        manifest_path = model_root / "manifest.json"
        object_path = model_root / "object-record.json"
        verification_path = model_root / "verification-report.json"
        for required_path in (manifest_path, object_path, verification_path):
            if not required_path.is_file() or required_path.is_symlink():
                raise ExternalRunPlanError(f"required bounded evidence missing: {required_path}")
            if required_path.stat().st_size > int(authority["evidence"]["maximum_github_file_bytes"]):
                raise ExternalRunPlanError(f"bounded evidence file too large: {required_path}")

        manifest = load_json(manifest_path)
        object_record_raw = load_json(object_path)
        verification_raw = load_json(verification_path)
        bundle_model = _model_plan(raw_bundle_authority, expected)
        profile = _benchmark_profile(benchmark, expected)
        manifest_details = _validate_manifest(
            manifest,
            expected_model=expected,
            bundle_model_plan=bundle_model,
            bundle_authority_sha256=bundle_authority_sha256,
            authority=authority,
        )
        object_record = _validate_object_record(
            object_record_raw, f"{key} object record"
        )
        manifest_digest = file_sha256(manifest_path)
        verification = _validate_verification(
            verification_raw,
            expected_model=expected,
            bundle_authority_sha256=bundle_authority_sha256,
            manifest_sha256=manifest_digest,
        )

        archive_sha = str(object_record["archive_sha256"])
        archive_size = int(object_record["archive_size_bytes"])
        locator = str(object_record["immutable_locator"])
        version_id = str(object_record["version_id"])
        cross_values = {
            "summary_model": (summary["model_id"], summary["revision"]),
            "expected_model": (expected["model_id"], expected["revision"]),
            "summary_archive": (summary["archive_sha256"], summary["archive_size_bytes"]),
            "object_archive": (archive_sha, archive_size),
            "verification_archive": (
                verification["archive_sha256"],
                verification["archive_size_bytes"],
            ),
            "manifest_archive": (
                manifest_details["archive"]["sha256"],
                manifest_details["archive"]["size_bytes"],
            ),
        }
        if cross_values["summary_model"] != cross_values["expected_model"]:
            raise ExternalRunPlanError(f"{key} finalization model identity mismatch")
        if not (
            cross_values["summary_archive"]
            == cross_values["object_archive"]
            == cross_values["verification_archive"]
            == cross_values["manifest_archive"]
        ):
            raise ExternalRunPlanError(f"{key} archive binding mismatch")
        if summary["immutable_locator"] != locator or summary["version_id"] != version_id:
            raise ExternalRunPlanError(f"{key} immutable object summary mismatch")
        if summary["verification_report_sha256"] != verification["report_sha256"]:
            raise ExternalRunPlanError(f"{key} verification report digest mismatch")
        storage = manifest_details["storage"]
        if storage.get("immutable_locator") != locator:
            raise ExternalRunPlanError(f"{key} manifest immutable locator mismatch")
        if storage.get("object") != manifest_details["storage_object"]:
            raise ExternalRunPlanError(f"{key} manifest storage object mismatch")
        manifest_object = _object(storage.get("object"), f"{key} manifest storage object")
        for field, observed in (
            ("endpoint_host", object_record["endpoint_host"]),
            ("region", object_record["region"]),
            ("bucket", object_record["bucket"]),
            ("key", object_record["key"]),
            ("version_id", object_record["version_id"]),
            ("etag", object_record["etag"]),
        ):
            if manifest_object.get(field) != observed:
                raise ExternalRunPlanError(f"{key} manifest object {field} mismatch")
        retention_remaining = object_record["retention_expires_at"] - now
        minimum_retention = timedelta(
            days=int(authority["finalization"]["minimum_retention_remaining_days"])
        )
        if retention_remaining < minimum_retention:
            raise ExternalRunPlanError(f"{key} immutable retention is insufficient")

        restore_root = str(authority["target"]["restore_root_template"]).format(
            exact_main=exact_commit, run_id=portable_run_id, model_key=key
        )
        if restore_root in restore_roots:
            raise ExternalRunPlanError("model restore roots must be independent")
        restore_roots.add(restore_root)
        if not restore_root.startswith(str(authority["target"]["workspace_root"]) + "/"):
            raise ExternalRunPlanError(f"{key} restore root escapes workspace")

        binaries = manifest_details["binaries"]
        model_plans.append(
            {
                "key": key,
                "role": expected["role"],
                "model_id": expected["model_id"],
                "revision": expected["revision"],
                "profile_id": expected["profile_id"],
                "runtime_class": "CPU",
                "quantization": "Q4_K_M",
                "bundle": {
                    "authority_sha256": bundle_authority_sha256,
                    "manifest_sha256": manifest_digest,
                    "verification_report_sha256": verification["report_sha256"],
                    "archive_sha256": archive_sha,
                    "archive_size_bytes": archive_size,
                    "immutable_locator": locator,
                    "endpoint_host": object_record["endpoint_host"],
                    "region": object_record["region"],
                    "bucket": object_record["bucket"],
                    "object_key": object_record["key"],
                    "version_id": version_id,
                    "etag": object_record["etag"],
                    "retention_expires_at": object_record["retention_expires_at"].isoformat(),
                },
                "artifact": manifest_details["artifact"],
                "toolchain_binaries": [
                    {"name": name, **binaries[name]}
                    for name in authority["toolchain"]["required_binaries"]
                ],
                "restore_root": restore_root,
                "benchmark_thresholds": profile["thresholds"],
            }
        )

    evidence_root = str(authority["target"]["evidence_root_template"]).format(
        exact_main=exact_commit, run_id=portable_run_id
    )
    if evidence_root in restore_roots:
        raise ExternalRunPlanError("evidence root aliases a model restore root")
    if not evidence_root.startswith(str(authority["target"]["workspace_root"]) + "/"):
        raise ExternalRunPlanError("evidence root escapes workspace")

    plan: dict[str, object] = {
        "schema_version": "tai.cpu-benchmark-external-run-plan.v1",
        "status": "READY_FOR_REMOTE_EXECUTION",
        "exact_main": exact_commit,
        "run_id": portable_run_id,
        "planned_at": now.isoformat(),
        "runner_authority_sha256": authority["authority_sha256"],
        "execution_authority_sha256": execution_authority["authority_sha256"],
        "readiness_report_sha256": readiness["report_sha256"],
        "gold_corpus_sha256": gold["corpus_sha256"],
        "gold_assessment_sha256": gold["assessment_sha256"],
        "bundle_authority_sha256": bundle_authority_sha256,
        "benchmark_authority_sha256": benchmark["authority_sha256"],
        "finalization_source": {
            "run_id": source["run_id"],
            "run_attempt": source["run_attempt"],
            "head_sha": source["head_sha"],
            "artifact_id": source["artifact_id"],
            "artifact_name": source["artifact_name"],
            "artifact_digest": source["artifact_digest"],
        },
        "finalization_report_sha256": finalization["report_sha256"],
        "target": {
            "host_role": "DEDICATED_MODEL_HOST",
            "required_user": "tai-model",
            "workspace_root": authority["target"]["workspace_root"],
            "evidence_root": evidence_root,
            "production_fallback_allowed": False,
        },
        "models": model_plans,
        "evaluation": {
            "suite_id": authority["evaluation"]["suite_id"],
            "total_cases": 58,
            "critical_cases": 23,
            "accepted": True,
        },
        "execution": authority["execution"],
        "evidence_boundary": authority["evidence"],
        "secrets_in_plan": False,
        **_EXPECTED_MATURITY,
    }
    plan["plan_sha256"] = canonical_sha256(plan)
    return plan


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
