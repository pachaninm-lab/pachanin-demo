from __future__ import annotations

from datetime import UTC, datetime

from tai.hybrid_retrieval import (
    EffectiveRetrievalMode,
    FusionPolicy,
    HybridRetrievalMode,
    HybridSearchResult,
    HybridSearchTrace,
)
from tai.retrieval_benchmark import (
    BenchmarkEvidenceClass,
    RetrievalBenchmarkAuthority,
    RetrievalBenchmarkCase,
    RetrievalBenchmarkPolicy,
    RetrievalBenchmarkSuite,
)
from tai.retrieval_index import RetrievalHit, RetrievalQuery

NOW = datetime(2026, 7, 19, tzinfo=UTC)


def _hit(chunk_id: str) -> RetrievalHit:
    return RetrievalHit(
        chunk_id=chunk_id,
        source_id=f"source-{chunk_id}",
        generation=1,
        score=1.0,
        text=chunk_id,
        trust_score=1.0,
    )


class _Engine:
    def __init__(
        self,
        answers: dict[str, tuple[str, ...]],
        *,
        admitted: bool = True,
        mode: EffectiveRetrievalMode = EffectiveRetrievalMode.HYBRID,
        evidence_class: BenchmarkEvidenceClass = BenchmarkEvidenceClass.STRUCTURAL_ONLY,
    ) -> None:
        self._answers = answers
        self._admitted = admitted
        self._mode = mode
        self._identity = "c" * 64
        self._evidence_class = evidence_class

    @property
    def identity_sha256(self) -> str:
        return self._identity

    @property
    def components_admitted(self) -> bool:
        return self._admitted

    @property
    def execution_class(self) -> BenchmarkEvidenceClass:
        return self._evidence_class

    def search(self, query: RetrievalQuery) -> HybridSearchResult:
        ids = self._answers[query.text][: query.limit]
        hits = tuple(_hit(chunk_id) for chunk_id in ids)
        return HybridSearchResult(
            hits=hits,
            trace=HybridSearchTrace(
                requested_mode=HybridRetrievalMode.HYBRID_REQUIRED,
                effective_mode=self._mode,
                execution_class=self._evidence_class,
                lexical_identity_sha256="d" * 64,
                lexical_candidate_count=len(hits),
                semantic_candidate_count=len(hits),
                fused_candidate_count=len(hits),
                fusion_policy_sha256=FusionPolicy().sha256,
                semantic_identity_sha256="e" * 64,
                embedding_identity_sha256="a" * 64,
                semantic_trace_sha256="b" * 64,
                reranker_identity_sha256=None,
                fallback_reason=None,
                candidates=(),
                selected_chunk_ids=ids,
            ),
        )


def _case(
    case_id: str,
    query: str,
    expected: tuple[str, ...],
    *,
    prohibited: tuple[str, ...] = (),
    critical: bool = False,
) -> RetrievalBenchmarkCase:
    return RetrievalBenchmarkCase(
        case_id=case_id,
        query=query,
        expected_chunk_ids=expected,
        prohibited_chunk_ids=prohibited,
        tenant_id=None,
        now=NOW,
        limit=3,
        critical=critical,
    )


def _suite(*cases: RetrievalBenchmarkCase) -> RetrievalBenchmarkSuite:
    return RetrievalBenchmarkSuite(
        suite_id="tai.ap15a.test",
        version="2026.07.19.1",
        cases=tuple(cases),
        created_at=NOW,
    )


def _policy() -> RetrievalBenchmarkPolicy:
    return RetrievalBenchmarkPolicy(
        minimum_case_count=2,
        minimum_recall_at_k=1.0,
        minimum_mrr=1.0,
        minimum_ndcg_at_k=1.0,
        required_critical_recall=1.0,
    )


def test_structural_fixture_never_becomes_operational_acceptance() -> None:
    suite = _suite(
        _case("case-a", "q1", ("a",), critical=True),
        _case("case-b", "q2", ("b",)),
    )
    report = RetrievalBenchmarkAuthority(_policy()).evaluate(
        engine=_Engine({"q1": ("a",), "q2": ("b",)}),
        suite=suite,
        exact_head_sha="d" * 40,
    )

    assert report.accepted is False
    assert "STRUCTURAL_FIXTURES_NOT_OPERATIONAL_EVIDENCE" in report.rejection_reasons
    assert report.summary.mean_recall_at_k == 1.0
    assert len(report.report_sha256) == 64


def test_measured_admitted_hybrid_report_can_pass() -> None:
    suite = _suite(
        _case("case-a", "q1", ("a",), critical=True),
        _case("case-b", "q2", ("b",)),
    )
    report = RetrievalBenchmarkAuthority(_policy()).evaluate(
        engine=_Engine(
            {"q1": ("a",), "q2": ("b",)},
            evidence_class=BenchmarkEvidenceClass.MEASURED,
        ),
        suite=suite,
        exact_head_sha="e" * 40,
    )

    assert report.accepted is True
    assert report.rejection_reasons == ()


def test_prohibited_leak_and_lexical_fallback_block_acceptance() -> None:
    suite = _suite(
        _case("case-a", "q1", ("a",), prohibited=("secret",), critical=True),
        _case("case-b", "q2", ("b",)),
    )
    report = RetrievalBenchmarkAuthority(_policy()).evaluate(
        engine=_Engine(
            {"q1": ("secret", "a"), "q2": ("b",)},
            mode=EffectiveRetrievalMode.LEXICAL,
            evidence_class=BenchmarkEvidenceClass.MEASURED,
        ),
        suite=suite,
        exact_head_sha="f" * 40,
    )

    assert report.accepted is False
    assert "PROHIBITED_HIT_BUDGET_EXCEEDED" in report.rejection_reasons
    assert "HYBRID_MODE_NOT_SATISFIED" in report.rejection_reasons
    assert report.summary.prohibited_hit_count == 1


def test_report_is_deterministic_across_suite_case_order() -> None:
    first_suite = _suite(
        _case("case-b", "q2", ("b",)),
        _case("case-a", "q1", ("a",), critical=True),
    )
    second_suite = _suite(
        _case("case-a", "q1", ("a",), critical=True),
        _case("case-b", "q2", ("b",)),
    )
    engine = _Engine(
        {"q1": ("a",), "q2": ("b",)},
        evidence_class=BenchmarkEvidenceClass.MEASURED,
    )
    authority = RetrievalBenchmarkAuthority(_policy())

    first = authority.evaluate(
        engine=engine,
        suite=first_suite,
        exact_head_sha="2" * 40,
    )
    second = authority.evaluate(
        engine=engine,
        suite=second_suite,
        exact_head_sha="2" * 40,
    )

    assert first.suite_sha256 == second.suite_sha256
    assert first.report_sha256 == second.report_sha256
    assert [result.case_id for result in first.results] == ["case-a", "case-b"]


def test_unadmitted_components_block_measured_report() -> None:
    suite = _suite(
        _case("case-a", "q1", ("a",)),
        _case("case-b", "q2", ("b",)),
    )
    report = RetrievalBenchmarkAuthority(_policy()).evaluate(
        engine=_Engine(
            {"q1": ("a",), "q2": ("b",)},
            admitted=False,
            evidence_class=BenchmarkEvidenceClass.MEASURED,
        ),
        suite=suite,
        exact_head_sha="1" * 40,
    )

    assert report.accepted is False
    assert "RETRIEVAL_COMPONENTS_NOT_ADMITTED" in report.rejection_reasons
