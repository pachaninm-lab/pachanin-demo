from __future__ import annotations

import hashlib
from typing import Any

from tai.cpu_runtime_contract import (
    ALLOWED_TERMINAL_STATUSES,
    RuntimeEvidenceError,
    as_array,
    as_bool,
    as_identity,
    as_int,
    as_object,
    as_relative_path,
    as_sha256,
    as_text,
    as_timestamp,
    as_unique_texts,
    require_keys,
)


def parse_corpus(
    value: object, authority: dict[str, Any]
) -> tuple[dict[str, Any], list[str]]:
    item = as_object(value, "corpus")
    require_keys(
        item,
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
        "corpus",
    )
    parsed: dict[str, Any] = {
        "suite_id": as_identity(item["suite_id"], "corpus.suite_id"),
        "status": as_text(item["status"], "corpus.status"),
        "accepted": as_bool(item["accepted"], "corpus.accepted"),
        "assessment_sha256": as_sha256(
            item["assessment_sha256"], "corpus.assessment_sha256"
        ),
        "corpus_sha256": as_sha256(
            item["corpus_sha256"], "corpus.corpus_sha256"
        ),
        "total_cases": as_int(
            item["total_cases"], "corpus.total_cases", minimum=1
        ),
        "critical_cases": as_int(
            item["critical_cases"], "corpus.critical_cases", minimum=1
        ),
        "locales": as_unique_texts(item["locales"], "corpus.locales"),
        "unreviewed_cases": as_int(
            item["unreviewed_cases"], "corpus.unreviewed_cases"
        ),
        "case_manifest_path": as_relative_path(
            item["case_manifest_path"], "corpus.case_manifest_path"
        ),
        "raw_observation_count": as_int(
            item["raw_observation_count"],
            "corpus.raw_observation_count",
            minimum=1,
        ),
    }
    plan = as_object(authority["corpus"], "authority.corpus")
    comparisons: dict[str, Any] = {
        "suite_id": plan["suite_id"],
        "status": plan["required_status"],
        "accepted": plan["required_accepted"],
        "total_cases": plan["required_total_cases"],
        "critical_cases": plan["required_critical_cases"],
        "locales": plan["required_locales"],
        "unreviewed_cases": plan["maximum_unreviewed_cases"],
        "raw_observation_count": plan["required_raw_observations_total"],
    }
    reasons = [
        f"CORPUS_{key.upper()}_MISMATCH"
        for key, expected in comparisons.items()
        if parsed[key] != expected
    ]
    return parsed, reasons


def validate_case_manifest(
    value: dict[str, Any],
    corpus: dict[str, Any],
    authority: dict[str, Any],
) -> tuple[dict[str, dict[str, str]], list[str]]:
    require_keys(
        value,
        {
            "schema_version",
            "suite_id",
            "assessment_sha256",
            "corpus_sha256",
            "locales",
            "cases",
        },
        "case manifest",
    )
    reasons: list[str] = []
    if value["schema_version"] != "tai.runtime-corpus-manifest.v1":
        reasons.append("CASE_MANIFEST_SCHEMA_MISMATCH")
    if value["suite_id"] != corpus["suite_id"]:
        reasons.append("CASE_MANIFEST_SUITE_MISMATCH")
    if value["assessment_sha256"] != corpus["assessment_sha256"]:
        reasons.append("CASE_MANIFEST_ASSESSMENT_MISMATCH")
    if value["corpus_sha256"] != corpus["corpus_sha256"]:
        reasons.append("CASE_MANIFEST_CORPUS_MISMATCH")
    plan = as_object(authority["corpus"], "authority.corpus")
    required_locales = [str(item) for item in plan["required_locales"]]
    locales = as_unique_texts(value["locales"], "case manifest.locales")
    if locales != required_locales:
        reasons.append("CASE_MANIFEST_LOCALES_MISMATCH")
    prompts: dict[str, dict[str, str]] = {}
    critical_count = 0
    for index, raw_case in enumerate(
        as_array(value["cases"], "case manifest.cases")
    ):
        name = f"case manifest.cases[{index}]"
        case = as_object(raw_case, name)
        require_keys(
            case, {"case_id", "critical", "prompt_sha256_by_locale"}, name
        )
        case_id = as_identity(case["case_id"], f"{name}.case_id")
        if case_id in prompts:
            raise RuntimeEvidenceError("case manifest ids must be unique")
        if as_bool(case["critical"], f"{name}.critical"):
            critical_count += 1
        prompt_map = as_object(
            case["prompt_sha256_by_locale"],
            f"{name}.prompt_sha256_by_locale",
        )
        require_keys(
            prompt_map,
            set(required_locales),
            f"{name}.prompt_sha256_by_locale",
        )
        prompts[case_id] = {
            locale: as_sha256(
                prompt_map[locale],
                f"{name}.prompt_sha256_by_locale.{locale}",
            )
            for locale in required_locales
        }
    if len(prompts) != as_int(
        plan["required_total_cases"], "required_total_cases"
    ):
        reasons.append("CASE_MANIFEST_TOTAL_CASES_MISMATCH")
    if critical_count != as_int(
        plan["required_critical_cases"], "required_critical_cases"
    ):
        reasons.append("CASE_MANIFEST_CRITICAL_CASES_MISMATCH")
    return prompts, reasons


def validate_raw_manifest(
    value: dict[str, Any],
    prompts: dict[str, dict[str, str]],
    corpus: dict[str, Any],
    profile_ids: list[str],
    authority: dict[str, Any],
) -> tuple[int, list[str]]:
    require_keys(
        value,
        {"schema_version", "suite_id", "profile_ids", "entries"},
        "raw observations manifest",
    )
    reasons: list[str] = []
    if value["schema_version"] != "tai.raw-model-observations.v1":
        reasons.append("RAW_OBSERVATIONS_SCHEMA_MISMATCH")
    if value["suite_id"] != corpus["suite_id"]:
        reasons.append("RAW_OBSERVATIONS_SUITE_MISMATCH")
    observed_profiles = as_unique_texts(
        value["profile_ids"], "raw observations manifest.profile_ids"
    )
    if observed_profiles != profile_ids:
        reasons.append("RAW_OBSERVATIONS_PROFILE_SET_MISMATCH")
    plan = as_object(authority["corpus"], "authority.corpus")
    required_locales = [str(item) for item in plan["required_locales"]]
    counts = {profile_id: 0 for profile_id in profile_ids}
    seen: set[tuple[str, str, str]] = set()
    entries = as_array(value["entries"], "raw observations manifest.entries")
    for index, raw_entry in enumerate(entries):
        name = f"raw observations manifest.entries[{index}]"
        entry = as_object(raw_entry, name)
        require_keys(
            entry,
            {
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
            },
            name,
        )
        case_id = as_identity(entry["case_id"], f"{name}.case_id")
        locale = as_text(entry["locale"], f"{name}.locale")
        profile_id = as_identity(entry["profile_id"], f"{name}.profile_id")
        key = (case_id, locale, profile_id)
        if key in seen:
            raise RuntimeEvidenceError(f"duplicate raw observation: {key!r}")
        seen.add(key)
        if case_id not in prompts:
            reasons.append(f"RAW_OBSERVATION_UNKNOWN_CASE:{case_id}")
            continue
        if locale not in required_locales:
            reasons.append(f"RAW_OBSERVATION_UNKNOWN_LOCALE:{locale}")
            continue
        if profile_id not in counts:
            reasons.append(f"RAW_OBSERVATION_UNKNOWN_PROFILE:{profile_id}")
            continue
        counts[profile_id] += 1
        prompt_sha = as_sha256(
            entry["prompt_sha256"], f"{name}.prompt_sha256"
        )
        if prompt_sha != prompts[case_id][locale]:
            reasons.append(
                "RAW_OBSERVATION_PROMPT_DIGEST_MISMATCH:"
                f"{case_id}:{locale}:{profile_id}"
            )
        as_sha256(entry["response_sha256"], f"{name}.response_sha256")
        as_identity(entry["request_id"], f"{name}.request_id")
        status = as_text(entry["status"], f"{name}.status")
        if status not in ALLOWED_TERMINAL_STATUSES:
            reasons.append(f"RAW_OBSERVATION_STATUS_INVALID:{status}")
        started = as_timestamp(entry["started_at"], f"{name}.started_at")
        completed = as_timestamp(
            entry["completed_at"], f"{name}.completed_at"
        )
        if completed < started:
            reasons.append(
                "RAW_OBSERVATION_TIME_INVALID:"
                f"{case_id}:{locale}:{profile_id}"
            )
        as_sha256(entry["trace_sha256"], f"{name}.trace_sha256")
    expected = {
        (case_id, locale, profile_id)
        for case_id in prompts
        for locale in required_locales
        for profile_id in profile_ids
    }
    missing = expected - seen
    unexpected = seen - expected
    if missing:
        reasons.append(f"RAW_OBSERVATION_COVERAGE_MISSING:{len(missing)}")
    if unexpected:
        reasons.append(
            f"RAW_OBSERVATION_COVERAGE_UNEXPECTED:{len(unexpected)}"
        )
    per_profile = as_int(
        plan["required_raw_observations_per_profile"],
        "required_raw_observations_per_profile",
        minimum=1,
    )
    for profile_id, count in counts.items():
        if count != per_profile:
            reasons.append(
                f"RAW_OBSERVATION_PROFILE_COUNT_MISMATCH:{profile_id}"
            )
    expected_total = as_int(
        plan["required_raw_observations_total"],
        "required_raw_observations_total",
        minimum=1,
    )
    if len(entries) != expected_total:
        reasons.append("RAW_OBSERVATION_TOTAL_COUNT_MISMATCH")
    return len(entries), reasons


def validate_raw_payload(
    value: dict[str, Any], raw_manifest: dict[str, Any]
) -> list[str]:
    require_keys(
        value,
        {"schema_version", "suite_id", "entries"},
        "raw observations payload",
    )
    reasons: list[str] = []
    if value["schema_version"] != "tai.raw-model-observation-payload.v1":
        reasons.append("RAW_PAYLOAD_SCHEMA_MISMATCH")
    if value["suite_id"] != raw_manifest["suite_id"]:
        reasons.append("RAW_PAYLOAD_SUITE_MISMATCH")
    manifest_by_key: dict[tuple[str, str, str], dict[str, Any]] = {}
    raw_manifest_entries = as_array(
        raw_manifest["entries"], "raw observations manifest.entries"
    )
    for index, raw_entry in enumerate(raw_manifest_entries):
        entry = as_object(
            raw_entry, f"raw observations manifest.entries[{index}]"
        )
        key = (
            as_identity(
                entry["case_id"], f"raw manifest entries[{index}].case_id"
            ),
            as_text(
                entry["locale"], f"raw manifest entries[{index}].locale"
            ),
            as_identity(
                entry["profile_id"],
                f"raw manifest entries[{index}].profile_id",
            ),
        )
        manifest_by_key[key] = entry
    seen: set[tuple[str, str, str]] = set()
    payload_entries = as_array(
        value["entries"], "raw observations payload.entries"
    )
    for index, raw_entry in enumerate(payload_entries):
        name = f"raw observations payload.entries[{index}]"
        entry = as_object(raw_entry, name)
        require_keys(
            entry,
            {
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
            },
            name,
        )
        case_id = as_identity(entry["case_id"], f"{name}.case_id")
        locale = as_text(entry["locale"], f"{name}.locale")
        profile_id = as_identity(entry["profile_id"], f"{name}.profile_id")
        key = (case_id, locale, profile_id)
        if key in seen:
            raise RuntimeEvidenceError(
                f"duplicate raw payload observation: {key!r}"
            )
        seen.add(key)
        declared = manifest_by_key.get(key)
        if declared is None:
            reasons.append(
                f"RAW_PAYLOAD_ENTRY_UNDECLARED:{case_id}:{locale}:{profile_id}"
            )
            continue
        prompt = as_text(entry["prompt"], f"{name}.prompt")
        response = entry["response"]
        if not isinstance(response, str):
            raise RuntimeEvidenceError(f"{name}.response must be a string")
        if len(prompt) > 10_000:
            reasons.append(
                f"RAW_PAYLOAD_PROMPT_TOO_LARGE:{case_id}:{locale}:{profile_id}"
            )
        if len(response) > 200_000:
            reasons.append(
                "RAW_PAYLOAD_RESPONSE_TOO_LARGE:"
                f"{case_id}:{locale}:{profile_id}"
            )
        if (
            hashlib.sha256(prompt.encode()).hexdigest()
            != declared["prompt_sha256"]
        ):
            reasons.append(
                "RAW_PAYLOAD_PROMPT_DIGEST_MISMATCH:"
                f"{case_id}:{locale}:{profile_id}"
            )
        if (
            hashlib.sha256(response.encode()).hexdigest()
            != declared["response_sha256"]
        ):
            reasons.append(
                "RAW_PAYLOAD_RESPONSE_DIGEST_MISMATCH:"
                f"{case_id}:{locale}:{profile_id}"
            )
        for field in (
            "request_id",
            "status",
            "started_at",
            "completed_at",
            "trace_sha256",
        ):
            if entry[field] != declared[field]:
                reasons.append(
                    "RAW_PAYLOAD_METADATA_MISMATCH:"
                    f"{case_id}:{locale}:{profile_id}:{field}"
                )
    missing = set(manifest_by_key) - seen
    unexpected = seen - set(manifest_by_key)
    if missing:
        reasons.append(f"RAW_PAYLOAD_COVERAGE_MISSING:{len(missing)}")
    if unexpected:
        reasons.append(
            f"RAW_PAYLOAD_COVERAGE_UNEXPECTED:{len(unexpected)}"
        )
    return reasons
