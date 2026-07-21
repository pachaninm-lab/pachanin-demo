from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from tai.cpu_runtime_contract import (
    EXPECTED_MATURITY,
    VERIFIED_RUNTIME_STATUS,
    RuntimeEvidenceError,
    as_bool,
    as_commit,
    as_int,
    as_object,
    as_relative_path,
    as_sha256,
    as_text,
    as_timestamp,
    canonical_sha256,
    load_authority,
    load_json,
    pending_report,
    require_keys,
    write_json,
)
from tai.cpu_runtime_files import (
    load_semantic,
    parse_file_records,
    parse_storage,
    verify_declared_files,
)
from tai.cpu_runtime_measurements import (
    parse_bundle_finalization,
    parse_fallback,
    parse_profiles,
    parse_soak,
    validate_fallback_semantics,
    validate_profile_semantics,
    validate_soak_semantics,
)
from tai.cpu_runtime_observations import (
    parse_corpus,
    validate_case_manifest,
    validate_raw_manifest,
    validate_raw_payload,
)

__all__ = [
    "RuntimeEvidenceError",
    "canonical_sha256",
    "load_authority",
    "load_json",
    "verify_runtime_evidence",
    "write_json",
]

MANIFEST_KEYS = {
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


def _parse_readiness(
    value: object,
    *,
    exact_main: str,
    measured_at: datetime,
    maximum_age_hours: int,
) -> tuple[dict[str, Any], list[str]]:
    item = as_object(value, "readiness")
    require_keys(
        item,
        {
            "schema_version",
            "status",
            "ready",
            "exact_main",
            "evaluated_at",
            "report_sha256",
            "simulated",
        },
        "readiness",
    )
    schema = as_text(item["schema_version"], "readiness.schema_version")
    status = as_text(item["status"], "readiness.status")
    ready = as_bool(item["ready"], "readiness.ready")
    observed_main = as_commit(item["exact_main"], "readiness.exact_main")
    evaluated_at = as_timestamp(
        item["evaluated_at"], "readiness.evaluated_at"
    )
    report_sha = as_sha256(
        item["report_sha256"], "readiness.report_sha256"
    )
    simulated = as_bool(item["simulated"], "readiness.simulated")
    parsed: dict[str, Any] = {
        "schema_version": schema,
        "status": status,
        "ready": ready,
        "exact_main": observed_main,
        "evaluated_at": evaluated_at,
        "report_sha256": report_sha,
        "simulated": simulated,
    }
    reasons: list[str] = []
    if schema != "tai.cpu-benchmark-execution-readiness.v1":
        reasons.append("READINESS_SCHEMA_MISMATCH")
    if status != "READY_FOR_EXTERNAL_EXECUTION" or not ready:
        reasons.append("READINESS_NOT_ACCEPTED")
    if observed_main != exact_main:
        reasons.append("READINESS_EXACT_MAIN_MISMATCH")
    if evaluated_at > measured_at + timedelta(minutes=5):
        reasons.append("READINESS_FROM_FUTURE")
    if measured_at - evaluated_at > timedelta(hours=maximum_age_hours):
        reasons.append("READINESS_STALE")
    if simulated:
        reasons.append("READINESS_SIMULATED")
    return parsed, reasons


def _pending_manifest_is_empty(manifest: dict[str, Any]) -> None:
    expected: dict[str, Any] = {
        "exact_main": None,
        "readiness": None,
        "bundle_finalization": None,
        "corpus": None,
        "runtime_profiles": [],
        "fallback_exercise": None,
        "soak": None,
        "raw_observations": None,
        "evidence_files": [],
        "storage": None,
        "measured_at": None,
    }
    for key, value in expected.items():
        if manifest[key] != value:
            raise RuntimeEvidenceError(
                f"pending runtime manifest field must remain empty: {key}"
            )


def _required_evidence_paths(
    authority: dict[str, Any],
    corpus: dict[str, Any],
    profiles: list[dict[str, Any]],
    fallback: dict[str, Any],
    soak: dict[str, Any],
    raw_info: dict[str, Any],
) -> set[str]:
    evidence = as_object(authority["evidence"], "authority.evidence")
    required = {str(item) for item in evidence["required_semantic_files"]}
    required.update(
        {
            str(corpus["case_manifest_path"]),
            str(raw_info["manifest_path"]),
            str(raw_info["payload_path"]),
            str(fallback["raw_metrics_path"]),
            str(fallback["protocol_path"]),
            str(soak["raw_metrics_path"]),
            str(soak["environment_path"]),
        }
    )
    for profile in profiles:
        required.update(
            {
                str(profile["hardware_path"]),
                str(profile["environment_path"]),
                str(profile["benchmark_metrics_path"]),
                str(profile["request_metrics_path"]),
                str(profile["cost_inputs_path"]),
            }
        )
    return required


def verify_runtime_evidence(
    authority_path: Path,
    manifest_path: Path,
    original_root: Path,
    restored_root: Path,
) -> dict[str, object]:
    authority = load_authority(authority_path)
    manifest = load_json(manifest_path)
    require_keys(manifest, MANIFEST_KEYS, "runtime evidence manifest")
    if manifest["schema_version"] != "tai.cpu-runtime-evidence.v1":
        raise RuntimeEvidenceError(
            "unsupported runtime evidence schema_version"
        )
    maturity = {
        "quality_scoring_status": manifest["quality_scoring_status"],
        "benchmark_status": manifest["benchmark_status"],
        "model_admission_status": manifest["model_admission_status"],
        "production_operational_status": manifest[
            "production_operational_status"
        ],
    }
    if maturity != EXPECTED_MATURITY:
        raise RuntimeEvidenceError(
            "runtime evidence maturity boundary is invalid"
        )

    lifecycle = as_text(manifest["lifecycle"], "manifest.lifecycle")
    if lifecycle == "PENDING_RUNTIME_EXECUTION":
        reason = as_text(
            manifest["pending_reason"], "manifest.pending_reason"
        )
        _pending_manifest_is_empty(manifest)
        return pending_report(authority, reason)
    if lifecycle != "COMPLETE":
        raise RuntimeEvidenceError(
            "runtime evidence lifecycle is unsupported"
        )
    if manifest["pending_reason"] is not None:
        raise RuntimeEvidenceError(
            "complete runtime evidence cannot have pending_reason"
        )

    exact_main = as_commit(manifest["exact_main"], "manifest.exact_main")
    measured_at = as_timestamp(
        manifest["measured_at"], "manifest.measured_at"
    )
    reasons: list[str] = []

    readiness_plan = as_object(
        authority["readiness"], "authority.readiness"
    )
    _, readiness_reasons = _parse_readiness(
        manifest["readiness"],
        exact_main=exact_main,
        measured_at=measured_at,
        maximum_age_hours=as_int(
            readiness_plan["maximum_age_hours"],
            "maximum_age_hours",
            minimum=1,
        ),
    )
    reasons.extend(readiness_reasons)

    plans = [
        as_object(item, "authority.runtime_profile")
        for item in authority["runtime_profiles"]
    ]
    bundles, bundle_reasons = parse_bundle_finalization(
        manifest["bundle_finalization"], plans
    )
    reasons.extend(bundle_reasons)
    corpus, corpus_reasons = parse_corpus(manifest["corpus"], authority)
    reasons.extend(corpus_reasons)
    profiles, profile_reasons = parse_profiles(
        manifest["runtime_profiles"], plans
    )
    reasons.extend(profile_reasons)
    fallback, fallback_reasons = parse_fallback(
        manifest["fallback_exercise"], authority
    )
    reasons.extend(fallback_reasons)
    soak, soak_reasons = parse_soak(manifest["soak"], authority)
    reasons.extend(soak_reasons)

    bundle_by_key = {
        str(item["model_key"]): item for item in bundles["models"]
    }
    for profile, plan in zip(profiles, plans, strict=True):
        bundle = bundle_by_key[str(plan["model_key"])]
        if profile["artifact_sha256"] != bundle["artifact_sha256"]:
            reasons.append(
                f"PROFILE_ARTIFACT_MISMATCH:{profile['profile_id']}"
            )

    files = parse_file_records(manifest["evidence_files"])
    records, file_reasons, total_size = verify_declared_files(
        authority, files, original_root, restored_root
    )
    reasons.extend(file_reasons)

    raw_info_source = as_object(
        manifest["raw_observations"], "raw_observations"
    )
    require_keys(
        raw_info_source,
        {"manifest_path", "payload_path", "observation_count"},
        "raw_observations",
    )
    raw_info: dict[str, Any] = {
        "manifest_path": as_relative_path(
            raw_info_source["manifest_path"],
            "raw_observations.manifest_path",
        ),
        "payload_path": as_relative_path(
            raw_info_source["payload_path"],
            "raw_observations.payload_path",
        ),
        "observation_count": as_int(
            raw_info_source["observation_count"],
            "raw_observations.observation_count",
            minimum=1,
        ),
    }

    required = _required_evidence_paths(
        authority, corpus, profiles, fallback, soak, raw_info
    )
    for relative in sorted(required - set(records)):
        reasons.append(f"REQUIRED_EVIDENCE_UNDECLARED:{relative}")

    case_manifest = load_semantic(
        original_root,
        records,
        str(corpus["case_manifest_path"]),
        "case manifest",
    )
    prompts, case_reasons = validate_case_manifest(
        case_manifest, corpus, authority
    )
    reasons.extend(case_reasons)

    raw_manifest = load_semantic(
        original_root,
        records,
        str(raw_info["manifest_path"]),
        "raw observations manifest",
    )
    profile_ids = [str(profile["profile_id"]) for profile in profiles]
    raw_count, raw_reasons = validate_raw_manifest(
        raw_manifest, prompts, corpus, profile_ids, authority
    )
    reasons.extend(raw_reasons)
    raw_payload = load_semantic(
        original_root,
        records,
        str(raw_info["payload_path"]),
        "raw observations payload",
    )
    reasons.extend(validate_raw_payload(raw_payload, raw_manifest))
    if int(raw_info["observation_count"]) != raw_count:
        reasons.append("RAW_OBSERVATION_DECLARED_COUNT_MISMATCH")
    if int(raw_info["observation_count"]) != int(
        corpus["raw_observation_count"]
    ):
        reasons.append("RAW_OBSERVATION_CORPUS_COUNT_MISMATCH")

    for profile in profiles:
        reasons.extend(
            validate_profile_semantics(original_root, records, profile)
        )
    reasons.extend(
        validate_fallback_semantics(original_root, records, fallback)
    )
    reasons.extend(validate_soak_semantics(original_root, records, soak))
    _, storage_reasons = parse_storage(
        manifest["storage"], authority, measured_at
    )
    reasons.extend(storage_reasons)

    unique_reasons = sorted(set(reasons))
    profile_status: dict[str, str] = {
        str(profile["profile_id"]): (
            "REJECTED"
            if any(
                str(profile["profile_id"]) in reason
                for reason in unique_reasons
            )
            else "MEASURED"
        )
        for profile in profiles
    }
    report: dict[str, object] = {
        "schema_version": "tai.cpu-runtime-evidence-verification.v1",
        "status": (
            VERIFIED_RUNTIME_STATUS if not unique_reasons else "REJECTED"
        ),
        "authority_sha256": authority["authority_sha256"],
        "manifest_sha256": canonical_sha256(manifest),
        "exact_main": exact_main,
        "runtime_profiles": profile_status,
        "raw_observation_count": raw_count,
        "evidence_file_count": len(files),
        "evidence_total_size_bytes": total_size,
        "reasons": unique_reasons,
        **EXPECTED_MATURITY,
    }
    report["report_sha256"] = canonical_sha256(report)
    return report
