from __future__ import annotations

from datetime import UTC, datetime

import pytest

from tai.evaluation import (
    EvaluationAuthority,
    EvaluationCase,
    EvaluationCategory,
    EvaluationObservation,
    EvaluationSeverity,
    EvaluationSuite,
)
from tai.git_oid import validate_git_oid
from tai.operations import OperationalIndicator, SLOObservation
from tai.release_acceptance import (
    WorkflowConclusion,
    WorkflowRunEvidence,
    workflow_evidence_sha256,
)

_SHA1 = "a" * 40
_SHA256 = "b" * 64
_CONTENT_SHA256 = "c" * 64
_NOW = datetime(2026, 7, 19, tzinfo=UTC)


@pytest.mark.parametrize("value", [_SHA1, _SHA256])
def test_git_oid_accepts_full_sha1_and_sha256(value: str) -> None:
    validate_git_oid(value, "exact_head_sha")


@pytest.mark.parametrize(
    "value",
    [
        "a" * 39,
        "a" * 41,
        "b" * 63,
        "b" * 65,
        "A" * 40,
        "g" * 40,
        "",
    ],
)
def test_git_oid_rejects_invalid_or_abbreviated_values(value: str) -> None:
    with pytest.raises(ValueError, match="full lowercase Git object ID"):
        validate_git_oid(value, "exact_head_sha")


def test_release_workflow_evidence_accepts_github_sha1_exact_head() -> None:
    digest = workflow_evidence_sha256(
        workflow_name="CI",
        run_id=1,
        exact_head_sha=_SHA1,
        conclusion=WorkflowConclusion.SUCCESS,
        completed_at=_NOW,
        run_url="https://github.com/pachaninm-lab/pachanin-demo/actions/runs/1",
    )
    evidence = WorkflowRunEvidence(
        workflow_name="CI",
        run_id=1,
        exact_head_sha=_SHA1,
        conclusion=WorkflowConclusion.SUCCESS,
        completed_at=_NOW,
        run_url="https://github.com/pachaninm-lab/pachanin-demo/actions/runs/1",
        evidence_sha256=digest,
    )
    assert evidence.exact_head_sha == _SHA1


def test_evaluation_authority_accepts_github_sha1_exact_head() -> None:
    case = EvaluationCase(
        case_id="case-1",
        category=EvaluationCategory.GROUNDED_QA,
        severity=EvaluationSeverity.LOW,
        allowed_statuses=frozenset({"ANSWERED"}),
    )
    suite = EvaluationSuite(
        suite_id="suite-1",
        version="1",
        cases=(case,),
        created_at=_NOW,
    )
    observation = EvaluationObservation(
        case_id="case-1",
        request_id="request-1",
        status="ANSWERED",
        answer="ok",
        citations=(),
        allowed_citations=(),
        tenant_id=None,
        source_tenant_ids=(),
        model_invoked=False,
        tools=(),
        reason=None,
        observed_at=_NOW,
        trace_sha256=_CONTENT_SHA256,
    )
    report = EvaluationAuthority().evaluate(
        suite=suite,
        observations=(observation,),
        exact_head_sha=_SHA1,
        model_route="local-model",
        knowledge_version="1",
        policy_version="1",
        started_at=_NOW,
        completed_at=_NOW,
    )
    assert report.exact_head_sha == _SHA1


def test_operations_accept_github_sha1_exact_head_but_keep_content_sha256() -> None:
    observation = SLOObservation(
        observation_id="observation-1",
        slo_id="availability",
        indicator=OperationalIndicator.AVAILABILITY,
        value=1.0,
        sample_count=1,
        window_started_at=_NOW,
        window_ended_at=_NOW,
        observed_at=_NOW,
        source_sha256=_CONTENT_SHA256,
        exact_head_sha=_SHA1,
    )
    assert observation.exact_head_sha == _SHA1
    with pytest.raises(ValueError, match="SHA-256 digest"):
        SLOObservation(
            observation_id="observation-2",
            slo_id="availability",
            indicator=OperationalIndicator.AVAILABILITY,
            value=1.0,
            sample_count=1,
            window_started_at=_NOW,
            window_ended_at=_NOW,
            observed_at=_NOW,
            source_sha256=_SHA1,
            exact_head_sha=_SHA1,
        )


def test_forward_migration_updates_all_persisted_git_oid_constraints() -> None:
    sql = (
        __import__("pathlib").Path(__file__).parents[1]
        / "tai/migrations/0012_git_object_id_contract.sql"
    ).read_text(encoding="utf-8")
    for table in (
        "tai_evaluation_runs",
        "tai_slo_observations",
        "tai_operational_evidence",
        "tai_operational_readiness_decisions",
        "tai_application_release_attestations",
        "tai_production_release_attestations",
    ):
        assert table in sql
    assert "[0-9a-f]{40}" in sql
    assert "[0-9a-f]{64}" in sql
