from __future__ import annotations

import hashlib
from pathlib import Path, PurePosixPath
from typing import Any

from tai.cpu_runtime_contract import (
    RuntimeEvidenceError,
    load_authority as load_runtime_authority,
)
from tai.cpu_runtime_evidence import verify_runtime_evidence
from tai.quality_scoring_contract import (
    EXPECTED_MATURITY,
    LOCALES,
    PROFILES,
    VERIFIED_RUNTIME_STATUS,
    QualityScoringError,
    as_array,
    as_bool,
    as_commit,
    as_identity,
    as_int,
    as_object,
    as_sha256,
    as_text,
    canonical_sha256,
    load_json,
    require_keys,
    self_digest,
)

RUNTIME_REPORT_KEYS = {
    "schema_version",
    "status",
    "authority_sha256",
    "manifest_sha256",
    "exact_main",
    "runtime_profiles",
    "raw_observation_count",
    "evidence_file_count",
    "evidence_total_size_bytes",
    "reasons",
    "quality_scoring_status",
    "benchmark_status",
    "model_admission_status",
    "production_operational_status",
    "report_sha256",
}
ASSESSMENT_KEYS = {
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
}
CASE_KEYS = {
    "case_id",
    "domain",
    "criticality",
    "variant_kind",
    "prompt_sha256_by_locale",
    "case_sha256",
    "coverage_family_id",
}
RAW_ENTRY_KEYS = {
    "case_id",
    "locale",
    "profile_id",
    "request_id",
    "prompt_sha256",
    "response_sha256",
    "status",
    "started_at",
    "completed_at",
    "trace_sha256",
}
RAW_PAYLOAD_KEYS = {
    "case_id",
    "locale",
    "profile_id",
    "request_id",
    "prompt",
    "response",
    "status",
    "started_at",
    "completed_at",
    "trace_sha256",
}
OBSERVATION_KEYS = {
    "profile_id",
    "case_id",
    "case_sha256",
    "domain",
    "criticality",
    "locale",
    "prompt_sha256",
    "response_sha256",
    "trace_sha256",
    "terminal_status",
}
ANNOTATION_KEYS = {
    "schema_version",
    "annotation_id",
    "profile_id",
    "case_id",
    "case_sha256",
    "locale",
    "prompt_sha256",
    "response_sha256",
    "trace_sha256",
    "scorer_id",
    "scorer_role",
    "scored_at",
    "evidence_sha256",
    "decision",
    "disposition_valid",
    "required_concepts_met",
    "forbidden_claims_absent",
    "citation_authority_valid",
    "citation_support_valid",
    "citation_freshness_valid",
    "abstention_valid",
    "unsupported_fact_count",
    "safety_failure_count",
    "disagreement_with_annotation_id",
    "annotation_sha256",
}


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_external_file(root: Path, relative: str) -> Path:
    posix = PurePosixPath(relative)
    if (
        posix.is_absolute()
        or not posix.parts
        or any(part in {"", ".", ".."} for part in posix.parts)
        or "\\" in relative
    ):
        raise QualityScoringError("runtime evidence path is unsafe")
    current = root.resolve(strict=True)
    for part in posix.parts:
        current /= part
        if current.is_symlink():
            raise QualityScoringError("runtime evidence symlink is rejected")
    if not current.is_file():
        raise QualityScoringError("runtime evidence file is absent")
    resolved_root = root.resolve(strict=True)
    resolved = current.resolve(strict=True)
    if resolved_root not in resolved.parents:
        raise QualityScoringError("runtime evidence file escapes its root")
    return current


def runtime_report(
    path: Path,
    authority: dict[str, Any],
    runtime_authority_path: Path,
    runtime_manifest_path: Path,
    original_root: Path,
    restored_root: Path,
) -> dict[str, Any]:
    report = load_json(path)
    require_keys(report, RUNTIME_REPORT_KEYS, "runtime verification report")
    self_digest(report, "report_sha256", "runtime verification report")
    plan = as_object(authority["runtime_verification"], "runtime_verification")
    if report["schema_version"] != plan["schema_version"]:
        raise QualityScoringError("runtime verification schema mismatch")
    try:
        runtime_authority = load_runtime_authority(runtime_authority_path)
        reproduced = verify_runtime_evidence(
            runtime_authority_path,
            runtime_manifest_path,
            original_root,
            restored_root,
        )
    except RuntimeEvidenceError as exc:
        raise QualityScoringError(f"runtime evidence re-verification failed: {exc}") from exc
    if report != reproduced:
        raise QualityScoringError("runtime report is not reproduced from immutable evidence")
    if report["authority_sha256"] != runtime_authority["authority_sha256"]:
        raise QualityScoringError("runtime authority digest mismatch")
    if report["status"] != VERIFIED_RUNTIME_STATUS or report["reasons"] != []:
        raise QualityScoringError("runtime evidence is not verified")
    exact_main = as_commit(report["exact_main"], "runtime.exact_main")
    as_sha256(report["manifest_sha256"], "runtime.manifest_sha256")
    profiles = as_object(report["runtime_profiles"], "runtime.runtime_profiles")
    if profiles != {profile: "MEASURED" for profile in PROFILES}:
        raise QualityScoringError("runtime profile verification is incomplete")
    required_count = as_int(
        plan["required_raw_observation_count"],
        "runtime_verification.required_raw_observation_count",
        minimum=1,
    )
    if as_int(report["raw_observation_count"], "runtime.raw_count") != required_count:
        raise QualityScoringError("runtime raw observation count mismatch")
    if as_array(report["reasons"], "runtime.reasons"):
        raise QualityScoringError("runtime report contains blockers")
    maturity = {
        "benchmark_status": report["benchmark_status"],
        "model_admission_status": report["model_admission_status"],
        "production_operational_status": report["production_operational_status"],
    }
    if report["quality_scoring_status"] != "PENDING_QUALITY_SCORING":
        raise QualityScoringError("runtime report quality status is invalid")
    if maturity != EXPECTED_MATURITY:
        raise QualityScoringError("runtime report maturity boundary is invalid")
    return {**report, "exact_main": exact_main}


def accepted_assessment(path: Path, authority: dict[str, Any]) -> dict[str, Any]:
    assessment = load_json(path)
    require_keys(assessment, ASSESSMENT_KEYS, "accepted AP-14C assessment")
    self_digest(assessment, "assessment_sha256", "accepted AP-14C assessment")
    corpus_plan = as_object(authority["corpus"], "authority.corpus")
    if assessment["schema_version"] != corpus_plan["assessment_schema"]:
        raise QualityScoringError("AP-14C assessment schema mismatch")
    if (
        assessment["status"] != corpus_plan["required_assessment_status"]
        or as_bool(assessment["accepted"], "assessment.accepted") is not True
    ):
        raise QualityScoringError("AP-14C assessment is not accepted")
    as_text(assessment["version"], "assessment.version")
    as_sha256(assessment["corpus_sha256"], "assessment.corpus_sha256")
    components = as_object(assessment["component_sha256"], "assessment.component_sha256")
    require_keys(
        components,
        {"platform_sha256", "agro_sha256", "coverage_sha256", "reviews_sha256"},
        "assessment.component_sha256",
    )
    for key, value in components.items():
        as_sha256(value, f"assessment.component_sha256.{key}")
    counts = as_object(assessment["counts"], "assessment.counts")
    require_keys(
        counts,
        {
            "platform_cases",
            "agro_cases",
            "total_cases",
            "critical_cases",
            "reviewed_cases",
            "unreviewed_cases",
            "platform_roles",
            "deal_states",
            "agro_topics",
            "locales",
        },
        "assessment.counts",
    )
    expected_counts = {
        "platform_cases": corpus_plan["required_platform_cases"],
        "agro_cases": corpus_plan["required_agro_cases"],
        "total_cases": corpus_plan["required_total_cases"],
        "critical_cases": corpus_plan["required_critical_cases"],
        "reviewed_cases": corpus_plan["required_total_cases"],
        "unreviewed_cases": 0,
        "locales": len(LOCALES),
    }
    for key, expected in expected_counts.items():
        if as_int(counts[key], f"assessment.counts.{key}") != expected:
            raise QualityScoringError("AP-14C assessment coverage mismatch")
    for key in ("platform_roles", "deal_states", "agro_topics"):
        as_int(counts[key], f"assessment.counts.{key}", minimum=1)
    targets = as_object(assessment["quality_targets"], "assessment.quality_targets")
    require_keys(
        targets,
        {
            "platform_accuracy_minimum",
            "agro_accuracy_minimum",
            "critical_unsupported_facts_maximum",
            "citation_validity_minimum",
        },
        "assessment.quality_targets",
    )
    if targets != {
        "platform_accuracy_minimum": 0.95,
        "agro_accuracy_minimum": 0.9,
        "critical_unsupported_facts_maximum": 0,
        "citation_validity_minimum": 1,
    }:
        raise QualityScoringError("AP-14C assessment quality targets mismatch")
    if as_array(assessment["blocking_reasons"], "assessment.blocking_reasons"):
        raise QualityScoringError("AP-14C assessment has blocking reasons")
    if as_array(
        assessment["missing_review_case_ids"], "assessment.missing_review_case_ids"
    ):
        raise QualityScoringError("AP-14C assessment has missing review cases")
    return assessment


def case_manifest(
    path: Path,
    authority: dict[str, Any],
    assessment: dict[str, Any],
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    manifest = load_json(path)
    require_keys(
        manifest,
        {
            "schema_version",
            "version",
            "corpus_sha256",
            "assessment_sha256",
            "cases",
            "manifest_sha256",
        },
        "case manifest",
    )
    self_digest(manifest, "manifest_sha256", "case manifest")
    if manifest["schema_version"] != "tai.gold-case-manifest.v1":
        raise QualityScoringError("case manifest schema mismatch")
    if manifest["version"] != assessment["version"]:
        raise QualityScoringError("case manifest version mismatch")
    if manifest["corpus_sha256"] != assessment["corpus_sha256"]:
        raise QualityScoringError("case manifest corpus digest mismatch")
    if manifest["assessment_sha256"] != assessment["assessment_sha256"]:
        raise QualityScoringError("case manifest assessment digest mismatch")
    cases = as_array(manifest["cases"], "case manifest.cases")
    plan = as_object(authority["corpus"], "authority.corpus")
    if len(cases) != plan["required_total_cases"]:
        raise QualityScoringError("case manifest count mismatch")
    result: dict[str, dict[str, Any]] = {}
    domains = {"PLATFORM": 0, "AGRO": 0}
    critical = 0
    for index, item in enumerate(cases):
        case = as_object(item, f"cases[{index}]")
        require_keys(case, CASE_KEYS, f"cases[{index}]")
        case_id = as_identity(case["case_id"], "case_id")
        if case_id in result:
            raise QualityScoringError("duplicate case_id")
        domain = as_text(case["domain"], "domain")
        if domain not in domains:
            raise QualityScoringError("case domain is invalid")
        criticality = as_text(case["criticality"], "criticality")
        if criticality not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
            raise QualityScoringError("case criticality is invalid")
        prompt_map = as_object(
            case["prompt_sha256_by_locale"], "case.prompt_sha256_by_locale"
        )
        require_keys(prompt_map, set(LOCALES), "case.prompt_sha256_by_locale")
        normalized_prompts = {
            locale: as_sha256(prompt_map[locale], f"case.prompt_sha256.{locale}")
            for locale in LOCALES
        }
        as_sha256(case["case_sha256"], "case.case_sha256")
        as_identity(case["coverage_family_id"], "case.coverage_family_id")
        domains[domain] += 1
        critical += int(criticality == "CRITICAL")
        result[case_id] = {**case, "prompt_sha256_by_locale": normalized_prompts}
    if domains != {
        "PLATFORM": plan["required_platform_cases"],
        "AGRO": plan["required_agro_cases"],
    }:
        raise QualityScoringError("case domain counts mismatch")
    if critical != plan["required_critical_cases"]:
        raise QualityScoringError("critical case count mismatch")
    return result, manifest


def _runtime_file_record(
    runtime_manifest: dict[str, Any], relative: str
) -> dict[str, Any]:
    records = as_array(runtime_manifest["evidence_files"], "runtime.evidence_files")
    matches: list[dict[str, Any]] = []
    for index, item in enumerate(records):
        record = as_object(item, f"runtime.evidence_files[{index}]")
        require_keys(record, {"path", "sha256", "size_bytes"}, "runtime evidence file")
        if record["path"] == relative:
            matches.append(record)
    if len(matches) != 1:
        raise QualityScoringError("runtime raw evidence declaration is not unique")
    return matches[0]


def _verified_runtime_source(
    runtime_manifest_path: Path,
    original_root: Path,
    runtime: dict[str, Any],
    assessment: dict[str, Any],
) -> tuple[dict[str, Any], Path, Path, str, str]:
    runtime_manifest = load_json(runtime_manifest_path)
    if canonical_sha256(runtime_manifest) != runtime["manifest_sha256"]:
        raise QualityScoringError("runtime manifest digest mismatch")
    if runtime_manifest.get("lifecycle") != "COMPLETE":
        raise QualityScoringError("runtime manifest is not complete")
    if as_commit(
        runtime_manifest.get("exact_main"), "runtime manifest exact_main"
    ) != runtime["exact_main"]:
        raise QualityScoringError("runtime manifest exact-main mismatch")
    corpus = as_object(runtime_manifest.get("corpus"), "runtime manifest corpus")
    if (
        corpus.get("status") != "ACCEPTED"
        or corpus.get("accepted") is not True
        or corpus.get("assessment_sha256") != assessment["assessment_sha256"]
        or corpus.get("corpus_sha256") != assessment["corpus_sha256"]
    ):
        raise QualityScoringError("runtime corpus is not bound to accepted AP-14C")
    raw_info = as_object(
        runtime_manifest.get("raw_observations"), "runtime raw observations"
    )
    require_keys(
        raw_info,
        {"manifest_path", "payload_path", "observation_count"},
        "runtime raw observations",
    )
    manifest_relative = as_text(raw_info["manifest_path"], "raw manifest path")
    payload_relative = as_text(raw_info["payload_path"], "raw payload path")
    if (
        manifest_relative != "raw-observations/manifest.json"
        or payload_relative != "raw-observations/payload.json"
        or as_int(raw_info["observation_count"], "raw observation count") != 348
    ):
        raise QualityScoringError("runtime raw observation locator mismatch")
    manifest_record = _runtime_file_record(runtime_manifest, manifest_relative)
    payload_record = _runtime_file_record(runtime_manifest, payload_relative)
    manifest_file = _safe_external_file(original_root, manifest_relative)
    payload_file = _safe_external_file(original_root, payload_relative)
    for file_path, record, name in (
        (manifest_file, manifest_record, "raw manifest"),
        (payload_file, payload_record, "raw payload"),
    ):
        if (
            _file_sha256(file_path) != as_sha256(record["sha256"], f"{name}.sha256")
            or file_path.stat().st_size
            != as_int(record["size_bytes"], f"{name}.size", minimum=1)
        ):
            raise QualityScoringError(f"{name} no longer matches verified runtime evidence")
    return (
        runtime_manifest,
        manifest_file,
        payload_file,
        str(manifest_record["sha256"]),
        str(payload_record["sha256"]),
    )


def observation_index(
    runtime_manifest_path: Path,
    original_root: Path,
    runtime: dict[str, Any],
    assessment: dict[str, Any],
    cases: dict[str, dict[str, Any]],
) -> tuple[dict[tuple[str, str, str], dict[str, Any]], dict[str, Any]]:
    (
        _,
        raw_manifest_path,
        raw_payload_path,
        raw_manifest_sha256,
        raw_payload_sha256,
    ) = _verified_runtime_source(
        runtime_manifest_path,
        original_root,
        runtime,
        assessment,
    )
    raw_manifest = load_json(raw_manifest_path)
    require_keys(
        raw_manifest,
        {"schema_version", "suite_id", "profile_ids", "entries"},
        "verified raw observation manifest",
    )
    if raw_manifest["schema_version"] != "tai.raw-model-observations.v1":
        raise QualityScoringError("verified raw observation manifest schema mismatch")
    if raw_manifest["suite_id"] != "tai-platform-agro-58-v1":
        raise QualityScoringError("verified raw observation suite mismatch")
    if raw_manifest["profile_ids"] != list(PROFILES):
        raise QualityScoringError("verified raw observation profile order mismatch")
    payload = load_json(raw_payload_path)
    require_keys(
        payload,
        {"schema_version", "suite_id", "entries"},
        "verified raw observation payload",
    )
    if payload["schema_version"] != "tai.raw-model-observation-payload.v1":
        raise QualityScoringError("verified raw payload schema mismatch")
    if payload["suite_id"] != raw_manifest["suite_id"]:
        raise QualityScoringError("verified raw payload suite mismatch")
    payload_rows: dict[tuple[str, str, str], dict[str, Any]] = {}
    for number, item in enumerate(as_array(payload["entries"], "raw payload entries")):
        row = as_object(item, f"raw payload entries[{number}]")
        require_keys(row, RAW_PAYLOAD_KEYS, f"raw payload entries[{number}]")
        key = (
            as_identity(row["profile_id"], "payload.profile_id"),
            as_identity(row["case_id"], "payload.case_id"),
            as_identity(row["locale"], "payload.locale"),
        )
        if key in payload_rows:
            raise QualityScoringError("verified raw payload contains a duplicate")
        payload_rows[key] = row
    observations: dict[tuple[str, str, str], dict[str, Any]] = {}
    rows = as_array(raw_manifest["entries"], "raw observation entries")
    if len(rows) != 348 or len(payload_rows) != 348:
        raise QualityScoringError("verified raw observation count mismatch")
    for number, item in enumerate(rows):
        row = as_object(item, f"raw observation entries[{number}]")
        require_keys(row, RAW_ENTRY_KEYS, f"raw observation entries[{number}]")
        profile = as_identity(row["profile_id"], "observation.profile_id")
        case_id = as_identity(row["case_id"], "observation.case_id")
        locale = as_identity(row["locale"], "observation.locale")
        key = (profile, case_id, locale)
        case = cases.get(case_id)
        payload_row = payload_rows.get(key)
        if (
            profile not in PROFILES
            or locale not in LOCALES
            or case is None
            or payload_row is None
            or key in observations
        ):
            raise QualityScoringError("verified observation Cartesian identity mismatch")
        for field in (
            "request_id",
            "status",
            "started_at",
            "completed_at",
            "trace_sha256",
        ):
            if payload_row[field] != row[field]:
                raise QualityScoringError("raw payload metadata differs from raw manifest")
        prompt = as_text(payload_row["prompt"], "payload.prompt")
        response = payload_row["response"]
        if not isinstance(response, str):
            raise QualityScoringError("payload.response must be a string")
        prompt_sha = as_sha256(row["prompt_sha256"], "observation.prompt_sha256")
        response_sha = as_sha256(row["response_sha256"], "observation.response_sha256")
        trace_sha = as_sha256(row["trace_sha256"], "observation.trace_sha256")
        if hashlib.sha256(prompt.encode()).hexdigest() != prompt_sha:
            raise QualityScoringError("raw payload prompt digest mismatch")
        if hashlib.sha256(response.encode()).hexdigest() != response_sha:
            raise QualityScoringError("raw payload response digest mismatch")
        if prompt_sha != case["prompt_sha256_by_locale"][locale]:
            raise QualityScoringError("observation prompt is not bound to case authority")
        status = as_text(row["status"], "observation.status")
        if status not in {"ANSWERED", "ABSTAINED", "REJECTED"}:
            raise QualityScoringError("observation terminal status is not scoreable")
        observations[key] = {
            "profile_id": profile,
            "case_id": case_id,
            "case_sha256": case["case_sha256"],
            "domain": case["domain"],
            "criticality": case["criticality"],
            "locale": locale,
            "prompt_sha256": prompt_sha,
            "response_sha256": response_sha,
            "trace_sha256": trace_sha,
            "terminal_status": status,
        }
    expected = {
        (profile, case_id, locale)
        for profile in PROFILES
        for case_id in cases
        for locale in LOCALES
    }
    if set(observations) != expected or set(payload_rows) != expected:
        raise QualityScoringError("verified observation Cartesian coverage mismatch")
    ordered = [observations[key] for key in sorted(observations)]
    index: dict[str, Any] = {
        "schema_version": "tai.quality-observation-index.v2",
        "exact_main": runtime["exact_main"],
        "runtime_report_sha256": runtime["report_sha256"],
        "runtime_manifest_sha256": runtime["manifest_sha256"],
        "runtime_authority_sha256": runtime["authority_sha256"],
        "raw_manifest_sha256": raw_manifest_sha256,
        "raw_payload_sha256": raw_payload_sha256,
        "corpus_sha256": assessment["corpus_sha256"],
        "assessment_sha256": assessment["assessment_sha256"],
        "observations": ordered,
    }
    index["index_sha256"] = canonical_sha256(index)
    return observations, index
