from __future__ import annotations

import copy
from collections.abc import Callable
from datetime import timedelta
from pathlib import Path
from typing import Any

import pytest

from tai.quality_scoring import _aggregate
from tai.quality_scoring_contract import (
    PROFILES,
    VERIFIED_QUALITY_STATUS,
    QualityScoringError,
    as_array,
    as_bool,
    as_commit,
    as_identity,
    as_int,
    as_number,
    as_object,
    as_optional_text,
    as_relative_path,
    as_sha256,
    as_text,
    as_timestamp,
    as_unique_texts,
    canonical_sha256,
    file_sha256,
    load_authority,
    load_json,
    require_keys,
    self_digest,
    write_json,
)
from tai.quality_scoring_files import load_declared_json, parse_file_records
from tai.quality_scoring_inputs import (
    load_assessment,
    load_case_authority,
    load_runtime_manifest,
    load_runtime_report,
)
from test_quality_scoring import (
    EVALUATED_AT,
    MAIN_SHA,
    _seal,
    build_fixture,
)


@pytest.mark.parametrize(
    ("call", "message"),
    [
        (lambda: as_object([], "x"), "object"),
        (lambda: as_array({}, "x"), "array"),
        (lambda: as_text("", "x"), "non-blank"),
        (lambda: as_bool(1, "x"), "boolean"),
        (lambda: as_int(True, "x"), "integer"),
        (lambda: as_int(-1, "x"), "allowed range"),
        (lambda: as_number(False, "x"), "numeric"),
        (lambda: as_sha256("x" * 64, "x"), "SHA-256"),
        (lambda: as_commit("a" * 39, "x"), "Git commit"),
        (lambda: as_identity("bad space", "x"), "portable identity"),
        (lambda: as_timestamp("not-a-time", "x"), "ISO-8601"),
        (lambda: as_timestamp("2026-07-21T12:00:00", "x"), "timezone-aware"),
        (lambda: as_unique_texts(["x", "x"], "x"), "unique"),
        (lambda: as_relative_path("../x", "x"), "traversal"),
        (lambda: as_relative_path("/x", "x"), "relative path"),
    ],
)
def test_contract_fail_closed_helpers(call: Callable[[], object], message: str) -> None:
    with pytest.raises(QualityScoringError, match=message):
        call()
    assert as_optional_text(None, "x") is None
    assert as_optional_text("ok", "x") == "ok"


def test_contract_io_and_digest_failures(tmp_path: Path) -> None:
    array_path = tmp_path / "array.json"
    array_path.write_text("[]", encoding="utf-8")
    with pytest.raises(QualityScoringError, match="root must be an object"):
        load_json(array_path)
    with pytest.raises(QualityScoringError, match="cannot hash"):
        file_sha256(tmp_path / "missing")
    with pytest.raises(QualityScoringError, match="keys invalid"):
        require_keys({"x": 1}, {"y"}, "value")
    with pytest.raises(QualityScoringError, match="digest mismatch"):
        self_digest({"x": 1, "sha": "0" * 64}, "sha", "value")


def test_file_record_limits_and_set_are_fail_closed(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    manifest = load_json(fixture.manifest_path)
    files = manifest["evidence_files"]

    duplicate = copy.deepcopy(files)
    duplicate[1]["path"] = duplicate[0]["path"]
    with pytest.raises(QualityScoringError, match="duplicate evidence path"):
        parse_file_records(duplicate, authority)

    missing = files[:-1]
    with pytest.raises(QualityScoringError, match="file set mismatch"):
        parse_file_records(missing, authority)

    too_large = copy.deepcopy(files)
    too_large[0]["size_bytes"] = authority["evidence"]["maximum_file_size_bytes"] + 1
    with pytest.raises(QualityScoringError, match="exceeds size"):
        parse_file_records(too_large, authority)

    limited = copy.deepcopy(authority)
    limited["evidence"]["maximum_file_count"] = 1
    with pytest.raises(QualityScoringError, match="count exceeds"):
        parse_file_records(files, limited)

    with pytest.raises(QualityScoringError, match="undeclared semantic evidence"):
        load_declared_json(fixture.original_root, {}, "quality/annotations.json")


def test_runtime_report_and_manifest_negative_matrix(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    report = load_json(fixture.runtime_report_path)

    bad_report = copy.deepcopy(report)
    bad_report["status"] = "REJECTED"
    _seal(bad_report, "report_sha256")
    path = tmp_path / "bad-report.json"
    write_json(path, bad_report)
    with pytest.raises(QualityScoringError, match="not verified"):
        load_runtime_report(path, authority)

    report_parsed = load_runtime_report(fixture.runtime_report_path, authority)
    manifest = load_json(fixture.runtime_manifest_path)
    simulated = copy.deepcopy(manifest)
    simulated["readiness"]["simulated"] = True
    simulated_path = tmp_path / "simulated.json"
    write_json(simulated_path, simulated)
    forged_report = copy.deepcopy(report)
    forged_report["manifest_sha256"] = canonical_sha256(simulated)
    _seal(forged_report, "report_sha256")
    forged_path = tmp_path / "forged-report.json"
    write_json(forged_path, forged_report)
    with pytest.raises(QualityScoringError, match="readiness is not accepted"):
        load_runtime_manifest(
            simulated_path,
            load_runtime_report(forged_path, authority),
            authority,
            EVALUATED_AT,
        )

    stale = copy.deepcopy(manifest)
    stale["measured_at"] = (EVALUATED_AT - timedelta(days=181)).isoformat()
    stale_path = tmp_path / "stale.json"
    write_json(stale_path, stale)
    stale_report = copy.deepcopy(report)
    stale_report["manifest_sha256"] = canonical_sha256(stale)
    _seal(stale_report, "report_sha256")
    write_json(forged_path, stale_report)
    with pytest.raises(QualityScoringError, match="stale"):
        load_runtime_manifest(
            stale_path,
            load_runtime_report(forged_path, authority),
            authority,
            EVALUATED_AT,
        )
    assert report_parsed["exact_main"] == MAIN_SHA


def test_assessment_and_case_authority_negative_matrix(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    assessment = load_json(fixture.assessment_path)

    blocked = copy.deepcopy(assessment)
    blocked["blocking_reasons"] = ["OPEN"]
    _seal(blocked, "assessment_sha256")
    path = tmp_path / "blocked-assessment.json"
    write_json(path, blocked)
    with pytest.raises(QualityScoringError, match="review blockers"):
        load_assessment(path, authority)

    bad_target = copy.deepcopy(assessment)
    bad_target["quality_targets"]["platform_accuracy_minimum"] = 0.5
    _seal(bad_target, "assessment_sha256")
    write_json(path, bad_target)
    with pytest.raises(QualityScoringError, match="targets mismatch"):
        load_assessment(path, authority)

    accepted = load_assessment(fixture.assessment_path, authority)
    cases = load_json(fixture.case_authority_path)
    cases["counts"]["total"] = 57
    _seal(cases, "authority_sha256")
    case_path = tmp_path / "bad-cases.json"
    write_json(case_path, cases)
    with pytest.raises(QualityScoringError, match="counts mismatch"):
        load_case_authority(case_path, authority, MAIN_SHA, accepted)


def _mutate_annotations(
    fixture: Any, mutate: Callable[[list[dict[str, Any]]], None]
) -> None:
    value = fixture.json("quality/annotations.json")
    mutate(value["annotations"])
    for row in value["annotations"]:
        row["annotation_sha256"] = canonical_sha256(
          {key: value for key, value in row.items() if key != "annotation_sha256"}
        )
    value["annotations_sha256"] = canonical_sha256(value["annotations"])
    fixture.rewrite_quality_file("quality/annotations.json", value)


@param.parametrize(
    ("mutate", "match"),
    [
        (lambda rows: rows.pop(), "incomplete"),
        (lambda rows: rows.append(copy.deepcopy(rows[0])), "duplicate annotation_id"),
        (lambda rows: rows[0].__setitem__("scorer_kind", "LLM"), "scorer_kind"),
        (lambda rows: rows[0].__setitem__("scorer_role", "SECURITY_REVIEWER"), "domain primary"),
        (lambda rows: rows[0].__setitem__("decision", "REJECTED"), "has non-approved history"),
        (lambda rows: rows[0].__setitem__("observed_status", "REJECTED"), "status mismatch"),
        (lambda rows: rows[0].__setitem__("observed_concepts", []), "required concept missing"),
        (lambda rows: rows[0].__setitem__("observed_forbidden_claims", ["BAD"]), "forbidden claims included"),
        (lambda rows: rows[0].__setitem__("citations", []), "trusted citation missing"),
        (lambda rows: rows[0].__setitem__("unsupported_fact_count", 1), "unsupported fact"),
        (lambda rows: rows[0].__setitem__("safety_failure_count", 1), "safety failure"),
        (lambda rows: rows[0].__setitem__("abstention_reason", "NOT_ALLOWED"), "abstention reason"),
        (lambda rows: rows[0].__setitem__("disagreement_with_annotation_id", "other"), "disagreement or conflict history"),
        (lambda rows: rows[0].__setitem__("evidence_sha256", "0" * 64), "placeholder"),
    ],
)
def test_annotation_failure_matrix(
    tmp_path: Path,
    mutate: Callable[[list[dict[str, Any]]], None],
    match: str,
) -> None:
    fixture = build_fixture(tmp_path)
    _mutate_annotations(fixture, mutate)
    with pytest.raises(QualityScoringError, match=match):
        fixture.verify()


def test_future_annotation_is_rejected(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    value = fixture.json("quality/annotations.json")
    value["annotations"][0]["scored_at"] = (EVALUATED_AT + timedelta(minutes=10)).isoformat()
    for row in value["annotations"]:
        row["annotation_sha256"] = canonical_sha256(
          {key: item for key, item in row.items() if key != "annotation_sha256"}
        )
    value["annotations_sha256"] = canonical_sha256(value["annotations"])
    fixture.rewrite_quality_file("quality/annotations.json", value)
    with pytest.raises(QualityScoringError, match="from the future"):
        fixture.verify()


def test_aggregate_guards_and_critical_counters(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    assessment = load_assessment(fixture.assessment_path, authority)
    cases, _ = load_case_authority(
        fixture.case_authority_path, authority, MAIN_SHA, assessment
    )
    with pytest.raises(QualityScoringError, match="coverage is incomplete"):
        _aggregate(cases, {}, {"citation_total": 0, "citation_valid": 0}, authority)

    passed = {
        (profile, case_id, locale): True
        for profile in PROFILES
        for case_id in cases
        for locale in ("ru", "en", "zh")
    }
    counters = {
        "citation_total": 1,
        "citation_valid": 0,
        "critical_unsupported_facts": 1,
        "critical_safety_failures": 1,
        "critical_abstention_misses": 1,
    }
    _, trusons = _aggregate(cases, passed, counters, authority)
    assert "CITATION_VALIDITY_BELOW_THRESHOLD" in reasons
    assert "CRITICAL_UNSUPPORTED_FACTS" in reasons
    assert "CRITICAL_SAFETY_FAILURES" in reasons
    assert "CRITICAL_ABSTENTION_MISSES" in reasons


def test_additional_manifest_and_storage_guards(tmp_path: Path) -> None:
    from tai.quality_scoring import _basis

    fixture = build_fixture(tmp_path)
    manifest = load_json(fixture.manifest_path)
    manifest["quality_scoring_status"] = VERIFIED_QUALITY_STATUS
    _seal(manifest, "manifest_sha256")
    write_json(fixture.manifest_path, manifest)
    with pytest.raises(QualityScoringError, match="cannot pre-claim"):
        fixture.verify()

    fixture = build_fixture(tmp_path / "locator")
    storage = fixture.json("quality/storage-manifest.json")
    storage["immutable_locator"] = "s3://mutable"
    _seal(storage, "storage_sha256")
    fixture.rewrite_quality_file("quality/storage-manifest.json", storage)
    with pytest.raises(QualityScoringError, match="not immutable"):
        fixture.verify()

    fixture = build_fixture(tmp_path / "root-id")
    storage = fixture.json("quality/storage-manifest.json")
    storage["restored_root_id"] = storage["original_root_id"]
    _seal(storage, "storage_sha256")
    fixture.rewrite_quality_file("quality/storage-manifest.json", storage)
    with pytest.raises(QualityScoringError, match="not independent"):
        fixture.verify()

    with pytest.raises(QualityScoringError, match="denominator"):
        _basis(1, 0)


def test_additional_evidence_root_guards(tmp_path: Path) -> None:
    from tai.quality_scoring_files import verify_evidence_roots

    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    manifest = load_json(fixture.manifest_path)
    records = parse_file_records(manifest["evidence_files"], authority)

    with pytest.raises(QualityScoringError, match="roots must exist"):
        verify_evidence_roots(records, tmp_path / "missing", fixture.restored_root)

    extra = fixture.original_root / "quality" / "extra.json"
    extra.write_text("{}", encoding="utf-8")
    with pytest.raises(QualityScoringError, match="original evidence root"):
        verify_evidence_roots(records, fixture.original_root, fixture.restored_root)
    extra.unlink()

    extra = fixture.restored_root / "quality" / "extra.json"
    extra.write_text("{}", encoding="utf-8")
    with pytest.raises(QualityScoringError, match="restored evidence root"):
        verify_evidence_roots(records, fixture.original_root, fixture.restored_root)


def test_additional_runtime_input_guards(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    report = load_json(fixture.runtime_report_path)

    bad_profiles = copy.deepcopy(report)
    bad_profiles["runtime_profiles"] = {PROFILES[0]: "MEASURED"}
    _seal(bad_profiles, "report_sha256")
    path = tmp_path / "bad-profiles.json"
    write_json(path, bad_profiles)
    with pytest.raises(QualityScoringError, match="profile verification"):
        load_runtime_report(path, authority)

    bad_count = copy.deepcopy(report)
    bad_count["raw_observation_count"] = 347
    _seal(bad_count, "report_sha256")
    write_json(path, bad_count)
    with pytest.raises(QualityScoringError, match="raw observation count"):
        load_runtime_report(path, authority)

    manifest = load_json(fixture.runtime_manifest_path)
    bad_corpus = copy.deepcopy(manifest)
    bad_corpus["corpus"]["accepted"] = False
    bad_report = copy.deepcopy(report)
    bad_report["manifest_sha256"] = canonical_sha256(bad_corpus)
    _seal(bad_report, "report_sha256")
    write_json(path, bad_report)
    manifest_path = tmp_path / "bad-corpus.json"
    write_json(manifest_path, bad_corpus)
    with pytest.raises(QualityScoringError, match="corpus is not accepted"):
        load_runtime_manifest(
            manifest_path,
            load_runtime_report(path, authority),
            authority,
            EVALUATED_AT,
        )


def test_additional_case_and_annotation_guards(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    assessment = load_assessment(fixture.assessment_path, authority)
    cases = load_json(fixture.case_authority_path)
    cases["cases"][0]["domain"] = "OTHER"
    cases["cases"][0]["case_sha256"] = canonical_sha256(
        {key: value for key, value in cases["cases"][0].items() if key != "case_sha256"]
    )
    _seal(cases, "authority_sha256")
    path = tmp_path / "bad-domain.json"
    write_json(path, cases)
    with pytest.raises(QualityScoringError, match="domain is invalid"):
        load_case_authority(path, authority, MAIN_SHA, assessment)

    fixture = build_fixture(tmp_path / "stale-ann")
    annotations = fixture.json("quality/annotations.json")
    annotations["annotations"][0]["case_sha256"] = "a" * 64
    annotations["annotations"][0]["annotation_sha256"] = canonical_sha256(
        {
            key: value
            for key, value in annotations["annotations"][0].items()
            if key != "annotation_sha256"
        }
    )
    _seal(annotations, "annotations_sha256")
    fixture.rewrite_quality_file("quality/annotations.json", annotations)
    with pytest.raises(QualityScoringError, match="stale case_sha256"):
        fixture.verify()


def test_trust_binding_and_authority_copy_guards(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    manifest = load_json(fixture.manifest_path)
    manifest["trusted_runtime_report_sha256"] = "a" * 64
    _seal(manifest, "manifest_sha256")
    write_json(fixture.manifest_path, manifest)
    with pytest.raises(QualityScoringError, match="trust binding mismatch"):
        fixture.verify()

    fixture = build_fixture(tmp_path / "case-copy")
    copied = fixture.json("quality/case-authority.json")
    copied["authority_sha256"] = "b" * 64
    fixture.rewrite_quality_file("quality/case-authority.json", copied)
    with pytest.raises(QualityScoringError, match="copy differs"):
        fixture.verify()


def test_assessment_copy_guard(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    copied = fixture.json("quality/gold-assessment.json")
    copied["version"] = "forged"
    fixture.rewrite_quality_file("quality/gold-assessment.json", copied)
    with pytest.raises(QualityScoringError, match="assessment copy differs"):
        fixture.verify()
