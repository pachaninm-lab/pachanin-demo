from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from tai.loader_metrics import InMemoryLoaderMetricsSink, InstrumentedLoaderWorker
from tai.loader_state import InMemoryLoaderStateRepository, LoaderRunStatus
from tai.loader_worker import WorkerExecution
from tai.managed_loader import FetchDisposition

NOW = datetime(2026, 7, 18, 18, tzinfo=UTC)
SOURCE_ID = "official.minselhoz"


@dataclass
class StubWorker:
    execution: WorkerExecution

    def run_once(self, *, now: datetime) -> WorkerExecution:
        assert now == NOW
        return self.execution


class RaisingWorker:
    def run_once(self, *, now: datetime) -> WorkerExecution:
        raise RuntimeError("worker failed")


class SequenceClock:
    def __init__(self, *values: float) -> None:
        self._values = iter(values)

    def __call__(self) -> float:
        return next(self._values)


def test_instrumented_worker_records_run_duration_and_failure_gauge() -> None:
    repository = InMemoryLoaderStateRepository()
    repository.schedule(
        source_id=SOURCE_ID,
        source_uri="https://mcx.gov.ru/report",
        next_run_at=NOW,
    )
    lease = repository.claim_due(worker_id="worker-a", now=NOW, lease_duration=NOW - NOW.replace(hour=17))
    assert lease is not None
    assert repository.complete(
        lease=lease,
        status=LoaderRunStatus.RETRYABLE_FAILURE,
        next_run_at=NOW,
        etag=None,
        last_modified=None,
        consecutive_failures=2,
    )
    metrics = InMemoryLoaderMetricsSink()
    worker = InstrumentedLoaderWorker(
        worker=StubWorker(
            WorkerExecution(
                SOURCE_ID,
                FetchDisposition.RETRYABLE_FAILURE,
                True,
                ("upstream_timeout",),
            )
        ),
        repository=repository,
        metrics=metrics,
        clock=SequenceClock(10.0, 10.25),
    )

    execution = worker.run_once(now=NOW)

    assert execution.source_id == SOURCE_ID
    assert metrics.counters == [
        (
            "tai_loader_runs_total",
            {
                "source_id": SOURCE_ID,
                "disposition": "RETRYABLE_FAILURE",
                "completed": "true",
            },
        )
    ]
    assert metrics.observations == [
        ("tai_loader_run_duration_seconds", 0.25, {})
    ]
    assert metrics.gauges == [
        ("tai_loader_consecutive_failures", 2.0, {"source_id": SOURCE_ID})
    ]


def test_instrumented_worker_records_exception_and_duration_before_reraising() -> None:
    metrics = InMemoryLoaderMetricsSink()
    worker = InstrumentedLoaderWorker(
        worker=RaisingWorker(),
        repository=InMemoryLoaderStateRepository(),
        metrics=metrics,
        clock=SequenceClock(20.0, 20.5),
    )

    try:
        worker.run_once(now=NOW)
    except RuntimeError as error:
        assert str(error) == "worker failed"
    else:
        raise AssertionError("worker exception must be propagated")

    assert metrics.counters == [
        ("tai_loader_worker_exceptions_total", {"exception": "RuntimeError"})
    ]
    assert metrics.observations == [
        ("tai_loader_run_duration_seconds", 0.5, {})
    ]
    assert metrics.gauges == []
