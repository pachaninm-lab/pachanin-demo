from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Any, cast

from tai.source_coverage import (
    CoverageAssessment,
    OfficialSourceCatalog,
    OfficialSourceDefinition,
)

_GIT_OBJECT_ID = re.compile(r"(?:[0-9a-f]{40}|[0-9a-f]{64})")
_SHA256 = re.compile(r"[0-9a-f]{64}")
_REASON = re.compile(r"[a-z0-9][a-z0-9._:-]{1,127}")
_MAXIMUM_HISTORY_CYCLES = 52
_CONSECUTIVE_FAILURE_WARNING = 2
_CONSECUTIVE_FAILURE_CRITICAL = 3


class SourceRefreshOutcome(StrEnum):
    SUCCEEDED = "SUCCEEDED"
    NOT_MODIFIED = "NOT_MODIFIED"
    RETRYABLE_FAILURE = "RETRYABLE_FAILURE"
    PERMANENT_FAILURE = "PERMANENT_FAILURE"

    @property
    def successful(self) -> bool:
        return self in {self.SUCCEEDED, self.NOT_MODIFIED}


class SourceAvailability(StrEnum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"
    UNKNOWN = "UNKNOWN"


class SourceFreshness(StrEnum):
    CURRENT = "CURRENT"
    STALE = "STALE"
    UNKNOWN = "UNKNOWN"


class SourcePublicationStatus(StrEnum):
    CURRENT = "CURRENT"
    EXPIRED = "EXPIRED"
    UNKNOWN = "UNKNOWN"


class SourceHealthStatus(StrEnum):
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    CRITICAL = "CRITICAL"


class SourceAlertSeverity(StrEnum):
    WARNING = "WARNING"
    CRITICAL = "CRITICAL"


class SourceAlertCode(StrEnum):
    SOURCE_UNOBSERVED = "SOURCE_UNOBSERVED"
    SOURCE_REFRESH_FAILED = "SOURCE_REFRESH_FAILED"
    SOURCE_CONSECUTIVE_FAILURES = "SOURCE_CONSECUTIVE_FAILURES"
    REFRESH_STALE = "REFRESH_STALE"
    PUBLICATION_EXPIRED = "PUBLICATION_EXPIRED"
    AUTHORITY_REVIEW_DUE = "AUTHORITY_REVIEW_DUE"
    HISTORY_GAP = "HISTORY_GAP"


class SourceHistoryStatus(StrEnum):
    BOOTSTRAP = "BOOTSTRAP"
    CONTIGUOUS = "CONTIGUOUS"
    GAP = "GAP"


@dataclass(frozen=True, slots=True)
class SourceRefreshEvent:
    source_id: str
    started_at: datetime
    completed_at: datetime
    outcome: SourceRefreshOutcome
    reason: str
    observation_sha256: str | None = None
    content_sha256: str | None = None
    latest_publication_at: datetime | None = None
    last_success_at: datetime | None = None
    document_count: int | None = None
    observed_topics: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not self.source_id.strip():
            raise ValueError("refresh event source_id must not be blank")
        _aware(self.started_at, "started_at")
        _aware(self.completed_at, "completed_at")
        if self.completed_at < self.started_at:
            raise ValueError("refresh event completed_at precedes started_at")
        if _REASON.fullmatch(self.reason) is None:
            raise ValueError("refresh event reason must be a bounded diagnostic code")
        if self.observation_sha256 is not None:
            _sha256(self.observation_sha256, "observation_sha256")
        if self.content_sha256 is not None:
            _sha256(self.content_sha256, "content_sha256")
        if self.latest_publication_at is not None:
            _aware(self.latest_publication_at, "latest_publication_at")
        if self.last_success_at is not None:
            _aware(self.last_success_at, "last_success_at")
        if self.document_count is not None and self.document_count < 1:
            raise ValueError("refresh event document_count must be positive")
        if len(self.observed_topics) != len(set(self.observed_topics)):
            raise ValueError("refresh event topics must be unique")
        has_observation = self.observation_sha256 is not None
        observation_fields = (
            self.content_sha256,
            self.latest_publication_at,
            self.last_success_at,
            self.document_count,
        )
        if has_observation != all(value is not None for value in observation_fields):
            raise ValueError("refresh observation fields must be present together")
        if has_observation and not self.observed_topics:
            raise ValueError("refresh observation topics must not be empty")
        if self.outcome.successful and not has_observation:
            raise ValueError("successful refresh event requires observation evidence")

    @property
    def event_sha256(self) -> str:
        return _hash_payload(_refresh_event_payload(self, include_sha=False))


@dataclass(frozen=True, slots=True)
class SourceRefreshCycle:
    repository_sha: str
    run_id: int
    run_attempt: int
    trigger: str
    started_at: datetime
    completed_at: datetime
    evidence_bundle_sha256: str
    events: tuple[SourceRefreshEvent, ...]

    def __post_init__(self) -> None:
        _git_oid(self.repository_sha)
        if self.run_id < 1 or self.run_attempt < 1:
            raise ValueError("refresh cycle run identity must be positive")
        if self.trigger not in {"issue_comment", "schedule", "workflow_dispatch"}:
            raise ValueError("refresh cycle trigger is not governed")
        _aware(self.started_at, "started_at")
        _aware(self.completed_at, "completed_at")
        if self.completed_at < self.started_at:
            raise ValueError("refresh cycle completed_at precedes started_at")
        _sha256(self.evidence_bundle_sha256, "evidence_bundle_sha256")
        if not self.events:
            raise ValueError("refresh cycle events must not be empty")
        source_ids = tuple(event.source_id for event in self.events)
        if len(source_ids) != len(set(source_ids)):
            raise ValueError("refresh cycle source ids must be unique")

    @property
    def cycle_sha256(self) -> str:
        return _hash_payload(_refresh_cycle_payload(self, include_sha=False))


@dataclass(frozen=True, slots=True)
class SourceHealthHistory:
    repository_sha: str
    catalog_sha256: str
    generated_at: datetime
    previous_history_sha256: str | None
    cycles: tuple[SourceRefreshCycle, ...]

    def __post_init__(self) -> None:
        _git_oid(self.repository_sha)
        _sha256(self.catalog_sha256, "catalog_sha256")
        _aware(self.generated_at, "generated_at")
        if self.previous_history_sha256 is not None:
            _sha256(self.previous_history_sha256, "previous_history_sha256")
        if not self.cycles:
            raise ValueError("source health history must not be empty")
        identities = tuple((cycle.run_id, cycle.run_attempt) for cycle in self.cycles)
        if len(identities) != len(set(identities)):
            raise ValueError("source health history contains duplicate run attempts")
        run_ids = tuple(cycle.run_id for cycle in self.cycles)
        if len(run_ids) != len(set(run_ids)):
            raise ValueError("source health history must retain only the latest rerun")
        if tuple(sorted(self.cycles, key=_cycle_order)) != self.cycles:
            raise ValueError("source health history cycles must be ordered")

    @property
    def history_sha256(self) -> str:
        return _hash_payload(source_health_history_payload(self, include_sha=False))


@dataclass(frozen=True, slots=True)
class SourceHealthAlert:
    code: SourceAlertCode
    severity: SourceAlertSeverity
    source_id: str | None
    observed_at: datetime
    detail: str

    def __post_init__(self) -> None:
        _aware(self.observed_at, "alert observed_at")
        if not self.detail.strip() or len(self.detail) > 256:
            raise ValueError("source health alert detail must be bounded")


@dataclass(frozen=True, slots=True)
class SourceHealthRecord:
    source_id: str
    owner: str
    entrypoint_uri: str
    topics: tuple[str, ...]
    availability: SourceAvailability
    refresh: SourceFreshness
    publication: SourcePublicationStatus
    last_attempt_at: datetime | None
    last_success_at: datetime | None
    latest_publication_at: datetime | None
    next_refresh_due_at: datetime | None
    publication_expires_at: datetime | None
    authority_review_due_at: datetime
    consecutive_failures: int
    refresh_history: tuple[SourceRefreshEvent, ...]
    alerts: tuple[SourceHealthAlert, ...]


@dataclass(frozen=True, slots=True)
class SourceHealthDashboard:
    repository_sha: str
    catalog_sha256: str
    generated_at: datetime
    history_status: SourceHistoryStatus
    history_sha256: str
    assessment_sha256: str
    coverage_basis_points: int
    critical_coverage_basis_points: int
    all_critical_covered: bool
    status: SourceHealthStatus
    sources: tuple[SourceHealthRecord, ...]
    alerts: tuple[SourceHealthAlert, ...]

    @property
    def dashboard_sha256(self) -> str:
        return _hash_payload(source_health_dashboard_payload(self, include_sha=False))


class OfficialSourceHealthAuthority:
    """Derive bounded source health from immutable refresh history."""

    def assess(
        self,
        *,
        catalog: OfficialSourceCatalog,
        history: SourceHealthHistory,
        history_status: SourceHistoryStatus,
        coverage: CoverageAssessment,
        now: datetime,
    ) -> SourceHealthDashboard:
        _aware(now, "now")
        if coverage.generated_at != now:
            raise ValueError("source health coverage must be generated at dashboard time")
        catalog_ids = {source.source_id for source in catalog.sources}
        for cycle in history.cycles:
            cycle_ids = {event.source_id for event in cycle.events}
            if not cycle_ids.issubset(catalog_ids):
                raise ValueError("source health history contains unknown source")
        records = tuple(
            self._record(
                source=source,
                catalog=catalog,
                events=_events_for_source(history, source.source_id),
                now=now,
            )
            for source in sorted(catalog.sources, key=lambda item: item.source_id)
        )
        alerts = [alert for record in records for alert in record.alerts]
        if history_status is SourceHistoryStatus.GAP:
            alerts.append(
                SourceHealthAlert(
                    code=SourceAlertCode.HISTORY_GAP,
                    severity=SourceAlertSeverity.CRITICAL,
                    source_id=None,
                    observed_at=now,
                    detail="Previous immutable source-health history is unavailable or invalid.",
                )
            )
        ordered_alerts = tuple(sorted(alerts, key=_alert_order))
        status = (
            SourceHealthStatus.CRITICAL
            if any(
                alert.severity is SourceAlertSeverity.CRITICAL
                for alert in ordered_alerts
            )
            else SourceHealthStatus.DEGRADED
            if ordered_alerts
            else SourceHealthStatus.HEALTHY
        )
        return SourceHealthDashboard(
            repository_sha=history.repository_sha,
            catalog_sha256=history.catalog_sha256,
            generated_at=now,
            history_status=history_status,
            history_sha256=history.history_sha256,
            assessment_sha256=coverage.assessment_sha256,
            coverage_basis_points=coverage.coverage_basis_points,
            critical_coverage_basis_points=coverage.critical_coverage_basis_points,
            all_critical_covered=coverage.all_critical_covered,
            status=status,
            sources=records,
            alerts=ordered_alerts,
        )

    def _record(
        self,
        *,
        source: OfficialSourceDefinition,
        catalog: OfficialSourceCatalog,
        events: tuple[SourceRefreshEvent, ...],
        now: datetime,
    ) -> SourceHealthRecord:
        latest = events[-1] if events else None
        success = next(
            (event for event in reversed(events) if event.outcome.successful),
            None,
        )
        failures = _consecutive_failures(events)
        last_success_at = success.last_success_at if success is not None else None
        publication_at = (
            success.latest_publication_at if success is not None else None
        )
        refresh_due = (
            last_success_at + source.expected_update_interval
            if last_success_at is not None
            else None
        )
        publication_limit = min(
            (
                requirement.maximum_publication_age
                for requirement in catalog.requirements
                if requirement.topic in source.topics
            ),
            default=source.maximum_publication_age,
        )
        publication_limit = min(publication_limit, source.maximum_publication_age)
        publication_expires = (
            publication_at + publication_limit
            if publication_at is not None
            else None
        )
        review_due = source.verified_at + source.expected_update_interval
        refresh_status = (
            SourceFreshness.UNKNOWN
            if refresh_due is None
            else SourceFreshness.STALE
            if now > refresh_due
            else SourceFreshness.CURRENT
        )
        publication_status = (
            SourcePublicationStatus.UNKNOWN
            if publication_expires is None
            else SourcePublicationStatus.EXPIRED
            if now > publication_expires
            else SourcePublicationStatus.CURRENT
        )
        availability = (
            SourceAvailability.UNKNOWN
            if latest is None
            else SourceAvailability.HEALTHY
            if latest.outcome.successful
            else SourceAvailability.FAILED
            if success is None or failures >= _CONSECUTIVE_FAILURE_CRITICAL
            else SourceAvailability.DEGRADED
        )
        alerts: list[SourceHealthAlert] = []
        if success is None:
            alerts.append(
                _alert(
                    SourceAlertCode.SOURCE_UNOBSERVED,
                    SourceAlertSeverity.CRITICAL,
                    source.source_id,
                    now,
                    "No successful governed refresh exists for this source.",
                )
            )
        if failures:
            alerts.append(
                _alert(
                    SourceAlertCode.SOURCE_REFRESH_FAILED,
                    SourceAlertSeverity.WARNING,
                    source.source_id,
                    now,
                    f"Latest refresh failed with {latest.reason if latest else 'unknown'}.",
                )
            )
        if failures >= _CONSECUTIVE_FAILURE_WARNING:
            alerts.append(
                _alert(
                    SourceAlertCode.SOURCE_CONSECUTIVE_FAILURES,
                    (
                        SourceAlertSeverity.CRITICAL
                        if failures >= _CONSECUTIVE_FAILURE_CRITICAL
                        else SourceAlertSeverity.WARNING
                    ),
                    source.source_id,
                    now,
                    f"Consecutive governed refresh failures: {failures}.",
                )
            )
        if refresh_status is SourceFreshness.STALE:
            alerts.append(
                _alert(
                    SourceAlertCode.REFRESH_STALE,
                    SourceAlertSeverity.CRITICAL,
                    source.source_id,
                    now,
                    "Last successful refresh exceeded the governed update interval.",
                )
            )
        if publication_status is SourcePublicationStatus.EXPIRED:
            alerts.append(
                _alert(
                    SourceAlertCode.PUBLICATION_EXPIRED,
                    SourceAlertSeverity.CRITICAL,
                    source.source_id,
                    now,
                    "Latest publication exceeded the strictest source/topic age limit.",
                )
            )
        if now > review_due:
            alerts.append(
                _alert(
                    SourceAlertCode.AUTHORITY_REVIEW_DUE,
                    SourceAlertSeverity.WARNING,
                    source.source_id,
                    now,
                    "Source authority verification is due for review.",
                )
            )
        return SourceHealthRecord(
            source_id=source.source_id,
            owner=source.owner,
            entrypoint_uri=source.entrypoint_uri,
            topics=tuple(sorted(topic.value for topic in source.topics)),
            availability=availability,
            refresh=refresh_status,
            publication=publication_status,
            last_attempt_at=latest.completed_at if latest is not None else None,
            last_success_at=last_success_at,
            latest_publication_at=publication_at,
            next_refresh_due_at=refresh_due,
            publication_expires_at=publication_expires,
            authority_review_due_at=review_due,
            consecutive_failures=failures,
            refresh_history=events,
            alerts=tuple(sorted(alerts, key=_alert_order)),
        )


def merge_source_health_history(
    *,
    previous: SourceHealthHistory | None,
    current: SourceRefreshCycle,
    catalog_sha256: str,
) -> SourceHealthHistory:
    _sha256(catalog_sha256, "catalog_sha256")
    if previous is not None and previous.catalog_sha256 != catalog_sha256:
        raise ValueError("previous source health history catalog digest changed")
    by_run_id = {
        cycle.run_id: cycle for cycle in (() if previous is None else previous.cycles)
    }
    existing = by_run_id.get(current.run_id)
    if existing is not None and existing.run_attempt > current.run_attempt:
        raise ValueError("source health rerun attempt moved backwards")
    by_run_id[current.run_id] = current
    cycles = tuple(sorted(by_run_id.values(), key=_cycle_order))[-_MAXIMUM_HISTORY_CYCLES:]
    return SourceHealthHistory(
        repository_sha=current.repository_sha,
        catalog_sha256=catalog_sha256,
        generated_at=current.completed_at,
        previous_history_sha256=(
            previous.history_sha256 if previous is not None else None
        ),
        cycles=cycles,
    )


def source_health_history_payload(
    history: SourceHealthHistory,
    *,
    include_sha: bool = True,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "catalog_sha256": history.catalog_sha256,
        "cycles": [_refresh_cycle_payload(cycle) for cycle in history.cycles],
        "generated_at": history.generated_at.isoformat(),
        "previous_history_sha256": history.previous_history_sha256,
        "repository_sha": history.repository_sha,
        "schema_version": "tai.source-health-history.v1",
    }
    if include_sha:
        payload["history_sha256"] = history.history_sha256
    return payload


def source_health_dashboard_payload(
    dashboard: SourceHealthDashboard,
    *,
    include_sha: bool = True,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "alerts": [_alert_payload(alert) for alert in dashboard.alerts],
        "all_critical_covered": dashboard.all_critical_covered,
        "assessment_sha256": dashboard.assessment_sha256,
        "catalog_sha256": dashboard.catalog_sha256,
        "coverage_basis_points": dashboard.coverage_basis_points,
        "critical_coverage_basis_points": dashboard.critical_coverage_basis_points,
        "generated_at": dashboard.generated_at.isoformat(),
        "history_sha256": dashboard.history_sha256,
        "history_status": dashboard.history_status.value,
        "repository_sha": dashboard.repository_sha,
        "schema_version": "tai.source-health-dashboard.v1",
        "sources": [_record_payload(record) for record in dashboard.sources],
        "status": dashboard.status.value,
    }
    if include_sha:
        payload["dashboard_sha256"] = dashboard.dashboard_sha256
    return payload


def active_alerts_payload(dashboard: SourceHealthDashboard) -> dict[str, object]:
    payload: dict[str, object] = {
        "alerts": [_alert_payload(alert) for alert in dashboard.alerts],
        "dashboard_sha256": dashboard.dashboard_sha256,
        "generated_at": dashboard.generated_at.isoformat(),
        "repository_sha": dashboard.repository_sha,
        "schema_version": "tai.source-health-alerts.v1",
    }
    payload["alerts_sha256"] = _hash_payload(payload)
    return payload


def load_source_health_history(path: Path) -> SourceHealthHistory:
    raw = json.loads(path.read_text(encoding="utf-8"))
    payload = _object(raw, "source health history")
    if payload.get("schema_version") != "tai.source-health-history.v1":
        raise ValueError("unsupported source health history schema")
    cycles = tuple(
        _parse_cycle(value) for value in _array(payload, "cycles")
    )
    history = SourceHealthHistory(
        repository_sha=_string(payload, "repository_sha"),
        catalog_sha256=_string(payload, "catalog_sha256"),
        generated_at=_datetime(payload, "generated_at"),
        previous_history_sha256=_optional_string(
            payload,
            "previous_history_sha256",
        ),
        cycles=cycles,
    )
    if _string(payload, "history_sha256") != history.history_sha256:
        raise ValueError("source health history digest mismatch")
    return history


def _events_for_source(
    history: SourceHealthHistory,
    source_id: str,
) -> tuple[SourceRefreshEvent, ...]:
    return tuple(
        event
        for cycle in history.cycles
        for event in cycle.events
        if event.source_id == source_id
    )


def _consecutive_failures(events: tuple[SourceRefreshEvent, ...]) -> int:
    failures = 0
    for event in reversed(events):
        if event.outcome.successful:
            break
        failures += 1
    return failures


def _refresh_event_payload(
    event: SourceRefreshEvent,
    *,
    include_sha: bool = True,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "completed_at": event.completed_at.isoformat(),
        "content_sha256": event.content_sha256,
        "document_count": event.document_count,
        "last_success_at": _iso(event.last_success_at),
        "latest_publication_at": _iso(event.latest_publication_at),
        "observation_sha256": event.observation_sha256,
        "observed_topics": list(event.observed_topics),
        "outcome": event.outcome.value,
        "reason": event.reason,
        "source_id": event.source_id,
        "started_at": event.started_at.isoformat(),
    }
    if include_sha:
        payload["event_sha256"] = event.event_sha256
    return payload


def _refresh_cycle_payload(
    cycle: SourceRefreshCycle,
    *,
    include_sha: bool = True,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "completed_at": cycle.completed_at.isoformat(),
        "events": [_refresh_event_payload(event) for event in cycle.events],
        "evidence_bundle_sha256": cycle.evidence_bundle_sha256,
        "repository_sha": cycle.repository_sha,
        "run_attempt": cycle.run_attempt,
        "run_id": cycle.run_id,
        "started_at": cycle.started_at.isoformat(),
        "trigger": cycle.trigger,
    }
    if include_sha:
        payload["cycle_sha256"] = cycle.cycle_sha256
    return payload


def _record_payload(record: SourceHealthRecord) -> dict[str, object]:
    return {
        "alerts": [_alert_payload(alert) for alert in record.alerts],
        "authority_review_due_at": record.authority_review_due_at.isoformat(),
        "availability": record.availability.value,
        "consecutive_failures": record.consecutive_failures,
        "entrypoint_uri": record.entrypoint_uri,
        "last_attempt_at": _iso(record.last_attempt_at),
        "last_success_at": _iso(record.last_success_at),
        "latest_publication_at": _iso(record.latest_publication_at),
        "next_refresh_due_at": _iso(record.next_refresh_due_at),
        "owner": record.owner,
        "publication": record.publication.value,
        "publication_expires_at": _iso(record.publication_expires_at),
        "refresh": record.refresh.value,
        "refresh_history": [
            _refresh_event_payload(event) for event in record.refresh_history
        ],
        "source_id": record.source_id,
        "topics": list(record.topics),
    }


def _alert_payload(alert: SourceHealthAlert) -> dict[str, object]:
    return {
        "code": alert.code.value,
        "detail": alert.detail,
        "observed_at": alert.observed_at.isoformat(),
        "severity": alert.severity.value,
        "source_id": alert.source_id,
    }


def _parse_cycle(value: object) -> SourceRefreshCycle:
    payload = _object(value, "source refresh cycle")
    cycle = SourceRefreshCycle(
        repository_sha=_string(payload, "repository_sha"),
        run_id=_integer(payload, "run_id"),
        run_attempt=_integer(payload, "run_attempt"),
        trigger=_string(payload, "trigger"),
        started_at=_datetime(payload, "started_at"),
        completed_at=_datetime(payload, "completed_at"),
        evidence_bundle_sha256=_string(payload, "evidence_bundle_sha256"),
        events=tuple(_parse_event(item) for item in _array(payload, "events")),
    )
    if _string(payload, "cycle_sha256") != cycle.cycle_sha256:
        raise ValueError("source refresh cycle digest mismatch")
    return cycle


def _parse_event(value: object) -> SourceRefreshEvent:
    payload = _object(value, "source refresh event")
    event = SourceRefreshEvent(
        source_id=_string(payload, "source_id"),
        started_at=_datetime(payload, "started_at"),
        completed_at=_datetime(payload, "completed_at"),
        outcome=SourceRefreshOutcome(_string(payload, "outcome")),
        reason=_string(payload, "reason"),
        observation_sha256=_optional_string(payload, "observation_sha256"),
        content_sha256=_optional_string(payload, "content_sha256"),
        latest_publication_at=_optional_datetime(
            payload,
            "latest_publication_at",
        ),
        last_success_at=_optional_datetime(payload, "last_success_at"),
        document_count=_optional_integer(payload, "document_count"),
        observed_topics=tuple(_strings(payload, "observed_topics")),
    )
    if _string(payload, "event_sha256") != event.event_sha256:
        raise ValueError("source refresh event digest mismatch")
    return event


def _alert(
    code: SourceAlertCode,
    severity: SourceAlertSeverity,
    source_id: str,
    now: datetime,
    detail: str,
) -> SourceHealthAlert:
    return SourceHealthAlert(
        code=code,
        severity=severity,
        source_id=source_id,
        observed_at=now,
        detail=detail,
    )


def _cycle_order(cycle: SourceRefreshCycle) -> tuple[datetime, int, int]:
    return cycle.completed_at, cycle.run_id, cycle.run_attempt


def _alert_order(alert: SourceHealthAlert) -> tuple[str, str, str]:
    return alert.source_id or "", alert.severity.value, alert.code.value


def _hash_payload(payload: object) -> str:
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _object(value: object, name: str) -> dict[str, Any]:
    if not isinstance(value, dict) or any(not isinstance(key, str) for key in value):
        raise ValueError(f"{name} must be an object")
    return cast(dict[str, Any], value)


def _array(payload: dict[str, Any], key: str) -> list[object]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ValueError(f"{key} must be an array")
    return cast(list[object], value)


def _string(payload: dict[str, Any], key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value:
        raise ValueError(f"{key} must be a non-empty string")
    return value


def _optional_string(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if value is not None and not isinstance(value, str):
        raise ValueError(f"{key} must be a string or null")
    return value


def _integer(payload: dict[str, Any], key: str) -> int:
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{key} must be an integer")
    return value


def _optional_integer(payload: dict[str, Any], key: str) -> int | None:
    value = payload.get(key)
    if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
        raise ValueError(f"{key} must be an integer or null")
    return cast(int | None, value)


def _strings(payload: dict[str, Any], key: str) -> list[str]:
    values = _array(payload, key)
    if any(not isinstance(value, str) for value in values):
        raise ValueError(f"{key} must contain strings")
    return cast(list[str], values)


def _datetime(payload: dict[str, Any], key: str) -> datetime:
    value = datetime.fromisoformat(_string(payload, key))
    _aware(value, key)
    return value


def _optional_datetime(payload: dict[str, Any], key: str) -> datetime | None:
    value = _optional_string(payload, key)
    if value is None:
        return None
    parsed = datetime.fromisoformat(value)
    _aware(parsed, key)
    return parsed


def _git_oid(value: str) -> None:
    if _GIT_OBJECT_ID.fullmatch(value) is None:
        raise ValueError("repository_sha must be a lowercase Git object id")


def _sha256(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be lowercase SHA-256")


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None
