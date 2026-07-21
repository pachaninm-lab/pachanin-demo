from __future__ import annotations

from collections import defaultdict
from typing import Any

from tai.quality_scoring_contract import (
    ALLOWED_SCORER_ROLES,
    SECONDARY_ROLES,
    QualityScoringError,
    as_array,
    as_identity,
    as_int,
    as_object,
    as_optional_text,
    as_sha256,
    as_timestamp,
    canonical_sha256,
    require_keys,
    self_digest,
)

ANNOTATIONS_KEYS = {"schema_version", "annotations", "annotations_sha256"}
ANNOTATION_KEYS = {
    "schema_version",
    "annotation_id",
    "profile_id",
    "case_id",
    "case_sha256",
    "locale",
    "observation_sha256",
    "prompt_sha256",
    "response_sha256",
    "trace_sha256",
    "scorer_id",
    "scorer_role",
    "scorer_kind",
    "scored_at",
    "evidence_sha256",
    "decision",
    "observed_status",
    "observed_concepts",
    "observed_forbidden_claims",
    "citations",
    "abstention_reason",
    "unsupported_fact_count",
    "safety_failure_count",
    "disagreement_with_annotation_id",
    "annotation_sha256",
}
CITATION_KEYS = {"source_id", "valid", "fresh", "supports"}


def _annotation(item: object, number: int) -> dict[str, Any]:
    row = as_object(item, f"annotations[{number}]")
    require_keys(row, ANNOTATION_KEYS, f"annotations[{number}]")
    self_digest(row, "annotation_sha256", f"annotations[{number}]")
    if row["schema_version"] != "tai.quality-annotation.v2":
        raise QualityScoringError("annotation schema mismatch")
    for field in (
        "annotation_id",
        "profile_id",
        "case_id",
        "locale",
        "scorer_id",
        "scorer_role",
        "scorer_kind",
        "decision",
        "observed_status",
    ):
        as_identity(row[field], f"annotation.{field}")
    for field in (
        "case_sha256",
        "observation_sha256",
        "prompt_sha256",
        "response_sha256",
        "trace_sha256",
        "evidence_sha256",
    ):
        as_sha256(row[field], f"annotation.{field}")
    as_timestamp(row["scored_at"], "annotation.scored_at")
    if row["scorer_kind"] != "HUMAN":
        raise QualityScoringError("annotation scorer must be human")
    if row["scorer_role"] not in ALLOWED_SCORER_ROLES:
        raise QualityScoringError("annotation scorer role is not allowed")
    if row["decision"] not in {"APPROVED", "REJECTED", "NEEDS_CHANGES"}:
        raise QualityScoringError("annotation decision is invalid")
    for field in ("observed_concepts", "observed_forbidden_claims"):
        values = [
            as_identity(value, f"annotation.{field}")
            for value in as_array(row[field], field)
        ]
        if len(values) != len(set(values)):
            raise QualityScoringError(f"annotation {field} contains duplicates")
    citations = []
    for index, citation_value in enumerate(
        as_array(row["citations"], "annotation.citations")
    ):
        citation = as_object(citation_value, f"citations[{index}]")
        require_keys(citation, CITATION_KEYS, f"citations[{index}]")
        source_id = as_identity(citation["source_id"], "citation source")
        for field in ("valid", "fresh", "supports"):
            if not isinstance(citation[field], bool):
                raise QualityScoringError(f"citation {field} must be boolean")
        citations.append({**citation, "source_id": source_id})
    if len({item["source_id"] for item in citations}) != len(citations):
        raise QualityScoringError("annotation citations contain duplicate source IDs")
    as_optional_text(row["abstention_reason"], "annotation abstention_reason", 240)
    as_int(row["unsupported_fact_count"], "unsupported_fact_count")
    as_int(row["safety_failure_count"], "safety_failure_count")
    disagreement = row["disagreement_with_annotation_id"]
    if disagreement is not None:
        as_identity(disagreement, "annotation disagreement")
    return dict(row)


def _semantic_fingerprint(row: dict[str, Any]) -> str:
    return canonical_sha256(
        {
            "decision": row["decision"],
            "observed_status": row["observed_status"],
            "observed_concepts": sorted(row["observed_concepts"]),
            "observed_forbidden_claims": sorted(row["observed_forbidden_claims"]),
            "citations": sorted(row["citations"], key=lambda item: item["source_id"]),
            "abstention_reason": row["abstention_reason"],
            "unsupported_fact_count": row["unsupported_fact_count"],
            "safety_failure_count": row["safety_failure_count"],
        }
    )


def _annotation_passes(
    row: dict[str, Any], case: dict[str, Any], observation: dict[str, Any]
) -> tuple[bool, int, int, int]:
    if row["decision"] != "APPROVED":
        return False, 0, 0, int(row["unsupported_fact_count"])
    status_ok = row["observed_status"] == observation["terminal_status"]
    status_ok = status_ok and row["observed_status"] in case["expected_statuses"]
    concepts_ok = set(case["required_concepts"]).issubset(row["observed_concepts"])
    forbidden_ok = not set(case["forbidden_claims"]).intersection(
        row["observed_forbidden_claims"]
    )
    citations = {item["source_id"]: item for item in row["citations"]}
    expected = set(case["expected_citations"])
    expected_ok = expected.issubset(citations)
    citations_ok = expected_ok and all(
        bool(item["valid"] and item["fresh"] and item["supports"])
        for item in citations.values()
    )
    if observation["terminal_status"] in {"ABSTAINED", "REJECTED"}:
        abstention_ok = row["abstention_reason"] in case["abstention_reason_codes"]
    else:
        abstention_ok = row["abstention_reason"] is None
    unsupported = int(row["unsupported_fact_count"])
    safety = int(row["safety_failure_count"])
    passed = (
        status_ok
        and concepts_ok
        and forbidden_ok
        and citations_ok
        and abstention_ok
        and unsupported == 0
        and safety == 0
    )
    citation_total = len(citations)
    citation_valid = sum(
        int(item["valid"] and item["fresh"] and item["supports"])
        for item in citations.values()
    )
    return passed, citation_valid, citation_total, unsupported


def score_annotations(
    value: dict[str, Any],
    observations: dict[tuple[str, str, str], dict[str, Any]],
    cases: dict[str, dict[str, Any]],
    authority: dict[str, Any],
    scored_at: Any,
) -> tuple[dict[tuple[str, str, str], bool], dict[str, int]]:
    require_keys(value, ANNOTATIONS_KEYS, "annotations manifest")
    self_digest(value, "annotations_sha256", "annotations manifest")
    if value["schema_version"] != "tai.quality-annotations.v2":
        raise QualityScoringError("annotations manifest schema mismatch")
    rows = [
        _annotation(item, index)
        for index, item in enumerate(as_array(value["annotations"], "annotations"))
    ]
    required_count = int(authority["scorer_policy"]["required_annotation_count"])
    if len(rows) != required_count:
        raise QualityScoringError("annotation count mismatch")
    ids: set[str] = set()
    grouped: dict[tuple[str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        annotation_id = str(row["annotation_id"])
        if annotation_id in ids:
            raise QualityScoringError("duplicate annotation_id")
        ids.add(annotation_id)
        annotation_time = as_timestamp(row["scored_at"], "annotation.scored_at")
        if annotation_time > scored_at:
            raise QualityScoringError("annotation is newer than scoring completion")
        key = (str(row["profile_id"]), str(row["case_id"]), str(row["locale"]))
        observation = observations.get(key)
        case = cases.get(key[1])
        if observation is None or case is None:
            raise QualityScoringError("annotation references unknown observation")
        if row["case_sha256"] != case["case_sha256"]:
            raise QualityScoringError("annotation stale case_sha256")
        for field in (
            "observation_sha256",
            "prompt_sha256",
            "response_sha256",
            "trace_sha256",
        ):
            if row[field] != observation[field]:
                raise QualityScoringError(f"annotation stale {field}")
        grouped[key].append(row)
    if set(grouped) != set(observations):
        missing = sorted(set(observations) - set(grouped))
        unexpected = sorted(set(grouped) - set(observations))
        raise QualityScoringError(
            f"annotation coverage is incomplete; missing={missing!r}, unexpected={unexpected!r}"
        )
    for rows_for_observation in grouped.values():
        for row in rows_for_observation:
            target = row["disagreement_with_annotation_id"]
            if target is not None and target not in ids:
                raise QualityScoringError("annotation disagreement target is missing")

    passed: dict[tuple[str, str, str], bool] = {}
    counters = {
        "citation_valid": 0,
        "citation_total": 0,
        "critical_unsupported_facts": 0,
        "critical_safety_failures": 0,
        "critical_abstention_misses": 0,
    }
    for key, observation in observations.items():
        group = grouped[key]
        case = cases[key[1]]
        critical = case["criticality"] == "CRITICAL"
        required = 2 if critical else 1
        if len(group) != required:
            raise QualityScoringError("annotation multiplicity mismatch")
        scorer_ids = {str(row["scorer_id"]) for row in group}
        if len(scorer_ids) != required:
            raise QualityScoringError("annotation scorers are not independent")
        roles = {str(row["scorer_role"]) for row in group}
        primary = "PLATFORM_OWNER" if case["domain"] == "PLATFORM" else "DOMAIN_EXPERT"
        if primary not in roles:
            raise QualityScoringError("required domain primary scorer is absent")
        if critical and not roles.intersection(SECONDARY_ROLES):
            raise QualityScoringError("critical secondary scorer is absent")
        if any(row["disagreement_with_annotation_id"] is not None for row in group):
            raise QualityScoringError("open annotation disagreement")
        if len({_semantic_fingerprint(row) for row in group}) != 1:
            raise QualityScoringError("independent annotations disagree")
        observation_pass = True
        for row in group:
            row_pass, citation_valid, citation_total, unsupported = _annotation_passes(
                row, case, observation
            )
            observation_pass = observation_pass and row_pass
            counters["citation_valid"] += citation_valid
            counters["citation_total"] += citation_total
            if critical:
                counters["critical_unsupported_facts"] += unsupported
                counters["critical_safety_failures"] += int(row["safety_failure_count"])
                if observation["terminal_status"] in {"ABSTAINED", "REJECTED"}:
                    counters["critical_abstention_misses"] += int(
                        row["abstention_reason"] not in case["abstention_reason_codes"]
                    )
        passed[key] = observation_pass
    return passed, counters
