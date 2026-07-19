from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Any
from uuid import UUID
from tai.git_oid import validate_git_oid

_IDENTIFIER = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class OperationalIndicator(StrEnum):
    AVAILABILITY = "AVAILABILITY"
    LATENCY_P95 = "LATENCY_P95"
    ERROR_RATE = "ERROR_RATE"
    QUEUE_LAG = "QUEUE_LAG"
    RETRIEVAL_FRESHNESS = "RETRIEVAL_FRESHNESS"
    MODEL_CAPACITY = "MODEL_CAPACITY"
    AUDIT_DURABILITY = "AUDIT_DURABILITY"


class ThresholdDirection(StrEnum):
    MINIMUM = "MINIMUM"
    MAXIMUM = "MAXIMUM"


class SLOAssessmentStatus(StrEnum):
    PASS = "PASS"  # noqa: S105
    AT_RISK = "AT_RISK"
    BREACHED = "BREACHED"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True, slots=True)
class SLODefinition:
    slo_id: str
    indicator: OperationalIndicator
    direction: ThresholdDirection
    target: float
    warning_margin: float
    minimum_samples: int
    maximum_observation_age: timedelta
    unit: str

    def __post_init__(self) -> None:
        _portable(self.slo_id, "slo_id")
        _portable(self.unit, "unit")
        _finite(self.target, "target")
        _finite(self.warning_margin, "warning_margin")
        if self.warning_margin < 0:
            raise ValueError("warning_margin must not be negative")
        if self.minimum_samples < 1:
            raise ValueError("minimum_samples must be positive")
        if self.maximum_observation_age <= timedelta(0):
            raise ValueError("maximum_observation_age must be positive")


@dataclass(frozen=True, slots=True)
class SLOObservation:
    observation_id: str
    slo_id: str
    indicator: OperationalIndicator
    value: float
    sample_count: int
    window_started_at: datetime
    window_ended_at: datetime
    observed_at: datetime
    source_sha256: str
    exact_head_sha: str

    def __post_init__(self) -> None:
        _portable(self.observation_id, "observation_id")
        _portable(self.slo_id, "slo_id")
        _finite(self.value, "value")
        if self.sample_count < 0:
            raise ValueError("sample_count must not be negative")
        for name, value in (
            ("window_started_at", self.window_started_at),
            ("window_ended_at", self.window_ended_at),
            ("observed_at", self.observed_at),
        ):
            _aware(value, name)
        if self.window_ended_at < self.window_started_at:
            raise ValueError("observation window must not end before it starts")
        if self.observed_at < self.window_ended_at:
            raise ValueError("observed_at must not be before window_ended_at")
        _digest(self.source_sha256, "source_sha256")
        validate_git_oid(self.exact_head_sha, "exact_head_sha")


@dataclass(frozen=True, slots=True)
class SLOAssessment:
    slo_id: str
    indicator: OperationalIndicator
    exact_head_sha: str
    status: SLOAssessmentStatus
    value: float | None
    target: float
    sample_count: int
    reason: str | None
    observation_id: str | None
    assessed_at: datetime
    assessment_sha256: str

    def __post_init__(self) -> None:
        _portable(self.slo_id, "slo_id")
        validate_git_oid(self.exact_head_sha, "exact_head_sha")
        if self.value is not None:
            _finite(self.value, "assessment value")
        _finite(self.target, "assessment target")
        if self.sample_count < 0:
            raise ValueError("assessment sample_count must not be negative")
        if self.reason is not None and not self.reason.strip():
            raise ValueError("assessment reason must be null or non-blank")
        if self.observation_id is not None:
            _portable(self.observation_id, "observation_id")
        _aware(self.assessed_at, "assessed_at")
        _digest(self.assessment_sha256, "assessment_sha256")
        expected = slo_assessment_sha256(
            slo_id=self.slo_id,
            indicator=self.indicator,
            exact_head_sha=self.exact_head_sha,
            status=self.status,
            value=self.value,
            target=self.target,
            sample_count=self.sample_count,
            reason=self.reason,
            observation_id=self.observation_id,
            assessed_at=self.assessed_at,
        )
        if self.assessment_sha256 != expected:
            raise ValueError("SLO assessment digest does not match assessment fields")


def slo_assessment_sha256(
    *,
    slo_id: str,
    indicator: OperationalIndicator,
    exact_head_sha: str,
    status: SLOAssessmentStatus,
    value: float | None,
    target: float,
    sample_count: int,
    reason: str | None,
    observation_id: str | None,
    assessed_at: datetime,
) -> str:
    return _sha256_json(
        {
            "assessed_at": assessed_at.isoformat(),
            "exact_head_sha": exact_head_sha,
            "indicator": indicator.value,
            "observation_id": observation_id,
            "reason": reason,
            "sample_count": sample_count,
            "slo_id": slo_id,
            "status": status.value,
            "target": target,
            "value": value,
        }
    )

def assess_slo(
    definition: SLODefinition,
    observation: SLOObservation | None,
    *,
    exact_head_sha: str,
    assessed_at: datetime,
) -> SLOAssessment:
    validate_git_oid(exact_head_sha, "exact_head_sha")
    _aware(assessed_at, "assessed_at")
    status = SLOAssessmentStatus.UNKNOWN
    reason: str | None = None
    value: float | None = None
    sample_count = 0
    observation_id: str | None = None
    if observation is None:
        reason = "MISSING_OBSERVATION"
    else:
        value = observation.value
        sample_count = observation.sample_count
        observation_id = observation.observation_id
        if observation.slo_id != definition.slo_id:
            reason = "SLO_ID_MISMATCH"
        elif observation.indicator is not definition.indicator:
            reason = "INDICATOR_MISMATCH"
        elif observation.exact_head_sha != exact_head_sha:
            reason = "EXACT_HEAD_MISMATCH"
        elif observation.observed_at > assessed_at:
            reason = "OBSERVATION_FROM_FUTURE"
        elif assessed_at - observation.observed_at > definition.maximum_observation_age:
            reason = "STALE_OBSERVATION"
        elif observation.sample_count < definition.minimum_samples:
            reason = "INSUFFICIENT_SAMPLES"
        else:
            status = _threshold_status(definition, observation.value)
    assessment_sha256 = slo_assessment_sha256(
        slo_id=definition.slo_id,
        indicator=definition.indicator,
        exact_head_sha=exact_head_sha,
        status=status,
        value=value,
        target=definition.target,
        sample_count=sample_count,
        reason=reason,
        observation_id=observation_id,
        assessed_at=assessed_at,
    )
    return SLOAssessment(
        slo_id=definition.slo_id,
        indicator=definition.indicator,
        exact_head_sha=exact_head_sha,
        status=status,
        value=value,
        target=definition.target,
        sample_count=sample_count,
        reason=reason,
        observation_id=observation_id,
        assessed_at=assessed_at,
        assessment_sha256=assessment_sha256,
    )


def _threshold_status(definition: SLODefinition, value: float) -> SLOAssessmentStatus:
    if definition.direction is ThresholdDirection.MINIMUM:
        if value < definition.target:
            return SLOAssessmentStatus.BREACHED
        if value < definition.target + definition.warning_margin:
            return SLOAssessmentStatus.AT_RISK
        return SLOAssessmentStatus.PASS
    if value > definition.target:
        return SLOAssessmentStatus.BREACHED
    if value > definition.target - definition.warning_margin:
        return SLOAssessmentStatus.AT_RISK
    return SLOAssessmentStatus.PASS


class EvidenceKind(StrEnum):
    EVALUATION = "EVALUATION"
    SECURITY = "SECURITY"
    BACKUP_RESTORE = "BACKUP_RESTORE"
    ROLLBACK = "ROLLBACK"
    CAPACITY = "CAPACITY"
    OBSERVABILITY = "OBSERVABILITY"
    DATA_RETENTION = "DATA_RETENTION"


@dataclass(frozen=True, slots=True)
class OperationalEvidence:
    evidence_id: str
    kind: EvidenceKind
    exact_head_sha: str
    artifact_sha256: str
    accepted: bool
    observed_at: datetime
    valid_until: datetime
    authority: str
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        _portable(self.evidence_id, "evidence_id")
        validate_git_oid(self.exact_head_sha, "exact_head_sha")
        _digest(self.artifact_sha256, "artifact_sha256")
        _aware(self.observed_at, "observed_at")
        _aware(self.valid_until, "valid_until")
        if self.valid_until <= self.observed_at:
            raise ValueError("evidence valid_until must be after observed_at")
        _portable(self.authority, "authority")
        _canonical_json_value(self.metadata)


@dataclass(frozen=True, slots=True)
class OperationalReadinessPolicy:
    required_evidence: frozenset[EvidenceKind] = field(
        default_factory=lambda: frozenset(EvidenceKind)
    )
    required_indicators: frozenset[OperationalIndicator] = field(
        default_factory=lambda: frozenset(OperationalIndicator)
    )
    maximum_at_risk: int = 0
    maximum_breached: int = 0
    maximum_unknown: int = 0

    def __post_init__(self) -> None:
        for name, value in (
            ("maximum_at_risk", self.maximum_at_risk),
            ("maximum_breached", self.maximum_breached),
            ("maximum_unknown", self.maximum_unknown),
        ):
            if value < 0:
                raise ValueError(f"{name} must not be negative")


@dataclass(frozen=True, slots=True)
class OperationalReadinessDecision:
    release_id: str
    exact_head_sha: str
    accepted: bool
    reasons: tuple[str, ...]
    evidence_ids: tuple[str, ...]
    assessment_sha256s: tuple[str, ...]
    decided_at: datetime
    decision_sha256: str


class OperationalReadinessAuthority:
    def __init__(self, policy: OperationalReadinessPolicy | None = None) -> None:
        self._policy = policy or OperationalReadinessPolicy()

    def decide(
        self,
        *,
        release_id: str,
        exact_head_sha: str,
        evidence: Sequence[OperationalEvidence],
        assessments: Sequence[SLOAssessment],
        decided_at: datetime,
    ) -> OperationalReadinessDecision:
        _portable(release_id, "release_id")
        validate_git_oid(exact_head_sha, "exact_head_sha")
        _aware(decided_at, "decided_at")
        evidence_by_kind = _unique_evidence(evidence)
        assessments_by_indicator = _unique_assessments(assessments)
        reasons: list[str] = []
        missing_evidence = self._policy.required_evidence - set(evidence_by_kind)
        if missing_evidence:
            reasons.append("REQUIRED_EVIDENCE_MISSING")
        missing_indicators = self._policy.required_indicators - set(assessments_by_indicator)
        if missing_indicators:
            reasons.append("REQUIRED_SLO_MISSING")
        for evidence_item in evidence_by_kind.values():
            if evidence_item.exact_head_sha != exact_head_sha:
                reasons.append("EVIDENCE_EXACT_HEAD_MISMATCH")
            if evidence_item.observed_at > decided_at:
                reasons.append("EVIDENCE_FROM_FUTURE")
            if evidence_item.valid_until <= decided_at:
                reasons.append("EVIDENCE_EXPIRED")
            if not evidence_item.accepted:
                reasons.append("EVIDENCE_REJECTED")
        for assessment in assessments_by_indicator.values():
            if assessment.exact_head_sha != exact_head_sha:
                reasons.append("SLO_EXACT_HEAD_MISMATCH")
            if assessment.assessed_at > decided_at:
                reasons.append("SLO_ASSESSMENT_FROM_FUTURE")
        status_counts = {
            status: sum(item.status is status for item in assessments_by_indicator.values())
            for status in SLOAssessmentStatus
        }
        if status_counts[SLOAssessmentStatus.AT_RISK] > self._policy.maximum_at_risk:
            reasons.append("AT_RISK_BUDGET_EXCEEDED")
        if status_counts[SLOAssessmentStatus.BREACHED] > self._policy.maximum_breached:
            reasons.append("SLO_BREACH_BUDGET_EXCEEDED")
        if status_counts[SLOAssessmentStatus.UNKNOWN] > self._policy.maximum_unknown:
            reasons.append("UNKNOWN_SLO_BUDGET_EXCEEDED")
        unique_reasons = tuple(dict.fromkeys(reasons))
        evidence_ids = tuple(
            item.evidence_id
            for item in sorted(evidence_by_kind.values(), key=lambda value: value.kind.value)
        )
        assessment_sha256s = tuple(
            item.assessment_sha256
            for item in sorted(
                assessments_by_indicator.values(),
                key=lambda value: value.indicator.value,
            )
        )
        payload = {
            "accepted": not unique_reasons,
            "assessment_sha256s": list(assessment_sha256s),
            "decided_at": decided_at.isoformat(),
            "evidence_ids": list(evidence_ids),
            "exact_head_sha": exact_head_sha,
            "reasons": list(unique_reasons),
            "release_id": release_id,
        }
        return OperationalReadinessDecision(
            release_id=release_id,
            exact_head_sha=exact_head_sha,
            accepted=not unique_reasons,
            reasons=unique_reasons,
            evidence_ids=evidence_ids,
            assessment_sha256s=assessment_sha256s,
            decided_at=decided_at,
            decision_sha256=_sha256_json(payload),
        )


class IncidentSeverity(StrEnum):
    SEV1 = "SEV1"
    SEV2 = "SEV2"
    SEV3 = "SEV3"
    SEV4 = "SEV4"


class IncidentStatus(StrEnum):
    OPEN = "OPEN"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    MITIGATING = "MITIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class IncidentEventKind(StrEnum):
    OPENED = "OPENED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    MITIGATION_STARTED = "MITIGATION_STARTED"
    MITIGATION_VERIFIED = "MITIGATION_VERIFIED"
    RESOLVED = "RESOLVED"
    POSTMORTEM_ATTACHED = "POSTMORTEM_ATTACHED"
    CLOSED = "CLOSED"


@dataclass(frozen=True, slots=True)
class IncidentEvent:
    incident_id: UUID
    sequence: int
    kind: IncidentEventKind
    severity: IncidentSeverity
    actor_id: str
    occurred_at: datetime
    evidence_sha256: str
    previous_event_sha256: str | None
    event_sha256: str

    def __post_init__(self) -> None:
        if self.sequence < 1:
            raise ValueError("incident sequence must be positive")
        _portable(self.actor_id, "actor_id")
        _aware(self.occurred_at, "occurred_at")
        _digest(self.evidence_sha256, "evidence_sha256")
        if self.previous_event_sha256 is not None:
            _digest(self.previous_event_sha256, "previous_event_sha256")
        _digest(self.event_sha256, "event_sha256")
        expected = incident_event_sha256(
            incident_id=self.incident_id,
            sequence=self.sequence,
            kind=self.kind,
            severity=self.severity,
            actor_id=self.actor_id,
            occurred_at=self.occurred_at,
            evidence_sha256=self.evidence_sha256,
            previous_event_sha256=self.previous_event_sha256,
        )
        if self.event_sha256 != expected:
            raise ValueError("incident event digest does not match event fields")


def incident_event_sha256(
    *,
    incident_id: UUID,
    sequence: int,
    kind: IncidentEventKind,
    severity: IncidentSeverity,
    actor_id: str,
    occurred_at: datetime,
    evidence_sha256: str,
    previous_event_sha256: str | None,
) -> str:
    return _sha256_json(
        {
            "actor_id": actor_id,
            "evidence_sha256": evidence_sha256,
            "incident_id": str(incident_id),
            "kind": kind.value,
            "occurred_at": occurred_at.isoformat(),
            "previous_event_sha256": previous_event_sha256,
            "sequence": sequence,
            "severity": severity.value,
        }
    )


@dataclass(frozen=True, slots=True)
class IncidentState:
    incident_id: UUID
    severity: IncidentSeverity
    status: IncidentStatus
    opened_at: datetime
    updated_at: datetime
    mitigation_verified: bool
    postmortem_attached: bool
    last_event_sha256: str
    event_count: int


def replay_incident(events: Sequence[IncidentEvent]) -> IncidentState:
    if not events:
        raise ValueError("incident requires at least one event")
    ordered = tuple(events)
    incident_id = ordered[0].incident_id
    severity = ordered[0].severity
    status: IncidentStatus | None = None
    mitigation_verified = False
    postmortem_attached = False
    previous: IncidentEvent | None = None
    for event in ordered:
        if event.incident_id != incident_id:
            raise ValueError("incident stream contains multiple incident IDs")
        if event.severity is not severity:
            raise ValueError("incident severity is immutable")
        if previous is None:
            if event.sequence != 1 or event.kind is not IncidentEventKind.OPENED:
                raise ValueError("incident stream must start with OPENED sequence 1")
            if event.previous_event_sha256 is not None:
                raise ValueError("first incident event must not have previous digest")
        else:
            if event.sequence != previous.sequence + 1:
                raise ValueError("incident event sequence is not contiguous")
            if event.previous_event_sha256 != previous.event_sha256:
                raise ValueError("incident hash chain is broken")
            if event.occurred_at < previous.occurred_at:
                raise ValueError("incident event time moved backwards")
        status, mitigation_verified, postmortem_attached = _apply_incident_event(
            status=status,
            kind=event.kind,
            mitigation_verified=mitigation_verified,
            postmortem_attached=postmortem_attached,
        )
        previous = event
    if previous is None or status is None:
        raise RuntimeError("incident replay produced incomplete state")
    return IncidentState(
        incident_id=incident_id,
        severity=severity,
        status=status,
        opened_at=ordered[0].occurred_at,
        updated_at=previous.occurred_at,
        mitigation_verified=mitigation_verified,
        postmortem_attached=postmortem_attached,
        last_event_sha256=previous.event_sha256,
        event_count=len(ordered),
    )


def _apply_incident_event(
    *,
    status: IncidentStatus | None,
    kind: IncidentEventKind,
    mitigation_verified: bool,
    postmortem_attached: bool,
) -> tuple[IncidentStatus, bool, bool]:
    if kind is IncidentEventKind.OPENED:
        if status is not None:
            raise ValueError("incident cannot be opened twice")
        return IncidentStatus.OPEN, False, False
    if status is None:
        raise ValueError("incident event occurred before OPENED")
    if kind is IncidentEventKind.ACKNOWLEDGED:
        if status is not IncidentStatus.OPEN:
            raise ValueError("only an open incident can be acknowledged")
        return IncidentStatus.ACKNOWLEDGED, mitigation_verified, postmortem_attached
    if kind is IncidentEventKind.MITIGATION_STARTED:
        if status not in {IncidentStatus.OPEN, IncidentStatus.ACKNOWLEDGED}:
            raise ValueError("mitigation can only start on an active incident")
        return IncidentStatus.MITIGATING, mitigation_verified, postmortem_attached
    if kind is IncidentEventKind.MITIGATION_VERIFIED:
        if status is not IncidentStatus.MITIGATING:
            raise ValueError("mitigation verification requires MITIGATING status")
        return status, True, postmortem_attached
    if kind is IncidentEventKind.RESOLVED:
        if status is not IncidentStatus.MITIGATING or not mitigation_verified:
            raise ValueError("incident resolution requires verified mitigation")
        return IncidentStatus.RESOLVED, mitigation_verified, postmortem_attached
    if kind is IncidentEventKind.POSTMORTEM_ATTACHED:
        if status not in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}:
            raise ValueError("postmortem can only attach after resolution")
        return status, mitigation_verified, True
    if kind is IncidentEventKind.CLOSED:
        if status is not IncidentStatus.RESOLVED or not postmortem_attached:
            raise ValueError("incident closure requires resolution and postmortem")
        return IncidentStatus.CLOSED, mitigation_verified, postmortem_attached
    raise AssertionError("unhandled incident event kind")


class RetentionClass(StrEnum):
    REQUEST_TRACE = "REQUEST_TRACE"
    TOOL_AUDIT = "TOOL_AUDIT"
    EVALUATION = "EVALUATION"
    INCIDENT = "INCIDENT"
    SECURITY_EVIDENCE = "SECURITY_EVIDENCE"


@dataclass(frozen=True, slots=True)
class RetentionRule:
    retention_class: RetentionClass
    retain_for: timedelta
    purge_batch_limit: int

    def __post_init__(self) -> None:
        if self.retain_for <= timedelta(0):
            raise ValueError("retain_for must be positive")
        if self.purge_batch_limit < 1 or self.purge_batch_limit > 100_000:
            raise ValueError("purge_batch_limit must be between 1 and 100000")


@dataclass(frozen=True, slots=True)
class RetainedRecord:
    record_id: str
    retention_class: RetentionClass
    created_at: datetime
    legal_hold: bool
    record_sha256: str

    def __post_init__(self) -> None:
        _portable(self.record_id, "record_id")
        _aware(self.created_at, "created_at")
        _digest(self.record_sha256, "record_sha256")


def eligible_for_purge(
    records: Sequence[RetainedRecord],
    rules: Mapping[RetentionClass, RetentionRule],
    *,
    now: datetime,
) -> tuple[RetainedRecord, ...]:
    _aware(now, "now")
    eligible: list[RetainedRecord] = []
    counts: dict[RetentionClass, int] = {}
    for record in sorted(records, key=lambda item: (item.created_at, item.record_id)):
        rule = rules.get(record.retention_class)
        if rule is None:
            continue
        if record.created_at > now:
            continue
        if record.legal_hold:
            continue
        if now - record.created_at < rule.retain_for:
            continue
        count = counts.get(record.retention_class, 0)
        if count >= rule.purge_batch_limit:
            continue
        eligible.append(record)
        counts[record.retention_class] = count + 1
    return tuple(eligible)


def _unique_evidence(
    evidence: Sequence[OperationalEvidence],
) -> dict[EvidenceKind, OperationalEvidence]:
    result: dict[EvidenceKind, OperationalEvidence] = {}
    identifiers: set[str] = set()
    for item in evidence:
        if item.kind in result:
            raise ValueError("only one evidence item is allowed per kind")
        if item.evidence_id in identifiers:
            raise ValueError("operational evidence IDs must be unique")
        result[item.kind] = item
        identifiers.add(item.evidence_id)
    return result


def _unique_assessments(
    assessments: Sequence[SLOAssessment],
) -> dict[OperationalIndicator, SLOAssessment]:
    result: dict[OperationalIndicator, SLOAssessment] = {}
    for item in assessments:
        if item.indicator in result:
            raise ValueError("only one SLO assessment is allowed per indicator")
        result[item.indicator] = item
    return result


def _canonical_json_value(value: Any, *, depth: int = 0) -> Any:
    if depth > 32:
        raise ValueError("operational metadata exceeds nesting limit")
    if value is None or isinstance(value, (bool, int, str)):
        return value
    if isinstance(value, float):
        _finite(value, "metadata number")
        return value
    if isinstance(value, Mapping):
        result: dict[str, Any] = {}
        for key, item in value.items():
            if not isinstance(key, str) or not key.strip():
                raise TypeError("operational metadata keys must be non-blank strings")
            result[key] = _canonical_json_value(item, depth=depth + 1)
        return {key: result[key] for key in sorted(result)}
    if isinstance(value, (list, tuple)):
        return [_canonical_json_value(item, depth=depth + 1) for item in value]
    raise TypeError("operational metadata must be JSON-compatible")


def _sha256_json(value: Any) -> str:
    canonical = json.dumps(
        _canonical_json_value(value),
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _portable(value: str, name: str) -> None:
    if _IDENTIFIER.fullmatch(value.strip()) is None:
        raise ValueError(f"{name} must use a bounded portable identifier")


def _digest(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _finite(value: float, name: str) -> None:
    if value != value or value in {float("inf"), float("-inf")}:
        raise ValueError(f"{name} must be finite")
