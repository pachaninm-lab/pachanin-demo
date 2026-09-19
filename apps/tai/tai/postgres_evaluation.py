from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from contextlib import AbstractContextManager
from typing import Any, Protocol

from tai.evaluation import EvaluationCaseResult, EvaluationReport


class EvaluationCursor(Protocol):
    def execute(self, query: str, parameters: Sequence[Any] = ()) -> None: ...

    def fetchone(self) -> Mapping[str, Any] | None: ...


class EvaluationConnection(Protocol):
    def cursor(self) -> AbstractContextManager[EvaluationCursor]: ...

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


class EvaluationConnectionFactory(Protocol):
    def __call__(self) -> AbstractContextManager[EvaluationConnection]: ...


class PostgreSQLEvaluationRepository:
    """Append-only, idempotent authority for release evaluation evidence."""

    def __init__(self, connection_factory: EvaluationConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record(self, report: EvaluationReport) -> None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    self._record_run(cursor, report)
                    for result in report.results:
                        self._record_result(cursor, report.run_id, result)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    @staticmethod
    def _record_run(cursor: EvaluationCursor, report: EvaluationReport) -> None:
        query = """
            INSERT INTO tai_evaluation_runs (
                run_id,
                suite_id,
                suite_version,
                suite_sha256,
                exact_head_sha,
                model_route,
                knowledge_version,
                policy_version,
                baseline_run_id,
                started_at,
                completed_at,
                accepted,
                rejection_reasons,
                summary,
                report_sha256
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::JSONB, %s
            )
            ON CONFLICT (run_id) DO UPDATE
            SET run_id = EXCLUDED.run_id
            WHERE tai_evaluation_runs.report_sha256 = EXCLUDED.report_sha256
            RETURNING run_id, report_sha256
        """
        cursor.execute(
            query,
            (
                report.run_id,
                report.suite_id,
                report.suite_version,
                report.suite_sha256,
                report.exact_head_sha,
                report.model_route,
                report.knowledge_version,
                report.policy_version,
                report.baseline_run_id,
                report.started_at,
                report.completed_at,
                report.accepted,
                list(report.rejection_reasons),
                _summary_json(report),
                report.report_sha256,
            ),
        )
        row = cursor.fetchone()
        if row is None:
            raise RuntimeError("evaluation run_id is already bound to different evidence")
        if str(row["report_sha256"]) != report.report_sha256:
            raise RuntimeError("persisted evaluation report digest does not match")

    @staticmethod
    def _record_result(
        cursor: EvaluationCursor,
        run_id: str,
        result: EvaluationCaseResult,
    ) -> None:
        query = """
            INSERT INTO tai_evaluation_case_results (
                run_id,
                case_id,
                category,
                severity,
                outcome,
                violations,
                observation_sha256,
                result_sha256
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (run_id, case_id) DO UPDATE
            SET run_id = EXCLUDED.run_id
            WHERE tai_evaluation_case_results.result_sha256 = EXCLUDED.result_sha256
            RETURNING case_id, result_sha256
        """
        cursor.execute(
            query,
            (
                run_id,
                result.case_id,
                result.category.value,
                result.severity.value,
                result.outcome.value,
                list(result.violations),
                result.observation_sha256,
                result.result_sha256,
            ),
        )
        row = cursor.fetchone()
        if row is None:
            raise RuntimeError("evaluation case is already bound to different evidence")
        if str(row["result_sha256"]) != result.result_sha256:
            raise RuntimeError("persisted evaluation case digest does not match")


def _summary_json(report: EvaluationReport) -> str:
    summary = report.summary
    return json.dumps(
        {
            "category_pass_rates": dict(summary.category_pass_rates),
            "critical_pass_rate": summary.critical_pass_rate,
            "error_cases": summary.error_cases,
            "failed_cases": summary.failed_cases,
            "passed_cases": summary.passed_cases,
            "regressions": list(summary.regressions),
            "total_cases": summary.total_cases,
            "weighted_pass_rate": summary.weighted_pass_rate,
        },
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )
