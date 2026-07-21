from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest

from tai.quality_scoring import verify_quality_scoring
from tai.quality_scoring_annotations import score_annotations
from tai.quality_scoring_contract import (
    EXPECTED_QUALITY_MATURITY,
    PROFILES,
    VERIFIED_QUALITY_STATUS,
    QualityScoringError,
    canonical_sha256,
    expected_authority,
    file_sha256,
    load_authority,
    load_json,
    write_json,
)
from tai.quality_scoring_files import parse_file_records, verify_evidence_roots
from tai.quality_scoring_inputs import (
    load_assessment,
    load_case_authority,
    load_runtime_manifest,
    load_runtime_raw_manifest,
    load_runtime_report,
)

MAIN_SHA = "4fec4797f3ef8191c849438b02b83940f1c4c24f"
MEASURED_AT = datetime(2026, 7, 21, 15, 0, tzinfo=UTC)
SCORED_AT = datetime(2026, 7, 21, 16, 0, tzinfo=UTC)
EVALUATED_AT = datetime(2026, 7, 21, 17, 0, tzinfo=UTC)


def _sha(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _seal(value: dict[str, Any], field: str) -> dict[str, Any]:
    value[field] = canonical_sha256(
        {key: item for key, item in value.items() if key != field}
    )
    return value


def _write(path: Path, value: dict[str, Any]) -> None:
    write_json(path, value)


def _record(path: Path, relative: str) -> dict[str, Any]:
    return {
        "path": relative,
        "sha256": file_sha256(path),
        "size_bytes": path.stat().st_size,
    }


def _case(index: int) -> dict[str, Any]:
    domain = "PLATFORM" if index < 42 else "AGRO"
    critical = index < 23
    case_id = f"{domain.casefold()}.case.{index:02d}"
    prompts = {
        locale: _sha(f"prompt:{case_id}:{locale}") for locale in ("ru", "en", "zh")
    }
    case: dict[str, Any] = {
        "case_id": case_id,
        "domain": domain,
        "criticality": "CRITICAL" if critical else "HIGH",
        "variant_kind": "GOVERNED",
        "prompt_sha256_by_locale": prompts,
        "expected_statuses": ["ANSWERED"],
        "required_concepts": [f"CONCEPT_{index:02d}"],
        "forbidden_claims": [f"FORBIDDEN_{index:02d}"],
        "expected_citations": [f"source.{index:02d}"],
        "abstention_reason_codes": [],
        "coverage_family_id": f"family.{index:02d}",
        "case_sha256": "0" * 64,
    }
    case["case_sha256"] = canonical_sha256(
        {key: value for key, value in case.items() if key != "case_sha256"}
    )
    return case


def _assessment(corpus_sha: str) -> dict[str, Any]:
    return _seal(
        {
            "schema_version": "tai.gold-set-assessment.v1",
            "version": "2026.07.21.1",
            "accepted": True,
            "status": "ACCEPTED",
            "corpus_sha256": corpus_sha,
            "component_sha256": {
                "platform_sha256": _sha("platform"),
                "agro_sha256": _sha("agro"),
                "coverage_sha256": _sha("coverage"),
                "reviews_sha256": _sha("reviews"),
            },
            "counts": {
                "platform_cases": 42,
                "agro_cases": 16,
                "total_cases": 58,
                "critical_cases": 23,
                "reviewed_cases": 58,
                "unreviewed_cases": 0,
                "platform_roles": 12,
                "deal_states": 23,
                "agro_topics": 8,
                "locales": 3,
            },
            "quality_targets": {
                "platform_accuracy_minimum": 0.95,
                "agro_accuracy_minimum": 0.9,
                "critical_unsupported_facts_maximum": 0,
                "citation_validity_minimum": 1,
            },
            "blocking_reasons": [],
            "missing_review_case_ids": [],
            "assessment_sha256": "0" * 64,
        },
        "assessment_sha256",
    )


def _runtime_case_manifest(
    cases: list[dict[str, Any]], assessment: dict[str, Any]
) -> dict[str, Any]:
    return {
        "schema_version": "tai.runtime-corpus-manifest.v1",
        "suite_id": "tai-platform-agro-58-v1",
        "assessment_sha256": assessment["assessment_sha256"],
        "corpus_sha256": assessment["corpus_sha256"],
        "locales": ["ru", "en", "zh"],
        "cases": [
            {
                "case_id": case["case_id"],
                "critical": case["criticality"] == "CRITICAL",
                "prompt_sha256_by_locale": case["prompt_sha256_by_locale"],
            }
            for case in cases
        ],
    }


def _raw(cases: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    manifest_entries: list[dict[str, Any]] = []
    payload_entries: list[dict[str, Any]] = []
    for profile in PROFILES:
        for case in cases:
            for locale in ("ru", "en", "zh"):
                prompt = f"prompt:{case['case_id']}:{locale}"
                response = f"response:{profile}:{case['case_id']}:{locale}"
                request_id = f"req:{profile}:{case['case_id']}:{locale}"
                started = MEASURED_AT
                completed = started + timedelta(seconds=1)
                trace = _sha(f"trace:{request_id}")
                manifest_entries.append(
                    {
                        "case_id": case["case_id"],
                        "locale": locale,
                        "profile_id": profile,
                        "request_id": request_id,
                        "prompt_sha256": _sha(prompt),
                        "response_sha256": _sha(response),
                        "status": "ANSWERED",
                        "started_at": started.isoformat(),
                        "completed_at": completed.isoformat(),
                        "trace_sha256": trace,
                    }
                )
                payload_entries.append(
                    {
                        "case_id": case["case_id"],
                        "locale": locale,
                        "profile_id": profile,
                        "request_id": request_id,
                        "prompt": prompt,
                        "response": response,
                        "status": "ANSWERED",
                        "started_at": started.isoformat(),
                        "completed_at": completed.isoformat(),
                        "trace_sha256": trace,
                    }
                )
    return (
        {
            "schema_version": "tai.raw-model-observations.v1",
            "suite_id": "tai-platform-agro-58-v1",
            "profile_ids": list(PROFILES),
            "entries": manifest_entries,
        },
        {
            "schema_version": "tai.raw-model-observation-payload.v1",
            "suite_id": "tai-platform-agro-58-v1",
            "entries": payload_entries,
        },
    )


def _observation(entry: dict[str, Any]) -> dict[str, Any]:
    value = {
        "profile_id": entry["profile_id"],
        "case_id": entry["case_id"],
        "locale": entry["locale"],
        "request_id": entry["request_id"],
        "prompt_sha256": entry["prompt_sha256"],
        "response_sha256": entry["response_sha256"],
        "trace_sha256": entry["trace_sha256"],
        "terminal_status": entry["status"],
        "started_at": datetime.fromisoformat(entry["started_at"]).isoformat(),
        "completed_at": datetime.fromisoformat(entry["completed_at"]).isoformat(),
    }
    value["observation_sha256"] = canonical_sha256(value)
    return value


def _annotations(
    cases: list[dict[str, Any]], raw_manifest: dict[str, Any]
) -> dict[str, Any]:
    by_case = {case["case_id"]: case for case in cases}
    rows: list[dict[str, Any]] = []
    for number, entry in enumerate(raw_manifest["entries"]):
        case = by_case[entry["case_id"]]
        observation = _observation(entry)
        primary_role = (
            "PLATFORM_OWNER" if case["domain"] == "PLATFORM" else "DOMAIN_EXPERT"
        )
        roles = [primary_role]
        if case["criticality"] == "CRITICAL":
            roles.append("SECURITY_REVIEWER")
        for role_index, role in enumerate(roles):
            row: dict[str, Any] = {
                "schema_version": "tai.quality-annotation.v2",
                "annotation_id": f"ann.{number:03d}.{role_index}",
                "profile_id": entry["profile_id"],
                "case_id": entry["case_id"],
                "case_sha256": case["case_sha256"],
                "locale": entry["locale"],
                "observation_sha256": observation["observation_sha256"],
                "prompt_sha256": entry["prompt_sha256"],
                "response_sha256": entry["response_sha256"],
                "trace_sha256": entry["trace_sha256"],
                "scorer_id": f"human.{role.casefold()}.{role_index}",
                "scorer_role": role,
                "scorer_kind": "HUMAN",
                "scored_at": (SCORED_AT - timedelta(minutes=1)).isoformat(),
                "evidence_sha256": _sha(f"evidence:{number}:{role_index}"),
                "decision": "APPROVED",
                "observed_status": "ANSWERED",
                "observed_concepts": list(case["required_concepts"]),
                "observed_forbidden_claims": [],
                "citations": [
                    {
                        "source_id": source,
                        "valid": True,
                        "fresh": True,
                        "supports": True,
                    }
                    for source in case["expected_citations"]
                ],
                "abstention_reason": None,
                "unsupported_fact_count": 0,
                "safety_failure_count": 0,
                "disagreement_with_annotation_id": None,
                "annotation_sha256": "0" * 64,
            }
            row["annotation_sha256"] = canonical_sha256(
                {key: value for key, value in row.items() if key != "annotation_sha256"}
            )
            rows.append(row)
    return _seal(
        {
            "schema_version": "tai.quality-annotations.v2",
            "annotations": rows,
            "annotations_sha256": "0" * 64,
        },
        "annotations_sha256",
    )


def _runtime_manifest(
    assessment: dict[str, Any], semantic_records: list[dict[str, Any]]
) -> dict[str, Any]:
    return {
        "schema_version": "tai.cpu-runtime-evidence.v1",
        "lifecycle": "COMPLETE",
        "pending_reason": None,
        "exact_main": MAIN_SHA,
        "readiness": {
            "schema_version": "tai.cpu-benchmark-execution-readiness.v1",
            "status": "READY_FOR_EXTERNAL_EXECUTION",
            "ready": True,
            "exact_main": MAIN_SHA,
            "evaluated_at": (MEASURED_AT - timedelta(minutes=10)).isoformat(),
            "report_sha256": _sha("readiness"),
            "simulated": False,
        },
        "bundle_finalization": {"status": "VERIFIED"},
        "corpus": {
            "suite_id": "tai-platform-agro-58-v1",
            "status": "ACCEPTED",
            "accepted": True,
            "assessment_sha256": assessment["assessment_sha256"],
            "corpus_sha256": assessment["corpus_sha256"],
            "total_cases": 58,
            "critical_cases": 23,
            "locales": ["ru", "en", "zh"],
            "unreviewed_cases": 0,
            "case_manifest_path": "suite/case-manifest.json",
            "raw_observation_count": 348,
        },
        "runtime_profiles": [
            {"profile_id": profile, "status": "MEASURED"} for profile in PROFILES
        ],
        "fallback_exercise": {"status": "PASSED"},
        "soak": {"status": "PASSED"},
        "raw_observations": {
            "manifest_path": "raw-observations/manifest.json",
            "payload_path": "raw-observations/payload.json",
            "observation_count": 348,
        },
        "evidence_files": semantic_records,
        "storage": {"status": "IMMUTABLE"},
        "measured_at": MEASURED_AT.isoformat(),
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        "benchmark_status": "PENDING_BENCHMARK",
        "model_admission_status": "PENDING_ADMISSION",
        "production_operational_status": "NOT_ATTESTED",
    }


def _runtime_report(runtime_manifest: dict[str, Any]) -> dict[str, Any]:
    total = sum(int(row["size_bytes"]) for row in runtime_manifest["evidence_files"])
    return _seal(
        {
            "schema_version": "tai.cpu-runtime-evidence-verification.v1",
            "status": "RUNTIME_EVIDENCE_VERIFIED_PENDING_QUALITY_SCORING",
            "authority_sha256": _sha("runtime-authority"),
            "manifest_sha256": canonical_sha256(runtime_manifest),
            "exact_main": MAIN_SHA,
            "runtime_profiles": {profile: "MEASURED" for profile in PROFILES},
            "raw_observation_count": 348,
            "evidence_file_count": len(runtime_manifest["evidence_files"]),
            "evidence_total_size_bytes": total,
            "reasons": [],
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            "benchmark_status": "PENDING_BENCHMARK",
            "model_admission_status": "PENDING_ADMISSION",
            "production_operational_status": "NOT_ATTESTED",
            "report_sha256": "0" * 64,
        },
        "report_sha256",
    )


def _storage() -> dict[str, Any]:
    archive_sha = _sha("quality-archive")
    return _seal(
        {
            "schema_version": "tai.quality-storage-manifest.v2",
            "provider": "SELECTEL_S3",
            "immutable_locator": (
                "s3+version://tai-evidence/quality/2993?versionId=v1"
                f"#sha256={archive_sha}"
            ),
            "archive_sha256": archive_sha,
            "archive_size_bytes": 1_000_000,
            "object_version_id": "v1",
            "retention_days": 90,
            "uploaded_at": (SCORED_AT - timedelta(minutes=10)).isoformat(),
            "restored_at": (SCORED_AT - timedelta(minutes=5)).isoformat(),
            "original_root_id": "quality-original-v1",
            "restored_root_id": "quality-restore-v1",
            "storage_sha256": "0" * 64,
        },
        "storage_sha256",
    )


@dataclass
class Fixture:
    root: Path
    authority_path: Path
    manifest_path: Path
    runtime_report_path: Path
    runtime_manifest_path: Path
    assessment_path: Path
    case_authority_path: Path
    original_root: Path
    restored_root: Path

    def verify(self) -> dict[str, object]:
        return verify_quality_scoring(
            self.authority_path,
            self.manifest_path,
            self.runtime_report_path,
            self.runtime_manifest_path,
            self.assessment_path,
            self.case_authority_path,
            self.original_root,
            self.restored_root,
            evaluated_at=EVALUATED_AT.isoformat(),
        )

    def json(self, relative: str) -> dict[str, Any]:
        return load_json(self.original_root / relative)

    def rewrite_quality_file(self, relative: str, value: dict[str, Any]) -> None:
        for root in (self.original_root, self.restored_root):
            _write(root / relative, value)
        self.rebuild_manifest()

    def rebuild_manifest(self) -> None:
        manifest = load_json(self.manifest_path)
        manifest["evidence_files"] = [
            _record(self.original_root / relative, relative)
            for relative in expected_authority()["evidence"]["required_files"]
        ]
        _seal(manifest, "manifest_sha256")
        _write(self.manifest_path, manifest)


def build_fixture(tmp_path: Path) -> Fixture:
    authority = expected_authority()
    authority_path = tmp_path / "authority.json"
    _write(authority_path, authority)
    authority_sha = canonical_sha256(authority)

    cases = [_case(index) for index in range(58)]
    corpus_sha = canonical_sha256(cases)
    assessment = _assessment(corpus_sha)
    case_authority = _seal(
        {
            "schema_version": "tai.quality-case-authority.v1",
            "exact_main": MAIN_SHA,
            "suite_id": "tai-platform-agro-58-v1",
            "assessment_sha256": assessment["assessment_sha256"],
            "corpus_sha256": assessment["corpus_sha256"],
            "counts": {"total": 58, "platform": 42, "agro": 16, "critical": 23},
            "locales": ["ru", "en", "zh"],
            "cases": cases,
            "authority_sha256": "0" * 64,
        },
        "authority_sha256",
    )
    runtime_case = _runtime_case_manifest(cases, assessment)
    raw_manifest, raw_payload = _raw(cases)
    annotations = _annotations(cases, raw_manifest)
    storage = _storage()

    staging = tmp_path / "staging"
    staging.mkdir()
    semantic_sources = {
        "suite/case-manifest.json": runtime_case,
        "raw-observations/manifest.json": raw_manifest,
        "raw-observations/payload.json": raw_payload,
    }
    runtime_records = []
    for relative, value in semantic_sources.items():
        path = staging / relative
        _write(path, value)
        runtime_records.append(_record(path, relative))
    runtime_manifest = _runtime_manifest(assessment, runtime_records)
    runtime_report = _runtime_report(runtime_manifest)

    trusted = tmp_path / "trusted"
    trusted.mkdir()
    runtime_report_path = trusted / "runtime-report.json"
    runtime_manifest_path = trusted / "runtime-manifest.json"
    assessment_path = trusted / "assessment.json"
    case_authority_path = trusted / "case-authority.json"
    _write(runtime_report_path, runtime_report)
    _write(runtime_manifest_path, runtime_manifest)
    _write(assessment_path, assessment)
    _write(case_authority_path, case_authority)

    original_root = tmp_path / "quality-original"
    restored_root = tmp_path / "quality-restored"
    originals = {
        "quality/runtime-verification.json": runtime_report,
        "quality/runtime-manifest.json": runtime_manifest,
        "quality/gold-assessment.json": assessment,
        "quality/case-authority.json": case_authority,
        "quality/runtime-case-manifest.json": runtime_case,
        "quality/runtime-raw-manifest.json": raw_manifest,
        "quality/runtime-raw-payload.json": raw_payload,
        "quality/annotations.json": annotations,
        "quality/storage-manifest.json": storage,
    }
    for root in (original_root, restored_root):
        for relative, value in originals.items():
            _write(root / relative, value)

    evidence_files = [
        _record(original_root / relative, relative)
        for relative in authority["evidence"]["required_files"]
    ]
    manifest = _seal(
        {
            "schema_version": "tai.quality-scoring-evidence.v2",
            "lifecycle": "COMPLETE",
            "pending_reason": None,
            "authority_sha256": authority_sha,
            "exact_main": MAIN_SHA,
            "trusted_runtime_report_sha256": runtime_report["report_sha256"],
            "trusted_runtime_manifest_sha256": canonical_sha256(runtime_manifest),
            "trusted_assessment_sha256": assessment["assessment_sha256"],
            "trusted_case_authority_sha256": case_authority["authority_sha256"],
            "runtime_report_path": "quality/runtime-verification.json",
            "runtime_manifest_path": "quality/runtime-manifest.json",
            "assessment_path": "quality/gold-assessment.json",
            "case_authority_path": "quality/case-authority.json",
            "runtime_case_manifest_path": "quality/runtime-case-manifest.json",
            "runtime_raw_manifest_path": "quality/runtime-raw-manifest.json",
            "runtime_raw_payload_path": "quality/runtime-raw-payload.json",
            "annotations_path": "quality/annotations.json",
            "storage_manifest_path": "quality/storage-manifest.json",
            "evidence_files": evidence_files,
            "scored_at": SCORED_AT.isoformat(),
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            **EXPECTED_QUALITY_MATURITY,
            "manifest_sha256": "0" * 64,
        },
        "manifest_sha256",
    )
    manifest_path = tmp_path / "scoring-manifest.json"
    _write(manifest_path, manifest)
    return Fixture(
        root=tmp_path,
        authority_path=authority_path,
        manifest_path=manifest_path,
        runtime_report_path=runtime_report_path,
        runtime_manifest_path=runtime_manifest_path,
        assessment_path=assessment_path,
        case_authority_path=case_authority_path,
        original_root=original_root,
        restored_root=restored_root,
    )


def test_authority_is_exact(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    assert authority["authority_sha256"] == canonical_sha256(expected_authority())
    modified = expected_authority()
    modified["scorer_policy"]["llm_judge_allowed"] = True
    _write(fixture.authority_path, modified)
    with pytest.raises(QualityScoringError, match="governed contract"):
        load_authority(fixture.authority_path)


def test_complete_human_scoring_is_verified(tmp_path: Path) -> None:
    report = build_fixture(tmp_path).verify()
    assert report["accepted"] is True
    assert report["status"] == VERIFIED_QUALITY_STATUS
    assert report["observation_count"] == 348
    assert report["annotation_count"] == 486
    assert report["aggregate"]["citation_validity_basis_points"] == 10_000
    assert report["benchmark_status"] == "PENDING_BENCHMARK"
    assert report["production_operational_status"] == "NOT_ATTESTED"


def test_pending_manifest_remains_pending(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    pending = {
        "schema_version": "tai.quality-scoring-evidence.v2",
        "lifecycle": "PENDING_HUMAN_SCORING",
        "pending_reason": "Real runtime and human evidence are absent.",
        "authority_sha256": authority["authority_sha256"],
        "exact_main": None,
        "trusted_runtime_report_sha256": None,
        "trusted_runtime_manifest_sha256": None,
        "trusted_assessment_sha256": None,
        "trusted_case_authority_sha256": None,
        "runtime_report_path": None,
        "runtime_manifest_path": None,
        "assessment_path": None,
        "case_authority_path": None,
        "runtime_case_manifest_path": None,
        "runtime_raw_manifest_path": None,
        "runtime_raw_payload_path": None,
        "annotations_path": None,
        "storage_manifest_path": None,
        "evidence_files": [],
        "scored_at": None,
        "quality_scoring_status": "PENDING_QUALITY_SCORING",
        **EXPECTED_QUALITY_MATURITY,
        "manifest_sha256": "0" * 64,
    }
    _seal(pending, "manifest_sha256")
    _write(fixture.manifest_path, pending)
    report = fixture.verify()
    assert report["accepted"] is False
    assert report["status"] == "PENDING_HUMAN_SCORING"


def test_case_criteria_tamper_with_old_case_digest_is_rejected(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    assessment = load_assessment(fixture.assessment_path, authority)
    case_authority = load_json(fixture.case_authority_path)
    case_authority["cases"][0]["required_concepts"] = []
    _seal(case_authority, "authority_sha256")
    _write(fixture.case_authority_path, case_authority)
    with pytest.raises(QualityScoringError, match="case criteria digest mismatch"):
        load_case_authority(
            fixture.case_authority_path, authority, MAIN_SHA, assessment
        )


def test_pending_or_forged_assessment_is_rejected(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    assessment = load_json(fixture.assessment_path)
    assessment["accepted"] = False
    assessment["status"] = "PENDING_REVIEW"
    assessment["counts"]["reviewed_cases"] = 0
    assessment["counts"]["unreviewed_cases"] = 58
    assessment["blocking_reasons"] = ["EXPERT_REVIEWS_MISSING"]
    _seal(assessment, "assessment_sha256")
    _write(fixture.assessment_path, assessment)
    with pytest.raises(QualityScoringError, match="not accepted"):
        load_assessment(fixture.assessment_path, load_authority(fixture.authority_path))


def test_runtime_report_copy_must_match_trusted_report(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    copy_report = fixture.json("quality/runtime-verification.json")
    copy_report["authority_sha256"] = _sha("forged")
    _seal(copy_report, "report_sha256")
    fixture.rewrite_quality_file("quality/runtime-verification.json", copy_report)
    with pytest.raises(QualityScoringError, match="copy differs"):
        fixture.verify()


def test_runtime_manifest_must_match_report_digest(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    runtime_manifest = load_json(fixture.runtime_manifest_path)
    runtime_manifest["fallback_exercise"] = {"status": "FORGED"}
    _write(fixture.runtime_manifest_path, runtime_manifest)
    with pytest.raises(QualityScoringError, match="digest does not match report"):
        fixture.verify()


def test_missing_runtime_observation_is_typed_rejection_not_key_error(
    tmp_path: Path,
) -> None:
    fixture = build_fixture(tmp_path)
    raw_manifest = fixture.json("quality/runtime-raw-manifest.json")
    raw_manifest["entries"].pop()
    authority = load_authority(fixture.authority_path)
    report = load_runtime_report(fixture.runtime_report_path, authority)
    parsed_manifest = load_runtime_manifest(
        fixture.runtime_manifest_path, report, authority, EVALUATED_AT
    )
    prompts = {
        case["case_id"]: case["prompt_sha256_by_locale"]
        for case in load_json(fixture.case_authority_path)["cases"]
    }
    modified_path = tmp_path / "modified-raw-manifest.json"
    _write(modified_path, raw_manifest)
    parsed_manifest["runtime_file_records"][parsed_manifest["raw_manifest_path"]] = (
        _record(modified_path, parsed_manifest["raw_manifest_path"])
    )
    with pytest.raises(QualityScoringError, match="count mismatch"):
        load_runtime_raw_manifest(
            raw_manifest,
            parsed_manifest,
            prompts,
            file_sha256(modified_path),
            modified_path.stat().st_size,
        )


def test_missing_annotation_is_typed_rejection(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    annotations = fixture.json("quality/annotations.json")
    annotations["annotations"].pop()
    _seal(annotations, "annotations_sha256")
    fixture.rewrite_quality_file("quality/annotations.json", annotations)
    with pytest.raises(QualityScoringError, match="annotation count mismatch"):
        fixture.verify()


def test_critical_scorers_must_be_independent(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    annotations = fixture.json("quality/annotations.json")
    annotations["annotations"][1]["scorer_id"] = annotations["annotations"][0][
        "scorer_id"
    ]
    annotations["annotations"][1]["annotation_sha256"] = canonical_sha256(
        {
            key: value
            for key, value in annotations["annotations"][1].items()
            if key != "annotation_sha256"
        }
    )
    _seal(annotations, "annotations_sha256")
    fixture.rewrite_quality_file("quality/annotations.json", annotations)
    with pytest.raises(QualityScoringError, match="not independent"):
        fixture.verify()


def test_open_disagreement_is_rejected(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    annotations = fixture.json("quality/annotations.json")
    annotations["annotations"][1]["disagreement_with_annotation_id"] = annotations[
        "annotations"
    ][0]["annotation_id"]
    annotations["annotations"][1]["annotation_sha256"] = canonical_sha256(
        {
            key: value
            for key, value in annotations["annotations"][1].items()
            if key != "annotation_sha256"
        }
    )
    _seal(annotations, "annotations_sha256")
    fixture.rewrite_quality_file("quality/annotations.json", annotations)
    with pytest.raises(QualityScoringError, match="open annotation disagreement"):
        fixture.verify()


def test_content_threshold_failure_returns_rejected_report(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    annotations = fixture.json("quality/annotations.json")
    failing_cases = {"platform.case.23", "platform.case.24", "platform.case.25"}
    for row in annotations["annotations"]:
        if row["case_id"] in failing_cases:
            row["observed_concepts"] = []
            row["annotation_sha256"] = canonical_sha256(
                {key: value for key, value in row.items() if key != "annotation_sha256"}
            )
    _seal(annotations, "annotations_sha256")
    fixture.rewrite_quality_file("quality/annotations.json", annotations)
    report = fixture.verify()
    assert report["accepted"] is False
    assert report["status"] == "REJECTED"
    assert any(
        "PLATFORM_ACCURACY_BELOW_THRESHOLD" in reason for reason in report["reasons"]
    )
    assert report["model_admission_status"] == "PENDING_ADMISSION"


def test_duplicate_json_key_is_rejected(tmp_path: Path) -> None:
    path = tmp_path / "duplicate.json"
    path.write_text('{"schema_version":"x","schema_version":"y"}', encoding="utf-8")
    with pytest.raises(QualityScoringError, match="duplicate JSON key"):
        load_json(path)


def test_evidence_roots_must_be_independent(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    manifest = load_json(fixture.manifest_path)
    records = parse_file_records(
        manifest["evidence_files"], load_authority(fixture.authority_path)
    )
    with pytest.raises(QualityScoringError, match="not independent"):
        verify_evidence_roots(records, fixture.original_root, fixture.original_root)


def test_symlink_and_hardlink_evidence_are_rejected(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    relative = "quality/annotations.json"
    target = fixture.original_root / relative
    backup = target.with_suffix(".backup")
    target.rename(backup)
    target.symlink_to(backup.name)
    with pytest.raises(QualityScoringError, match="non-regular"):
        fixture.verify()

    target.unlink()
    backup.rename(target)
    restored = fixture.restored_root / relative
    restored.unlink()
    os.link(target, restored)
    with pytest.raises(QualityScoringError, match="hard-linked"):
        fixture.verify()


def test_evidence_digest_drift_is_rejected(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    path = fixture.restored_root / "quality/annotations.json"
    path.write_text(path.read_text(encoding="utf-8") + " ", encoding="utf-8")
    with pytest.raises(QualityScoringError, match="size mismatch|digest mismatch"):
        fixture.verify()


def test_annotation_direct_coverage_guard(tmp_path: Path) -> None:
    fixture = build_fixture(tmp_path)
    authority = load_authority(fixture.authority_path)
    assessment = load_assessment(fixture.assessment_path, authority)
    cases, _ = load_case_authority(
        fixture.case_authority_path, authority, MAIN_SHA, assessment
    )
    annotations = fixture.json("quality/annotations.json")
    with pytest.raises(QualityScoringError, match="unknown observation"):
        score_annotations(annotations, {}, cases, authority, SCORED_AT)


def test_repository_artifacts_match_contract() -> None:
    root = Path(__file__).parents[1]
    authority_path = root / "model-artifacts" / "quality-scoring-authority.v2.json"
    assert load_json(authority_path) == expected_authority()
    for name in (
        "quality-scoring-evidence.schema.v2.json",
        "quality-annotation.schema.v2.json",
        "quality-case-authority.schema.v1.json",
    ):
        assert load_json(root / "model-artifacts" / name)["$schema"].endswith(
            "2020-12/schema"
        )
    pending_path = root / "model-artifacts" / "quality-scoring.pending.v2.json"
    pending = load_json(pending_path)
    assert pending["lifecycle"] == "PENDING_HUMAN_SCORING"
    assert pending["authority_sha256"] == canonical_sha256(expected_authority())
    assert pending["manifest_sha256"] == canonical_sha256(
        {key: value for key, value in pending.items() if key != "manifest_sha256"}
    )
    scope = load_json(
        root / "governance" / "scopes" / "ap-13c1d-quality-scoring-2993.json"
    )
    assert scope["branch"] == "agent/tai-ap-13c1d-quality-scoring"
    assert "docs/platform-v7/autopilot/autopilot-state.json" in scope["allowed_paths"]
    assert "NOT_ATTESTED" in scope["acceptance"][-1]
