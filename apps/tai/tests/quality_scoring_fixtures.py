from __future__ import annotations

import copy
import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from tai.quality_scoring_contract import (
    EXPECTED_MATURITY,
    LOCALES,
    PROFILES,
    VERIFIED_QUALITY_STATUS,
    VERIFIED_RUNTIME_STATUS,
    canonical_sha256,
    expected_authority,
    load_authority,
    write_json,
)

EXACT_MAIN = "a" * 40
NOW = datetime(2026, 7, 21, 18, 0, tzinfo=UTC)


def _signed(value: dict[str, Any], field: str) -> dict[str, Any]:
    result = copy.deepcopy(value)
    result[field] = canonical_sha256(result)
    return result


def _authority(path: Path) -> dict[str, Any]:
    write_json(path, expected_authority())
    return load_authority(path)


def _runtime_report(path: Path) -> dict[str, Any]:
    report = _signed(
        {
            "schema_version": "tai.cpu-runtime-evidence-verification.v1",
            "status": VERIFIED_RUNTIME_STATUS,
            "authority_sha256": "1" * 64,
            "manifest_sha256": "2" * 64,
            "exact_main": EXACT_MAIN,
            "runtime_profiles": {profile: "MEASURED" for profile in PROFILES},
            "raw_observation_count": 348,
            "evidence_file_count": 20,
            "evidence_total_size_bytes": 100000,
            "reasons": [],
            "quality_scoring_status": "PENDING_QUALITY_SCORING",
            **EXPECTED_MATURITY,
        },
        "report_sha256",
    )
    write_json(path, report)
    return report


def _cases(path: Path) -> list[dict[str, Any]]:
    rows = []
    for index in range(58):
        domain = "PLATFORM" if index < 42 else "AGRO"
        rows.append(
            {
                "case_id": f"case.{index:02d}",
                "domain": domain,
                "criticality": "CRITICAL" if index < 23 else "HIGH",
                "variant_kind": "CANONICAL",
                "prompt_sha256": hashlib.sha256(f"prompt:{index}".encode()).hexdigest(),
                "case_sha256": hashlib.sha256(f"case:{index}".encode()).hexdigest(),
                "coverage_family_id": f"family.{index:02d}",
            }
        )
    write_json(
        path,
        {
            "schema_version": "tai.gold-case-manifest.v1",
            "version": "v1",
            "cases": rows,
        },
    )
    return rows


def _observations(
    path: Path, runtime: dict[str, Any], cases: list[dict[str, Any]]
) -> dict[str, Any]:
    rows = []
    for profile in PROFILES:
        for case in cases:
            for locale in LOCALES:
                rows.append(
                    {
                        "profile_id": profile,
                        "case_id": case["case_id"],
                        "case_sha256": case["case_sha256"],
                        "domain": case["domain"],
                        "criticality": case["criticality"],
                        "locale": locale,
                        "prompt_sha256": hashlib.sha256(
                            f"{profile}:{case['case_id']}:{locale}:prompt".encode()
                        ).hexdigest(),
                        "response_sha256": hashlib.sha256(
                            f"{profile}:{case['case_id']}:{locale}:response".encode()
                        ).hexdigest(),
                        "trace_sha256": hashlib.sha256(
                            f"{profile}:{case['case_id']}:{locale}:trace".encode()
                        ).hexdigest(),
                        "terminal_status": "ANSWERED",
                    }
                )
    index = _signed(
        {
            "schema_version": "tai.quality-observation-index.v1",
            "exact_main": EXACT_MAIN,
            "runtime_report_sha256": runtime["report_sha256"],
            "corpus_sha256": "3" * 64,
            "assessment_sha256": "4" * 64,
            "observations": rows,
        },
        "index_sha256",
    )
    write_json(path, index)
    return index


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
    runtime_path = tmp_path / "runtime.json"
    cases_path = tmp_path / "cases.json"
    index_path = tmp_path / "index.json"
    scoring_path = tmp_path / "scoring.json"
    authority = _authority(authority_path)
    runtime = _runtime_report(runtime_path)
    cases = _cases(cases_path)
    index = _observations(index_path, runtime, cases)
    annotations = _annotations(index)
    manifest = _complete_manifest(scoring_path, authority, runtime, index, annotations)
    return {
        "authority_path": authority_path,
        "runtime_path": runtime_path,
        "cases_path": cases_path,
        "index_path": index_path,
        "scoring_path": scoring_path,
        "authority": authority,
        "runtime": runtime,
        "cases": cases,
        "index": index,
        "annotations": annotations,
        "manifest": manifest,
    }


def _rewrite_manifest(fixture: dict[str, Any]) -> None:
    manifest = copy.deepcopy(fixture["manifest"])
    manifest.pop("manifest_sha256", None)
    manifest["storage"]["annotations_sha256"] = canonical_sha256(
        manifest["annotations"]
    )
    manifest = _signed(manifest, "manifest_sha256")
    fixture["manifest"] = manifest
    write_json(fixture["scoring_path"], manifest)
