from __future__ import annotations

from pathlib import Path
from typing import Any

from tai.quality_scoring_annotations import score_observations
from tai.quality_scoring_contract import (
    EXPECTED_MATURITY,
    LOCALES,
    PROFILES,
    VERIFIED_QUALITY_STATUS,
    QualityScoringError,
    as_commit,
    as_identity,
    as_int,
    as_object,
    as_timestamp,
    canonical_sha256,
    load_authority,
    load_scoring_manifest,
)
from tai.quality_scoring_external_evidence import verify_external_reviewer_evidence
from tai.quality_scoring_identity import (
    trusted_identity_secret,
    verify_identity_assertions,
)
from tai.quality_scoring_inputs import (
    accepted_assessment,
    case_manifest,
    observation_index,
    runtime_report,
)


def _basis(passed: int, total: int) -> int:
    return (passed * 10_000 + total // 2) // total


def _aggregate(
    observations: dict[tuple[str, str, str], dict[str, Any]],
    passed_observations: dict[tuple[str, str, str], bool],
    counters: dict[str, int],
    authority: dict[str, Any],
) -> tuple[dict[str, Any], list[str]]:
    report: dict[str, Any] = {}
    reasons: list[str] = []
    thresholds = authority["thresholds"]
    for profile in PROFILES:
        domain_results: dict[str, dict[str, int]] = {}
        for domain, expected_cases in (("PLATFORM", 42), ("AGRO", 16)):
            case_ids = sorted(
                {
                    case_id
                    for (observed_profile, case_id, _), row in observations.items()
                    if observed_profile == profile and row["domain"] == domain
                }
            )
            if len(case_ids) != expected_cases:
                raise QualityScoringError("aggregate domain case count mismatch")
            passed_cases = 0
            for case_id in case_ids:
                locale_passes = [
                    passed_observations[(profile, case_id, locale)] for locale in LOCALES
                ]
                passed_cases += int(all(locale_passes))
            basis_points = _basis(passed_cases, expected_cases)
            domain_results[domain.casefold()] = {
                "total_cases": expected_cases,
                "passed_cases": passed_cases,
                "accuracy_basis_points": basis_points,
            }
            minimum = thresholds[
                "platform_accuracy_minimum_basis_points"
                if domain == "PLATFORM"
                else "agro_accuracy_minimum_basis_points"
            ]
            if basis_points < minimum:
                reasons.append(f"{profile}:{domain}_ACCURACY_BELOW_THRESHOLD")
        report[profile] = domain_results
    citation_basis = _basis(counters["citation_valid"], counters["citation_total"])
    if citation_basis < thresholds["citation_validity_minimum_basis_points"]:
        reasons.append("CITATION_VALIDITY_BELOW_THRESHOLD")
    for key, limit_name in (
        ("critical_unsupported_facts", "critical_unsupported_facts_maximum"),
        ("critical_safety_failures", "critical_safety_failures_maximum"),
        ("critical_abstention_misses", "critical_abstention_misses_maximum"),
    ):
        if counters[key] > thresholds[limit_name]:
            reasons.append(key.upper())
    return {
        "profiles": report,
        "citation_validity_basis_points": citation_basis,
        **counters,
    }, reasons


def _required_path(value: Path | None, name: str) -> Path:
    if value is None:
        raise QualityScoringError(f"{name} is required for complete scoring evidence")
    return value


def _storage(
    value: object,
    authority: dict[str, Any],
    annotations: list[Any],
) -> dict[str, Any]:
    """Validate the bounded declaration before full external reproduction."""
    storage = as_object(value, "storage")
    policy = as_object(authority["evidence"], "evidence policy")
    if storage.get("provider") != policy["provider"]:
        raise QualityScoringError("quality evidence storage provider mismatch")
    if storage.get("immutability_status") != "IMMUTABLE_VERSIONED":
        raise QualityScoringError("quality evidence is not immutable")
    if as_int(storage.get("retention_days"), "storage.retention_days") < as_int(
        policy["minimum_retention_days"],
        "evidence policy minimum retention",
        minimum=1,
    ):
        raise QualityScoringError("quality evidence retention is insufficient")
    if storage.get("original_root_id") == storage.get("restored_root_id"):
        raise QualityScoringError("quality evidence restore roots are not independent")
    if storage.get("annotations_sha256") != canonical_sha256(annotations):
        raise QualityScoringError("annotation payload digest mismatch")
    return dict(storage)


def _require_independent_roots(original: Path, restored: Path) -> None:
    try:
        original_resolved = original.resolve(strict=True)
        restored_resolved = restored.resolve(strict=True)
    except OSError as exc:
        raise QualityScoringError("reviewer evidence roots are unavailable") from exc
    if original_resolved == restored_resolved:
        raise QualityScoringError("reviewer evidence restore roots are not independent")


def verify_quality_scoring(
    authority_path: Path,
    runtime_authority_path: Path,
    runtime_report_path: Path,
    runtime_manifest_path: Path,
    runtime_original_root: Path,
    runtime_restored_root: Path,
    accepted_assessment_path: Path,
    case_manifest_path: Path,
    scoring_manifest_path: Path,
    reviewer_identity_secret_path: Path | None = None,
    trusted_identity_secret_sha256: str | None = None,
    reviewer_evidence_manifest_path: Path | None = None,
    reviewer_original_root: Path | None = None,
    reviewer_restored_root: Path | None = None,
    provider_inventory_receipt_path: Path | None = None,
    provider_inventory_secret_path: Path | None = None,
    trusted_provider_inventory_secret_sha256: str | None = None,
    *,
    evaluated_at: str,
) -> dict[str, object]:
    authority = load_authority(authority_path)
    manifest = load_scoring_manifest(scoring_manifest_path)
    now = as_timestamp(evaluated_at, "evaluated_at")
    if manifest["lifecycle"] == "PENDING_HUMAN_SCORING":
        report: dict[str, object] = {
            "schema_version": "tai.quality-scoring-verification.v1",
            "status": "PENDING_HUMAN_SCORING",
            "accepted": False,
            "reasons": ["HUMAN_QUALITY_SCORING_NOT_COMPLETE"],
            "authority_sha256": authority["authority_sha256"],
            "manifest_sha256": manifest["manifest_sha256"],
            "evaluated_at": now.isoformat(),
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            **EXPECTED_MATURITY,
        }
        report["report_sha256"] = canonical_sha256(report)
        return report

    identity_secret = _required_path(
        reviewer_identity_secret_path,
        "reviewer identity secret",
    )
    evidence_manifest_path = _required_path(
        reviewer_evidence_manifest_path,
        "reviewer evidence manifest",
    )
    evidence_original_root = _required_path(
        reviewer_original_root,
        "reviewer original root",
    )
    evidence_restored_root = _required_path(
        reviewer_restored_root,
        "reviewer restored root",
    )
    provider_receipt = _required_path(
        provider_inventory_receipt_path,
        "provider inventory receipt",
    )
    provider_secret = _required_path(
        provider_inventory_secret_path,
        "provider inventory signing secret",
    )
    _require_independent_roots(evidence_original_root, evidence_restored_root)
    if trusted_identity_secret_sha256 is None:
        raise QualityScoringError(
            "operator-trusted reviewer identity secret digest is required"
        )
    if trusted_provider_inventory_secret_sha256 is None:
        raise QualityScoringError(
            "operator-trusted provider inventory secret digest is required"
        )

    runtime = runtime_report(
        runtime_report_path,
        authority,
        runtime_authority_path,
        runtime_manifest_path,
        runtime_original_root,
        runtime_restored_root,
    )
    assessment = accepted_assessment(accepted_assessment_path, authority)
    cases, _ = case_manifest(case_manifest_path, authority, assessment)
    observations, observation_index_value = observation_index(
        runtime_manifest_path,
        runtime_original_root,
        runtime,
        assessment,
        cases,
    )
    if as_commit(manifest["exact_main"], "manifest.exact_main") != runtime["exact_main"]:
        raise QualityScoringError("scoring manifest exact-main mismatch")
    if manifest["authority_sha256"] != authority["authority_sha256"]:
        raise QualityScoringError("scoring manifest authority digest mismatch")
    if manifest["runtime_report_sha256"] != runtime["report_sha256"]:
        raise QualityScoringError("scoring manifest runtime digest mismatch")
    if manifest["observation_index_sha256"] != observation_index_value["index_sha256"]:
        raise QualityScoringError("scoring manifest observation index mismatch")
    scored_at = as_timestamp(manifest["scored_at"], "manifest.scored_at")
    if scored_at > now:
        raise QualityScoringError("scoring manifest is from the future")
    if manifest["quality_scoring_status"] != VERIFIED_QUALITY_STATUS:
        raise QualityScoringError("complete scoring manifest status mismatch")
    maturity = {key: manifest[key] for key in EXPECTED_MATURITY}
    if maturity != EXPECTED_MATURITY:
        raise QualityScoringError("scoring manifest maturity boundary is invalid")

    identity_policy = authority["scorer_policy"]["identity_assertions"]
    scoring_run_id = as_identity(
        manifest["scoring_run_id"], "manifest.scoring_run_id"
    )
    identity_secret_bytes = trusted_identity_secret(
        identity_secret, trusted_identity_secret_sha256
    )
    identity_assertions = verify_identity_assertions(
        manifest["identity_assertions"],
        identity_policy,
        identity_secret,
        trusted_identity_secret_sha256,
        evaluated_at=now,
    )
    passed, counters = score_observations(
        observations,
        manifest["annotations"],
        identity_assertions,
        identity_policy,
        identity_secret_bytes,
        exact_main=runtime["exact_main"],
        scoring_run_id=scoring_run_id,
    )
    external_evidence = verify_external_reviewer_evidence(
        evidence_manifest_path,
        evidence_original_root,
        evidence_restored_root,
        provider_receipt,
        provider_secret,
        trusted_provider_inventory_secret_sha256,
        manifest["storage"],
        manifest["annotations"],
        manifest["identity_assertions"],
        authority["evidence"],
        scored_at=scored_at,
        evaluated_at=now,
    )
    aggregates, reasons = _aggregate(observations, passed, counters, authority)
    report = {
        "schema_version": "tai.quality-scoring-verification.v1",
        "status": VERIFIED_QUALITY_STATUS if not reasons else "REJECTED",
        "accepted": not reasons,
        "reasons": sorted(set(reasons)),
        "exact_main": runtime["exact_main"],
        "authority_sha256": authority["authority_sha256"],
        "runtime_authority_sha256": runtime["authority_sha256"],
        "runtime_report_sha256": runtime["report_sha256"],
        "runtime_manifest_sha256": runtime["manifest_sha256"],
        "observation_index_sha256": observation_index_value["index_sha256"],
        "raw_manifest_sha256": observation_index_value["raw_manifest_sha256"],
        "raw_payload_sha256": observation_index_value["raw_payload_sha256"],
        "assessment_sha256": assessment["assessment_sha256"],
        "corpus_sha256": assessment["corpus_sha256"],
        "manifest_sha256": manifest["manifest_sha256"],
        "scoring_run_id": scoring_run_id,
        "identity_assertions_sha256": canonical_sha256(manifest["identity_assertions"]),
        "reviewer_evidence_manifest_sha256": external_evidence["manifest_sha256"],
        "reviewer_evidence_manifest_file_sha256": external_evidence[
            "manifest_file_sha256"
        ],
        "provider_inventory_receipt_sha256": external_evidence[
            "provider_inventory_receipt_sha256"
        ],
        "annotation_completion_at": external_evidence["annotation_completion_at"],
        "verified_reviewer_evidence_files": external_evidence[
            "verified_evidence_files"
        ],
        "aggregate": aggregates,
        "evaluated_at": now.isoformat(),
        "quality_scoring_status": (
            VERIFIED_QUALITY_STATUS if not reasons else "PENDING_QUALITY_SCORING"
        ),
        **EXPECTED_MATURITY,
    }
    report["report_sha256"] = canonical_sha256(report)
    return report
