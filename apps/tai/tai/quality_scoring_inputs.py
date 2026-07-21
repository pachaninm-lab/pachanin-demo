from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from tai.quality_scoring_contract import (
    EXPECTED_RUNTIME_MATURITY,
    LOCALES,
    PROFILES,
    VERIFIED_RUNTIME_STATUS,
    QualityScoringError,
    as_array,
    as_bool,
    as_commit,
    as_identity,
    as_int,
    as_number,
    as_object,
    as_relative_path,
    as_sha256,
    as_text,
    as_timestamp,
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
RUNTIME_MANIFEST_KEYS = {
    "schema_version",
    "lifecycle",
    "pending_reason",
    "exact_main",
    "readiness",
    "bundle_finalization",
    "corpus",
    "runtime_profiles",
    "fallback_exercise",
    "soak",
    "raw_observations",
    "evidence_files",
    "storage",
    "measured_at",
    "quality_scoring_status",
    "benchmark_status",
    "model_admission_status",
    "production_operational_status",
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
CASE_AUTHORITY_KEYS = {
    "schema_version",
    "exact_main",
    "suite_id",
    "assessment_sha256",
    "corpus_sha256",
    "counts",
    "locales",
    "cases",
    "authority_sha256",
}
CASE_KEYS = {
    "case_id",
    "domain",
    "criticality",
    "variant_kind",
    "prompt_sha256_by_locale",
    "expected_statuses",
    "required_concepts",
    "forbidden_claims",
    "expected_citations",
    "abstention_reason_codes",
    "coverage_family_id",
    "case_sha256",
}
RUNTIME_CASE_MANIFEST_KEYS = {
    "schema_version",
    "suite_id",
    "assessment_sha256",
    "corpus_sha256",
    "locales",
    "cases",
}
RUNTIME_RAW_MANIFEST_KEYS = {"schema_version", "suite_id", "profile_ids", "entries"}
RUNTIME_RAW_ENTRY_KEYS = {
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
RUNTIME_RAW_PAYLOAD_KEYS = {"schema_version", "suite_id", "entries"}
RUNTIME_PAYLOAD_ENTRY_KEYS = {
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
RUNTIME_FILE_KEYS = {"path", "sha256", "size_bytes"}


def _maturity(value: dict[str, Any], expected: dict[str, str], name: str) -> None:
    if {key: value[key] for key in expected} != expected:
        raise QualityScoringError(f"{name} maturity boundary is invalid")


def load_runtime_report(path: Path, authority: dict[str, Any]) -> dict[str, Any]:
    report = load_json(path)
    require_keys(report, RUNTIME_REPORT_KEYS, "runtime verification report")
    self_digest(report, "report_sha256", "runtime verification report")
    plan = as_object(authority["runtime_input"], "authority.runtime_input")
    if report["schema_version"] != plan["verification_schema"]:
        raise QualityScoringError("runtime verification schema mismatch")
    if report["status"] != VERIFIED_RUNTIME_STATUS or report["reasons"] != []:
        raise QualityScoringError("runtime evidence is not verified")
    exact_main = as_commit(report["exact_main"], "runtime.exact_main")
    for field in ("authority_sha256", "manifest_sha256"):
        as_sha256(report[field], f"runtime.{field}")
    profiles = as_object(report["runtime_profiles"], "runtime.runtime_profiles")
    if profiles != {profile: "MEASURED" for profile in PROFILES}:
        raise QualityScoringError("runtime profile verification is incomplete")
    if as_int(report["raw_observation_count"], "runtime.raw_count") != 348:
        raise QualityScoringError("runtime raw observation count mismatch")
    as_int(report["evidence_file_count"], "runtime.evidence_file_count", minimum=1)
    as_int(
        report["evidence_total_size_bytes"],
        "runtime.evidence_total_size_bytes",
        minimum=1,
    )
    _maturity(report, EXPECTED_RUNTIME_MATURITY, "runtime report")
    return {**report, "exact_main": exact_main}


def _runtime_file_records(value: object) -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    for index, raw in enumerate(as_array(value, "runtime evidence_files")):
        row = as_object(raw, f"runtime evidence_files[{index}]")
        require_keys(row, RUNTIME_FILE_KEYS, f"runtime evidence_files[{index}]")
        path = as_relative_path(row["path"], f"runtime evidence_files[{index}].path")
        if path in records:
            raise QualityScoringError("duplicate runtime evidence path")
        records[path] = {
            "path": path,
            "sha256": as_sha256(row["sha256"], "runtime evidence sha256"),
            "size_bytes": as_int(row["size_bytes"], "runtime evidence size", minimum=1),
        }
    return records


def load_runtime_manifest(
    path: Path,
    report: dict[str, Any],
    authority: dict[str, Any],
    evaluated_at: datetime,
) -> dict[str, Any]:
    manifest = load_json(path)
    require_keys(manifest, RUNTIME_MANIFEST_KEYS, "runtime manifest")
    plan = as_object(authority["runtime_input"], "authority.runtime_input")
    if manifest["schema_version"] != plan["manifest_schema"]:
        raise QualityScoringError("runtime manifest schema mismatch")
    if manifest["lifecycle"] != "COMPLETE" or manifest["pending_reason"] is not None:
        raise QualityScoringError("runtime manifest is not complete")
    if canonical_sha256(manifest) != report["manifest_sha256"]:
        raise QualityScoringError("runtime manifest digest does not match report")
    exact_main = as_commit(manifest["exact_main"], "runtime manifest exact_main")
    if exact_main != report["exact_main"]:
        raise QualityScoringError("runtime manifest exact-main mismatch")
    measured_at = as_timestamp(manifest["measured_at"], "runtime manifest measured_at")
    if measured_at > evaluated_at + timedelta(minutes=5):
        raise QualityScoringError("runtime manifest is from the future")
    if evaluated_at - measured_at > timedelta(days=int(plan["maximum_age_days"])):
        raise QualityScoringError("runtime manifest is stale")

    readiness = as_object(manifest["readiness"], "runtime readiness")
    require_keys(
        readiness,
        {
            "schema_version",
            "status",
            "ready",
            "exact_main",
            "evaluated_at",
            "report_sha256",
            "simulated",
        },
        "runtime readiness",
    )
    if (
        readiness["schema_version"] != "tai.cpu-benchmark-execution-readiness.v1"
        or readiness["status"] != "READY_FOR_EXTERNAL_EXECUTION"
        or not as_bool(readiness["ready"], "runtime readiness.ready")
        or as_commit(readiness["exact_main"], "runtime readiness exact_main")
        != exact_main
        or as_bool(readiness["simulated"], "runtime readiness.simulated")
    ):
        raise QualityScoringError("runtime readiness is not accepted")
    as_sha256(readiness["report_sha256"], "runtime readiness report_sha256")
    readiness_at = as_timestamp(readiness["evaluated_at"], "runtime readiness time")
    if readiness_at > measured_at + timedelta(minutes=5):
        raise QualityScoringError("runtime readiness is from the future")

    corpus = as_object(manifest["corpus"], "runtime corpus")
    require_keys(
        corpus,
        {
            "suite_id",
            "status",
            "accepted",
            "assessment_sha256",
            "corpus_sha256",
            "total_cases",
            "critical_cases",
            "locales",
            "unreviewed_cases",
            "case_manifest_path",
            "raw_observation_count",
        },
        "runtime corpus",
    )
    if (
        corpus["suite_id"] != "tai-platform-agro-58-v1"
        or corpus["status"] != "ACCEPTED"
        or not as_bool(corpus["accepted"], "runtime corpus.accepted")
        or as_int(corpus["total_cases"], "runtime corpus total") != 58
        or as_int(corpus["critical_cases"], "runtime corpus critical") != 23
        or corpus["locales"] != list(LOCALES)
        or as_int(corpus["unreviewed_cases"], "runtime corpus unreviewed") != 0
        or as_int(corpus["raw_observation_count"], "runtime corpus raw count") != 348
    ):
        raise QualityScoringError("runtime corpus is not accepted")
    as_sha256(corpus["assessment_sha256"], "runtime corpus assessment")
    as_sha256(corpus["corpus_sha256"], "runtime corpus digest")
    case_manifest_path = as_relative_path(
        corpus["case_manifest_path"], "runtime corpus case_manifest_path"
    )

    profiles = as_array(manifest["runtime_profiles"], "runtime profiles")
    profile_ids = []
    for index, raw_profile in enumerate(profiles):
        profile = as_object(raw_profile, f"runtime profiles[{index}]")
        profile_ids.append(as_identity(profile.get("profile_id"), "runtime profile_id"))
    if profile_ids != list(PROFILES):
        raise QualityScoringError("runtime manifest profile set mismatch")

    raw = as_object(manifest["raw_observations"], "runtime raw observations")
    require_keys(
        raw, {"manifest_path", "payload_path", "observation_count"}, "runtime raw"
    )
    raw_manifest_path = as_relative_path(
        raw["manifest_path"], "runtime raw manifest_path"
    )
    raw_payload_path = as_relative_path(raw["payload_path"], "runtime raw payload_path")
    if as_int(raw["observation_count"], "runtime raw count") != 348:
        raise QualityScoringError("runtime raw observation count mismatch")

    records = _runtime_file_records(manifest["evidence_files"])
    for required in (case_manifest_path, raw_manifest_path, raw_payload_path):
        if required not in records:
            raise QualityScoringError(
                f"runtime semantic file is undeclared: {required}"
            )
    if len(records) != report["evidence_file_count"]:
        raise QualityScoringError("runtime report evidence file count mismatch")
    if (
        sum(int(row["size_bytes"]) for row in records.values())
        != report["evidence_total_size_bytes"]
    ):
        raise QualityScoringError("runtime report evidence size mismatch")
    _maturity(manifest, EXPECTED_RUNTIME_MATURITY, "runtime manifest")
    return {
        **manifest,
        "exact_main": exact_main,
        "measured_at": measured_at,
        "corpus": corpus,
        "runtime_file_records": records,
        "case_manifest_path": case_manifest_path,
        "raw_manifest_path": raw_manifest_path,
        "raw_payload_path": raw_payload_path,
    }


def load_assessment(path: Path, authority: dict[str, Any]) -> dict[str, Any]:
    value = load_json(path)
    require_keys(value, ASSESSMENT_KEYS, "accepted AP-14C assessment")
    self_digest(value, "assessment_sha256", "accepted AP-14C assessment")
    plan = as_object(authority["assessment"], "authority.assessment")
    if (
        value["schema_version"] != plan["schema_version"]
        or value["status"] != plan["required_status"]
        or as_bool(value["accepted"], "assessment.accepted")
        is not plan["required_accepted"]
    ):
        raise QualityScoringError("AP-14C assessment is not accepted")
    as_text(value["version"], "assessment.version")
    as_sha256(value["corpus_sha256"], "assessment.corpus_sha256")
    components = as_object(value["component_sha256"], "assessment components")
    require_keys(
        components,
        {"platform_sha256", "agro_sha256", "coverage_sha256", "reviews_sha256"},
        "assessment components",
    )
    for key, component in components.items():
        as_sha256(component, f"assessment component {key}")
    counts = as_object(value["counts"], "assessment counts")
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
        "assessment counts",
    )
    expected_counts = {
        "platform_cases": plan["required_platform_cases"],
        "agro_cases": plan["required_agro_cases"],
        "total_cases": plan["required_total_cases"],
        "critical_cases": plan["required_critical_cases"],
        "reviewed_cases": plan["required_reviewed_cases"],
        "unreviewed_cases": plan["required_unreviewed_cases"],
        "locales": plan["required_locales"],
    }
    for key, expected in expected_counts.items():
        if as_int(counts[key], f"assessment counts {key}") != expected:
            raise QualityScoringError(f"assessment count mismatch: {key}")
    for key in ("platform_roles", "deal_states", "agro_topics"):
        as_int(counts[key], f"assessment counts {key}", minimum=1)
    targets = as_object(value["quality_targets"], "assessment targets")
    require_keys(
        targets,
        {
            "platform_accuracy_minimum",
            "agro_accuracy_minimum",
            "critical_unsupported_facts_maximum",
            "citation_validity_minimum",
        },
        "assessment targets",
    )
    if (
        as_number(targets["platform_accuracy_minimum"], "platform target") != 0.95
        or as_number(targets["agro_accuracy_minimum"], "agro target") != 0.9
        or as_int(
            targets["critical_unsupported_facts_maximum"],
            "critical unsupported target",
        )
        != 0
        or as_number(targets["citation_validity_minimum"], "citation target") != 1.0
    ):
        raise QualityScoringError("assessment quality targets mismatch")
    if value["blocking_reasons"] != [] or value["missing_review_case_ids"] != []:
        raise QualityScoringError("assessment still contains review blockers")
    return value


def _case_digest(case: dict[str, Any]) -> str:
    return canonical_sha256(
        {key: value for key, value in case.items() if key != "case_sha256"}
    )


def load_case_authority(
    path: Path,
    authority: dict[str, Any],
    exact_main: str,
    assessment: dict[str, Any],
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    value = load_json(path)
    require_keys(value, CASE_AUTHORITY_KEYS, "trusted case authority")
    self_digest(value, "authority_sha256", "trusted case authority")
    plan = as_object(authority["case_authority"], "authority.case_authority")
    if value["schema_version"] != plan["schema_version"]:
        raise QualityScoringError("case authority schema mismatch")
    if as_commit(value["exact_main"], "case authority exact_main") != exact_main:
        raise QualityScoringError("case authority exact-main mismatch")
    if value["suite_id"] != plan["suite_id"]:
        raise QualityScoringError("case authority suite mismatch")
    if value["assessment_sha256"] != assessment["assessment_sha256"]:
        raise QualityScoringError("case authority assessment binding mismatch")
    if value["corpus_sha256"] != assessment["corpus_sha256"]:
        raise QualityScoringError("case authority corpus binding mismatch")
    counts = as_object(value["counts"], "case authority counts")
    require_keys(counts, {"total", "platform", "agro", "critical"}, "case counts")
    expected_counts = {
        "total": plan["required_total_cases"],
        "platform": plan["required_platform_cases"],
        "agro": plan["required_agro_cases"],
        "critical": plan["required_critical_cases"],
    }
    if counts != expected_counts:
        raise QualityScoringError("case authority counts mismatch")
    if value["locales"] != list(LOCALES):
        raise QualityScoringError("case authority locales mismatch")
    rows = as_array(value["cases"], "case authority cases")
    if len(rows) != 58:
        raise QualityScoringError("case authority case count mismatch")
    cases: dict[str, dict[str, Any]] = {}
    observed_counts = {"PLATFORM": 0, "AGRO": 0, "CRITICAL": 0}
    for index, item in enumerate(rows):
        case = as_object(item, f"cases[{index}]")
        require_keys(case, CASE_KEYS, f"cases[{index}]")
        case_id = as_identity(case["case_id"], "case_id")
        if case_id in cases:
            raise QualityScoringError("duplicate case_id")
        domain = as_text(case["domain"], "case domain")
        if domain not in {"PLATFORM", "AGRO"}:
            raise QualityScoringError("case domain is invalid")
        criticality = as_text(case["criticality"], "case criticality")
        if criticality not in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
            raise QualityScoringError("case criticality is invalid")
        as_text(case["variant_kind"], "case variant_kind")
        prompt_map = as_object(case["prompt_sha256_by_locale"], "case prompts")
        require_keys(prompt_map, set(LOCALES), "case prompts")
        for locale in LOCALES:
            as_sha256(prompt_map[locale], f"case prompt {locale}")
        for field in (
            "expected_statuses",
            "required_concepts",
            "forbidden_claims",
            "expected_citations",
            "abstention_reason_codes",
        ):
            rows_for_field = [
                as_identity(row, f"case.{field}")
                for row in as_array(case[field], field)
            ]
            if len(rows_for_field) != len(set(rows_for_field)):
                raise QualityScoringError(f"case {field} contains duplicates")
        if not case["expected_statuses"]:
            raise QualityScoringError("case expected_statuses must not be empty")
        as_identity(case["coverage_family_id"], "coverage family")
        digest = as_sha256(case["case_sha256"], "case_sha256")
        if digest != _case_digest(case):
            raise QualityScoringError(f"case criteria digest mismatch: {case_id}")
        observed_counts[domain] += 1
        observed_counts["CRITICAL"] += int(criticality == "CRITICAL")
        cases[case_id] = dict(case)
    if observed_counts != {"PLATFORM": 42, "AGRO": 16, "CRITICAL": 23}:
        raise QualityScoringError("case authority observed counts mismatch")
    return cases, value


def load_runtime_case_manifest(
    value: dict[str, Any],
    runtime_manifest: dict[str, Any],
    assessment: dict[str, Any],
    trusted_cases: dict[str, dict[str, Any]],
    copy_sha256: str,
    copy_size: int,
) -> dict[str, dict[str, str]]:
    require_keys(value, RUNTIME_CASE_MANIFEST_KEYS, "runtime case manifest")
    if value["schema_version"] != "tai.runtime-corpus-manifest.v1":
        raise QualityScoringError("runtime case manifest schema mismatch")
    corpus = as_object(runtime_manifest["corpus"], "runtime corpus")
    if (
        value["suite_id"] != corpus["suite_id"]
        or value["assessment_sha256"] != assessment["assessment_sha256"]
        or value["corpus_sha256"] != assessment["corpus_sha256"]
        or value["locales"] != list(LOCALES)
    ):
        raise QualityScoringError("runtime case manifest authority binding mismatch")
    record = runtime_manifest["runtime_file_records"][
        runtime_manifest["case_manifest_path"]
    ]
    if record["sha256"] != copy_sha256 or int(record["size_bytes"]) != copy_size:
        raise QualityScoringError("runtime case manifest copy digest mismatch")
    rows = as_array(value["cases"], "runtime case manifest cases")
    if len(rows) != 58:
        raise QualityScoringError("runtime case manifest count mismatch")
    prompts: dict[str, dict[str, str]] = {}
    critical_count = 0
    for index, raw in enumerate(rows):
        case = as_object(raw, f"runtime cases[{index}]")
        require_keys(
            case,
            {"case_id", "critical", "prompt_sha256_by_locale"},
            f"runtime cases[{index}]",
        )
        case_id = as_identity(case["case_id"], "runtime case_id")
        trusted = trusted_cases.get(case_id)
        if trusted is None or case_id in prompts:
            raise QualityScoringError("runtime case identity mismatch")
        critical = as_bool(case["critical"], "runtime case critical")
        if critical != (trusted["criticality"] == "CRITICAL"):
            raise QualityScoringError("runtime case criticality mismatch")
        critical_count += int(critical)
        prompt_map = as_object(case["prompt_sha256_by_locale"], "runtime prompts")
        require_keys(prompt_map, set(LOCALES), "runtime prompts")
        prompts[case_id] = {}
        for locale in LOCALES:
            digest = as_sha256(prompt_map[locale], f"runtime prompt {locale}")
            if digest != trusted["prompt_sha256_by_locale"][locale]:
                raise QualityScoringError("runtime prompt digest mismatch")
            prompts[case_id][locale] = digest
    if critical_count != 23 or set(prompts) != set(trusted_cases):
        raise QualityScoringError("runtime case coverage mismatch")
    return prompts


def load_runtime_raw_manifest(
    value: dict[str, Any],
    runtime_manifest: dict[str, Any],
    prompts: dict[str, dict[str, str]],
    copy_sha256: str,
    copy_size: int,
) -> dict[tuple[str, str, str], dict[str, Any]]:
    require_keys(value, RUNTIME_RAW_MANIFEST_KEYS, "runtime raw manifest")
    if value["schema_version"] != "tai.raw-model-observations.v1":
        raise QualityScoringError("runtime raw manifest schema mismatch")
    corpus = as_object(runtime_manifest["corpus"], "runtime corpus")
    if value["suite_id"] != corpus["suite_id"] or value["profile_ids"] != list(
        PROFILES
    ):
        raise QualityScoringError("runtime raw manifest authority binding mismatch")
    record = runtime_manifest["runtime_file_records"][
        runtime_manifest["raw_manifest_path"]
    ]
    if record["sha256"] != copy_sha256 or int(record["size_bytes"]) != copy_size:
        raise QualityScoringError("runtime raw manifest copy digest mismatch")
    rows = as_array(value["entries"], "runtime raw manifest entries")
    if len(rows) != 348:
        raise QualityScoringError("runtime raw manifest count mismatch")
    observations: dict[tuple[str, str, str], dict[str, Any]] = {}
    for index, raw in enumerate(rows):
        row = as_object(raw, f"runtime raw entries[{index}]")
        require_keys(row, RUNTIME_RAW_ENTRY_KEYS, f"runtime raw entries[{index}]")
        case_id = as_identity(row["case_id"], "runtime observation case")
        locale = as_identity(row["locale"], "runtime observation locale")
        profile = as_identity(row["profile_id"], "runtime observation profile")
        key = (profile, case_id, locale)
        if (
            case_id not in prompts
            or locale not in LOCALES
            or profile not in PROFILES
            or key in observations
        ):
            raise QualityScoringError("runtime observation Cartesian identity mismatch")
        prompt_sha = as_sha256(row["prompt_sha256"], "runtime observation prompt")
        if prompt_sha != prompts[case_id][locale]:
            raise QualityScoringError("runtime observation prompt digest mismatch")
        response_sha = as_sha256(row["response_sha256"], "runtime observation response")
        trace_sha = as_sha256(row["trace_sha256"], "runtime observation trace")
        request_id = as_identity(row["request_id"], "runtime observation request")
        status = as_text(row["status"], "runtime observation status")
        if status not in {"ANSWERED", "ABSTAINED", "REJECTED"}:
            raise QualityScoringError("runtime observation status invalid")
        started = as_timestamp(row["started_at"], "runtime observation started_at")
        completed = as_timestamp(
            row["completed_at"], "runtime observation completed_at"
        )
        if completed < started:
            raise QualityScoringError("runtime observation chronology invalid")
        observation = {
            "profile_id": profile,
            "case_id": case_id,
            "locale": locale,
            "request_id": request_id,
            "prompt_sha256": prompt_sha,
            "response_sha256": response_sha,
            "trace_sha256": trace_sha,
            "terminal_status": status,
            "started_at": started.isoformat(),
            "completed_at": completed.isoformat(),
        }
        observation["observation_sha256"] = canonical_sha256(observation)
        observations[key] = observation
    expected = {
        (profile, case_id, locale)
        for profile in PROFILES
        for case_id in prompts
        for locale in LOCALES
    }
    if set(observations) != expected:
        raise QualityScoringError("runtime observation Cartesian coverage mismatch")
    return observations


def _sha_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_runtime_raw_payload(
    value: dict[str, Any],
    runtime_manifest: dict[str, Any],
    observations: dict[tuple[str, str, str], dict[str, Any]],
    copy_sha256: str,
    copy_size: int,
) -> None:
    require_keys(value, RUNTIME_RAW_PAYLOAD_KEYS, "runtime raw payload")
    if value["schema_version"] != "tai.raw-model-observation-payload.v1":
        raise QualityScoringError("runtime raw payload schema mismatch")
    if value["suite_id"] != runtime_manifest["corpus"]["suite_id"]:
        raise QualityScoringError("runtime raw payload suite mismatch")
    record = runtime_manifest["runtime_file_records"][
        runtime_manifest["raw_payload_path"]
    ]
    if record["sha256"] != copy_sha256 or int(record["size_bytes"]) != copy_size:
        raise QualityScoringError("runtime raw payload copy digest mismatch")
    rows = as_array(value["entries"], "runtime raw payload entries")
    if len(rows) != 348:
        raise QualityScoringError("runtime raw payload count mismatch")
    seen: set[tuple[str, str, str]] = set()
    for index, raw in enumerate(rows):
        row = as_object(raw, f"runtime payload entries[{index}]")
        require_keys(
            row, RUNTIME_PAYLOAD_ENTRY_KEYS, f"runtime payload entries[{index}]"
        )
        key = (
            as_identity(row["profile_id"], "payload profile"),
            as_identity(row["case_id"], "payload case"),
            as_identity(row["locale"], "payload locale"),
        )
        observation = observations.get(key)
        if observation is None or key in seen:
            raise QualityScoringError("runtime payload Cartesian identity mismatch")
        seen.add(key)
        prompt = as_text(row["prompt"], "payload prompt", 100_000)
        response = row["response"]
        if not isinstance(response, str) or len(response) > 1_000_000:
            raise QualityScoringError("payload response must be a bounded string")
        if (
            _sha_text(prompt) != observation["prompt_sha256"]
            or _sha_text(response) != observation["response_sha256"]
            or row["request_id"] != observation["request_id"]
            or row["status"] != observation["terminal_status"]
            or row["trace_sha256"] != observation["trace_sha256"]
            or as_timestamp(row["started_at"], "payload started").isoformat()
            != observation["started_at"]
            or as_timestamp(row["completed_at"], "payload completed").isoformat()
            != observation["completed_at"]
        ):
            raise QualityScoringError("runtime payload observation binding mismatch")
    if seen != set(observations):
        raise QualityScoringError("runtime payload coverage mismatch")
