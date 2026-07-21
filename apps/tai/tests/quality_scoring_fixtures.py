from __future__ import annotations

import copy
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
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
RETENTION_UNTIL = NOW + timedelta(days=100)


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


def _identity_secret(path: Path) -> tuple[bytes, str]:
    seed = hashlib.sha256(b"tai-quality-fixture-trust-anchor").digest()
    secret = seed + hashlib.sha256(seed).digest()
    path.write_bytes(secret)
    return secret, hashlib.sha256(secret).hexdigest()


def _canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _provider_secret(path: Path) -> tuple[bytes, str]:
    seed = hashlib.sha256(b"tai-quality-provider-inventory-fixture").digest()
    secret = seed + hashlib.sha256(seed).digest()
    path.write_bytes(secret)
    return secret, hashlib.sha256(secret).hexdigest()


def _provider_receipt(
    path: Path,
    secret: bytes,
    storage: dict[str, Any],
    evidence_manifest: dict[str, Any],
) -> dict[str, Any]:
    objects = [
        {
            "annotation_id": record["annotation_id"],
            "object_key": record["object_key"],
            "object_version_id": record["object_version_id"],
            "sha256": record["sha256"],
            "size_bytes": record["size_bytes"],
            "retention_until": record["retention_until"],
            "immutability_status": "IMMUTABLE_VERSIONED",
        }
        for record in evidence_manifest["files"]
    ]
    receipt: dict[str, Any] = {
        "schema_version": "tai.quality-provider-inventory-receipt.v1",
        "issuer": "TAI_SELECTEL_S3_INVENTORY",
        "audience": "TAI_QUALITY_SCORING",
        "provider": storage["provider"],
        "bucket": storage["bucket"],
        "issued_at": (NOW + timedelta(minutes=1)).isoformat(),
        "expires_at": (NOW + timedelta(hours=1)).isoformat(),
        "key_id": "tai-quality-provider-inventory-hmac-v1",
        "original_root_id": storage["original_root_id"],
        "restored_root_id": storage["restored_root_id"],
        "manifest": {
            "object_key": storage["evidence_manifest_object_key"],
            "object_version_id": storage["evidence_manifest_object_version_id"],
            "sha256": storage["evidence_manifest_file_sha256"],
            "size_bytes": storage["evidence_manifest_size_bytes"],
            "retention_until": storage["retention_until"],
            "immutability_status": storage["immutability_status"],
        },
        "objects": objects,
    }
    receipt["signature"] = hmac.new(
        secret,
        _canonical_bytes(receipt),
        hashlib.sha256,
    ).hexdigest()
    write_json(path, receipt)
    return receipt


def _identity_assertion(
    secret: bytes,
    *,
    assertion_id: str,
    subject: str,
    role: str,
) -> dict[str, Any]:
    value: dict[str, Any] = {
        "schema_version": "tai.reviewer-identity-assertion.v1",
        "assertion_id": assertion_id,
        "issuer": "TAI_SERVER_IDENTITY",
        "audience": "TAI_QUALITY_SCORING",
        "subject": subject,
        "role": role,
        "mfa_verified": True,
        "mfa_method": "WEBAUTHN",
        "mfa_verified_at": (NOW - timedelta(minutes=1)).isoformat(),
        "issued_at": (NOW - timedelta(minutes=5)).isoformat(),
        "expires_at": (NOW + timedelta(hours=1)).isoformat(),
        "key_id": "tai-reviewer-identity-hmac-v1",
        "nonce": f"nonce.{assertion_id}",
    }
    value["signature"] = hmac.new(
        secret,
        _canonical_bytes(value),
        hashlib.sha256,
    ).hexdigest()
    return value


def _identity_assertions(secret: bytes) -> list[dict[str, Any]]:
    return [
        _identity_assertion(
            secret,
            assertion_id="assertion.platform-owner",
            subject="primary.platform",
            role="PLATFORM_OWNER",
        ),
        _identity_assertion(
            secret,
            assertion_id="assertion.domain-expert",
            subject="primary.agro",
            role="DOMAIN_EXPERT",
        ),
        _identity_assertion(
            secret,
            assertion_id="assertion.security-reviewer",
            subject="security.reviewer",
            role="SECURITY_REVIEWER",
        ),
    ]


def _assertion_id(scorer_id: str) -> str:
    return {
        "primary.platform": "assertion.platform-owner",
        "primary.agro": "assertion.domain-expert",
        "security.reviewer": "assertion.security-reviewer",
    }[scorer_id]


def _evidence_payload(annotation_id: str) -> bytes:
    return (
        json.dumps(
            {
                "schema_version": "tai.quality-reviewer-evidence-fixture.v1",
                "annotation_id": annotation_id,
                "fixture_only": True,
            },
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        )
        + "\n"
    ).encode("utf-8")


def _annotation(
    observation: dict[str, Any],
    *,
    scorer_id: str,
    scorer_role: str,
    suffix: str,
    decision: str = "PASS",
) -> dict[str, Any]:
    annotation_id = (
        f"ann.{observation['profile_id']}.{observation['case_id']}."
        f"{observation['locale']}.{suffix}"
    )
    evidence = _evidence_payload(annotation_id)
    object_suffix = hashlib.sha256(annotation_id.encode()).hexdigest()[:24]
    return _signed(
        {
            "schema_version": "tai.quality-annotation.v1",
            "annotation_id": annotation_id,
            "profile_id": observation["profile_id"],
            "case_id": observation["case_id"],
            "case_sha256": observation["case_sha256"],
            "locale": observation["locale"],
            "prompt_sha256": observation["prompt_sha256"],
            "response_sha256": observation["response_sha256"],
            "trace_sha256": observation["trace_sha256"],
            "scorer_id": scorer_id,
            "scorer_role": scorer_role,
            "identity_assertion_id": _assertion_id(scorer_id),
            "scored_at": NOW.isoformat(),
            "evidence_sha256": hashlib.sha256(evidence).hexdigest(),
            "evidence_size_bytes": len(evidence),
            "evidence_object_key": f"quality-review/{object_suffix}.json",
            "evidence_object_version_id": f"version-{object_suffix}",
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
        primary_id = (
            "primary.platform"
            if observation["domain"] == "PLATFORM"
            else "primary.agro"
        )
        result.append(
            _annotation(
                observation,
                scorer_id=primary_id,
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


def _reviewer_evidence(
    manifest_path: Path,
    original_root: Path,
    restored_root: Path,
    annotations: list[dict[str, Any]],
    identity_assertions: list[dict[str, Any]],
) -> dict[str, Any]:
    relative_manifest = "reviewer-evidence/manifest.json"
    records: list[dict[str, Any]] = []
    for index, annotation in enumerate(annotations):
        relative_path = f"reviewer-evidence/files/{index:04d}.json"
        payload = _evidence_payload(str(annotation["annotation_id"]))
        for root in (original_root, restored_root):
            target = root / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
        records.append(
            {
                "annotation_id": annotation["annotation_id"],
                "relative_path": relative_path,
                "sha256": hashlib.sha256(payload).hexdigest(),
                "size_bytes": len(payload),
                "object_key": annotation["evidence_object_key"],
                "object_version_id": annotation["evidence_object_version_id"],
                "retention_until": RETENTION_UNTIL.isoformat(),
            }
        )
    external_manifest = _signed(
        {
            "schema_version": "tai.quality-reviewer-evidence-manifest.v1",
            "provider": "SELECTEL_S3",
            "bucket": "tai-quality-evidence-fixture",
            "manifest_object_key": "quality-review/manifest.json",
            "manifest_object_version_id": "quality-manifest-version-1",
            "retention_until": RETENTION_UNTIL.isoformat(),
            "original_root_id": "quality-original-root",
            "restored_root_id": "quality-restored-root",
            "files": records,
        },
        "manifest_sha256",
    )
    write_json(manifest_path, external_manifest)
    raw = manifest_path.read_bytes()
    for root in (original_root, restored_root):
        target = root / relative_manifest
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    return {
        "provider": "SELECTEL_S3",
        "bucket": "tai-quality-evidence-fixture",
        "retention_days": 100,
        "retention_until": RETENTION_UNTIL.isoformat(),
        "immutability_status": "IMMUTABLE_VERSIONED",
        "original_root_id": "quality-original-root",
        "restored_root_id": "quality-restored-root",
        "annotations_sha256": canonical_sha256(annotations),
        "identity_assertions_sha256": canonical_sha256(identity_assertions),
        "evidence_manifest_relative_path": relative_manifest,
        "evidence_manifest_object_key": "quality-review/manifest.json",
        "evidence_manifest_object_version_id": "quality-manifest-version-1",
        "evidence_manifest_size_bytes": len(raw),
        "evidence_manifest_file_sha256": hashlib.sha256(raw).hexdigest(),
        "evidence_manifest_sha256": external_manifest["manifest_sha256"],
    }


def _complete_manifest(
    path: Path,
    authority: dict[str, Any],
    runtime: dict[str, Any],
    index: dict[str, Any],
    annotations: list[dict[str, Any]],
    identity_assertions: list[dict[str, Any]],
    storage: dict[str, Any],
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
            "identity_assertions": identity_assertions,
            "annotations": annotations,
            "storage": storage,
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
    identity_secret_path = tmp_path / "reviewer-identity-key.bin"
    provider_secret_path = tmp_path / "provider-inventory-key.bin"
    provider_receipt_path = tmp_path / "provider-inventory-receipt.json"
    reviewer_manifest_path = tmp_path / "reviewer-evidence-manifest.json"
    reviewer_original_root = tmp_path / "reviewer-original"
    reviewer_restored_root = tmp_path / "reviewer-restored"
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
    secret, trusted_secret_sha256 = _identity_secret(identity_secret_path)
    identity_assertions = _identity_assertions(secret)
    annotations = _annotations(index)
    storage = _reviewer_evidence(
        reviewer_manifest_path,
        reviewer_original_root,
        reviewer_restored_root,
        annotations,
        identity_assertions,
    )
    provider_secret, trusted_provider_secret_sha256 = _provider_secret(
        provider_secret_path
    )
    provider_receipt = _provider_receipt(
        provider_receipt_path,
        provider_secret,
        storage,
        load_json(reviewer_manifest_path),
    )
    manifest = _complete_manifest(
        scoring_path,
        authority,
        runtime,
        index,
        annotations,
        identity_assertions,
        storage,
    )
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
        "identity_secret_path": identity_secret_path,
        "trusted_secret_sha256": trusted_secret_sha256,
        "provider_secret_path": provider_secret_path,
        "trusted_provider_secret_sha256": trusted_provider_secret_sha256,
        "provider_receipt_path": provider_receipt_path,
        "provider_receipt": provider_receipt,
        "reviewer_manifest_path": reviewer_manifest_path,
        "reviewer_original_root": reviewer_original_root,
        "reviewer_restored_root": reviewer_restored_root,
        "authority": authority,
        "runtime": runtime,
        "assessment": assessment,
        "cases": cases,
        "observations": observations,
        "index": index,
        "identity_assertions": identity_assertions,
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
        fixture["identity_secret_path"],
        fixture["trusted_secret_sha256"],
        fixture["reviewer_manifest_path"],
        fixture["reviewer_original_root"],
        fixture["reviewer_restored_root"],
        fixture["provider_receipt_path"],
        fixture["provider_secret_path"],
        fixture["trusted_provider_secret_sha256"],
        evaluated_at=evaluated_at,
    )


def _rebuild_reviewer_evidence(fixture: dict[str, Any]) -> None:
    storage = _reviewer_evidence(
        fixture["reviewer_manifest_path"],
        fixture["reviewer_original_root"],
        fixture["reviewer_restored_root"],
        fixture["manifest"]["annotations"],
        fixture["manifest"]["identity_assertions"],
    )
    fixture["manifest"]["storage"] = storage
    secret_path = fixture["provider_secret_path"]
    assert isinstance(secret_path, Path)
    fixture["provider_receipt"] = _provider_receipt(
        fixture["provider_receipt_path"],
        secret_path.read_bytes(),
        storage,
        load_json(fixture["reviewer_manifest_path"]),
    )


def _rewrite_manifest(fixture: dict[str, Any]) -> None:
    manifest = copy.deepcopy(fixture["manifest"])
    manifest.pop("manifest_sha256", None)
    manifest["storage"]["annotations_sha256"] = canonical_sha256(
        manifest["annotations"]
    )
    manifest["storage"]["identity_assertions_sha256"] = canonical_sha256(
        manifest["identity_assertions"]
    )
    manifest = _signed(manifest, "manifest_sha256")
    fixture["manifest"] = manifest
    write_json(fixture["scoring_path"], manifest)
