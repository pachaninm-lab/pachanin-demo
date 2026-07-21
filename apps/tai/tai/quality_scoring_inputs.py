from __future__ import annotations

from pathlib import Path
from typing import Any

from tai.quality_scoring_contract import (
    EXPECTED_MATURITY,
    LOCALES,
    PROFILES,
    VERIFIED_RUNTIME_STATUS,
    QualityScoringError,
    as_array,
    as_commit,
    as_identity,
    as_int,
    as_object,
    as_sha256,
    as_text,
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
CASE_KEYS = {
    "case_id",
    "domain",
    "criticality",
    "variant_kind",
    "prompt_sha256",
    "case_sha256",
    "coverage_family_id",
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


def _basis(passed: int, total: int) -> int:
    return (passed * 10_000 + total // 2) // total


def runtime_report(path: Path, authority: dict[str, Any]) -> dict[str, Any]:
    report = load_json(path)
    require_keys(report, RUNTIME_REPORT_KEYS, "runtime verification report")
    self_digest(report, "report_sha256", "runtime verification report")
    plan = authority["runtime_verification"]
    if report["schema_version"] != plan["schema_version"]:
        raise QualityScoringError("runtime verification schema mismatch")
    if report["status"] != VERIFIED_RUNTIME_STATUS or report["reasons"] != []:
        raise QualityScoringError("runtime evidence is not verified")
    exact_main = as_commit(report["exact_main"], "runtime.exact_main")
    as_sha256(report["authority_sha256"], "runtime.authority_sha256")
    as_sha256(report["manifest_sha256"], "runtime.manifest_sha256")
    profiles = as_object(report["runtime_profiles"], "runtime.runtime_profiles")
    if profiles != {profile: "MEASURED" for profile in PROFILES}:
        raise QualityScoringError("runtime profile verification is incomplete")
    if as_int(report["raw_observation_count"], "runtime.raw_count") != 348:
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


def case_manifest(path: Path, authority: dict[str, Any]) -> dict[str, dict[str, Any]]:
    manifest = load_json(path)
    require_keys(manifest, {"schema_version", "version", "cases"}, "case manifest")
    if manifest["schema_version"] != "tai.gold-case-manifest.v1":
        raise QualityScoringError("case manifest schema mismatch")
    cases = as_array(manifest["cases"], "case manifest.cases")
    plan = authority["corpus"]
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
        as_sha256(case["prompt_sha256"], "case.prompt_sha256")
        as_sha256(case["case_sha256"], "case.case_sha256")
        as_identity(case["coverage_family_id"], "case.coverage_family_id")
        domains[domain] += 1
        critical += int(criticality == "CRITICAL")
        result[case_id] = dict(case)
    if domains != {
        "PLATFORM": plan["required_platform_cases"],
        "AGRO": plan["required_agro_cases"],
    }:
        raise QualityScoringError("case domain counts mismatch")
    if critical != plan["required_critical_cases"]:
        raise QualityScoringError("critical case count mismatch")
    return result


def observation_index(
    path: Path,
    runtime: dict[str, Any],
    cases: dict[str, dict[str, Any]],
) -> tuple[dict[tuple[str, str, str], dict[str, Any]], dict[str, Any]]:
    index = load_json(path)
    require_keys(
        index,
        {
            "schema_version",
            "exact_main",
            "runtime_report_sha256",
            "corpus_sha256",
            "assessment_sha256",
            "observations",
            "index_sha256",
        },
        "observation index",
    )
    self_digest(index, "index_sha256", "observation index")
    if index["schema_version"] != "tai.quality-observation-index.v1":
        raise QualityScoringError("observation index schema mismatch")
    if as_commit(index["exact_main"], "index.exact_main") != runtime["exact_main"]:
        raise QualityScoringError("observation index exact-main mismatch")
    if index["runtime_report_sha256"] != runtime["report_sha256"]:
        raise QualityScoringError("observation index runtime binding mismatch")
    as_sha256(index["corpus_sha256"], "index.corpus_sha256")
    as_sha256(index["assessment_sha256"], "index.assessment_sha256")
    rows = as_array(index["observations"], "index.observations")
    if len(rows) != 348:
        raise QualityScoringError("observation index count mismatch")
    result: dict[tuple[str, str, str], dict[str, Any]] = {}
    for number, item in enumerate(rows):
        row = as_object(item, f"observations[{number}]")
        require_keys(row, OBSERVATION_KEYS, f"observations[{number}]")
        profile = as_identity(row["profile_id"], "observation.profile_id")
        case_id = as_identity(row["case_id"], "observation.case_id")
        locale = as_identity(row["locale"], "observation.locale")
        key = (profile, case_id, locale)
        case = cases.get(case_id)
        if profile not in PROFILES or locale not in LOCALES or case is None or key in result:
            raise QualityScoringError("observation Cartesian identity mismatch")
        if (
            row["case_sha256"] != case["case_sha256"]
            or row["domain"] != case["domain"]
            or row["criticality"] != case["criticality"]
        ):
            raise QualityScoringError("observation case authority mismatch")
        for field in ("case_sha256", "prompt_sha256", "response_sha256", "trace_sha256"):
            as_sha256(row[field], f"observation.{field}")
        status = as_text(row["terminal_status"], "observation.terminal_status")
        if status not in {"ANSWERED", "ABSTAINED", "REJECTED"}:
            raise QualityScoringError("observation terminal status is invalid")
        result[key] = dict(row)
    expected = {
        (profile, case_id, locale)
        for profile in PROFILES
        for case_id in cases
        for locale in LOCALES
    }
    if set(result) != expected:
        raise QualityScoringError("observation Cartesian coverage mismatch")
    return result, index
