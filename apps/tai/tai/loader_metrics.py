from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from time import monotonic
from typing import Protocol

from tai.loader_state import LoaderStateRepository
from tai.loader_worker import ManagedLoaderWorker, WorkerExecution


class LoaderMetricsSink(Protocol):
    def increment(self, name: str, *, labels: dict[str, str]) -> None: ...

    def observe(self, name: str, value: float, *, labels: dict[str, str]) -> None: ...

    def set_gauge(self, name: str, value: float, *, labels: dict[str, str]) -> None: ...


class NullLoaderMetricsSink:
    def increment(self, name: str, *, labels: dict[str, str]) -> None:
        return None

    def observe(self, name: str, value: float, *, labels: dict[str, str]) -> None:
        return None

    def set_gauge(self, name: str, value: float, *, labels: dict[str, str]) -> None:
        return None


@dataclass
class InMemoryLoaderMetricsSink:
    counters: list[tuple[str, dict[str, str]]] = field(default_factory=list)
    observations: list[tuple[str, float, dict[str, str]]] = field(default_factory=list)
    gauges: list[tuple[str, float, dict[str, str]]] = field(default_factory=list)

    def increment(self, name: str, *, labels: dict[str, str]) -> None:
        self.counters.append((name, labels))

    def observe(self, name: str, value: float, *, labels: dict[str, str]) -> None:
        self.observations.append((name, value, labels))

    def set_gauge(self, name: str, value: float, *, labels: dict[str, str]) -> None:
        self.gauges.append((name, value, labels))


class InstrumentedLoaderWorker:
    def __init__(
        self,
        *,
        worker: ManagedLoaderWorker,
        repository: LoaderStateRepository,
        metrics: LoaderMetricsSink,
        clock: Callable[[], float] = monotonic,
    ) -> None:
        self._worker = worker
        self._repository = repository
        self._metrics = metrics
        self._clock = clock

    def run_once(self, *, now: datetime) -> WorkerExecution:
        started_at = self._clock()
        try:
            execution = self._worker.run_once(now=now)
        except Exception as error:
            self._metrics.increment(
                "tai_loader_worker_exceptions_total",
                labels={"exception": type(error).__name__},
            )
            raise
        finally:
            duration = max(0.0, self._clock() - started_at)
            self._metrics.observe(
                "tai_loader_run_duration_seconds",
                duration,
                labels={},
            )

        disposition = execution.disposition.value if execution.disposition else "NONE"
        source_id = execution.source_id or "NONE"
        labels = {
            "source_id": source_id,
            "disposition": disposition,
            "completed": str(execution.completed).lower(),
        }
        self._metrics.increment("tai_loader_runs_total", labels=labels)

        if execution.source_id is not None:
            state = self._repository.get(execution.source_id)
            if state is not None:
                self._metrics.set_gauge(
                    "tai_loader_consecutive_failures",
                    float(state.consecutive_failures),
                    labels={"source_id": execution.source_id},
                )
        return execution
