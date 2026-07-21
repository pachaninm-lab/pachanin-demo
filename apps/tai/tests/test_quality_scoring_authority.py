from __future__ import annotations

import copy
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest
from quality_scoring_fixtures import (
    EXACT_MAIN,
    NOW,
    _annotation_signature,
    _authority,
    _fixture,
    _rewrite_manifest,
    _signed,
    _verify,
)

from tai.quality_scoring import verify_quality_scoring
from tai.quality_scoring_contract import (
    EXPECTED_MATURITY,
    PROFILES,
    VERIFIED_QUALITY_STATUS,
    QualityScoringError,
    canonical_sha256,
    expected_authority,
    load_authority,
    load_json,
    load_scoring_manifest,
    write_json,
)


def _resign_annotation(
    fixture: dict[str, Any], annotation: dict[str, Any]
) -> None:
    annotation.pop("annotation_sha256", None)
    annotation.pop("annotation_signature", None)
    secret_path = fixture["identity_secret_path"]
    assert isinstance(secret_path, Path)
    annotation["annotation_signature"] = _annotation_signature(
        secret_path.read_bytes(), annotation
    )
    annotation.update(_signed(annotation, "annotation_sha256"))


def test_complete_human_quality_scoring_passes(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    report = _verify(
        fixture,
        evaluated_at=(NOW + timedelta(minutes=5)).isoformat(),
    )
    assert report["accepted"] is True
    assert report["status"] == VERIFIED_QUALITY_STATUS
    assert report["aggregate"]["citation_validity_basis_points"] == 10000
    assert report["runtime_authority_sha256"] == fixture["runtime"]["authority_sha256"]
    assert report["assessment_sha256"] == fixture["assessment"]["assessment_sha256"]
    assert report["raw_payload_sha256"] == fixture["index"]["raw_payload_sha256"]
    for profile in PROFILES:
        assert (
            report["aggregate"]["profiles"][profile]["platform"][
                "accuracy_basis_points"
            ]
            == 10000
        )
        assert (
            report["aggregate"]["profiles"][profile]["agro"]["accuracy_basis_points"]
            == 10000
        )
    assert report["benchmark_status"] == "PENDING_BENCHMARK"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_pending_baseline_is_bounded(tmp_path: Path) -> None:
    authority_path = tmp_path / "authority.json"
    authority = _authority(authority_path)
    pending = _signed(
        {
            "schema_version": "tai.quality-scoring-evidence.v1",
            "lifecycle": "PENDING_HUMAN_SCORING",
            "pending_reason": "Real runtime observations and human annotations are absent.",
            "exact_main": None,
            "authority_sha256": None,
            "runtime_report_sha256": None,
            "observation_index_sha256": None,
            "annotations": [],
            "storage": None,
            "scored_at": None,
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            **EXPECTED_MATURITY,
        },
        "manifest_sha256",
    )
    pending_path = tmp_path / "pending.json"
    write_json(pending_path, pending)
    assert load_scoring_manifest(pending_path)["lifecycle"] == "PENDING_HUMAN_SCORING"
    missing = tmp_path / "missing"
    report = verify_quality_scoring(
        authority_path,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        missing,
        pending_path,
        evaluated_at=NOW.isoformat(),
    )
    assert report["accepted"] is False
    assert report["authority_sha256"] == authority["authority_sha256"]
    assert report["quality_scoring_status"] == "PENDING_QUALITY_SCORING"


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        ("stale-response", "stale response_sha256"),
        ("missing-annotation", "coverage is incomplete"),
        ("same-scorer", "not independent"),
        ("disagreement", "open annotation disagreement"),
        ("runtime-rejected", "runtime report is not reproduced"),
        ("same-root", "restore roots are not independent"),
    ],
)
def test_contract_and_provenance_failures_are_rejected(
    tmp_path: Path, mutation: str, match: str
) -> None:
    fixture = _fixture(tmp_path)
    if mutation == "stale-response":
        annotation = fixture["manifest"]["annotations"][0]
        annotation["response_sha256"] = "f" * 64
        _resign_annotation(fixture, annotation)
        _rewrite_manifest(fixture)
    elif mutation == "missing-annotation":
        fixture["manifest"]["annotations"].pop()
        _rewrite_manifest(fixture)
    elif mutation == "same-scorer":
        critical_group = [
            row
            for row in fixture["manifest"]["annotations"]
            if row["case_id"] == "case-01"
            and row["profile_id"] == PROFILES[0]
            and row["locale"] == "ru"
        ]
        critical_group[1]["scorer_id"] = critical_group[0]["scorer_id"]
        critical_group[1]["identity_assertion_id"] = critical_group[0][
            "identity_assertion_id"
        ]
        _resign_annotation(fixture, critical_group[1])
        _rewrite_manifest(fixture)
    elif mutation == "disagreement":
        annotation = fixture["manifest"]["annotations"][0]
        annotation["disagreement_with_annotation_id"] = "ann.other"
        _resign_annotation(fixture, annotation)
        _rewrite_manifest(fixture)
    elif mutation == "runtime-rejected":
        runtime = copy.deepcopy(fixture["runtime"])
        runtime["status"] = "REJECTED"
        runtime["reasons"] = ["FAIL"]
        runtime.pop("report_sha256")
        runtime = _signed(runtime, "report_sha256")
        write_json(fixture["runtime_path"], runtime)
    else:
        fixture["manifest"]["storage"]["restored_root_id"] = fixture["manifest"][
            "storage"
        ]["original_root_id"]
        _rewrite_manifest(fixture)
    with pytest.raises(QualityScoringError, match=match):
        _verify(
            fixture,
            evaluated_at=(NOW + timedelta(minutes=5)).isoformat(),
        )


def test_runtime_payload_tamper_is_rejected_before_scoring(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    payload_path = fixture["original_root"] / "raw-observations/payload.json"
    payload = load_json(payload_path)
    payload["entries"][0]["response"] = "substituted response"
    write_json(payload_path, payload)
    with pytest.raises(
        QualityScoringError,
        match="runtime report is not reproduced from immutable evidence",
    ):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_rejected_assessment_and_forged_case_authority_are_rejected(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    assessment = copy.deepcopy(fixture["assessment"])
    assessment["accepted"] = False
    assessment["status"] = "PENDING_REVIEW"
    assessment["blocking_reasons"] = ["EXPERT_REVIEWS_MISSING"]
    assessment.pop("assessment_sha256")
    assessment = _signed(assessment, "assessment_sha256")
    write_json(fixture["assessment_path"], assessment)
    with pytest.raises(QualityScoringError, match="assessment is not accepted"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())

    fixture = _fixture(tmp_path / "forged-case")
    cases = load_json(fixture["cases_path"])
    cases["corpus_sha256"] = "f" * 64
    cases.pop("manifest_sha256")
    cases = _signed(cases, "manifest_sha256")
    write_json(fixture["cases_path"], cases)
    with pytest.raises(QualityScoringError, match="corpus digest mismatch"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_runtime_authority_weakening_is_rejected(tmp_path: Path) -> None:
    fixture = _fixture(tmp_path)
    weakened = load_json(fixture["runtime_authority_path"])
    weakened["readiness"]["maximum_age_hours"] = 999
    weakened_path = tmp_path / "weakened-runtime-authority.json"
    write_json(weakened_path, weakened)
    fixture["runtime_authority_path"] = weakened_path
    with pytest.raises(QualityScoringError, match="re-verification failed"):
        _verify(fixture, evaluated_at=(NOW + timedelta(minutes=5)).isoformat())


def test_quality_threshold_failure_is_reported_without_admission(
    tmp_path: Path,
) -> None:
    fixture = _fixture(tmp_path)
    failed_cases = {"case-01", "case-02", "case-03"}
    for annotation in fixture["manifest"]["annotations"]:
        if (
            annotation["profile_id"] == PROFILES[0]
            and annotation["case_id"] in failed_cases
        ):
            annotation["decision"] = "FAIL"
            for field in (
                "disposition_valid",
                "required_concepts_met",
                "forbidden_claims_absent",
                "citation_authority_valid",
                "citation_support_valid",
                "citation_freshness_valid",
                "abstention_valid",
            ):
                annotation[field] = False
            _resign_annotation(fixture, annotation)
    _rewrite_manifest(fixture)
    report = _verify(
        fixture,
        evaluated_at=(NOW + timedelta(minutes=5)).isoformat(),
    )
    assert report["accepted"] is False
    assert report["status"] == "REJECTED"
    assert any("ACCURACY_BELOW_THRESHOLD" in reason for reason in report["reasons"])
    assert report["quality_scoring_status"] == "PENDING_QUALITY_SCORING"
    assert report["model_admission_status"] == "PENDING_ADMISSION"


def test_duplicate_keys_and_authority_weakening_are_rejected(tmp_path: Path) -> None:
    duplicate = tmp_path / "duplicate.json"
    duplicate.write_text(
        '{"schema_version":"x","schema_version":"y"}', encoding="utf-8"
    )
    with pytest.raises(QualityScoringError, match="duplicate JSON key"):
        load_json(duplicate)
    authority = expected_authority()
    authority["thresholds"]["platform_accuracy_minimum_basis_points"] = 1
    authority_path = tmp_path / "weak-authority.json"
    write_json(authority_path, authority)
    with pytest.raises(QualityScoringError, match="differs from governed"):
        load_authority(authority_path)


def test_low_level_contract_rejections(tmp_path: Path) -> None:
    from tai import quality_scoring_contract as contract

    checks = [
        lambda: contract.as_object([], "object"),
        lambda: contract.as_array({}, "array"),
        lambda: contract.as_text("", "text"),
        lambda: contract.as_bool(1, "bool"),
        lambda: contract.as_int(True, "int"),
        lambda: contract.as_int(-1, "int", minimum=0),
        lambda: contract.as_sha256("x", "sha"),
        lambda: contract.as_commit("x", "commit"),
        lambda: contract.as_identity("bad space", "identity"),
        lambda: contract.as_timestamp("not-a-date", "time"),
        lambda: contract.as_timestamp("2026-07-21T18:00:00", "time"),
        lambda: contract.self_digest({"digest": "0" * 64}, "digest", "value"),
    ]
    for check in checks:
        with pytest.raises(QualityScoringError):
            check()

    complete_with_reason: dict[str, object] = {
        "schema_version": "tai.quality-scoring-evidence.v1",
        "lifecycle": "COMPLETE",
        "pending_reason": "not allowed",
        "exact_main": None,
        "authority_sha256": None,
        "runtime_report_sha256": None,
        "observation_index_sha256": None,
        "annotations": [],
        "storage": None,
        "scored_at": None,
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        **EXPECTED_MATURITY,
    }
    complete_with_reason["manifest_sha256"] = canonical_sha256(complete_with_reason)
    path = tmp_path / "complete-with-reason.json"
    write_json(path, complete_with_reason)
    with pytest.raises(QualityScoringError, match="cannot have pending_reason"):
        load_scoring_manifest(path)

    invalid_lifecycle = copy.deepcopy(complete_with_reason)
    invalid_lifecycle["lifecycle"] = "UNKNOWN"
    invalid_lifecycle["pending_reason"] = None
    invalid_lifecycle.pop("manifest_sha256")
    invalid_lifecycle["manifest_sha256"] = canonical_sha256(invalid_lifecycle)
    path = tmp_path / "invalid-lifecycle.json"
    write_json(path, invalid_lifecycle)
    with pytest.raises(
        QualityScoringError, match="unsupported quality scoring lifecycle"
    ):
        load_scoring_manifest(path)


def test_manifest_root_schema_and_pending_contamination_reject(tmp_path: Path) -> None:
    root = tmp_path / "root.json"
    root.write_text("[]\n", encoding="utf-8")
    with pytest.raises(QualityScoringError, match="root must be an object"):
        load_json(root)

    pending: dict[str, object] = {
        "schema_version": "tai.quality-scoring-evidence.v1",
        "lifecycle": "PENDING_HUMAN_SCORING",
        "pending_reason": "Human evidence is absent.",
        "exact_main": EXACT_MAIN,
        "authority_sha256": None,
        "runtime_report_sha256": None,
        "observation_index_sha256": None,
        "annotations": [],
        "storage": None,
        "scored_at": None,
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        **EXPECTED_MATURITY,
    }
    pending["manifest_sha256"] = canonical_sha256(pending)
    path = tmp_path / "contaminated-pending.json"
    write_json(path, pending)
    with pytest.raises(QualityScoringError, match="must remain empty"):
        load_scoring_manifest(path)

    pending["schema_version"] = "wrong"
    pending["exact_main"] = None
    pending.pop("manifest_sha256")
    pending["manifest_sha256"] = canonical_sha256(pending)
    path = tmp_path / "wrong-schema.json"
    write_json(path, pending)
    with pytest.raises(
        QualityScoringError, match="unsupported quality scoring manifest schema"
    ):
        load_scoring_manifest(path)


@pytest.mark.parametrize(
    ("field", "value", "match"),
    [
        ("exact_main", "b" * 40, "exact-main mismatch"),
        ("authority_sha256", "f" * 64, "authority digest mismatch"),
        ("runtime_report_sha256", "f" * 64, "runtime digest mismatch"),
        ("observation_index_sha256", "f" * 64, "observation index mismatch"),
        (
            "scored_at",
            (NOW + timedelta(minutes=10)).isoformat(),
            "from the future",
        ),
        (
            "quality_scoring_status",
            "PENDING_QUALITY_SCORING",
            "status mismatch",
        ),
    ],
)
def test_complete_manifest_bindings_fail_closed(
    tmp_path: Path, field: str, value: object, match: str
) -> None:
    fixture = _fixture(tmp_path)
    fixture["manifest"][field] = value
    _rewrite_manifest(fixture)
    with pytest.raises(QualityScoringError, match=match):
        _verify(
            fixture,
            evaluated_at=(NOW + timedelta(minutes=5)).isoformat(),
        )
