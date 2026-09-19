from __future__ import annotations

import copy
import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from test_cpu_runtime_evidence import AUTHORITY as RUNTIME_AUTHORITY_PATH
from test_cpu_runtime_evidence import EXACT_MAIN, _complete_evidence, _rewrite_evidence

from tai.cpu_runtime_evidence import verify_runtime_evidence
from tai.quality_scoring import verify_quality_scoring
from tai.quality_scoring_contract import (
    EXPECTED_MATURITY,
    VERIFIED_QUALITY_STATUS,
    canonical_sha256,
    expected_authority,
    load_authority,
    load_json,
    write_json,
)
from tai.quality_scoring_inputs import (
    accepted_assessment,
    case_manifest,
    observation_index,
)

NOW = datetime(2026, 7, 21, 18, 0, tzinfo=UTC)


def _signed(value: dict[str, Any], field: str) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result[field] = canonical_sha256(result)
    return result


def _authority(path: Path) -> dict[str, Any]:
    write_json(path, expected_authority())
    return load_authority(path)


def _quality_cases(raw_manifest: dict[str, Any]) -> list[dict[str, Any]]:
    prompts: dict[str, dict[str, str]] = {}
    for item in raw_manifest["entries"]:
        case_id = str(item["case_id"])
        locale = str(item["locale"])
        digest = str(item["prompt_sha256"])
        current = prompts.setdefault(case_id, {})
        observed = current.get(locale)
        if observed is not None and observed != digest:
            raise AssertionError("runtime fixture prompt digest drift")
        current[locale] = digest
    rows: list[dict[str, Any]] = []
    for index, case_id in enumerate(sorted(prompts)):
        rows.append(
            {
                "case_id": case_id,
                "domain": "PLATFORM" if index < 42 else "AGRO",
                "criticality": "CRITICAL" if index < 23 else "HIGH",
                "variant_kind": "CANONICAL",
                "prompt_sha256_by_locale": prompts[case_id],
                "case_sha256": hashlib.sha256(
                    f"quality-case:{case_id}".encode()
                ).hexdigest(),
                "coverage_family_id": f"family.{index:02d}",
            }
        )
    if len(rows) != 58:
        raise AssertionError("runtime fixture case count mismatch")
    return rows


def _accepted_assessment(path: Path, cases: list[dict[str, Any]]) -> dict[str, Any]:
    version = "2026.07.21.quality-fixture"
    corpus_sha256 = canonical_sha256(
        {"schema_version": "tai.gold-corpus.v1", "version": version, "cases": cases}
    )
    assessment = _signed(
        {
            "schema_version": "tai.gold-set-assessment.v1",
            "version": version,
            "accepted": True,
            "status": "ACCEPTED",
            "corpus_sha256": corpus_sha256,
            "component_sha256": {
                "platform_sha256": hashlib.sha256(b"platform").hexdigest(),
                "agro_sha256": hashlib.sha256(b"agro").hexdigest(),
                "coverage_sha256": hashlib.sha256(b"coverage").hexdigest(),
                "reviews_sha256": hashlib.sha256(b"reviews").hexdigest(),
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
        },
        "assessment_sha256",
    )
    write_json(path, assessment)
    return assessment


def _case_manifest(
    path: Path,
    assessment: dict[str, Any],
    cases: list[dict[str, Any]],
) -> dict[str, Any]:
    value = _signed(
        {
            "schema_version": "tai.gold-case-manifest.v1",
            "version": assessment["version"],
            "corpus_sha256": assessment["corpus_sha256"],
            "assessment_sha256": assessment["assessment_sha256"],
            "cases": cases,
        },
        "manifest_sha256",
    )
    write_json(path, value)
    return value


def _bind_runtime_corpus(
    runtime_manifest_path: Path,
    original: Path,
    restored: Path,
    assessment: dict[str, Any],
) -> None:
    runtime_case_path = original / "suite/case-manifest.json"
    runtime_case = load_json(runtime_case_path)
    runtime_case["assessment_sha256"] = assessment["assessment_sha256"]
    runtime_case["corpus_sha256"] = assessment["corpus_sha256"]
    _rewrite_evidence(
        runtime_manifest_path,
        original,
        restored,
        "suite/case-manifest.json",
        runtime_case,
    )
    manifest = load_json(runtime_manifest_path)
    manifest["corpus"]["assessment_sha256"] = assessment["assessment_sha256"]
    manifest["corpus"]["corpus_sha256"] = assessment["corpus_sha256"]
    write_json(runtime_manifest_path, manifest)


def _annotation(
    observation: dict[str, Any],
    *,
    scorer_id: str,
    scorer_role: str,
    suffix: str,
    decision: str = "PASS",
) -> dict[str, Any]:
    return _signed(
        {
            "schema_version": "tai.quality-annotation.v1",
            "annotation_id": (
                f"ann.{observation['profile_id']}.{observation['case_id']}."
                f"{observation['locale']}.{suffix}"
            ),
            "profile_id": observation["profile_id"],
            "case_id": observation["case_id"],
            "case_sha256": observation["case_sha256"],
            "locale": observation["locale"],
            "prompt_sha256": observation["prompt_sha256"],
            "response_sha256": observation["response_sha256"],
            "trace_sha256": observation["trace_sha256"],
            "scorer_id": scorer_id,
            "scorer_role": scorer_role,
            "scored_at": NOW.isoformat(),
            "evidence_sha256": hashlib.sha256(
                f"evidence:{scorer_id}:{suffix}".encode()
            ).hexdigest(),
            "decision": decision,
            "disposition_valid": decision == "PASS",
            "required_concepts_met": decision == "PASS",
            "forbidden_claims_absent": decision == "PASS",
            "citation_authority_valid": decision == "PASS",
            "citation_support_valid": decision == "PASS",
            "citation_freshness_valid": decision == "PASS",
            "abstention_valid": decision == "PASS",
            "unsupported_fact_count": 0,
            "safety_failure_count": 0,
            "disagreement_with_annotation_id": None,
        },
        "annotation_sha256",
    )


def _annotations(index: dict[str, Any]) -> list[dict[str, Any]]:
    result = []
    for observation in index["observations"]:
        primary_role = (
            "PLATFORM_OWNER"
            if observation["domain"] == "PLATFORM"
            else "DOMAIN_EXPERT"
        )
        result.append(
            _annotation(
                observation,
                scorer_id=f"primary.{observation['domain'].lower()}",
                scorer_role=primary_role,
                suffix="primary",
            )
        )
        if observation["criticality"] == "CRITICAL":
            result.append(
                _annotation(
                    observation,
                    scorer_id="security.reviewer",
                    scorer_role="SECURITY_REVIEWER",
                    suffix="secondary",
                )
            )
    return result


def _complete_manifest(
    path: Path,
    authority: dict[str, Any],
    runtime: dict[str, Any],
    index: dict[str, Any],
    annotations: list[dict[str, Any]],
) -> dict[str, Any]:
    value = _signed(
        {
            "schema_version": "tai.quality-scoring-evidence.v1",
            "lifecycle": "COMPLETE",
            "pending_reason": None,
            "exact_main": EXACT_MAIN,
            "authority_sha256": authority["authority_sha256"],
            "runtime_report_sha256": runtime["report_sha256"],
            "observation_index_sha256": index["index_sha256"],
            "annotations": annotations,
            "storage": {
                "provider": "SELECTEL_S3",
                "object_version_id": "quality-version-1",
                "retention_days": 90,
                "immutability_status": "IMMUTABLE_VERSIONED",
                "original_root_id": "quality-original",
                "restored_root_id": "quality-restored",
                "annotations_sha256": canonical_sha256(annotations),
                "evidence_manifest_sha256": "5" * 64,
            },
            "scored_at": NOW.isoformat(),
            "quality_scoring_status": VERIFIED_QUALITY_STATUS,
            **EXPECTED_MATURITY,
        },
        "manifest_sha256",
    )
    write_json(path, value)
    return value


def _fixture(tmp_path: Path) -> dict[str, Any]:
    authority_path = tmp_path / "authority.json"
    runtime_report_path = tmp_path / "runtime-report.json"
    assessment_path = tmp_path / "accepted-assessment.json"
    cases_path = tmp_path / "cases.json"
    scoring_path = tmp_path / "scoring.json"
    runtime_manifest_path, original, restored = _complete_evidence(tmp_path / "runtime")
    raw_manifest = load_json(original / "raw-observations/manifest.json")
    cases = _quality_cases(raw_manifest)
    assessment = _accepted_assessment(assessment_path, cases)
    _case_manifest(cases_path, assessment, cases)
    _bind_runtime_corpus(runtime_manifest_path, original, restored, assessment)
    runtime = verify_runtime_evidence(
        RUNTIME_AUTHORITY_PATH,
        runtime_manifest_path,
        original,
        restored,
    )
    write_json(runtime_report_path, runtime)
    authority = _authority(authority_path)
    accepted = accepted_assessment(assessment_path, authority)
    case_map, _ = case_manifest(cases_path, authority, accepted)
    observations, index = observation_index(
        runtime_manifest_path,
        original,
        runtime,
        accepted,
        case_map,
    )
    annotations = _annotations(index)
    manifest = _complete_manifest(scoring_path, authority, runtime, index, annotations)
    return {
        "authority_path": authority_path,
        "runtime_authority_path": RUNTIME_AUTHORITY_PATH,
        "runtime_path": runtime_report_path,
        "runtime_manifest_path": runtime_manifest_path,
        "original_root": original,
        "restored_root": restored,
        "assessment_path": assessment_path,
        "cases_path": cases_path,
        "scoring_path": scoring_path,
        "authority": authority,
        "runtime": runtime,
        "assessment": assessment,
        "cases": cases,
        "observations": observations,
        "index": index,
        "annotations": annotations,
        "manifest": manifest,
    }


def _verify(
    fixture: dict[str, Any],
    *,
    evaluated_at: str,
) -> dict[str, object]:
    return verify_quality_scoring(
        fixture["authority_path"],
        fixture["runtime_authority_path"],
        fixture["runtime_path"],
        fixture["runtime_manifest_path"],
        fixture["original_root"],
        fixture["restored_root"],
        fixture["assessment_path"],
        fixture["cases_path"],
        fixture["scoring_path"],
        evaluated_at=evaluated_at,
    )


def _rewrite_manifest(fixture: dict[str, Any]) -> None:
    manifest = copy.deepcopy(fixture["manifest"])
    manifest.pop("manifest_sha256", None)
    manifest["storage"]["annotations_sha256"] = canonical_sha256(
        manifest["annotations"]
    )
    manifest = _signed(manifest, "manifest_sha256")
    fixture["manifest"] = manifest
    write_json(fixture["scoring_path"], manifest)
