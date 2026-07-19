from __future__ import annotations

import json
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from tai.source_coverage import (
    CoverageRequirement,
    CoverageTopic,
    OfficialSourceCatalog,
    OfficialSourceCoverageAuthority,
    OfficialSourceDefinition,
    SourceFormat,
    SourceObservation,
)
from tai.source_health import (
    OfficialSourceHealthAuthority,
    SourceAlertCode,
    SourceAlertSeverity,
    SourceAvailability,
    SourceFreshness,
    SourceHealthHistory,
    SourceHealthStatus,
    SourceHistoryStatus,
    SourcePublicationStatus,
    SourceRefreshCycle,
    SourceRefreshEvent,
    SourceRefreshOutcome,
    active_alerts_payload,
    load_source_health_history,
    merge_source_health_history,
    source_health_dashboard_payload,
    source_health_history_payload,
)

NOW = datetime(2026, 7, 19, 12, 0, tzinfo=UTC)
REPOSITORY_SHA = "a" * 40
CATALOG_SHA = "b" * 64
CONTENT_SHA = "c" * 64
OBSERVATION_SHA = "d" * 64


def _catalog(
    *,
    expected_interval: timedelta = timedelta(days=7),
    maximum_age: timedelta = timedelta(days=31),
    verified_at: datetime = NOW - timedelta(days=1),
) -> OfficialSourceCatalog:
    source = OfficialSourceDefinition(
        source_id="official.example.market",
        owner="Official Example Authority",
        entrypoint_uri="https://data.example.gov/market",
        allowed_hosts=frozenset({"data.example.gov"}),
        topics=frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
        formats=frozenset({SourceFormat.JSON}),
        expected_update_interval=expected_interval,
        maximum_publication_age=maximum_age,
        verified_at=verified_at,
    )
    return OfficialSourceCatalog(
        sources=(source,),
        requirements=(
            CoverageRequirement(
                topic=CoverageTopic.GRAIN_MARKET_PRICES,
                minimum_official_sources=1,
                maximum_publication_age=maximum_age,
            ),
        ),
    )


def _success(
    *,
    completed_at: datetime = NOW,
    publication_at: datetime | None = None,
) -> SourceRefreshEvent:
    published = publication_at or completed_at - timedelta(days=1)
    return SourceRefreshEvent(
        source_id="official.example.market",
        started_at=completed_at - timedelta(seconds=1),
        completed_at=completed_at,
        outcome=SourceRefreshOutcome.SUCCEEDED,
        reason="official_source_observed",
        observation_sha256=OBSERVATION_SHA,
        content_sha256=CONTENT_SHA,
        latest_publication_at=published,
        last_success_at=completed_at,
        document_count=2,
        observed_topics=(CoverageTopic.GRAIN_MARKET_PRICES.value,),
    )


def _failure(
    *,
    completed_at: datetime,
    outcome: SourceRefreshOutcome = SourceRefreshOutcome.RETRYABLE_FAILURE,
) -> SourceRefreshEvent:
    return SourceRefreshEvent(
        source_id="official.example.market",
        started_at=completed_at - timedelta(seconds=1),
        completed_at=completed_at,
        outcome=outcome,
        reason="source_transport_timeout",
    )


def _cycle(
    run_id: int,
    event: SourceRefreshEvent,
    *,
    run_attempt: int = 1,
) -> SourceRefreshCycle:
    return SourceRefreshCycle(
        repository_sha=REPOSITORY_SHA,
        run_id=run_id,
        run_attempt=run_attempt,
        trigger="schedule" if run_id % 2 else "workflow_dispatch",
        started_at=event.started_at,
        completed_at=event.completed_at,
        evidence_bundle_sha256=f"{run_id % 10}" * 64,
        events=(event,),
    )


def _observation(
    event: SourceRefreshEvent,
    *,
    failures: int = 0,
) -> SourceObservation:
    assert event.latest_publication_at is not None
    assert event.last_success_at is not None
    return SourceObservation(
        source_id=event.source_id,
        observed_at=event.completed_at,
        latest_publication_at=event.latest_publication_at,
        last_success_at=event.last_success_at,
        document_count=event.document_count or 1,
        consecutive_failures=failures,
        observed_topics=frozenset({CoverageTopic.GRAIN_MARKET_PRICES}),
        content_sha256=CONTENT_SHA,
    )


def test_owner_command_trigger_is_governed() -> None:
    cycle = replace(_cycle(1, _success()), trigger="issue_comment")

    assert cycle.trigger == "issue_comment"


def _coverage(
    catalog: OfficialSourceCatalog,
    observation: SourceObservation | None,
    *,
    now: datetime,
):
    return OfficialSourceCoverageAuthority().assess(
        catalog=catalog,
        observations=() if observation is None else (observation,),
        now=now,
    )


def _dashboard(
    *,
    catalog: OfficialSourceCatalog,
    history: SourceHealthHistory,
    observation: SourceObservation | None,
    now: datetime,
    history_status: SourceHistoryStatus = SourceHistoryStatus.CONTIGUOUS,
):
    return OfficialSourceHealthAuthority().assess(
        catalog=catalog,
        history=history,
        history_status=history_status,
        coverage=_coverage(catalog, observation, now=now),
        now=now,
    )


def test_healthy_history_dashboard_is_deterministic_and_round_trips(
    tmp_path: Path,
) -> None:
    catalog = _catalog()
    event = _success()
    history = merge_source_health_history(
        previous=None,
        current=_cycle(101, event),
        catalog_sha256=CATALOG_SHA,
    )
    dashboard = _dashboard(
        catalog=catalog,
        history=history,
        observation=_observation(event),
        now=NOW,
        history_status=SourceHistoryStatus.BOOTSTRAP,
    )

    assert dashboard.status is SourceHealthStatus.HEALTHY
    record = dashboard.sources[0]
    assert record.availability is SourceAvailability.HEALTHY
    assert record.refresh is SourceFreshness.CURRENT
    assert record.publication is SourcePublicationStatus.CURRENT
    assert record.consecutive_failures == 0
    assert record.alerts == ()
    assert len(event.event_sha256) == 64
    assert len(history.cycles[0].cycle_sha256) == 64
    assert len(history.history_sha256) == 64
    assert len(dashboard.dashboard_sha256) == 64
    assert source_health_dashboard_payload(dashboard) == source_health_dashboard_payload(
        dashboard
    )
    assert active_alerts_payload(dashboard)["alerts"] == []

    path = tmp_path / "history.json"
    path.write_text(
        json.dumps(source_health_history_payload(history)),
        encoding="utf-8",
    )
    assert load_source_health_history(path) == history


def test_failure_thresholds_and_success_recovery_reset_streak() -> None:
    catalog = _catalog()
    success = _success(completed_at=NOW - timedelta(days=1))
    history = merge_source_health_history(
        previous=None,
        current=_cycle(1, success),
        catalog_sha256=CATALOG_SHA,
    )
    first_failure = _failure(completed_at=NOW - timedelta(hours=3))
    history = merge_source_health_history(
        previous=history,
        current=_cycle(2, first_failure),
        catalog_sha256=CATALOG_SHA,
    )
    one = _dashboard(
        catalog=catalog,
        history=history,
        observation=_observation(success, failures=1),
        now=NOW - timedelta(hours=3),
    )
    assert one.sources[0].availability is SourceAvailability.DEGRADED
    assert one.sources[0].consecutive_failures == 1
    assert {alert.code for alert in one.alerts} == {
        SourceAlertCode.SOURCE_REFRESH_FAILED
    }

    second_failure = _failure(completed_at=NOW - timedelta(hours=2))
    history = merge_source_health_history(
        previous=history,
        current=_cycle(3, second_failure),
        catalog_sha256=CATALOG_SHA,
    )
    two = _dashboard(
        catalog=catalog,
        history=history,
        observation=_observation(success, failures=2),
        now=NOW - timedelta(hours=2),
    )
    consecutive = next(
        alert
        for alert in two.alerts
        if alert.code is SourceAlertCode.SOURCE_CONSECUTIVE_FAILURES
    )
    assert consecutive.severity is SourceAlertSeverity.WARNING

    third_failure = _failure(completed_at=NOW - timedelta(hours=1))
    history = merge_source_health_history(
        previous=history,
        current=_cycle(4, third_failure),
        catalog_sha256=CATALOG_SHA,
    )
    three = _dashboard(
        catalog=catalog,
        history=history,
        observation=_observation(success, failures=3),
        now=NOW - timedelta(hours=1),
    )
    assert three.status is SourceHealthStatus.CRITICAL
    assert three.sources[0].availability is SourceAvailability.FAILED
    assert next(
        alert
        for alert in three.alerts
        if alert.code is SourceAlertCode.SOURCE_CONSECUTIVE_FAILURES
    ).severity is SourceAlertSeverity.CRITICAL

    recovered = _success(completed_at=NOW)
    history = merge_source_health_history(
        previous=history,
        current=_cycle(5, recovered),
        catalog_sha256=CATALOG_SHA,
    )
    recovery = _dashboard(
        catalog=catalog,
        history=history,
        observation=_observation(recovered),
        now=NOW,
    )
    assert recovery.status is SourceHealthStatus.HEALTHY
    assert recovery.sources[0].consecutive_failures == 0
    assert recovery.alerts == ()


def test_stale_expired_and_authority_review_alerts_are_fail_closed() -> None:
    catalog = _catalog(
        expected_interval=timedelta(days=2),
        maximum_age=timedelta(days=3),
        verified_at=NOW - timedelta(days=3),
    )
    event = _success(
        completed_at=NOW - timedelta(days=3),
        publication_at=NOW - timedelta(days=4),
    )
    history = merge_source_health_history(
        previous=None,
        current=_cycle(1, event),
        catalog_sha256=CATALOG_SHA,
    )
    dashboard = _dashboard(
        catalog=catalog,
        history=history,
        observation=_observation(event),
        now=NOW,
    )

    record = dashboard.sources[0]
    assert record.refresh is SourceFreshness.STALE
    assert record.publication is SourcePublicationStatus.EXPIRED
    assert dashboard.status is SourceHealthStatus.CRITICAL
    assert {alert.code for alert in dashboard.alerts} == {
        SourceAlertCode.REFRESH_STALE,
        SourceAlertCode.PUBLICATION_EXPIRED,
        SourceAlertCode.AUTHORITY_REVIEW_DUE,
    }

    exact_catalog = _catalog(
        expected_interval=timedelta(days=3),
        maximum_age=timedelta(days=4),
        verified_at=NOW,
    )
    exact = _dashboard(
        catalog=exact_catalog,
        history=history,
        observation=_observation(event),
        now=NOW,
    )
    assert exact.sources[0].refresh is SourceFreshness.CURRENT
    assert exact.sources[0].publication is SourcePublicationStatus.CURRENT


def test_unobserved_and_history_gap_are_explicit() -> None:
    catalog = _catalog()
    failure = _failure(
        completed_at=NOW,
        outcome=SourceRefreshOutcome.PERMANENT_FAILURE,
    )
    history = merge_source_health_history(
        previous=None,
        current=_cycle(1, failure),
        catalog_sha256=CATALOG_SHA,
    )
    dashboard = _dashboard(
        catalog=catalog,
        history=history,
        observation=None,
        now=NOW,
        history_status=SourceHistoryStatus.GAP,
    )

    assert dashboard.sources[0].availability is SourceAvailability.FAILED
    assert dashboard.sources[0].refresh is SourceFreshness.UNKNOWN
    assert dashboard.sources[0].publication is SourcePublicationStatus.UNKNOWN
    assert {alert.code for alert in dashboard.alerts} == {
        SourceAlertCode.SOURCE_UNOBSERVED,
        SourceAlertCode.SOURCE_REFRESH_FAILED,
        SourceAlertCode.HISTORY_GAP,
    }
    assert any(alert.source_id is None for alert in dashboard.alerts)


def test_history_replaces_rerun_rejects_backward_attempt_and_bounds_cycles() -> None:
    first = _cycle(7, _success(completed_at=NOW - timedelta(hours=2)))
    history = merge_source_health_history(
        previous=None,
        current=first,
        catalog_sha256=CATALOG_SHA,
    )
    rerun = _cycle(
        7,
        _success(completed_at=NOW - timedelta(hours=1)),
        run_attempt=2,
    )
    history = merge_source_health_history(
        previous=history,
        current=rerun,
        catalog_sha256=CATALOG_SHA,
    )
    assert len(history.cycles) == 1
    assert history.cycles[0].run_attempt == 2
    assert history.previous_history_sha256 is not None

    with pytest.raises(ValueError, match="backwards"):
        merge_source_health_history(
            previous=history,
            current=first,
            catalog_sha256=CATALOG_SHA,
        )
    with pytest.raises(ValueError, match="catalog digest"):
        merge_source_health_history(
            previous=history,
            current=_cycle(8, _success()),
            catalog_sha256="e" * 64,
        )

    for run_id in range(8, 65):
        event = _success(completed_at=NOW + timedelta(minutes=run_id))
        history = merge_source_health_history(
            previous=history,
            current=_cycle(run_id, event),
            catalog_sha256=CATALOG_SHA,
        )
    assert len(history.cycles) == 52
    assert history.cycles[0].run_id == 13


def test_history_digest_tampering_and_unknown_source_are_rejected(
    tmp_path: Path,
) -> None:
    catalog = _catalog()
    event = _success()
    history = merge_source_health_history(
        previous=None,
        current=_cycle(1, event),
        catalog_sha256=CATALOG_SHA,
    )
    payload = source_health_history_payload(history)
    payload["history_sha256"] = "f" * 64
    path = tmp_path / "tampered.json"
    path.write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match="history digest"):
        load_source_health_history(path)

    unknown = replace(event, source_id="official.unknown.source")
    unknown_history = merge_source_health_history(
        previous=None,
        current=_cycle(2, unknown),
        catalog_sha256=CATALOG_SHA,
    )
    with pytest.raises(ValueError, match="unknown source"):
        _dashboard(
            catalog=catalog,
            history=unknown_history,
            observation=None,
            now=NOW,
        )


@pytest.mark.parametrize(
    ("base", "overrides", "message"),
    [
        (
            "failure",
            {"reason": "raw exception / secret"},
            "bounded diagnostic",
        ),
        (
            "success",
            {"content_sha256": None},
            "present together",
        ),
        (
            "success",
            {"observed_topics": ()},
            "topics",
        ),
        (
            "success",
            {"document_count": 0},
            "document_count",
        ),
    ],
)
def test_refresh_event_contract_rejects_unsafe_or_partial_evidence(
    base: str,
    overrides: dict[str, object],
    message: str,
) -> None:
    event = _failure(completed_at=NOW) if base == "failure" else _success()
    values: dict[str, object] = {
        "source_id": event.source_id,
        "started_at": event.started_at,
        "completed_at": event.completed_at,
        "outcome": event.outcome,
        "reason": event.reason,
        "observation_sha256": event.observation_sha256,
        "content_sha256": event.content_sha256,
        "latest_publication_at": event.latest_publication_at,
        "last_success_at": event.last_success_at,
        "document_count": event.document_count,
        "observed_topics": event.observed_topics,
    }
    values.update(overrides)
    with pytest.raises(ValueError, match=message):
        SourceRefreshEvent(**values)  # type: ignore[arg-type]
