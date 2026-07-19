from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any, Protocol

from tai.git_oid import validate_git_oid
from tai.hybrid_retrieval import (
    EffectiveRetrievalMode,
    HybridSearchResult,
    RetrievalExecutionClass,
)
from tai.retrieval_index import RetrievalQuery

_IDENTIFIER = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


BenchmarkEvidenceClass = RetrievalExecutionClass


class BenchmarkOutcome(StrEnum):
    PASS = "PASS"  # noqa: S105
    FAIL = "FAIL"
    ERROR = "ERROR"


@dataclass(frozen=True, slots=True)
class RetrievalBenchmarkCase:
    case_id: str
    query: str
    expected_chunk_ids: tuple[str, ...]
    prohibited_chunk_ids: tuple[str, ...]
    tenant_id: str | None
    now: datetime
    limit: int = 10
    minimum_trust_score: float = 0.5
    critical: bool = False

    def __post_init__(self) -> None:
        _portable(self.case_id, "case_id")
        if not self.query.strip():
            raise ValueError("benchmark query must not be blank")
        if not self.expected_chunk_ids:
            raise ValueError("benchmark case must define expected chunks")
        _unique_portable(self.expected_chunk_ids, "expected_chunk_ids")
        _unique_portable(self.prohibited_chunk_ids, "prohibited_chunk_ids")
        if set(self.expected_chunk_ids).intersection(self.prohibited_chunk_ids):
            raise ValueError("expected and prohibited chunks must not overlap")
        if self.tenant_id is not None and not self.tenant_id.strip():
            raise ValueError("tenant_id must be null or non-blank")
        if self.now.utcoffset() is None:
            raise ValueError("benchmark time must be timezone-aware")
        if self.limit < 1 or self.limit > 100:
            raise ValueError("benchmark limit must be between 1 and 100")
        if not 0.0 <= self.minimum_trust_score <= 1.0:
            raise ValueError("minimum_trust_score must be between 0 and 1")

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "case_id": self.case_id,
                "critical": self.critical,
                "expected_chunk_ids": list(self.expected_chunk_ids),
                "limit": self.limit,
                "minimum_trust_score": self.minimum_trust_score,
                "now": self.now.isoformat(),
                "prohibited_chunk_ids": list(self.prohibited_chunk_ids),
                "query_sha256": hashlib.sha256(self.query.encode()).hexdigest(),
                "tenant_id": self.tenant_id,
            }
        )


@dataclass(frozen=True, slots=True)
class RetrievalBenchmarkSuite:
    suite_id: str
    version: str
    cases: tuple[RetrievalBenchmarkCase, ...]
    created_at: datetime

    def __post_init__(self) -> None:
        _portable(self.suite_id, "suite_id")
        _portable(self.version, "suite version")
        if self.created_at.utcoffset() is None:
            raise ValueError("suite created_at must be timezone-aware")
        if not self.cases:
            raise ValueError("benchmark suite must contain cases")
        case_ids = [case.case_id for case in self.cases]
        if len(case_ids) != len(set(case_ids)):
            raise ValueError("benchmark case IDs must be unique")

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "cases": [
                    case.sha256
                    for case in sorted(self.cases, key=lambda item: item.case_id)
                ],
                "created_at": self.created_at.isoformat(),
                "suite_id": self.suite_id,
                "version": self.version,
            }
        )


@dataclass(frozen=True, slots=True)
class RetrievalBenchmarkPolicy:
    minimum_case_count: int = 20
    minimum_recall_at_k: float = 0.90
    minimum_mrr: float = 0.85
    minimum_ndcg_at_k: float = 0.85
    required_critical_recall: float = 1.0
    maximum_errors: int = 0
    maximum_prohibited_hits: int = 0
    require_measured_evidence: bool = True
    require_hybrid_mode: bool = True
    require_admitted_components: bool = True

    def __post_init__(self) -> None:
        if self.minimum_case_count < 1:
            raise ValueError("minimum_case_count must be positive")
        for value, name in (
            (self.minimum_recall_at_k, "minimum_recall_at_k"),
            (self.minimum_mrr, "minimum_mrr"),
            (self.minimum_ndcg_at_k, "minimum_ndcg_at_k"),
            (self.required_critical_recall, "required_critical_recall"),
        ):
            if not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be between 0 and 1")
        if self.maximum_errors < 0 or self.maximum_prohibited_hits < 0:
            raise ValueError("benchmark budgets must not be negative")

    @property
    def sha256(self) -> str:
        return _sha256_json(
            {
                "maximum_errors": self.maximum_errors,
                "maximum_prohibited_hits": self.maximum_prohibited_hits,
                "minimum_case_count": self.minimum_case_count,
                "minimum_mrr": self.minimum_mrr,
                "minimum_ndcg_at_k": self.minimum_ndcg_at_k,
                "minimum_recall_at_k": self.minimum_recall_at_k,
                "require_admitted_components": self.require_admitted_components,
                "require_hybrid_mode": self.require_hybrid_mode,
                "require_measured_evidence": self.require_measured_evidence,
                "required_critical_recall": self.required_critical_recall,
            }
        )


class BenchmarkEngine(Protocol):
    @property
    def identity_sha256(self) -> str: ...

    @property
    def components_admitted(self) -> bool: ...

    @property
    def execution_class(self) -> RetrievalExecutionClass: ...

    def search(self, query: RetrievalQuery) -> HybridSearchResult: ...


@dataclass(frozen=True, slots=True)
class RetrievalBenchmarkCaseResult:
    case_id: str
    outcome: BenchmarkOutcome
    returned_chunk_ids: tuple[str, ...]
    recall_at_k: float
    reciprocal_rank: float
    ndcg_at_k: float
    prohibited_hits: tuple[str, ...]
    effective_mode: EffectiveRetrievalMode | None
    trace_sha256: str | None
    violations: tuple[str, ...]
    result_sha256: str


@dataclass(frozen=True, slots=True)
class RetrievalBenchmarkSummary:
    total_cases: int
    passed_cases: int
    failed_cases: int
    error_cases: int
    mean_recall_at_k: float
    mean_reciprocal_rank: float
    mean_ndcg_at_k: float
    critical_recall: float
    prohibited_hit_count: int
    lexical_fallback_count: int


@dataclass(frozen=True, slots=True)
class RetrievalBenchmarkReport:
    suite_id: str
    suite_version: str
    suite_sha256: str
    exact_head_sha: str
    engine_identity_sha256: str
    policy_sha256: str
    evidence_class: BenchmarkEvidenceClass
    results: tuple[RetrievalBenchmarkCaseResult, ...]
    summary: RetrievalBenchmarkSummary
    accepted: bool
    rejection_reasons: tuple[str, ...]
    report_sha256: str


class RetrievalBenchmarkAuthority:
    def __init__(self, policy: RetrievalBenchmarkPolicy | None = None) -> None:
        self._policy = policy or RetrievalBenchmarkPolicy()

    def evaluate(
        self,
        *,
        engine: BenchmarkEngine,
        suite: RetrievalBenchmarkSuite,
        exact_head_sha: str,
    ) -> RetrievalBenchmarkReport:
        validate_git_oid(exact_head_sha, "exact_head_sha")
        _digest(engine.identity_sha256, "engine identity")
        evidence_class = engine.execution_class
        results = tuple(
            self._evaluate_case(engine, case)
            for case in sorted(suite.cases, key=lambda item: item.case_id)
        )
        summary = _summary(results, suite)
        reasons = self._rejection_reasons(
            suite=suite,
            summary=summary,
            evidence_class=evidence_class,
            components_admitted=engine.components_admitted,
        )
        accepted = not reasons
        payload = {
            "accepted": accepted,
            "engine_identity_sha256": engine.identity_sha256,
            "evidence_class": evidence_class.value,
            "exact_head_sha": exact_head_sha,
            "policy_sha256": self._policy.sha256,
            "rejection_reasons": list(reasons),
            "results": [result.result_sha256 for result in results],
            "suite_sha256": suite.sha256,
            "summary": _summary_payload(summary),
        }
        return RetrievalBenchmarkReport(
            suite_id=suite.suite_id,
            suite_version=suite.version,
            suite_sha256=suite.sha256,
            exact_head_sha=exact_head_sha,
            engine_identity_sha256=engine.identity_sha256,
            policy_sha256=self._policy.sha256,
            evidence_class=evidence_class,
            results=results,
            summary=summary,
            accepted=accepted,
            rejection_reasons=reasons,
            report_sha256=_sha256_json(payload),
        )

    def _evaluate_case(
        self,
        engine: BenchmarkEngine,
        case: RetrievalBenchmarkCase,
    ) -> RetrievalBenchmarkCaseResult:
        try:
            response = engine.search(
                RetrievalQuery(
                    text=case.query,
                    tenant_id=case.tenant_id,
                    now=case.now,
                    minimum_trust_score=case.minimum_trust_score,
                    limit=case.limit,
                )
            )
        except Exception:
            return _case_result(
                case=case,
                outcome=BenchmarkOutcome.ERROR,
                returned=(),
                recall=0.0,
                reciprocal_rank=0.0,
                ndcg=0.0,
                prohibited=(),
                effective_mode=None,
                trace_sha256=None,
                violations=("ENGINE_ERROR",),
            )

        returned = tuple(hit.chunk_id for hit in response.hits)
        expected = set(case.expected_chunk_ids)
        recall = len(expected.intersection(returned)) / len(expected)
        reciprocal_rank = _reciprocal_rank(returned, expected)
        ndcg = _ndcg(returned, expected, case.limit)
        prohibited = tuple(sorted(set(returned).intersection(case.prohibited_chunk_ids)))
        violations: list[str] = []
        if prohibited:
            violations.append("PROHIBITED_CHUNK_RETRIEVED")
        if case.critical and recall < 1.0:
            violations.append("CRITICAL_EXPECTED_CHUNK_MISSING")
        outcome = BenchmarkOutcome.PASS if not violations else BenchmarkOutcome.FAIL
        return _case_result(
            case=case,
            outcome=outcome,
            returned=returned,
            recall=recall,
            reciprocal_rank=reciprocal_rank,
            ndcg=ndcg,
            prohibited=prohibited,
            effective_mode=response.trace.effective_mode,
            trace_sha256=response.trace.sha256,
            violations=tuple(violations),
        )

    def _rejection_reasons(
        self,
        *,
        suite: RetrievalBenchmarkSuite,
        summary: RetrievalBenchmarkSummary,
        evidence_class: RetrievalExecutionClass,
        components_admitted: bool,
    ) -> tuple[str, ...]:
        reasons: list[str] = []
        if len(suite.cases) < self._policy.minimum_case_count:
            reasons.append("INSUFFICIENT_CASE_COUNT")
        if summary.mean_recall_at_k < self._policy.minimum_recall_at_k:
            reasons.append("RECALL_AT_K_BELOW_THRESHOLD")
        if summary.mean_reciprocal_rank < self._policy.minimum_mrr:
            reasons.append("MRR_BELOW_THRESHOLD")
        if summary.mean_ndcg_at_k < self._policy.minimum_ndcg_at_k:
            reasons.append("NDCG_AT_K_BELOW_THRESHOLD")
        if summary.critical_recall < self._policy.required_critical_recall:
            reasons.append("CRITICAL_RECALL_BELOW_THRESHOLD")
        if summary.error_cases > self._policy.maximum_errors:
            reasons.append("ERROR_BUDGET_EXCEEDED")
        if summary.prohibited_hit_count > self._policy.maximum_prohibited_hits:
            reasons.append("PROHIBITED_HIT_BUDGET_EXCEEDED")
        if self._policy.require_hybrid_mode and summary.lexical_fallback_count > 0:
            reasons.append("HYBRID_MODE_NOT_SATISFIED")
        if self._policy.require_admitted_components and not components_admitted:
            reasons.append("RETRIEVAL_COMPONENTS_NOT_ADMITTED")
        if (
            self._policy.require_measured_evidence
            and evidence_class is not RetrievalExecutionClass.MEASURED
        ):
            reasons.append("STRUCTURAL_FIXTURES_NOT_OPERATIONAL_EVIDENCE")
        return tuple(reasons)


def _case_result(
    *,
    case: RetrievalBenchmarkCase,
    outcome: BenchmarkOutcome,
    returned: tuple[str, ...],
    recall: float,
    reciprocal_rank: float,
    ndcg: float,
    prohibited: tuple[str, ...],
    effective_mode: EffectiveRetrievalMode | None,
    trace_sha256: str | None,
    violations: tuple[str, ...],
) -> RetrievalBenchmarkCaseResult:
    result_sha256 = _sha256_json(
        {
            "case_sha256": case.sha256,
            "effective_mode": None if effective_mode is None else effective_mode.value,
            "ndcg_at_k": ndcg,
            "outcome": outcome.value,
            "prohibited_hits": list(prohibited),
            "recall_at_k": recall,
            "reciprocal_rank": reciprocal_rank,
            "returned_chunk_ids": list(returned),
            "trace_sha256": trace_sha256,
            "violations": list(violations),
        }
    )
    return RetrievalBenchmarkCaseResult(
        case_id=case.case_id,
        outcome=outcome,
        returned_chunk_ids=returned,
        recall_at_k=recall,
        reciprocal_rank=reciprocal_rank,
        ndcg_at_k=ndcg,
        prohibited_hits=prohibited,
        effective_mode=effective_mode,
        trace_sha256=trace_sha256,
        violations=violations,
        result_sha256=result_sha256,
    )


def _summary(
    results: tuple[RetrievalBenchmarkCaseResult, ...],
    suite: RetrievalBenchmarkSuite,
) -> RetrievalBenchmarkSummary:
    total = len(results)
    critical_ids = {case.case_id for case in suite.cases if case.critical}
    critical_results = [result for result in results if result.case_id in critical_ids]
    critical_expected = len(critical_results)
    critical_recall = (
        1.0
        if critical_expected == 0
        else sum(result.recall_at_k for result in critical_results) / critical_expected
    )
    return RetrievalBenchmarkSummary(
        total_cases=total,
        passed_cases=sum(result.outcome is BenchmarkOutcome.PASS for result in results),
        failed_cases=sum(result.outcome is BenchmarkOutcome.FAIL for result in results),
        error_cases=sum(result.outcome is BenchmarkOutcome.ERROR for result in results),
        mean_recall_at_k=sum(result.recall_at_k for result in results) / total,
        mean_reciprocal_rank=sum(result.reciprocal_rank for result in results) / total,
        mean_ndcg_at_k=sum(result.ndcg_at_k for result in results) / total,
        critical_recall=critical_recall,
        prohibited_hit_count=sum(len(result.prohibited_hits) for result in results),
        lexical_fallback_count=sum(
            result.effective_mode is not EffectiveRetrievalMode.HYBRID for result in results
        ),
    )


def _reciprocal_rank(returned: tuple[str, ...], expected: set[str]) -> float:
    for rank, chunk_id in enumerate(returned, start=1):
        if chunk_id in expected:
            return 1.0 / rank
    return 0.0


def _ndcg(returned: tuple[str, ...], expected: set[str], limit: int) -> float:
    relevance = [1.0 if chunk_id in expected else 0.0 for chunk_id in returned[:limit]]
    dcg = sum(value / math.log2(rank + 1) for rank, value in enumerate(relevance, start=1))
    ideal_count = min(len(expected), limit)
    ideal = sum(1.0 / math.log2(rank + 1) for rank in range(1, ideal_count + 1))
    return 0.0 if ideal == 0.0 else dcg / ideal


def _summary_payload(summary: RetrievalBenchmarkSummary) -> dict[str, int | float]:
    return {
        "critical_recall": summary.critical_recall,
        "error_cases": summary.error_cases,
        "failed_cases": summary.failed_cases,
        "lexical_fallback_count": summary.lexical_fallback_count,
        "mean_ndcg_at_k": summary.mean_ndcg_at_k,
        "mean_recall_at_k": summary.mean_recall_at_k,
        "mean_reciprocal_rank": summary.mean_reciprocal_rank,
        "passed_cases": summary.passed_cases,
        "prohibited_hit_count": summary.prohibited_hit_count,
        "total_cases": summary.total_cases,
    }


def _unique_portable(values: tuple[str, ...], name: str) -> None:
    if len(values) != len(set(values)):
        raise ValueError(f"{name} must be unique")
    for value in values:
        _portable(value, name)


def _portable(value: str, name: str) -> None:
    if _IDENTIFIER.fullmatch(value.strip()) is None:
        raise ValueError(f"{name} must use a bounded portable identifier")


def _digest(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")


def _sha256_json(value: Any) -> str:
    canonical = json.dumps(
        value,
        allow_nan=False,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
