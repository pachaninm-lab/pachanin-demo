from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any

from tai.evaluation import EvaluationReport
from tai.operations import OperationalReadinessDecision

_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_REPOSITORY = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
_WORKFLOW = re.compile(r"^[A-Za-z0-9 ._·:/()-]{1,180}$")
_MIGRATION_PATH = re.compile(r"^[A-Za-z0-9_./-]+\.sql$")


class WorkflowConclusion(StrEnum):
    SUCCESS = "success"
    FAILURE = "failure"
    CANCELLED = "cancelled"
    TIMED_OUT = "timed_out"
    ACTION_REQUIRED = "action_required"
    SKIPPED = "skipped"
    NEUTRAL = "neutral"


class ProductionOperationalStatus(StrEnum):
    NOT_ATTESTED = "NOT_ATTESTED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class MigrationArtifact:
    version: int
    path: str
    sha256: str

    def __post_init__(self) -> None:
        if self.version < 1:
            raise ValueError("migration version must be positive")
        if _MIGRATION_PATH.fullmatch(self.path) is None:
            raise ValueError("migration path must be a bounded SQL path")
        _digest(self.sha256, "migration sha256")


@dataclass(frozen=True, slots=True)
class MigrationInventory:
    migrations: tuple[MigrationArtifact, ...]

    def __post_init__(self) -> None:
        if not self.migrations:
            raise ValueError("migration inventory must not be empty")
        versions = [migration.version for migration in self.migrations]
        paths = [migration.path for migration in self.migrations]
        if versions != sorted(versions):
            raise ValueError("migrations must be ordered by version")
        if len(versions) != len(set(versions)):
            raise ValueError("migration versions must be unique")
        if len(paths) != len(set(paths)):
            raise ValueError("migration paths must be unique")
        expected = list(range(1, versions[-1] + 1))
        if versions != expected:
            raise ValueError("migration versions must be contiguous from 1")

    @property
    def sha256(self) -> str:
        return _sha256_json(
            [
                {
                    "path": migration.path,
                    "sha256": migration.sha256,
                    "version": migration.version,
                }
                for migration in self.migrations
            ]
        )


@dataclass(frozen=True, slots=True)
class WorkflowRunEvidence:
    workflow_name: str
    run_id: int
    exact_head_sha: str
    conclusion: WorkflowConclusion
    completed_at: datetime
    run_url: str
    evidence_sha256: str

    def __post_init__(self) -> None:
        if _WORKFLOW.fullmatch(self.workflow_name.strip()) is None:
            raise ValueError("workflow_name must be bounded and portable")
        if self.run_id < 1:
            raise ValueError("workflow run_id must be positive")
        _digest(self.exact_head_sha, "workflow exact_head_sha")
        _aware(self.completed_at, "workflow completed_at")
        if not self.run_url.startswith("https://github.com/"):
            raise ValueError("workflow run_url must be a GitHub HTTPS URL")
        _digest(self.evidence_sha256, "workflow evidence_sha256")
        expected = workflow_evidence_sha256(
            workflow_name=self.workflow_name,
            run_id=self.run_id,
            exact_head_sha=self.exact_head_sha,
            conclusion=self.conclusion,
            completed_at=self.completed_at,
            run_url=self.run_url,
        )
        if self.evidence_sha256 != expected:
            raise ValueError("workflow evidence digest does not match fields")


def workflow_evidence_sha256(
    *,
    workflow_name: str,
    run_id: int,
    exact_head_sha: str,
    conclusion: WorkflowConclusion,
    completed_at: datetime,
    run_url: str,
) -> str:
    return _sha256_json(
        {
            "completed_at": completed_at.isoformat(),
            "conclusion": conclusion.value,
            "exact_head_sha": exact_head_sha,
            "run_id": run_id,
            "run_url": run_url,
            "workflow_name": workflow_name,
        }
    )


DEFAULT_REQUIRED_WORKFLOWS = frozenset(
    {
        "Auction Atomic Execution Acceptance",
        "CI",
        "Dependency Review",
        "Disputes PostgreSQL Authority Acceptance",
        "Node CI",
        "Optional Runtime Retirement Gate",
        "Outbox PostgreSQL Authority Acceptance",
        "Runtime Context Security Gate",
        "Security Abuse and Evidence Acceptance",
        "Security Quality Gate",
        "Security Scan",
        "TAI Foundation",
    }
)


@dataclass(frozen=True, slots=True)
class ApplicationReleasePolicy:
    required_workflows: frozenset[str] = DEFAULT_REQUIRED_WORKFLOWS
    minimum_migration_version: int = 11

    def __post_init__(self) -> None:
        if not self.required_workflows:
            raise ValueError("required_workflows must not be empty")
        for workflow in self.required_workflows:
            if _WORKFLOW.fullmatch(workflow) is None:
                raise ValueError("required workflow name is invalid")
        if self.minimum_migration_version < 1:
            raise ValueError("minimum_migration_version must be positive")


@dataclass(frozen=True, slots=True)
class ApplicationReleaseCandidate:
    repository: str
    exact_main_sha: str
    source_tree_sha256: str
    migration_inventory: MigrationInventory
    workflow_runs: tuple[WorkflowRunEvidence, ...]
    created_at: datetime
    free_access_architecture: bool
    previous_attestation_sha256: str | None = None

    def __post_init__(self) -> None:
        if _REPOSITORY.fullmatch(self.repository) is None:
            raise ValueError("repository must use owner/name form")
        _digest(self.exact_main_sha, "exact_main_sha")
        _digest(self.source_tree_sha256, "source_tree_sha256")
        _aware(self.created_at, "created_at")
        if self.previous_attestation_sha256 is not None:
            _digest(self.previous_attestation_sha256, "previous_attestation_sha256")
        names = [run.workflow_name for run in self.workflow_runs]
        if len(names) != len(set(names)):
            raise ValueError("only one workflow evidence item is allowed per workflow")


@dataclass(frozen=True, slots=True)
class ApplicationReleaseAttestation:
    release_id: str
    repository: str
    exact_main_sha: str
    accepted: bool
    reasons: tuple[str, ...]
    source_tree_sha256: str
    migration_inventory_sha256: str
    workflow_evidence_sha256s: tuple[str, ...]
    previous_attestation_sha256: str | None
    created_at: datetime
    production_operational_status: ProductionOperationalStatus
    attestation_sha256: str

    def __post_init__(self) -> None:
        _digest(self.release_id, "release_id")
        if _REPOSITORY.fullmatch(self.repository) is None:
            raise ValueError("repository must use owner/name form")
        if self.accepted and self.reasons:
            raise ValueError("accepted application attestation must not contain reasons")
        if not self.accepted and not self.reasons:
            raise ValueError("rejected application attestation requires reasons")
        if (
            self.production_operational_status
            is not ProductionOperationalStatus.NOT_ATTESTED
        ):
            raise ValueError(
                "application attestation cannot claim production operational acceptance"
            )
        _digest(self.exact_main_sha, "exact_main_sha")
        _digest(self.source_tree_sha256, "source_tree_sha256")
        _digest(self.migration_inventory_sha256, "migration_inventory_sha256")
        for digest in self.workflow_evidence_sha256s:
            _digest(digest, "workflow evidence digest")
        if self.previous_attestation_sha256 is not None:
            _digest(self.previous_attestation_sha256, "previous_attestation_sha256")
        _aware(self.created_at, "created_at")
        _digest(self.attestation_sha256, "attestation_sha256")
        expected = application_attestation_sha256(
            release_id=self.release_id,
            repository=self.repository,
            exact_main_sha=self.exact_main_sha,
            accepted=self.accepted,
            reasons=self.reasons,
            source_tree_sha256=self.source_tree_sha256,
            migration_inventory_sha256=self.migration_inventory_sha256,
            workflow_evidence_sha256s=self.workflow_evidence_sha256s,
            previous_attestation_sha256=self.previous_attestation_sha256,
            created_at=self.created_at,
            production_operational_status=self.production_operational_status,
        )
        if self.attestation_sha256 != expected:
            raise ValueError("application attestation digest does not match fields")


class ApplicationReleaseAuthority:
    """Attest an exact-main software release from exact-head GitHub workflow evidence."""

    def __init__(self, policy: ApplicationReleasePolicy | None = None) -> None:
        self._policy = policy or ApplicationReleasePolicy()

    def attest(self, candidate: ApplicationReleaseCandidate) -> ApplicationReleaseAttestation:
        runs = {run.workflow_name: run for run in candidate.workflow_runs}
        reasons: list[str] = []
        missing = self._policy.required_workflows - set(runs)
        if missing:
            reasons.append("REQUIRED_WORKFLOW_MISSING")
        for workflow_name in sorted(self._policy.required_workflows & set(runs)):
            run = runs[workflow_name]
            if run.exact_head_sha != candidate.exact_main_sha:
                reasons.append("WORKFLOW_EXACT_HEAD_MISMATCH")
            if run.conclusion is not WorkflowConclusion.SUCCESS:
                reasons.append("WORKFLOW_NOT_SUCCESSFUL")
            if run.completed_at > candidate.created_at:
                reasons.append("WORKFLOW_FROM_FUTURE")
        if candidate.migration_inventory.migrations[-1].version < (
            self._policy.minimum_migration_version
        ):
            reasons.append("MIGRATION_INVENTORY_BELOW_REQUIRED_VERSION")
        if not candidate.free_access_architecture:
            reasons.append("FREE_ACCESS_ARCHITECTURE_NOT_PROVEN")
        unique_reasons = tuple(dict.fromkeys(reasons))
        workflow_digests = tuple(
            runs[name].evidence_sha256 for name in sorted(runs)
        )
        release_id = _sha256_json(
            {
                "exact_main_sha": candidate.exact_main_sha,
                "migration_inventory_sha256": candidate.migration_inventory.sha256,
                "repository": candidate.repository,
                "source_tree_sha256": candidate.source_tree_sha256,
                "workflow_evidence_sha256s": list(workflow_digests),
            }
        )
        accepted = not unique_reasons
        production_status = ProductionOperationalStatus.NOT_ATTESTED
        attestation_sha256 = application_attestation_sha256(
            release_id=release_id,
            repository=candidate.repository,
            exact_main_sha=candidate.exact_main_sha,
            accepted=accepted,
            reasons=unique_reasons,
            source_tree_sha256=candidate.source_tree_sha256,
            migration_inventory_sha256=candidate.migration_inventory.sha256,
            workflow_evidence_sha256s=workflow_digests,
            previous_attestation_sha256=candidate.previous_attestation_sha256,
            created_at=candidate.created_at,
            production_operational_status=production_status,
        )
        return ApplicationReleaseAttestation(
            release_id=release_id,
            repository=candidate.repository,
            exact_main_sha=candidate.exact_main_sha,
            accepted=accepted,
            reasons=unique_reasons,
            source_tree_sha256=candidate.source_tree_sha256,
            migration_inventory_sha256=candidate.migration_inventory.sha256,
            workflow_evidence_sha256s=workflow_digests,
            previous_attestation_sha256=candidate.previous_attestation_sha256,
            created_at=candidate.created_at,
            production_operational_status=production_status,
            attestation_sha256=attestation_sha256,
        )


def application_attestation_sha256(
    *,
    release_id: str,
    repository: str,
    exact_main_sha: str,
    accepted: bool,
    reasons: tuple[str, ...],
    source_tree_sha256: str,
    migration_inventory_sha256: str,
    workflow_evidence_sha256s: tuple[str, ...],
    previous_attestation_sha256: str | None,
    created_at: datetime,
    production_operational_status: ProductionOperationalStatus,
) -> str:
    return _sha256_json(
        {
            "accepted": accepted,
            "created_at": created_at.isoformat(),
            "exact_main_sha": exact_main_sha,
            "migration_inventory_sha256": migration_inventory_sha256,
            "previous_attestation_sha256": previous_attestation_sha256,
            "production_operational_status": production_operational_status.value,
            "reasons": list(reasons),
            "release_id": release_id,
            "repository": repository,
            "source_tree_sha256": source_tree_sha256,
            "workflow_evidence_sha256s": list(workflow_evidence_sha256s),
        }
    )


@dataclass(frozen=True, slots=True)
class ProductionReleaseAttestation:
    release_id: str
    exact_main_sha: str
    application_attestation_sha256: str
    evaluation_report_sha256: str
    operational_decision_sha256: str
    status: ProductionOperationalStatus
    reasons: tuple[str, ...]
    attested_at: datetime
    attestation_sha256: str

    def __post_init__(self) -> None:
        _digest(self.release_id, "release_id")
        _digest(self.exact_main_sha, "exact_main_sha")
        _digest(
            self.application_attestation_sha256,
            "application_attestation_sha256",
        )
        _digest(self.evaluation_report_sha256, "evaluation_report_sha256")
        _digest(
            self.operational_decision_sha256,
            "operational_decision_sha256",
        )
        _aware(self.attested_at, "attested_at")
        _digest(self.attestation_sha256, "attestation_sha256")
        if self.status is ProductionOperationalStatus.NOT_ATTESTED:
            raise ValueError("production attestation must be ACCEPTED or REJECTED")
        if self.status is ProductionOperationalStatus.ACCEPTED and self.reasons:
            raise ValueError("accepted production attestation must not contain reasons")
        if self.status is ProductionOperationalStatus.REJECTED and not self.reasons:
            raise ValueError("rejected production attestation requires reasons")
        expected = production_attestation_sha256(
            release_id=self.release_id,
            exact_main_sha=self.exact_main_sha,
            application_attestation_sha256=self.application_attestation_sha256,
            evaluation_report_sha256=self.evaluation_report_sha256,
            operational_decision_sha256=self.operational_decision_sha256,
            status=self.status,
            reasons=self.reasons,
            attested_at=self.attested_at,
        )
        if self.attestation_sha256 != expected:
            raise ValueError("production attestation digest does not match fields")


def production_attestation_sha256(
    *,
    release_id: str,
    exact_main_sha: str,
    application_attestation_sha256: str,
    evaluation_report_sha256: str,
    operational_decision_sha256: str,
    status: ProductionOperationalStatus,
    reasons: tuple[str, ...],
    attested_at: datetime,
) -> str:
    return _sha256_json(
        {
            "application_attestation_sha256": application_attestation_sha256,
            "attested_at": attested_at.isoformat(),
            "evaluation_report_sha256": evaluation_report_sha256,
            "exact_main_sha": exact_main_sha,
            "operational_decision_sha256": operational_decision_sha256,
            "reasons": list(reasons),
            "release_id": release_id,
            "status": status.value,
        }
    )


class ProductionReleaseAuthority:
    """Require actual accepted evaluation and operational evidence for production claims."""

    def attest(
        self,
        *,
        application: ApplicationReleaseAttestation,
        evaluation: EvaluationReport,
        operations: OperationalReadinessDecision,
        attested_at: datetime,
    ) -> ProductionReleaseAttestation:
        _aware(attested_at, "attested_at")
        reasons: list[str] = []
        if not application.accepted:
            reasons.append("APPLICATION_RELEASE_NOT_ACCEPTED")
        if not evaluation.accepted:
            reasons.append("EVALUATION_NOT_ACCEPTED")
        if not operations.accepted:
            reasons.append("OPERATIONAL_READINESS_NOT_ACCEPTED")
        if evaluation.exact_head_sha != application.exact_main_sha:
            reasons.append("EVALUATION_EXACT_HEAD_MISMATCH")
        if operations.exact_head_sha != application.exact_main_sha:
            reasons.append("OPERATIONS_EXACT_HEAD_MISMATCH")
        if application.created_at > attested_at:
            reasons.append("APPLICATION_ATTESTATION_FROM_FUTURE")
        if evaluation.completed_at > attested_at:
            reasons.append("EVALUATION_FROM_FUTURE")
        if operations.decided_at > attested_at:
            reasons.append("OPERATIONS_DECISION_FROM_FUTURE")
        unique_reasons = tuple(dict.fromkeys(reasons))
        status = (
            ProductionOperationalStatus.ACCEPTED
            if not unique_reasons
            else ProductionOperationalStatus.REJECTED
        )
        release_id = application.release_id
        payload = {
            "application_attestation_sha256": application.attestation_sha256,
            "attested_at": attested_at.isoformat(),
            "evaluation_report_sha256": evaluation.report_sha256,
            "exact_main_sha": application.exact_main_sha,
            "operational_decision_sha256": operations.decision_sha256,
            "reasons": list(unique_reasons),
            "release_id": release_id,
            "status": status.value,
        }
        return ProductionReleaseAttestation(
            release_id=release_id,
            exact_main_sha=application.exact_main_sha,
            application_attestation_sha256=application.attestation_sha256,
            evaluation_report_sha256=evaluation.report_sha256,
            operational_decision_sha256=operations.decision_sha256,
            status=status,
            reasons=unique_reasons,
            attested_at=attested_at,
            attestation_sha256=_sha256_json(payload),
        )


def source_tree_sha256(files: Mapping[str, bytes]) -> str:
    if not files:
        raise ValueError("source tree must not be empty")
    payload: list[Mapping[str, str]] = []
    for path, content in sorted(files.items()):
        if not path or path.startswith("/") or ".." in path.split("/"):
            raise ValueError("source tree path must be repository-relative")
        payload.append(
            {
                "path": path,
                "sha256": hashlib.sha256(content).hexdigest(),
            }
        )
    return _sha256_json(payload)


def _sha256_json(value: Any) -> str:
    canonical = json.dumps(
        value,
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()


def _digest(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")


def _aware(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
