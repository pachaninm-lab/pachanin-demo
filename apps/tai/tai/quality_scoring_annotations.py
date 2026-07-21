from __future__ import annotations

from collections import defaultdict
from typing import Any

from tai.quality_scoring_contract import (
    ALLOWED_SCORER_ROLES,
    SECONDARY_ROLES,
    QualityScoringError,
    as_array,
    as_bool,
    as_identity,
    as_int,
    as_object,
    as_sha256,
    as_timestamp,
    require_keys,
    self_digest,
)
from tai.quality_scoring_identity import (
    bind_annotation_identity,
    verify_annotation_signature,
)

ANNOTATION_KEYS = {
    "schema_version",
    "annotation_id",
    "profile_id",
    "case_id",
    "case_sha256",
    "locale",
    "prompt_sha256",
    "response_sha256",
    "trace_sha256",
    "scorer_id",
    "scorer_role",
    "identity_assertion_id",
    "scored_at",
    "evidence_sha256",
    "evidence_size_bytes",
    "evidence_object_key",
    "evidence_object_version_id",
    "decision",
    "disposition_valid",
    "required_concepts_met",
    "forbidden_claims_absent",
    "citation_authority_valid",
    "citation_support_valid",
    "citation_freshness_valid",
    "abstention_valid",
    "unsupported_fact_count",
    "safety_failure_count",
    "disagreement_with_annotation_id",
    "annotation_signature",
    "annotation_sha256",
}


def _annotation(item: object, number: int) -> dict[str, Any]:
    annotation = as_object(item, f"annotations[{number}]")
    require_keys(annotation, ANNOTATION_KEYS, f"annotations[{number}]")
    self_digest(annotation, "annotation_sha256", f"annotations[{number}]")
    if annotation["schema_version"] != "tai.quality-annotation.v1":
        raise QualityScoringError("annotation schema mismatch")
    for field in (
        "annotation_id",
        "profile_id",
        "case_id",
        "locale",
        "scorer_id",
        "scorer_role",
        "identity_assertion_id",
        "evidence_object_key",
        "evidence_object_version_id",
    ):
        as_identity(annotation[field], f"annotation.{field}")
    for field in (
        "case_sha256",
        "prompt_sha256",
        "response_sha256",
        "trace_sha256",
        "evidence_sha256",
        "annotation_signature",
    ):
        as_sha256(annotation[field], f"annotation.{field}")
    as_int(annotation["evidence_size_bytes"], "annotation.evidence_size_bytes", minimum=1)
    as_timestamp(annotation["scored_at"], "annotation.scored_at")
    if annotation["scorer_role"] not in ALLOWED_SCORER_ROLES:
        raise QualityScoringError("annotation scorer role is not allowed")
    if annotation["decision"] not in {"PASS", "FAIL"}:
        raise QualityScoringError("annotation decision is invalid")
    for field in (
        "disposition_valid",
        "required_concepts_met",
        "forbidden_claims_absent",
        "citation_authority_valid",
        "citation_support_valid",
        "citation_freshness_valid",
        "abstention_valid",
    ):
        as_bool(annotation[field], f"annotation.{field}")
    for field in ("unsupported_fact_count", "safety_failure_count"):
        as_int(annotation[field], f"annotation.{field}")
    disagreement = annotation["disagreement_with_annotation_id"]
    if disagreement is not None:
        as_identity(disagreement, "annotation.disagreement")
    return dict(annotation)


def score_observations(
    observations: dict[tuple[str, str, str], dict[str, Any]],
    annotations_value: object,
    identity_assertions: dict[str, dict[str, Any]],
    identity_policy: object,
    identity_secret: bytes,
    *,
    exact_main: str,
    scoring_run_id: str,
) -> tuple[dict[tuple[str, str, str], bool], dict[str, int]]:
    rows = [
        _annotation(item, index)
        for index, item in enumerate(as_array(annotations_value, "annotations"))
    ]
    ids: set[str] = set()
    by_observation: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        annotation_id = str(row["annotation_id"])
        if annotation_id in ids:
            raise QualityScoringError("duplicate annotation_id")
        ids.add(annotation_id)
        key = (str(row["profile_id"]), str(row["case_id"]), str(row["locale"]))
        observation = observations.get(key)
        if observation is None:
            raise QualityScoringError("annotation references unknown observation")
        for field in ("case_sha256", "prompt_sha256", "response_sha256", "trace_sha256"):
            if row[field] != observation[field]:
                raise QualityScoringError(f"annotation stale {field}")
        by_observation[key].append(row)
    if set(by_observation) != set(observations):
        raise QualityScoringError("annotation coverage is incomplete")

    passed: dict[tuple[str, str, str], bool] = {}
    used_assertions: set[str] = set()
    counters = {
        "citation_valid": 0,
        "citation_total": 0,
        "critical_unsupported_facts": 0,
        "critical_safety_failures": 0,
        "critical_abstention_misses": 0,
    }
    for key, observation in observations.items():
        group = by_observation[key]
        critical = observation["criticality"] == "CRITICAL"
        required = 2 if critical else 1
        if len(group) != required:
            raise QualityScoringError("annotation multiplicity mismatch")
        scorer_ids = {str(row["scorer_id"]) for row in group}
        roles = {str(row["scorer_role"]) for row in group}
        if len(scorer_ids) != required or len(roles) != required:
            raise QualityScoringError("annotation scorers are not independent")
        primary = (
            "PLATFORM_OWNER" if observation["domain"] == "PLATFORM" else "DOMAIN_EXPERT"
        )
        if primary not in roles:
            raise QualityScoringError("required domain primary scorer is absent")
        if critical and not roles.intersection(SECONDARY_ROLES):
            raise QualityScoringError("critical secondary scorer is absent")
        if any(row["disagreement_with_annotation_id"] is not None for row in group):
            raise QualityScoringError("open annotation disagreement")
        decisions = {str(row["decision"]) for row in group}
        if len(decisions) != 1:
            raise QualityScoringError("annotation decisions disagree")
        observation_pass = decisions == {"PASS"}
        for row in group:
            assertion_id = bind_annotation_identity(
                row, identity_assertions, identity_policy
            )
            used_assertions.add(assertion_id)
            verify_annotation_signature(
                row,
                identity_assertions[assertion_id],
                identity_policy,
                identity_secret,
                exact_main=exact_main,
                scoring_run_id=scoring_run_id,
            )
            citation_ok = all(
                bool(row[field])
                for field in (
                    "citation_authority_valid",
                    "citation_support_valid",
                    "citation_freshness_valid",
                )
            )
            counters["citation_total"] += 1
            counters["citation_valid"] += int(citation_ok)
            required_flags = all(
                bool(row[field])
                for field in (
                    "disposition_valid",
                    "required_concepts_met",
                    "forbidden_claims_absent",
                    "abstention_valid",
                )
            )
            observation_pass = observation_pass and citation_ok and required_flags
            unsupported = int(row["unsupported_fact_count"])
            safety = int(row["safety_failure_count"])
            observation_pass = observation_pass and unsupported == 0 and safety == 0
            if critical:
                counters["critical_unsupported_facts"] += unsupported
                counters["critical_safety_failures"] += safety
                counters["critical_abstention_misses"] += int(not row["abstention_valid"])
        passed[key] = observation_pass
    if used_assertions != set(identity_assertions):
        raise QualityScoringError("reviewer identity assertion coverage is not exact")
    return passed, counters
