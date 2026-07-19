from __future__ import annotations

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest

from tai.evaluation import EvaluationReport, EvaluationSummary
from tai.operations import OperationalReadinessDecision
from tai.release_acceptance import (
    DEFAULT_REQUIRED_WORKFLOWS,
    ApplicationReleaseAuthority,
    ApplicationReleaseCandidate,
    MigrationArtifact,
    MigrationInventory,
    ProductionOperationalStatus,
    ProductionReleaseAuthority,
    WorkflowConclusion,
    WorkflowRunEvidence,
    source_tree_sha256,
    workflow_evidence_sha256,
)

NOW = datetime(2026, 7, 18, 23, 0, tzinfo=UTC)
HEAD = "a" * 64


def _migration_inventory(last: int = 13) -> MigrationInventory:
    return MigrationInventory(
        tuple(
            MigrationArtifact(
                version=version,
                path=f"apps/tai/tai/migrations/{version:04d}_migration.sql",
                sha256=f"{version % 10}" * 64,
            )
            for version in range(1, last + 1)
        )
    )


def _workflow(
    name: str,
    *,
    conclusion: WorkflowConclusion = WorkflowConclusion.SUCCESS,
    exact_head_sha: str = HEAD,
    completed_at: datetime | None = None,
) -> WorkflowRunEvidence:
    run_id = 1000 + sorted(DEFAULT_REQUIRED_WORKFLOWS).index(name)
    completed = completed_at or NOW - timedelta(minutes=1)
    run_url = f"https://github.com/pachaninm-lab/pachanin-demo/actions/runs/{run_id}"
    digest = workflow_evidence_sha256(
        workflow_name=name,
        run_id=run_id,
        exact_head_sha=exact_head_sha,
        conclusion=conclusion,
        completed_at=completed,
        run_url=run_url,
    )
    return WorkflowRunEvidence(
        workflow_name=name,
        run_id=run_id,
        exact_head_sha=exact_head_sha,
        conclusion=conclusion,
        completed_at=completed,
        run_url=run_url,
        evidence_sha256=digest,
    )


def _workflows() -> tuple[WorkflowRunEvidence, ...]:
    return tuple(_workflow(name) for name in sorted(DEFAULT_REQUIRED_WORKFLOWS))


def _candidate(**changes: object) -> ApplicationReleaseCandidate:
    values: dict[str, object] = {
        "repository": "pachaninm-lab/pachanin-demo",
        "exact_main_sha": HEAD,
        "source_tree_sha256": "b" * 64,
        "migration_inventory": _migration_inventory(),
        "workflow_runs": _workflows(),
        "created_at": NOW,
        "free_access_architecture": True,
        "previous_attestation_sha256": None,
    }
    values.update(changes)
    return ApplicationReleaseCandidate(**values)  # type: ignore[arg-type]


def test_application_release_is_deterministic_and_does_not_claim_production() -> None:
    candidate = _candidate()
    authority = ApplicationReleaseAuthority()

    first = authority.attest(candidate)
    second = authority.attest(
        replace(candidate, workflow_runs=tuple(reversed(candidate.workflow_runs)))
    )

    assert first == second
    assert first.accepted is True
    assert first.reasons == ()
    assert first.production_operational_status is ProductionOperationalStatus.NOT_ATTESTED
    assert len(first.release_id) == 64
    assert len(first.attestation_sha256) == 64
    assert first.migration_inventory_sha256 == candidate.migration_inventory.sha256


def test_application_release_rejects_missing_failed_wrong_head_and_future_workflows() -> None:
    workflows = list(_workflows())
    workflows.pop()
    workflows[0] = _workflow(
        workflows[0].workflow_name,
        conclusion=WorkflowConclusion.FAILURE,
    )
    workflows[1] = _workflow(
        workflows[1].workflow_name,
        exact_head_sha="c" * 64,
    )
    workflows[2] = _workflow(
        workflows[2].workflow_name,
        completed_at=NOW + timedelta(seconds=1),
    )

    attestation = ApplicationReleaseAuthority().attest(
        _candidate(
            workflow_runs=tuple(workflows),
            free_access_architecture=False,
            migration_inventory=_migration_inventory(last=9),
        )
    )

    assert attestation.accepted is False
    assert set(attestation.reasons) == {
        "REQUIRED_WORKFLOW_MISSING",
        "WORKFLOW_NOT_SUCCESSFUL",
        "WORKFLOW_EXACT_HEAD_MISMATCH",
        "WORKFLOW_FROM_FUTURE",
        "MIGRATION_INVENTORY_BELOW_REQUIRED_VERSION",
        "FREE_ACCESS_ARCHITECTURE_NOT_PROVEN",
    }


def test_workflow_evidence_detects_tampering() -> None:
    evidence = _workflow("TAI Foundation")

    with pytest.raises(ValueError, match="digest does not match"):
        replace(evidence, run_id=evidence.run_id + 1)


def test_migration_inventory_requires_ordered_contiguous_unique_versions() -> None:
    valid = _migration_inventory(last=3)
    assert len(valid.sha256) == 64

    with pytest.raises(ValueError, match="ordered"):
        MigrationInventory(tuple(reversed(valid.migrations)))
    with pytest.raises(ValueError, match="contiguous"):
        MigrationInventory((valid.migrations[0], valid.migrations[2]))
    with pytest.raises(ValueError, match="unique"):
        MigrationInventory((valid.migrations[0], valid.migrations[0]))


def test_source_tree_digest_is_order_independent_and_path_safe() -> None:
    first = source_tree_sha256({"b.py": b"b", "a.py": b"a"})
    second = source_tree_sha256({"a.py": b"a", "b.py": b"b"})

    assert first == second
    with pytest.raises(ValueError, match="must not be empty"):
        source_tree_sha256({})
    with pytest.raises(ValueError, match="repository-relative"):
        source_tree_sha256({"../secret": b"x"})


def _evaluation(*, accepted: bool = True, head: str = HEAD) -> EvaluationReport:
    return EvaluationReport(
        run_id="c" * 64,
        suite_id="tai.release.red-team",
        suite_version="v1",
        suite_sha256="d" * 64,
        exact_head_sha=head,
        model_route="local.route.v1",
        knowledge_version="knowledge.v1",
        policy_version="policy.v1",
        baseline_run_id=None,
        started_at=NOW - timedelta(minutes=10),
        completed_at=NOW - timedelta(minutes=5),
        results=(),
        summary=EvaluationSummary(
            total_cases=28,
            passed_cases=28 if accepted else 27,
            failed_cases=0 if accepted else 1,
            error_cases=0,
            weighted_pass_rate=1.0 if accepted else 0.9,
            critical_pass_rate=1.0 if accepted else 0.9,
            regressions=(),
            category_pass_rates={},
        ),
        accepted=accepted,
        rejection_reasons=() if accepted else ("CRITICAL_PASS_RATE_BELOW_THRESHOLD",),
        report_sha256="e" * 64,
    )


def _operations(*, accepted: bool = True, head: str = HEAD) -> OperationalReadinessDecision:
    return OperationalReadinessDecision(
        release_id="tai.release.operations",
        exact_head_sha=head,
        accepted=accepted,
        reasons=() if accepted else ("SLO_BREACH_BUDGET_EXCEEDED",),
        evidence_ids=("evaluation", "security"),
        assessment_sha256s=("f" * 64,),
        decided_at=NOW - timedelta(minutes=1),
        decision_sha256="1" * 64,
    )


def test_production_attestation_requires_all_actual_evidence_on_same_head() -> None:
    application = ApplicationReleaseAuthority().attest(_candidate())

    production = ProductionReleaseAuthority().attest(
        application=application,
        evaluation=_evaluation(),
        operations=_operations(),
        attested_at=NOW + timedelta(minutes=1),
    )

    assert production.status is ProductionOperationalStatus.ACCEPTED
    assert production.reasons == ()
    assert production.release_id == application.release_id
    assert len(production.attestation_sha256) == 64


def test_production_attestation_rejects_unaccepted_and_cross_head_evidence() -> None:
    application = ApplicationReleaseAuthority().attest(_candidate())

    production = ProductionReleaseAuthority().attest(
        application=application,
        evaluation=_evaluation(accepted=False, head="2" * 64),
        operations=_operations(accepted=False, head="3" * 64),
        attested_at=NOW + timedelta(minutes=1),
    )

    assert production.status is ProductionOperationalStatus.REJECTED
    assert set(production.reasons) == {
        "EVALUATION_NOT_ACCEPTED",
        "OPERATIONAL_READINESS_NOT_ACCEPTED",
        "EVALUATION_EXACT_HEAD_MISMATCH",
        "OPERATIONS_EXACT_HEAD_MISMATCH",
    }
