from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tai.evaluation import (
    EvaluationAuthority,
    EvaluationCase,
    EvaluationCategory,
    EvaluationObservation,
    EvaluationPolicy,
    EvaluationSeverity,
    EvaluationSuite,
)
from tai.postgres_evaluation import PostgreSQLEvaluationRepository

NOW = datetime(2026, 7, 18, 18, 0, tzinfo=UTC)


class _Cursor(AbstractContextManager["_Cursor"]):
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.rows = rows
        self.fail = fail
        self.executions: list[tuple[str, tuple[Any, ...]]] = []

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None:
        if self.fail:
            raise RuntimeError("database unavailable")
        self.executions.append((query, tuple(parameters)))

    def fetchone(self) -> Mapping[str, Any] | None:
        if not self.rows:
            raise AssertionError("unexpected fetchone call")
        return self.rows.pop(0)


class _Connection(AbstractContextManager["_Connection"]):
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.cursor_instance = _Cursor(rows, fail=fail)
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def cursor(self) -> _Cursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True


class _Factory:
    def __init__(self, rows: list[Mapping[str, Any] | None], *, fail: bool = False) -> None:
        self.connection = _Connection(rows, fail=fail)

    def __call__(self) -> _Connection:
        return self.connection


def _report():
    case = EvaluationCase(
        case_id="grounded",
        category=EvaluationCategory.GROUNDED_QA,
        severity=EvaluationSeverity.CRITICAL,
        allowed_statuses=frozenset({"ANSWERED"}),
        minimum_citations=1,
        expected_tenant_id="tenant-a",
    )
    suite = EvaluationSuite(
        suite_id="tai.release",
        version="v1",
        cases=(case,),
        created_at=NOW,
    )
    observation = EvaluationObservation(
        case_id="grounded",
        request_id="request-grounded",
        status="ANSWERED",
        answer="Подтверждено [S1].",
        citations=("S1",),
        allowed_citations=("S1",),
        tenant_id="tenant-a",
        source_tenant_ids=("tenant-a",),
        model_invoked=True,
        tools=(),
        reason=None,
        observed_at=NOW + timedelta(minutes=1),
        trace_sha256="b" * 64,
    )
    authority = EvaluationAuthority(
        policy=EvaluationPolicy(
            minimum_case_count=1,
            required_categories=frozenset({EvaluationCategory.GROUNDED_QA}),
        )
    )
    return authority.evaluate(
        suite=suite,
        observations=(observation,),
        exact_head_sha="a" * 64,
        model_route="local.v1",
        knowledge_version="knowledge.v1",
        policy_version="policy.v1",
        started_at=NOW,
        completed_at=NOW + timedelta(minutes=2),
    )


def test_report_and_case_results_are_persisted_idempotently() -> None:
    report = _report()
    result = report.results[0]
    factory = _Factory(
        [
            {"run_id": report.run_id, "report_sha256": report.report_sha256},
            {"case_id": result.case_id, "result_sha256": result.result_sha256},
        ]
    )

    PostgreSQLEvaluationRepository(factory).record(report)

    cursor = factory.connection.cursor_instance
    assert len(cursor.executions) == 2
    run_query, run_parameters = cursor.executions[0]
    case_query, case_parameters = cursor.executions[1]
    assert "ON CONFLICT (run_id) DO UPDATE" in run_query
    assert "report_sha256 = EXCLUDED.report_sha256" in run_query
    assert run_parameters[0] == report.run_id
    assert run_parameters[4] == "a" * 64
    summary = json.loads(str(run_parameters[13]))
    assert summary["total_cases"] == 1
    assert summary["weighted_pass_rate"] == 1.0
    assert "ON CONFLICT (run_id, case_id) DO UPDATE" in case_query
    assert case_parameters[0] == report.run_id
    assert case_parameters[1] == "grounded"
    assert case_parameters[4] == "PASS"
    assert factory.connection.committed is True
    assert factory.connection.rolled_back is False


def test_conflicting_run_id_fails_closed_and_rolls_back() -> None:
    report = _report()
    factory = _Factory([None])

    with pytest.raises(RuntimeError, match="run_id"):
        PostgreSQLEvaluationRepository(factory).record(report)

    assert factory.connection.committed is False
    assert factory.connection.rolled_back is True


def test_conflicting_case_evidence_rolls_back_entire_transaction() -> None:
    report = _report()
    factory = _Factory(
        [
            {"run_id": report.run_id, "report_sha256": report.report_sha256},
            None,
        ]
    )

    with pytest.raises(RuntimeError, match="evaluation case"):
        PostgreSQLEvaluationRepository(factory).record(report)

    assert factory.connection.committed is False
    assert factory.connection.rolled_back is True


def test_digest_mismatch_fails_closed() -> None:
    report = _report()
    factory = _Factory(
        [{"run_id": report.run_id, "report_sha256": "f" * 64}]
    )

    with pytest.raises(RuntimeError, match="digest"):
        PostgreSQLEvaluationRepository(factory).record(report)


def test_database_error_rolls_back() -> None:
    factory = _Factory([], fail=True)

    with pytest.raises(RuntimeError, match="database unavailable"):
        PostgreSQLEvaluationRepository(factory).record(_report())

    assert factory.connection.rolled_back is True
