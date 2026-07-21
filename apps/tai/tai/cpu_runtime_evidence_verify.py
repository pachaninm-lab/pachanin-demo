from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timedelta
from pathlib import Path, PurePosixPath
from typing import Any

from tai.cpu_runtime_evidence import (
    _LOCALES,
    _MATURITY,
    _PENDING_MATURITY,
    _PROFILES,
    _REQUIRED_FILES,
    RuntimeEvidenceError,
    _duplicates,
    _arr,
    _commit,
    _exact,
    _identity,
    _int,
    _keys,
    _obj,
    _path,
    _self_digest,
    _sha,
    _text,
    _time,
    canonical_sha256,
    load_json,
    load_runtime_authority,
    load_runtime_manifest,
)


def _file_sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _root_files(root: Path) -> set[str]:
    if not root.is_dir() or root.is_symlink():
        raise RuntimeEvidenceError(f"evidence root is invalid: {root}")
    result: set[str] = set()
    for directory, directories, files in os.walk(root, followlinks=False):
        base = Path(directory)
        if any((base / name).is_symlink() for name in directories):
            raise RuntimeEvidenceError("symlink directory rejected")
        for name in files:
            candidate = base / name
            if candidate.is_symlink() or not candidate.is_file():
                raise RuntimeEvidenceError("non-regular evidence file rejected")
            result.add(_path(candidate.relative_to(root).as_posix(), "evidence path"))
    return result


def _safe(root: Path, relative: str) -> Path:
    current = root
    for part in PurePosixPath(relative).parts:
        current /= part
        if current.is_symlink():
            raise RuntimeEvidenceError(f"symlink evidence path rejected: {relative}")
    if not current.is_file() or root.resolve(strict=True) not in current.resolve(strict=True).parents:
        raise RuntimeEvidenceError(f"evidence file is absent or escapes root: {relative}")
    return current


def _files(rows_value: object, authority: dict[str, Any], original: Path, restored: Path) -> tuple[dict[str, dict[str, Any]], int]:
    first_root, second_root = original.resolve(strict=True), restored.resolve(strict=True)
    if first_root == second_root or os.path.samefile(first_root, second_root):
        raise RuntimeEvidenceError("original and restored evidence roots are identical")
    rows: list[dict[str, Any]] = []
    for index, item in enumerate(_arr(rows_value, "evidence_files")):
        row = _obj(item, f"evidence_files[{index}]")
        _keys(row, {"path", "sha256", "size_bytes"}, f"evidence_files[{index}]")
        rows.append({"path": _path(row["path"], "file.path"), "sha256": _sha(row["sha256"], "file.sha256"), "size_bytes": _int(row["size_bytes"], "file.size", 1)})
    if not rows or len(rows) > authority["evidence"]["maximum_file_count"]:
        raise RuntimeEvidenceError("evidence file count is outside authority")
    paths = [str(row["path"]) for row in rows]
    if paths != sorted(paths) or len(paths) != len(set(paths)):
        raise RuntimeEvidenceError("evidence paths must be sorted and unique")
    forbidden = tuple(str(value).casefold() for value in authority["evidence"]["forbidden_suffixes"])
    if any(path.casefold().endswith(forbidden) for path in paths):
        raise RuntimeEvidenceError("forbidden model/archive payload in evidence")
    if not set(_REQUIRED_FILES).issubset(paths):
        raise RuntimeEvidenceError("required semantic evidence files are absent")
    if _root_files(first_root) != set(paths) or _root_files(second_root) != set(paths):
        raise RuntimeEvidenceError("evidence roots differ from declared file set")
    output: dict[str, dict[str, Any]] = {}
    total = 0
    for row in rows:
        relative, size, digest = str(row["path"]), int(row["size_bytes"]), str(row["sha256"])
        if size > authority["evidence"]["maximum_file_size_bytes"]:
            raise RuntimeEvidenceError(f"evidence file exceeds size limit: {relative}")
        first, second = _safe(first_root, relative), _safe(second_root, relative)
        a, b = first.stat(), second.stat()
        if (a.st_dev, a.st_ino) == (b.st_dev, b.st_ino):
            raise RuntimeEvidenceError(f"restored file is not independent: {relative}")
        if a.st_size != size or b.st_size != size or _file_sha(first) != digest or _file_sha(second) != digest:
            raise RuntimeEvidenceError(f"evidence digest or size mismatch: {relative}")
        output[relative] = row
        total += size
    if total > authority["evidence"]["maximum_total_size_bytes"]:
        raise RuntimeEvidenceError("total evidence size exceeds authority")
    return output, total


def _external(root: Path, relative: str) -> dict[str, Any]:
    return load_json(_safe(root.resolve(strict=True), relative))


def _readiness(value: object, authority: dict[str, Any], exact_main: str, measured: datetime) -> None:
    report = _obj(value, "readiness")
    _keys(report, {"schema_version", "status", "ready", "exact_main", "evaluated_at", "authority_sha256", "prerequisite_report_sha256", "gold_corpus_sha256", "gold_assessment_sha256", "required_profiles", "reasons", "benchmark_status", "model_admission_status", "production_operational_status", "report_sha256"}, "readiness")
    _self_digest(report, "report_sha256", "readiness")
    if report["schema_version"] != authority["readiness"]["schema_version"] or report["status"] != "READY_FOR_EXTERNAL_EXECUTION" or report["ready"] is not True or report["reasons"] != []:
        raise RuntimeEvidenceError("readiness is not executable")
    if _commit(report["exact_main"], "readiness.exact_main") != exact_main or report["authority_sha256"] != authority["execution_authority_sha256"] or report["required_profiles"] != list(_PROFILES):
        raise RuntimeEvidenceError("readiness authority binding mismatch")
    for key in ("prerequisite_report_sha256", "gold_corpus_sha256", "gold_assessment_sha256"):
        _sha(report[key], f"readiness.{key}")
    evaluated = _time(report["evaluated_at"], "readiness.evaluated_at")
    if evaluated > measured + timedelta(minutes=5) or measured - evaluated > timedelta(hours=24):
        raise RuntimeEvidenceError("readiness is stale or from the future")
    expected = {key: _MATURITY[key] for key in ("benchmark_status", "model_admission_status", "production_operational_status")}
    _exact({key: report[key] for key in expected}, expected, "readiness maturity")


def _bundles(value: object, authority: dict[str, Any], exact_main: str) -> None:
    report = _obj(value, "bundle_finalization")
    _keys(report, {"schema_version", "status", "verification_status", "source_report_sha256", "authority_sha256", "exact_main", "bundles"}, "bundle_finalization")
    policy = authority["bundle_finalization"]
    if report["schema_version"] != policy["schema_version"] or report["status"] != policy["required_status"] or report["verification_status"] != "VERIFIED" or _commit(report["exact_main"], "bundle.exact_main") != exact_main:
        raise RuntimeEvidenceError("bundle finalization mismatch")
    _sha(report["source_report_sha256"], "bundle.source_report_sha256")
    _sha(report["authority_sha256"], "bundle.authority_sha256")
    profiles = {item["profile_id"]: item for item in authority["runtime_profiles"]}
    rows = _arr(report["bundles"], "bundle_finalization.bundles")
    if len(rows) != 2:
        raise RuntimeEvidenceError("bundle coverage mismatch")
    observed: list[str] = []
    for index, item in enumerate(rows):
        row = _obj(item, f"bundles[{index}]")
        _keys(row, {"profile_id", "model_id", "revision", "object_key", "object_version_id", "bundle_sha256", "bundle_manifest_sha256", "original_restore_root_id", "independent_restore_root_id"}, f"bundles[{index}]")
        profile_id = _identity(row["profile_id"], "bundle.profile_id")
        profile = profiles.get(profile_id)
        if profile is None or row["model_id"] != profile["model_id"] or row["revision"] != profile["revision"]:
            raise RuntimeEvidenceError("bundle identity mismatch")
        _path(row["object_key"], "bundle.object_key")
        _identity(row["object_version_id"], "bundle.object_version_id")
        _sha(row["bundle_sha256"], "bundle.sha256")
        _sha(row["bundle_manifest_sha256"], "bundle.manifest_sha256")
        first = _identity(row["original_restore_root_id"], "bundle.original_root")
        second = _identity(row["independent_restore_root_id"], "bundle.restored_root")
        if first == second:
            raise RuntimeEvidenceError("bundle restore roots are not independent")
        observed.append(profile_id)
    _exact(observed, list(_PROFILES), "bundle ordering")


def _corpus(value: object, authority: dict[str, Any]) -> dict[str, Any]:
    corpus = _obj(value, "corpus")
    _keys(corpus, {"suite_id", "status", "accepted", "assessment_sha256", "corpus_sha256", "case_manifest_path", "case_manifest_sha256", "total_cases", "critical_cases", "locales", "unreviewed_cases"}, "corpus")
    expected = authority["corpus"]
    if corpus["suite_id"] != expected["suite_id"] or corpus["status"] != "ACCEPTED" or corpus["accepted"] is not True or corpus["total_cases"] != 58 or corpus["critical_cases"] != 23 or corpus["locales"] != list(_LOCALES) or corpus["unreviewed_cases"] != 0:
        raise RuntimeEvidenceError("corpus is not accepted or complete")
    for key in ("assessment_sha256", "corpus_sha256", "case_manifest_sha256"):
        _sha(corpus[key], f"corpus.{key}")
    _exact(_path(corpus["case_manifest_path"], "corpus.case_manifest_path"), "suite/case-manifest.json", "case manifest path")
    return corpus


def _case_manifest(root: Path, corpus: dict[str, Any], files: dict[str, dict[str, Any]]) -> tuple[set[str], int]:
    relative = "suite/case-manifest.json"
    manifest = _external(root, relative)
    if files[relative]["sha256"] != corpus["case_manifest_sha256"] or _file_sha(_safe(root, relative)) != corpus["case_manifest_sha256"]:
        raise RuntimeEvidenceError("case manifest digest mismatch")
    _keys(manifest, {"schema_version", "version", "cases"}, "case manifest")
    _exact(manifest["schema_version"], "tai.gold-case-manifest.v1", "case manifest schema")
    rows = _arr(manifest["cases"], "case manifest.cases")
    if len(rows) != 58:
        raise RuntimeEvidenceError("case manifest count mismatch")
    ids: set[str] = set()
    critical = 0
    for index, item in enumerate(rows):
        row = _obj(item, f"cases[{index}]")
        _keys(row, {"case_id", "domain", "criticality", "variant_kind", "prompt_sha256", "case_sha256", "coverage_family_id"}, f"cases[{index}]")
        case_id = _identity(row["case_id"], "case.case_id")
        if case_id in ids:
            raise RuntimeEvidenceError("duplicate case_id")
        ids.add(case_id)
        _sha(row["prompt_sha256"], "case.prompt_sha256")
        _sha(row["case_sha256"], "case.case_sha256")
        _identity(row["coverage_family_id"], "case.coverage_family_id")
        if row["domain"] not in {"PLATFORM", "AGRO"} or row["criticality"] not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
            raise RuntimeEvidenceError("case authority value mismatch")
        critical += int(row["criticality"] == "CRITICAL")
    if critical != 23:
        raise RuntimeEvidenceError("critical case count mismatch")
    return ids, critical


def _basis(errors: int, requests: int) -> int:
    return (errors * 10_000 + requests // 2) // requests


def _runtime_profile(value: object, authority_profile: dict[str, Any], authority: dict[str, Any]) -> dict[str, Any]:
    profile = _obj(value, "runtime profile")
    _keys(profile, {"profile_id", "role", "model_id", "revision", "runtime_class", "quantization", "artifact_sha256", "bundle_manifest_sha256", "host", "toolchain", "concurrency_results", "cold_start_ms", "warmup_ms", "cost_inputs", "metrics_sha256"}, "runtime profile")
    _self_digest(profile, "metrics_sha256", "runtime profile")
    for key in ("profile_id", "role", "model_id", "revision", "runtime_class", "quantization"):
        if profile[key] != authority_profile[key]:
            raise RuntimeEvidenceError(f"runtime profile {key} mismatch")
    _sha(profile["artifact_sha256"], "profile.artifact_sha256")
    _sha(profile["bundle_manifest_sha256"], "profile.bundle_manifest_sha256")
    host = _obj(profile["host"], "host")
    _keys(host, {"host_role", "user", "host_id", "cpu_model", "physical_cores", "logical_cores", "ram_mb", "os_release", "kernel_release", "production_host", "loopback_only"}, "host")
    if host["host_role"] != "DEDICATED_MODEL_HOST" or host["user"] != "tai-model" or host["production_host"] is not False or host["loopback_only"] is not True:
        raise RuntimeEvidenceError("runtime host boundary mismatch")
    for key in ("host_id", "cpu_model", "os_release", "kernel_release"):
        _text(host[key], f"host.{key}", 300)
    for key in ("physical_cores", "logical_cores", "ram_mb"):
        _int(host[key], f"host.{key}", 1)
    toolchain = _obj(profile["toolchain"], "toolchain")
    _keys(toolchain, {"name", "release", "commit", "profile", "acceptance_sha256", "binary_sha256"}, "toolchain")
    for key in ("name", "release", "commit", "profile"):
        if toolchain[key] != authority["toolchain"][key]:
            raise RuntimeEvidenceError("runtime toolchain identity mismatch")
    _sha(toolchain["acceptance_sha256"], "toolchain.acceptance_sha256")
    binaries = _obj(toolchain["binary_sha256"], "toolchain.binary_sha256")
    _keys(binaries, set(authority["toolchain"]["required_binaries"]), "toolchain.binary_sha256")
    for key, digest in binaries.items():
        _sha(digest, f"toolchain.binary_sha256.{key}")
    thresholds = authority_profile["thresholds"]
    results = _arr(profile["concurrency_results"], "concurrency_results")
    if len(results) != 3:
        raise RuntimeEvidenceError("concurrency coverage mismatch")
    observed: list[int] = []
    for index, item in enumerate(results):
        row = _obj(item, f"concurrency_results[{index}]")
        _keys(row, {"concurrency", "sample_count", "request_count", "error_count", "prompt_tokens_per_second_milli", "generation_tokens_per_second_milli", "p50_latency_ms", "p95_latency_ms", "p99_latency_ms", "error_rate_basis_points", "peak_ram_mb"}, f"concurrency_results[{index}]")
        concurrency = _int(row["concurrency"], "concurrency", 1)
        observed.append(concurrency)
        samples = _int(row["sample_count"], "sample_count", 1)
        requests = _int(row["request_count"], "request_count", 1)
        errors = _int(row["error_count"], "error_count")
        if samples < thresholds["minimum_sample_count"] or errors > requests or row["error_rate_basis_points"] != _basis(errors, requests):
            raise RuntimeEvidenceError("runtime sample or error accounting mismatch")
        checks = (
            (row["prompt_tokens_per_second_milli"] >= thresholds["minimum_prompt_tokens_per_second_milli"], "prompt throughput"),
            (row["generation_tokens_per_second_milli"] >= thresholds["minimum_generation_tokens_per_second_milli"], "generation throughput"),
            (row["p95_latency_ms"] <= thresholds["maximum_p95_latency_ms"], "p95 latency"),
            (row["p99_latency_ms"] <= thresholds["maximum_p99_latency_ms"], "p99 latency"),
            (row["error_rate_basis_points"] <= thresholds["maximum_error_rate_basis_points"], "error rate"),
            (row["peak_ram_mb"] <= thresholds["maximum_peak_ram_mb"], "peak RAM"),
        )
        if not all(result for result, _ in checks):
            failed = next(name for result, name in checks if not result)
            if "throughput" in failed:
                raise RuntimeEvidenceError("runtime throughput is below threshold")
            raise RuntimeEvidenceError(f"runtime threshold failed: {failed}")
        for key in ("prompt_tokens_per_second_milli", "generation_tokens_per_second_milli", "p50_latency_ms", "p95_latency_ms", "p99_latency_ms", "error_rate_basis_points", "peak_ram_mb"):
            _int(row[key], f"runtime.{key}")
    _exact(observed, [1, 2, 4], "concurrency ordering")
    if profile["cold_start_ms"] > thresholds["maximum_cold_start_ms"] or profile["warmup_ms"] > thresholds["maximum_warmup_ms"]:
        raise RuntimeEvidenceError("startup threshold failed")
    costs = _obj(profile["cost_inputs"], "cost_inputs")
    _keys(costs, {"currency", "host_monthly_cost_minor", "monthly_hours", "energy_price_minor_per_kwh", "average_power_watts", "pricing_observed_at", "pricing_source_sha256"}, "cost_inputs")
    if costs["currency"] != "RUB":
        raise RuntimeEvidenceError("cost currency must be RUB")
    for key in ("host_monthly_cost_minor", "monthly_hours", "energy_price_minor_per_kwh", "average_power_watts"):
        _int(costs[key], f"cost_inputs.{key}", 1)
    _time(costs["pricing_observed_at"], "cost_inputs.pricing_observed_at")
    _sha(costs["pricing_source_sha256"], "cost_inputs.pricing_source_sha256")
    return profile


def _fallback(value: object, authority: dict[str, Any]) -> dict[str, Any]:
    row = _obj(value, "fallback")
    _keys(row, {"primary_profile_id", "fallback_profile_id", "forced_primary_failure", "trigger_count", "failed_transitions", "p50_takeover_ms", "p95_takeover_ms", "continuity_violations", "metrics_sha256"}, "fallback")
    _self_digest(row, "metrics_sha256", "fallback")
    policy = authority["fallback"]
    if row["primary_profile_id"] != _PROFILES[0] or row["fallback_profile_id"] != _PROFILES[1] or row["forced_primary_failure"] is not True or row["trigger_count"] < policy["minimum_trigger_count"] or row["failed_transitions"] > policy["maximum_failed_transitions"] or row["p95_takeover_ms"] > policy["maximum_p95_takeover_ms"] or row["continuity_violations"] > policy["maximum_continuity_violations"]:
        raise RuntimeEvidenceError("fallback exercise failed")
    for key in ("trigger_count", "failed_transitions", "p50_takeover_ms", "p95_takeover_ms", "continuity_violations"):
        _int(row[key], f"fallback.{key}")
    return row


def _soak(value: object, authority: dict[str, Any]) -> dict[str, Any]:
    row = _obj(value, "soak")
    _keys(row, {"started_at", "completed_at", "duration_seconds", "request_count", "failed_requests", "critical_failures", "memory_start_mb", "memory_end_mb", "memory_drift_mb", "profile_request_counts", "metrics_sha256"}, "soak")
    _self_digest(row, "metrics_sha256", "soak")
    started, completed = _time(row["started_at"], "soak.started_at"), _time(row["completed_at"], "soak.completed_at")
    policy = authority["soak"]
    counts = _obj(row["profile_request_counts"], "soak.profile_request_counts")
    _keys(counts, set(_PROFILES), "soak.profile_request_counts")
    if completed < started or row["duration_seconds"] < policy["minimum_duration_seconds"] or row["request_count"] < policy["minimum_request_count"] or row["failed_requests"] > policy["maximum_failed_requests"] or row["critical_failures"] > policy["maximum_critical_failures"] or row["memory_drift_mb"] > policy["maximum_memory_drift_mb"] or sum(counts.values()) != row["request_count"] or any(not isinstance(value, int) or value < 1 for value in counts.values()):
        raise RuntimeEvidenceError("soak evidence failed")
    if int((completed - started).total_seconds()) < row["duration_seconds"]:
        raise RuntimeEvidenceError("soak duration timestamp mismatch")
    return row


def _storage(value: object, authority: dict[str, Any], evidence_files: object) -> dict[str, Any]:
    row = _obj(value, "storage")
    _keys(row, {"provider", "bucket", "prefix", "evidence_object_version_id", "retention_days", "immutability_status", "original_root_id", "restored_root_id", "restored_at", "evidence_set_sha256", "storage_manifest_sha256"}, "storage")
    _self_digest(row, "storage_manifest_sha256", "storage")
    if row["provider"] != "SELECTEL_S3" or row["immutability_status"] != "IMMUTABLE_VERSIONED" or row["retention_days"] < authority["evidence"]["minimum_external_retention_days"]:
        raise RuntimeEvidenceError("storage is not immutable Selectel S3")
    for key in ("bucket", "prefix", "evidence_object_version_id", "original_root_id", "restored_root_id"):
        _identity(row[key], f"storage.{key}")
    if row["original_root_id"] == row["restored_root_id"]:
        raise RuntimeEvidenceError("storage restore roots are not independent")
    _time(row["restored_at"], "storage.restored_at")
    rows = [item for item in _arr(evidence_files, "evidence_files") if isinstance(item, dict) and item.get("path") != "storage/manifest.json"]
    if row["evidence_set_sha256"] != canonical_sha256(rows):
        raise RuntimeEvidenceError("storage evidence set digest mismatch")
    return row


def _semantic(root: Path, relative: str, expected: dict[str, Any]) -> None:
    if _external(root, relative) != expected:
        raise RuntimeEvidenceError(f"semantic evidence mismatch: {relative}")


def _jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    try:
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                raise RuntimeEvidenceError(f"blank JSONL line: {number}")
            value = json.loads(line, object_pairs_hook=_duplicates)
            if not isinstance(value, dict):
                raise RuntimeEvidenceError(f"JSONL row is not an object: {number}")
            rows.append(value)
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise RuntimeEvidenceError(f"invalid JSONL {path}: {exc}") from exc
    return rows


def _raw(value: object, authority: dict[str, Any], corpus: dict[str, Any], case_ids: set[str], files: dict[str, dict[str, Any]], root: Path) -> int:
    raw = _obj(value, "raw_observations")
    _keys(raw, {"manifest_path", "manifest_file_sha256", "per_profile_counts", "total_count", "case_count", "critical_case_count", "locales", "external_only", "github_payload_exported", "quality_scored"}, "raw_observations")
    if raw["per_profile_counts"] != {_PROFILES[0]: 174, _PROFILES[1]: 174}:
        raise RuntimeEvidenceError("raw observation per-profile count mismatch")
    if raw["manifest_path"] != "raw-observations/manifest.json" or raw["external_only"] is not True or raw["github_payload_exported"] is not False or raw["quality_scored"] is not False or raw["total_count"] != 348 or raw["case_count"] != 58 or raw["critical_case_count"] != 23 or raw["locales"] != list(_LOCALES):
        raise RuntimeEvidenceError("raw observation summary mismatch")
    _sha(raw["manifest_file_sha256"], "raw manifest file digest")
    manifest_file = _safe(root, "raw-observations/manifest.json")
    if _file_sha(manifest_file) != raw["manifest_file_sha256"] or files["raw-observations/manifest.json"]["sha256"] != raw["manifest_file_sha256"]:
        raise RuntimeEvidenceError("raw observation manifest file digest mismatch")
    manifest = load_json(manifest_file)
    _keys(manifest, {"schema_version", "suite_id", "corpus_sha256", "assessment_sha256", "case_manifest_sha256", "locales", "profiles", "total_records", "manifest_sha256"}, "raw manifest")
    _self_digest(manifest, "manifest_sha256", "raw manifest")
    if manifest["schema_version"] != "tai.raw-observation-manifest.v1" or manifest["suite_id"] != corpus["suite_id"] or manifest["corpus_sha256"] != corpus["corpus_sha256"] or manifest["assessment_sha256"] != corpus["assessment_sha256"] or manifest["case_manifest_sha256"] != corpus["case_manifest_sha256"] or manifest["locales"] != list(_LOCALES) or manifest["total_records"] != 348:
        raise RuntimeEvidenceError("raw observation manifest authority mismatch")
    profile_rows = _arr(manifest["profiles"], "raw manifest.profiles")
    if len(profile_rows) != 2:
        raise RuntimeEvidenceError("raw observation profile coverage mismatch")
    coverage: set[tuple[str, str, str]] = set()
    total = 0
    for index, item in enumerate(profile_rows):
        row = _obj(item, f"raw profiles[{index}]")
        _keys(row, {"profile_id", "path", "sha256", "record_count"}, f"raw profiles[{index}]")
        profile_id = _PROFILES[index]
        relative = f"raw-observations/{profile_id}.jsonl"
        if row.get("sha256") != files[relative]["sha256"]:
            raise RuntimeEvidenceError("raw observation payload digest mismatch")
        if row.get("record_count") != 174:
            raise RuntimeEvidenceError("raw observation per-profile count mismatch")
        if row.get("profile_id") != profile_id or row.get("path") != relative:
            raise RuntimeEvidenceError("raw observation payload declaration mismatch")
        records = _jsonl(_safe(root, relative))
        if len(records) != 174:
            raise RuntimeEvidenceError("raw observation JSONL count mismatch")
        for record_index, record in enumerate(records):
            name = f"{relative}[{record_index}]"
            _keys(record, {"schema_version", "profile_id", "case_id", "locale", "prompt", "response", "status", "started_at", "completed_at", "latency_ms", "prompt_sha256", "response_sha256", "record_sha256"}, name)
            if record["schema_version"] != "tai.raw-observation.v1" or record["profile_id"] != profile_id or record["status"] != "SUCCEEDED":
                raise RuntimeEvidenceError("raw observation identity/status mismatch")
            case_id, locale = _identity(record["case_id"], f"{name}.case_id"), _identity(record["locale"], f"{name}.locale")
            if case_id not in case_ids or locale not in _LOCALES or (profile_id, case_id, locale) in coverage:
                raise RuntimeEvidenceError("raw observation coverage mismatch")
            coverage.add((profile_id, case_id, locale))
            prompt, response = _text(record["prompt"], f"{name}.prompt", 8000), _text(record["response"], f"{name}.response", 100000)
            if record["prompt_sha256"] != hashlib.sha256(prompt.encode()).hexdigest() or record["response_sha256"] != hashlib.sha256(response.encode()).hexdigest():
                raise RuntimeEvidenceError("raw observation content digest mismatch")
            started, completed = _time(record["started_at"], f"{name}.started_at"), _time(record["completed_at"], f"{name}.completed_at")
            if completed < started or _int(record["latency_ms"], f"{name}.latency_ms") > authority["generation"]["request_timeout_seconds"] * 1000:
                raise RuntimeEvidenceError("raw observation timing mismatch")
            _self_digest(record, "record_sha256", name)
        total += len(records)
    expected = {(profile, case, locale) for profile in _PROFILES for case in case_ids for locale in _LOCALES}
    if coverage != expected or total != 348:
        raise RuntimeEvidenceError("raw observation Cartesian coverage mismatch")
    return total


def verify_runtime_evidence(authority_path: Path, manifest_path: Path, original_root: Path, restored_root: Path, *, evaluated_at: str) -> dict[str, object]:
    authority = load_runtime_authority(authority_path)
    manifest = load_runtime_manifest(manifest_path)
    now = _time(evaluated_at, "evaluated_at")
    if manifest["lifecycle"] == "PENDING_RUNTIME_EXECUTION":
        report: dict[str, object] = {
            "schema_version": "tai.cpu-runtime-evidence-verification.v1",
            "status": "PENDING_RUNTIME_EXECUTION", "accepted": False,
            "reasons": ["RUNTIME_EXECUTION_NOT_COMPLETE"],
            "authority_sha256": authority["authority_sha256"],
            "execution_authority_sha256": authority["execution_authority_sha256"],
            "manifest_sha256": manifest["manifest_sha256"], "evaluated_at": now.isoformat(),
            **_PENDING_MATURITY,
        }
        report["report_sha256"] = canonical_sha256(report)
        return report
    exact_main = _commit(manifest["exact_main"], "manifest.exact_main")
    if manifest["authority_sha256"] != authority["authority_sha256"] or manifest["execution_authority_sha256"] != authority["execution_authority_sha256"]:
        raise RuntimeEvidenceError("manifest authority digest mismatch")
    measured = _time(manifest["measured_at"], "manifest.measured_at")
    if measured > now + timedelta(minutes=5):
        raise RuntimeEvidenceError("runtime evidence is from the future")
    _exact({key: manifest[key] for key in _MATURITY}, _MATURITY, "complete maturity")
    _readiness(manifest["readiness"], authority, exact_main, measured)
    _bundles(manifest["bundle_finalization"], authority, exact_main)
    corpus = _corpus(manifest["corpus"], authority)
    files, total_size = _files(manifest["evidence_files"], authority, original_root, restored_root)
    original, restored = original_root.resolve(strict=True), restored_root.resolve(strict=True)
    case_ids, _ = _case_manifest(original, corpus, files)
    _case_manifest(restored, corpus, files)
    profile_values = _arr(manifest["runtime_profiles"], "runtime_profiles")
    if len(profile_values) != 2:
        raise RuntimeEvidenceError("runtime profile count mismatch")
    profiles = [_runtime_profile(value, authority["runtime_profiles"][index], authority) for index, value in enumerate(profile_values)]
    for profile in profiles:
        relative = f"runtime/{profile['profile_id']}/metrics.json"
        _semantic(original, relative, profile)
        _semantic(restored, relative, profile)
    if canonical_sha256(profiles[0]["toolchain"]) != canonical_sha256(profiles[1]["toolchain"]):
        raise RuntimeEvidenceError("runtime profiles use different toolchains")
    _semantic(original, "toolchain/manifest.json", profiles[0]["toolchain"])
    _semantic(restored, "toolchain/manifest.json", profiles[0]["toolchain"])
    fallback = _fallback(manifest["fallback_exercise"], authority)
    soak = _soak(manifest["soak"], authority)
    storage = _storage(manifest["storage"], authority, manifest["evidence_files"])
    for root in (original, restored):
        _semantic(root, "fallback/metrics.json", fallback)
        _semantic(root, "soak/metrics.json", soak)
        _semantic(root, "storage/manifest.json", storage)
    count = _raw(manifest["raw_observations"], authority, corpus, case_ids, files, original)
    _raw(manifest["raw_observations"], authority, corpus, case_ids, files, restored)
    report = {
        "schema_version": "tai.cpu-runtime-evidence-verification.v1",
        "status": "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING",
        "accepted": True, "reasons": [], "exact_main": exact_main,
        "authority_sha256": authority["authority_sha256"],
        "execution_authority_sha256": authority["execution_authority_sha256"],
        "manifest_sha256": manifest["manifest_sha256"], "evidence_file_count": len(files),
        "evidence_total_size_bytes": total_size, "runtime_profiles": list(_PROFILES),
        "raw_observation_count": count, "evaluated_at": now.isoformat(), **_MATURITY,
    }
    report["report_sha256"] = canonical_sha256(report)
    return report
