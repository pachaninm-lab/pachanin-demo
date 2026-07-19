from __future__ import annotations

from collections import deque
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tai.model_admission import (
    LicenseReviewDecision,
    LicenseReviewEvidence,
    ModelAdmissionAuthority,
    ModelAdmissionCandidate,
    ModelAdmissionRecord,
    ModelArtifactEvidence,
    ModelBenchmarkEvidence,
)
from tai.model_runtime import ModelRuntimeClass
from tai.postgres_model_admission import PostgreSQLModelAdmissionRepository

NOW = datetime(2026, 7, 19, 7, 0, tzinfo=UTC)
ARTIFACT_SHA = "a" * 64


def _candidate() -> ModelAdmissionCandidate:
    artifact = ModelArtifactEvidence(
        model_id="model-a",
        revision="r1",
        artifact_locator=f"oci://registry.local/model-a@sha256:{ARTIFACT_SHA}",
        artifact_sha256=ARTIFACT_SHA,
        source_uri="https://models.example/model-a",
        source_revision="b" * 40,
        license_spdx="Apache-2.0",
        license_text_sha256="c" * 64,
        tokenizer_sha256="d" * 64,
        quantization="Q4_K_M",
        runtime_class=ModelRuntimeClass.CPU,
        artifact_size_bytes=1_000_000,
        created_at=NOW - timedelta(days=2),
    )
    review = LicenseReviewEvidence(
        model_id="model-a",
        revision="r1",
        artifact_sha256=ARTIFACT_SHA,
        license_spdx="Apache-2.0",
        license_text_sha256="c" * 64,
        decision=LicenseReviewDecision.APPROVED,
        reviewed_by="reviewer-1",
        reviewed_at=NOW - timedelta(days=1),
        evidence_locator="file:///evidence/license.json",
        evidence_sha256="e" * 64,
    )
    benchmarks = tuple(
        ModelBenchmarkEvidence(
            benchmark_id=benchmark_id,
            model_id="model-a",
            revision="r1",
            artifact_sha256=ARTIFACT_SHA,
            runtime_class=runtime_class,
            hardware_profile=hardware,
            quantization="Q4_K_M",
            sample_count=1_000,
            platform_accuracy_basis_points=9_700,
            agro_accuracy_basis_points=9_200,
            prompt_tokens_per_second_milli=10_000,
            generation_tokens_per_second_milli=8_000,
            p95_latency_ms=900,
            peak_memory_mb=12_000,
            estimated_cost_rub_per_million_tokens_milli=400_000,
            measured_at=NOW - timedelta(hours=12),
            evidence_locator=f"file:///evidence/{benchmark_id}.json",
            evidence_sha256=evidence_sha,
        )
        for benchmark_id, runtime_class, hardware, evidence_sha in (
            ("cpu-run", ModelRuntimeClass.CPU, "4 vCPU / 16 GiB", "f" * 64),
            ("gpu-run", ModelRuntimeClass.GPU_SHARED, "A10 / 24 GiB", "1" * 64),
        )
    )
    return ModelAdmissionCandidate(
        artifact=artifact,
        license_review=review,
        benchmarks=benchmarks,
        fallback_identities=(("fallback", "r1"),),
        evaluated_at=NOW,
    )


class _Cursor:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self._rows = deque(rows)
        self.calls: list[tuple[str, object]] = []

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def execute(self, query: str, parameters: object) -> None:
        self.calls.append((query, parameters))

    def fetchone(self) -> dict[str, Any] | None:
        if not self._rows:
            return None
        return self._rows.popleft()


class _Connection:
    def __init__(self, rows: list[dict[str, Any] | None]) -> None:
        self.cursor_value = _Cursor(rows)
        self.commits = 0
        self.rollbacks = 0

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def cursor(self) -> _Cursor:
        return self.cursor_value

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class _Factory:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection
        self.calls = 0

    def __call__(self) -> _Connection:
        self.calls += 1
        return self.connection


def test_repository_records_artifact_review_benchmarks_and_decision_atomically() -> None:
    candidate = _candidate()
    decision = ModelAdmissionAuthority().assess(candidate)
    connection = _Connection(
        [
            {"artifact_sha256": ARTIFACT_SHA},
            {"review_sha256": "2" * 64},
            {"benchmark_id": "cpu-run"},
            {"benchmark_id": "gpu-run"},
            {"decision_sha256": decision.decision_sha256},
        ]
    )
    repository = PostgreSQLModelAdmissionRepository(_Factory(connection))

    repository.record(candidate, decision)

    assert connection.commits == 1
    assert connection.rollbacks == 0
    assert len(connection.cursor_value.calls) == 5
    queries = "\n".join(query for query, _ in connection.cursor_value.calls)
    assert "tai_model_artifact_evidence" in queries
    assert "tai_model_license_reviews" in queries
    assert queries.count("tai_model_benchmark_evidence") == 2
    assert "tai_model_admission_decisions" in queries


def test_repository_rolls_back_when_existing_evidence_conflicts() -> None:
    candidate = _candidate()
    decision = ModelAdmissionAuthority().assess(candidate)
    connection = _Connection([None])
    repository = PostgreSQLModelAdmissionRepository(_Factory(connection))

    with pytest.raises(RuntimeError, match="artifact identity"):
        repository.record(candidate, decision)

    assert connection.commits == 0
    assert connection.rollbacks == 1


def test_repository_rejects_decision_not_bound_to_candidate() -> None:
    candidate = _candidate()
    decision = ModelAdmissionAuthority().assess(candidate)
    wrong = type(decision)(
        model_id="other-model",
        revision=decision.revision,
        artifact_sha256=decision.artifact_sha256,
        status=decision.status,
        reasons=decision.reasons,
        decided_at=decision.decided_at,
        decision_sha256=decision.decision_sha256,
    )
    factory = _Factory(_Connection([]))
    repository = PostgreSQLModelAdmissionRepository(factory)

    with pytest.raises(ValueError, match="not bound"):
        repository.record(candidate, wrong)

    assert factory.calls == 0


def test_repository_lists_current_admission_records() -> None:
    connection = _Connection(
        [
            {
                "model_id": "model-a",
                "revision": "r1",
                "artifact_sha256": ARTIFACT_SHA,
                "accepted": True,
                "decided_at": NOW,
                "decision_sha256": "9" * 64,
            },
            {
                "model_id": "model-b",
                "revision": "r2",
                "artifact_sha256": "b" * 64,
                "accepted": False,
                "decided_at": NOW - timedelta(hours=1),
                "decision_sha256": "8" * 64,
            },
            None,
        ]
    )
    repository = PostgreSQLModelAdmissionRepository(_Factory(connection))

    records = repository.list_current()

    assert records == (
        ModelAdmissionRecord(
            model_id="model-a",
            revision="r1",
            artifact_sha256=ARTIFACT_SHA,
            accepted=True,
            decided_at=NOW,
            decision_sha256="9" * 64,
        ),
        ModelAdmissionRecord(
            model_id="model-b",
            revision="r2",
            artifact_sha256="b" * 64,
            accepted=False,
            decided_at=NOW - timedelta(hours=1),
            decision_sha256="8" * 64,
        ),
    )
    assert connection.commits == 1
