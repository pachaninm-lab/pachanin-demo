from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from tai.quality_scoring_annotations import score_annotations
from tai.quality_scoring_contract import (
    EXPECTED_QUALITY_MATURITY,
    LOCALES,
    PROFILES,
    VERIFIED_QUALITY_STATUS,
    QualityScoringError,
    as_commit,
    as_identity,
    as_int,
    as_object,
    as_relative_path,
    as_sha256,
    as_text,
    as_timestamp,
    canonical_sha256,
    load_authority,
    load_json,
    require_keys,
    self_digest,
    write_json,
)
from tai.quality_scoring_files import (
    load_declared_json,
    parse_file_records,
    verify_evidence_roots,
)
from tai.quality_scoring_inputs import (
    load_assessment,
    load_case_authority,
    load_runtime_case_manifest,
    load_runtime_manifest,
    load_runtime_raw_manifest,
    load_runtime_report,
    validate_runtime_raw_payload,
)

__all__ = [
    "QualityScoringError",
    "canonical_sha256",
    "load_authority",
    "load_json",
    "verify_quality_scoring",
    "write_json",
]

MANIFEST_KEYS = {
    "schema_version",
    "lifecycle",
    "pending_reason",
    "authority_sha256",
    "exact_main",
    "trusted_runtime_report_sha256",
    "trusted_runtime_manifest_sha256",
    "trusted_assessment_sha256",
    "trusted_case_authority_sha256",
    "runtime_report_path",
    "runtime_manifest_path",
    "assessment_path",
    "case_authority_path",
    "runtime_case_manifest_path",
    "runtime_raw_manifest_path",
    "runtime_raw_payload_path",
    "annotations_path",
    "storage_manifest_path",
    "evidence_files",
    "scored_at",
    "quality_scoring_status",
    "benchmark_status",
    "model_admission_status",
    "production_operational_status",
    "manifest_sha256",
}
PATH_FIELDS = {
    "runtime_report_path": "quality/runtime-verification.json",
    "runtime_manifest_path": "quality/runtime-manifest.json",
    "assessment_path": "quality/gold-assessment.json",
    "case_authority_path": "quality/case-authority.json",
    "runtime_case_manifest_path": "quality/runtime-case-manifest.json",
    "runtime_raw_manifest_path": "quality/runtime-raw-manifest.json",
    "runtime_raw_payload_path": "quality/runtime-raw-payload.json",
    "annotations_path": "quality/annotations.json",
    "storage_manifest_path": "quality/storage-manifest.json",
}
STORAGE_KEYS = {
    "schema_version",
    "provider",
    "immutable_locator",
    "archive_sha256",
    "archive_size_bytes",
    "object_version_id",
    "retention_days",
    "uploaded_at",
    "restored_at",
    "original_root_id",
    "restored_root_id",
    "storage_sha256",
}


def _load_manifest(path: Path, authority: dict[str, Any]) -> dict[str, Any]:
    manifest = load_json(path)
    require_keys(manifest, MANIFEST_KEYS, "quality scoring manifest")
    self_digest(manifest, "manifest_sha256", "quality scoring manifest")
    if manifest["schema_version"] != "tai.quality-scoring-evidence.v2":
        raise QualityScoringError("quality scoring manifest schema mismatch")
    if manifest["authority_sha256"] != authority["authority_sha256"]:
        raise QualityScoringError("quality scoring manifest authority digest mismatch")
    if {
        key: manifest[key] for key in EXPECTED_QUALITY_MATURITY
    } != EXPECTED_QUALITY_MATURITY:
        raise QualityScoringError("quality scoring maturity boundary is invalid")
    if manifest["quality_scoring_status"] != "PENDING_QUALITY_SCORING":
        raise QualityScoringError("quality manifest cannot pre-claim verification")
    lifecycle = as_text(manifest["lifecycle"], "manifest.lifecycle")
    if lifecycle == "PENDING_HUMAN_SCORING":
        expected_empty: dict[str, object] = {
            "exact_main": None,
            "trusted_runtime_report_sha256": None,
            "trusted_runtime_manifest_sha256": None,
            "trusted_assessment_sha256": None,
            "trusted_case_authority_sha256": None,
            **{field: None for field in PATH_FIELDS},
            "evidence_files": [],
            "scored_at": None,
        }
        if manifest["pending_reason"] is None:
            raise QualityScoringError("pending manifest requires a reason")
        for field, expected in expected_empty.items():
            if manifest[field] != expected:
                raise QualityScoringError(
                    f"pending quality manifest field must remain empty: {field}"
                )
        return manifest
    if lifecycle != "COMPLETE" or manifest["pending_reason"] is not None:
        raise QualityScoringError("unsupported quality scoring lifecycle")
    for field, expected_path in PATH_FIELDS.items():
        if as_relative_path(manifest[field], f"manifest.{field}") != expected_path:
            raise QualityScoringError(f"quality evidence path mismatch: {field}")
    return manifest


def _storage(
    value: dict[str, Any], authority: dict[str, Any], scored_at: datetime
) -> None:
    require_keys(value, STORAGE_KEYS, "quality storage manifest")
    self_digest(value, "storage_sha256", "quality storage manifest")
    if value["schema_version"] != "tai.quality-storage-manifest.v2":
        raise QualityScoringError("quality storage manifest schema mismatch")
    plan = as_object(authority["evidence"], "authority.evidence")
    if value["provider"] != plan["provider"]:
        raise QualityScoringError("quality storage provider mismatch")
    locator = as_text(value["immutable_locator"], "storage immutable locator")
    archive_sha = as_sha256(value["archive_sha256"], "storage archive sha256")
    if (
        not locator.startswith("s3+version://")
        or "versionId=" not in locator
        or f"#sha256={archive_sha}" not in locator
    ):
        raise QualityScoringError("quality storage locator is not immutable")
    as_int(value["archive_size_bytes"], "storage archive size", minimum=1)
    as_identity(value["object_version_id"], "storage object version")
    if (
        as_int(value["retention_days"], "storage retention days")
        < plan["minimum_retention_days"]
    ):
        raise QualityScoringError("quality storage retention is insufficient")
    original_id = as_identity(value["original_root_id"], "storage original root")
    restored_id = as_identity(value["restored_root_id"], "storage restored root")
    if original_id == restored_id:
        raise QualityScoringError("quality storage restore roots are not independent")
    uploaded = as_timestamp(value["uploaded_at"], "storage uploaded_at")
    restored = as_timestamp(value["restored_at"], "storage restored_at")
    if uploaded > restored or restored > scored_at:
        raise QualityScoringError("quality storage chronology is invalid")


def _basis(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        raise QualityScoringError("basis-point denominator must be positive")
    return numerator * 10_000 // denominator


def _aggregate(
    cases: dict[str, dict[str, Any]],
    passed: dict[tuple[str, str, str], bool],
    counters: dict[str, int],
    authority: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    reasons: list[str] = []
    profiles: dict[str, Any] = {}
    thresholds = as_object(authority["thresholds"], "authority.thresholds")
    expected_keys = {
        (profile, case_id, locale)
        for profile in PROFILES
        for case_id in cases
        for locale in LOCALES
    }
    if set(passed) != expected_keys:
        raise QualityScoringError("score coverage is incomplete before aggregation")
    for profile in PROFILES:
        domain_results: dict[str, Any] = {}
        for domain, expected_count in (("PLATFORM", 42), ("AGRO", 16)):
            case_ids = sorted(
                case_id for case_id, case in cases.items() if case["domain"] == domain
            )
            if len(case_ids) != expected_count:
                raise QualityScoringError("aggregate case count mismatch")
            passed_cases = sum(
                int(all(passed[(profile, case_id, locale)] for locale in LOCALES))
                for case_id in case_ids
            )
            basis_points = _basis(passed_cases, expected_count)
            domain_results[domain.casefold()] = {
                "total_cases": expected_count,
                "passed_cases": passed_cases,
                "accuracy_basis_points": basis_points,
            }
            minimum = int(
                thresholds[
                    "platform_accuracy_minimum_basis_points"
                    if domain == "PLATFORM"
                    else "agro_accuracy_minimum_basis_points"
                ]
            )
            if basis_points < minimum:
                reasons.append(f"{profile}:{domain}_ACCURACY_BELOW_THRESHOLD")
        profiles[profile] = domain_results
    citation_total = counters["citation_total"]
    citation_basis = (
        10_000
        if citation_total == 0
        else _basis(counters["citation_valid"], citation_total)
    )
    if citation_basis < int(thresholds["citation_validity_minimum_basis_points"]):
        reasons.append("CITATION_VALIDITY_BELOW_THRESHOLD")
    for counter, threshold in (
        ("critical_unsupported_facts", "critical_unsupported_facts_maximum"),
        ("critical_safety_failures", "critical_safety_failures_maximum"),
        ("critical_abstention_misses", "critical_abstention_misses_maximum"),
    ):
        if counters[counter] > int(thresholds[threshold]):
            reasons.append(counter.upper())
    return {
        "profiles": profiles,
        "citation_validity_basis_points": citation_basis,
        **counters,
    }, reasons


def _record_metadata(
    records: dict[str, dict[str, Any]], relative: str
) -> tuple[str, int]:
    record = records[relative]
    return str(record["sha256"]), int(record["size_bytes"])


def verify_quality_scoring(
    authority_path: Path,
    scoring_manifest_path: Path,
    trusted_runtime_report_path: Path,
    trusted_runtime_manifest_path: Path,
    trusted_assessment_path: Path,
    trusted_case_authority_path: Path,
    original_root: Path,
    restored_root: Path,
    *,
    evaluated_at: str,
) -> dict[str, object]:
    authority = load_authority(authority_path)
    manifest = _load_manifest(scoring_manifest_path, authority)
    now = as_timestamp(evaluated_at, "evaluated_at")
    if manifest["lifecycle"] == "PENDING_HUMAN_SCORING":
        report: dict[str, object] = {
            "schema_version": "tai.quality-scoring-verification.v2",
            "status": "PENDING_HUMAN_SCORING",
            "accepted": False,
            "reasons": ["HUMAN_QUALITY_SCORING_NOT_COMPLETE"],
            "authority_sha256": authority["authority_sha256"],
            "manifest_sha256": manifest["manifest_sha256"],
            "evaluated_at": now.isoformat(),
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            **EXPECTED_QUALITY_MATURITY,
        }
        report["report_sha256"] = canonical_sha256(report)
        return report

    exact_main = as_commit(manifest["exact_main"], "manifest.exact_main")
    scored_at = as_timestamp(manifest["scored_at"], "manifest.scored_at")
    if scored_at > now + timedelta(minutes=5):
        raise QualityScoringError("quality scoring is from the future")

    trusted_runtime = load_runtime_report(trusted_runtime_report_path, authority)
    trusted_runtime_manifest = load_runtime_manifest(
        trusted_runtime_manifest_path, trusted_runtime, authority, now
    )
    trusted_assessment = load_assessment(trusted_assessment_path, authority)
    trusted_cases, trusted_case_authority = load_case_authority(
        trusted_case_authority_path,
        authority,
        exact_main,
        trusted_assessment,
    )
    if trusted_runtime["exact_main"] != exact_main:
        raise QualityScoringError("trusted runtime report exact-main mismatch")
    runtime_corpus = as_object(trusted_runtime_manifest["corpus"], "runtime corpus")
    if (
        runtime_corpus["assessment_sha256"] != trusted_assessment["assessment_sha256"]
        or runtime_corpus["corpus_sha256"] != trusted_assessment["corpus_sha256"]
    ):
        raise QualityScoringError("runtime corpus differs from accepted assessment")

    trust_bindings = {
        "trusted_runtime_report_sha256": trusted_runtime["report_sha256"],
        "trusted_runtime_manifest_sha256": trusted_runtime["manifest_sha256"],
        "trusted_assessment_sha256": trusted_assessment["assessment_sha256"],
        "trusted_case_authority_sha256": trusted_case_authority["authority_sha256"],
    }
    for field, expected in trust_bindings.items():
        if manifest[field] != expected:
            raise QualityScoringError(
                f"quality manifest trust binding mismatch: {field}"
            )

    records = parse_file_records(manifest["evidence_files"], authority)
    total_size = verify_evidence_roots(records, original_root, restored_root)
    copies = {
        field: load_declared_json(original_root, records, path)
        for field, path in PATH_FIELDS.items()
    }
    if copies["runtime_report_path"] != load_json(trusted_runtime_report_path):
        raise QualityScoringError("runtime report copy differs from trusted report")
    if copies["runtime_manifest_path"] != load_json(trusted_runtime_manifest_path):
        raise QualityScoringError("runtime manifest copy differs from trusted manifest")
    if copies["assessment_path"] != trusted_assessment:
        raise QualityScoringError("assessment copy differs from trusted assessment")
    if copies["case_authority_path"] != trusted_case_authority:
        raise QualityScoringError("case authority copy differs from trusted authority")

    case_copy_sha, case_copy_size = _record_metadata(
        records, PATH_FIELDS["runtime_case_manifest_path"]
    )
    prompts = load_runtime_case_manifest(
        copies["runtime_case_manifest_path"],
        trusted_runtime_manifest,
        trusted_assessment,
        trusted_cases,
        case_copy_sha,
        case_copy_size,
    )
    raw_manifest_sha, raw_manifest_size = _record_metadata(
        records, PATH_FIELDS["runtime_raw_manifest_path"]
    )
    observations = load_runtime_raw_manifest(
        copies["runtime_raw_manifest_path"],
        trusted_runtime_manifest,
        prompts,
        raw_manifest_sha,
        raw_manifest_size,
    )
    raw_payload_sha, raw_payload_size = _record_metadata(
        records, PATH_FIELDS["runtime_raw_payload_path"]
    )
    validate_runtime_raw_payload(
        copies["runtime_raw_payload_path"],
        trusted_runtime_manifest,
        observations,
        raw_payload_sha,
        raw_payload_size,
    )
    passed, counters = score_annotations(
        copies["annotations_path"],
        observations,
        trusted_cases,
        authority,
        scored_at,
    )
    _storage(copies["storage_manifest_path"], authority, scored_at)
    aggregate, reasons = _aggregate(trusted_cases, passed, counters, authority)
    status = VERIFIED_QUALITY_STATUS if not reasons else "REJECTED"
    report = {
        "schema_version": "tai.quality-scoring-verification.v2",
        "status": status,
        "accepted": not reasons,
        "reasons": sorted(set(reasons)),
        "exact_main": exact_main,
        "authority_sha256": authority["authority_sha256"],
        **trust_bindings,
        "manifest_sha256": manifest["manifest_sha256"],
        "observation_count": len(observations),
        "annotation_count": len(copies["annotations_path"]["annotations"]),
        "evidence_file_count": len(records),
        "evidence_total_size_bytes": total_size,
        "aggregate": aggregate,
        "evaluated_at": now.isoformat(),
        "quality_scoring_status": (
            VERIFIED_QUALITY_STATUS if not reasons else "PENDING_QUALITY_SCORING"
        ),
        **EXPECTED_QUALITY_MATURITY,
    }
    report["report_sha256"] = canonical_sha256(report)
    return report
