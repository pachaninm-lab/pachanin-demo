"""Fail-closed authority for the TAI industrial acceptance backlog.

This module is the single machine-readable source for:

* the canonical industrial acceptance backlog (one row per required acceptance item);
* the current industrial gap report;
* the production operational manifest.

Every derived status is computed from evidence-bearing backlog rows. No caller can
declare ``PASS`` by hand: :func:`derive_final_status` is the only producer of that
value and it refuses to emit ``PASS`` while any mandatory item lacks accepted
evidence. Percentages are always accompanied by the counts and the formula used to
produce them, so a reported number can be recomputed from the backlog alone.
"""

from __future__ import annotations

import json
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any, Final

from tai.git_oid import validate_git_oid

__all__ = [
    "AcceptanceBacklog",
    "AcceptanceItem",
    "AcceptanceStatus",
    "BacklogTotals",
    "DiscoveryContext",
    "FinalStatus",
    "IndustrialGapReport",
    "ModelDescriptor",
    "ProductionOperationalManifest",
    "SubsystemStatus",
    "backlog_canonical_json",
    "canonical_json",
    "derive_final_status",
    "gap_report_payload",
    "load_backlog",
    "manifest_payload",
]

BACKLOG_SCHEMA: Final = "tai.industrial-acceptance-backlog.v1"
GAP_REPORT_SCHEMA: Final = "tai.current-industrial-gap-report.v1"
MANIFEST_SCHEMA: Final = "tai.production-operational-manifest.v1"

PRODUCTION_PROVIDER: Final = "REG.RU"
PRODUCTION_REGION: Final = "RU"
PRODUCTION_DOMAIN: Final = "процент-агро.рф"

# Production hosting explicitly forbidden by the TAI infrastructure contract.
FORBIDDEN_PRODUCTION_PROVIDERS: Final = frozenset({"VERCEL", "NETLIFY"})

_ITEM_ID = re.compile(r"^[A-Z][A-Z0-9]*(?:[-.][A-Z0-9]+)+$")
_STAGE = re.compile(r"^[A-L]$")
_TEXT = re.compile(r"^[^\x00-\x1f]{1,240}$")
_EVIDENCE_REF = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./:#=-]{2,199}$")
_BRANCH = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_./-]{0,199}$")
_RELEASE_ID = re.compile(r"^[a-z0-9][a-z0-9-]{2,63}$")
_MODEL_ID = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


class AcceptanceStatus(StrEnum):
    """Lifecycle of a single acceptance item."""

    NOT_STARTED = "NOT_STARTED"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    REGRESSED = "REGRESSED"
    ACCEPTED = "ACCEPTED"


class SubsystemStatus(StrEnum):
    """Coarse status reported per subsystem in the gap report."""

    NOT_STARTED = "NOT_STARTED"
    PENDING_ACQUISITION = "PENDING_ACQUISITION"
    PENDING_BENCHMARK = "PENDING_BENCHMARK"
    PENDING_ADMISSION = "PENDING_ADMISSION"
    NOT_ACTIVATED = "NOT_ACTIVATED"
    PARTIAL = "PARTIAL"
    FAILING = "FAILING"
    ACCEPTED = "ACCEPTED"


class FinalStatus(StrEnum):
    """Overall production operational attestation result."""

    PASS = "PASS"  # noqa: S105 - attestation verdict, not a credential
    FAIL = "FAIL"
    NOT_ATTESTED = "NOT_ATTESTED"


def _text(value: str, name: str) -> None:
    if _TEXT.fullmatch(value) is None:
        raise ValueError(f"{name} must be bounded printable text of 1..240 characters")


def _utc(value: datetime, name: str) -> None:
    if value.tzinfo is None or value.utcoffset() != UTC.utcoffset(None):
        raise ValueError(f"{name} must be an aware UTC timestamp")


@dataclass(frozen=True, slots=True)
class AcceptanceItem:
    """One required industrial acceptance item.

    ``ACCEPTED`` is only representable together with at least one evidence
    reference, and a blocked or regressed item is only representable together with
    a stated reason. Those two invariants are what make the derived statuses
    trustworthy.
    """

    item_id: str
    stage: str
    title: str
    mandatory: bool
    status: AcceptanceStatus
    evidence_refs: tuple[str, ...] = ()
    blocking_reason: str | None = None

    def __post_init__(self) -> None:
        if _ITEM_ID.fullmatch(self.item_id) is None:
            raise ValueError("item_id must be an uppercase dotted or dashed identifier")
        if _STAGE.fullmatch(self.stage) is None:
            raise ValueError("stage must be a single letter in A..L")
        _text(self.title, "title")
        for reference in self.evidence_refs:
            if _EVIDENCE_REF.fullmatch(reference) is None:
                raise ValueError("evidence reference must be a bounded path, URL or digest token")
        if len(set(self.evidence_refs)) != len(self.evidence_refs):
            raise ValueError("evidence references must be unique")
        if self.blocking_reason is not None:
            _text(self.blocking_reason, "blocking_reason")

        if self.status is AcceptanceStatus.ACCEPTED:
            if not self.evidence_refs:
                raise ValueError(f"{self.item_id}: ACCEPTED requires at least one evidence ref")
            if self.blocking_reason is not None:
                raise ValueError(f"{self.item_id}: ACCEPTED must not carry a blocking reason")
        if self.status in _NEEDS_REASON and self.blocking_reason is None:
            raise ValueError(f"{self.item_id}: {self.status} requires a blocking reason")
        if self.status is AcceptanceStatus.NOT_STARTED and self.evidence_refs:
            raise ValueError(f"{self.item_id}: NOT_STARTED must not carry evidence")

    @property
    def is_blocking(self) -> bool:
        """Whether this item currently prevents production attestation."""
        return self.mandatory and self.status is not AcceptanceStatus.ACCEPTED

    def to_json_object(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "evidence_refs": list(self.evidence_refs),
            "item_id": self.item_id,
            "mandatory": self.mandatory,
            "stage": self.stage,
            "status": self.status.value,
            "title": self.title,
        }
        if self.blocking_reason is not None:
            payload["blocking_reason"] = self.blocking_reason
        return payload


_NEEDS_REASON: Final = frozenset({AcceptanceStatus.BLOCKED, AcceptanceStatus.REGRESSED})


@dataclass(frozen=True, slots=True)
class BacklogTotals:
    """Counts backing every reported percentage."""

    total: int
    accepted: int
    blocked: int
    regressed: int
    remaining: int
    mandatory_total: int
    mandatory_accepted: int

    @property
    def completion_percent(self) -> float:
        """Mandatory completion, rounded to two decimals."""
        if self.mandatory_total == 0:
            return 0.0
        return round(100 * self.mandatory_accepted / self.mandatory_total, 2)

    def to_json_object(self) -> dict[str, Any]:
        return {
            "accepted": self.accepted,
            "blocked": self.blocked,
            "completion_formula": "100 * mandatory_accepted / mandatory_total",
            "completion_percent": self.completion_percent,
            "mandatory_accepted": self.mandatory_accepted,
            "mandatory_total": self.mandatory_total,
            "regressed": self.regressed,
            "remaining": self.remaining,
            "total": self.total,
        }


@dataclass(frozen=True, slots=True)
class DiscoveryContext:
    """Verified repository facts the gap report is generated from."""

    exact_main_sha: str
    generated_at: datetime
    open_prs: tuple[int, ...]
    open_issues: tuple[int, ...]
    stale_branches: tuple[str, ...]
    failing_main_workflows: tuple[str, ...]

    def __post_init__(self) -> None:
        validate_git_oid(self.exact_main_sha, "exact_main_sha")
        _utc(self.generated_at, "generated_at")
        for numbers, name in ((self.open_prs, "open_prs"), (self.open_issues, "open_issues")):
            if any(number < 1 for number in numbers):
                raise ValueError(f"{name} must contain positive numbers")
            if len(set(numbers)) != len(numbers):
                raise ValueError(f"{name} must be unique")
            if list(numbers) != sorted(numbers):
                raise ValueError(f"{name} must be sorted ascending")
        for branch in self.stale_branches:
            if _BRANCH.fullmatch(branch) is None:
                raise ValueError("stale branch must be a bounded ref name")
        if len(set(self.stale_branches)) != len(self.stale_branches):
            raise ValueError("stale_branches must be unique")
        for workflow in self.failing_main_workflows:
            _text(workflow, "failing main workflow")


@dataclass(frozen=True, slots=True)
class ModelDescriptor:
    """A pinned model candidate and its admission state."""

    model_id: str
    revision: str
    quantization: str
    status: SubsystemStatus

    def __post_init__(self) -> None:
        if _MODEL_ID.fullmatch(self.model_id) is None:
            raise ValueError("model_id must be an owner/name identifier")
        validate_git_oid(self.revision, "model revision")
        _text(self.quantization, "quantization")

    def to_json_object(self) -> dict[str, Any]:
        return {
            "model_id": self.model_id,
            "quantization": self.quantization,
            "revision": self.revision,
            "status": self.status.value,
        }


@dataclass(frozen=True, slots=True)
class AcceptanceBacklog:
    """The canonical set of acceptance items plus the discovery facts."""

    discovery: DiscoveryContext
    items: tuple[AcceptanceItem, ...]
    subsystems: Mapping[str, SubsystemStatus]
    primary_model: ModelDescriptor
    fallback_model: ModelDescriptor

    def __post_init__(self) -> None:
        if not self.items:
            raise ValueError("backlog must not be empty")
        identifiers = [item.item_id for item in self.items]
        if len(set(identifiers)) != len(identifiers):
            raise ValueError("acceptance item ids must be unique")
        if identifiers != sorted(identifiers):
            raise ValueError("acceptance items must be sorted by item_id")
        if not any(item.mandatory for item in self.items):
            raise ValueError("backlog must contain at least one mandatory item")
        for name in _REQUIRED_SUBSYSTEMS:
            if name not in self.subsystems:
                raise ValueError(f"subsystem status is missing: {name}")
        for name in self.subsystems:
            if name not in _REQUIRED_SUBSYSTEMS:
                raise ValueError(f"unknown subsystem status: {name}")

    def totals(self) -> BacklogTotals:
        mandatory = [item for item in self.items if item.mandatory]
        return BacklogTotals(
            total=len(self.items),
            accepted=sum(item.status is AcceptanceStatus.ACCEPTED for item in self.items),
            blocked=sum(item.status is AcceptanceStatus.BLOCKED for item in self.items),
            regressed=sum(item.status is AcceptanceStatus.REGRESSED for item in self.items),
            remaining=sum(item.status is not AcceptanceStatus.ACCEPTED for item in self.items),
            mandatory_total=len(mandatory),
            mandatory_accepted=sum(
                item.status is AcceptanceStatus.ACCEPTED for item in mandatory
            ),
        )

    def blocking_items(self) -> tuple[AcceptanceItem, ...]:
        """Mandatory items that are not yet accepted, in backlog order."""
        return tuple(item for item in self.items if item.is_blocking)

    def stage_items(self, stage: str) -> tuple[AcceptanceItem, ...]:
        return tuple(item for item in self.items if item.stage == stage)


_REQUIRED_SUBSYSTEMS: Final = (
    "benchmark",
    "document_intelligence",
    "gateway",
    "knowledge",
    "model_admission",
    "model_artifact",
    "observability",
    "production_deployment",
    "retrieval",
    "safe_tools",
    "ui",
)


def derive_final_status(backlog: AcceptanceBacklog) -> FinalStatus:
    """Derive the only admissible attestation result for ``backlog``.

    ``PASS`` requires every mandatory item to be ``ACCEPTED`` and no item anywhere
    to be ``REGRESSED``. A regression on a mandatory item is a hard ``FAIL``;
    anything else that is merely incomplete is ``NOT_ATTESTED``.
    """
    if any(
        item.status is AcceptanceStatus.REGRESSED and item.mandatory for item in backlog.items
    ):
        return FinalStatus.FAIL
    totals = backlog.totals()
    if totals.mandatory_accepted == totals.mandatory_total and totals.regressed == 0:
        return FinalStatus.PASS
    return FinalStatus.NOT_ATTESTED


def _recommended_execution_order(backlog: AcceptanceBacklog) -> list[str]:
    """Blocking items ordered by stage, then by backlog order within a stage."""
    blocking = backlog.blocking_items()
    return [item.item_id for item in sorted(blocking, key=lambda item: (item.stage, item.item_id))]


@dataclass(frozen=True, slots=True)
class IndustrialGapReport:
    """Rendered view of the current gap between main and industrial readiness."""

    backlog: AcceptanceBacklog

    def to_json_object(self) -> dict[str, Any]:
        discovery = self.backlog.discovery
        totals = self.backlog.totals()
        blocking = self.backlog.blocking_items()
        subsystems = self.backlog.subsystems
        return {
            "benchmark_status": subsystems["benchmark"].value,
            "blocking_items": [
                {
                    "item_id": item.item_id,
                    "reason": item.blocking_reason or "not yet accepted",
                    "stage": item.stage,
                    "status": item.status.value,
                    "title": item.title,
                }
                for item in blocking
            ],
            "document_intelligence_status": subsystems["document_intelligence"].value,
            "exact_main_sha": discovery.exact_main_sha,
            "failing_main_workflows": list(discovery.failing_main_workflows),
            "gateway_status": subsystems["gateway"].value,
            "generated_at": discovery.generated_at.isoformat().replace("+00:00", "Z"),
            "knowledge_status": subsystems["knowledge"].value,
            "model_admission_status": subsystems["model_admission"].value,
            "model_artifact_status": subsystems["model_artifact"].value,
            "observability_status": subsystems["observability"].value,
            "open_issues": list(discovery.open_issues),
            "open_prs": list(discovery.open_prs),
            "operational_acceptance_status": derive_final_status(self.backlog).value,
            "production_deployment_status": subsystems["production_deployment"].value,
            "recommended_execution_order": _recommended_execution_order(self.backlog),
            "retrieval_status": subsystems["retrieval"].value,
            "safe_tools_status": subsystems["safe_tools"].value,
            "schema": GAP_REPORT_SCHEMA,
            "stale_branches": list(discovery.stale_branches),
            "totals": totals.to_json_object(),
            "ui_status": subsystems["ui"].value,
        }


def _stage_acceptance(backlog: AcceptanceBacklog, stage: str) -> dict[str, Any]:
    items = backlog.stage_items(stage)
    accepted = sum(item.status is AcceptanceStatus.ACCEPTED for item in items)
    if not items:
        status = FinalStatus.NOT_ATTESTED
    elif accepted == len(items):
        status = FinalStatus.PASS
    elif any(item.status is AcceptanceStatus.REGRESSED for item in items):
        status = FinalStatus.FAIL
    else:
        status = FinalStatus.NOT_ATTESTED
    return {
        "accepted": accepted,
        "blocking_items": [item.item_id for item in items if item.is_blocking],
        "stage": stage,
        "status": status.value,
        "total": len(items),
    }


@dataclass(frozen=True, slots=True)
class ProductionOperationalManifest:
    """Canonical exact-main operational manifest."""

    backlog: AcceptanceBacklog
    release_id: str
    provider: str = PRODUCTION_PROVIDER
    region: str = PRODUCTION_REGION
    production_domain: str = PRODUCTION_DOMAIN

    def __post_init__(self) -> None:
        if _RELEASE_ID.fullmatch(self.release_id) is None:
            raise ValueError("release_id must be a lowercase dashed identifier")
        if self.provider.upper() in FORBIDDEN_PRODUCTION_PROVIDERS:
            raise ValueError(f"{self.provider} is not admissible as production hosting")
        if self.provider != PRODUCTION_PROVIDER:
            raise ValueError(f"production provider must be {PRODUCTION_PROVIDER}")
        if self.region != PRODUCTION_REGION:
            raise ValueError(f"production region must be {PRODUCTION_REGION}")
        if self.production_domain != PRODUCTION_DOMAIN:
            raise ValueError(f"production domain must be {PRODUCTION_DOMAIN}")

    def to_json_object(self) -> dict[str, Any]:
        discovery = self.backlog.discovery
        return {
            "document_intelligence_acceptance": _stage_acceptance(self.backlog, "G"),
            "exact_main_sha": discovery.exact_main_sha,
            "fault_acceptance": _stage_acceptance(self.backlog, "L"),
            "final_status": derive_final_status(self.backlog).value,
            "gateway_acceptance": _stage_acceptance(self.backlog, "H"),
            "generated_at": discovery.generated_at.isoformat().replace("+00:00", "Z"),
            "infrastructure": {
                "production_domain": self.production_domain,
                "provider": self.provider,
                "region": self.region,
            },
            "knowledge_acceptance": _stage_acceptance(self.backlog, "D"),
            "model_admission": _stage_acceptance(self.backlog, "C"),
            "models": {
                "fallback": self.backlog.fallback_model.to_json_object(),
                "primary": self.backlog.primary_model.to_json_object(),
            },
            "observability_acceptance": _stage_acceptance(self.backlog, "J"),
            "open_blockers": [item.item_id for item in self.backlog.blocking_items()],
            "quality_acceptance": _stage_acceptance(self.backlog, "E"),
            "release_id": self.release_id,
            "retrieval_acceptance": _stage_acceptance(self.backlog, "F"),
            "runtime_acceptance": _stage_acceptance(self.backlog, "B"),
            "safe_tools_acceptance": _stage_acceptance(self.backlog, "I"),
            "schema": MANIFEST_SCHEMA,
            "deployment_acceptance": _stage_acceptance(self.backlog, "K"),
            "governance_acceptance": _stage_acceptance(self.backlog, "A"),
            "totals": self.backlog.totals().to_json_object(),
        }


def canonical_json(payload: Mapping[str, Any]) -> str:
    """Deterministic JSON rendering used for digests and drift comparison."""
    return json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


def backlog_canonical_json(backlog: AcceptanceBacklog) -> str:
    discovery = backlog.discovery
    return canonical_json(
        {
            "discovery": {
                "exact_main_sha": discovery.exact_main_sha,
                "failing_main_workflows": list(discovery.failing_main_workflows),
                "generated_at": discovery.generated_at.isoformat().replace("+00:00", "Z"),
                "open_issues": list(discovery.open_issues),
                "open_prs": list(discovery.open_prs),
                "stale_branches": list(discovery.stale_branches),
            },
            "items": [item.to_json_object() for item in backlog.items],
            "models": {
                "fallback": backlog.fallback_model.to_json_object(),
                "primary": backlog.primary_model.to_json_object(),
            },
            "schema": BACKLOG_SCHEMA,
            "subsystems": {name: status.value for name, status in backlog.subsystems.items()},
        }
    )


def gap_report_payload(backlog: AcceptanceBacklog) -> dict[str, Any]:
    return IndustrialGapReport(backlog=backlog).to_json_object()


def manifest_payload(backlog: AcceptanceBacklog, release_id: str) -> dict[str, Any]:
    return ProductionOperationalManifest(backlog=backlog, release_id=release_id).to_json_object()


def _require_mapping(value: Any, name: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{name} must be a JSON object")
    return value


def _require_sequence(value: Any, name: str) -> Sequence[Any]:
    if not isinstance(value, list):
        raise ValueError(f"{name} must be a JSON array")
    return value


def _require_str(value: Any, name: str) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{name} must be a string")
    return value


def _require_int(value: Any, name: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool):
        raise ValueError(f"{name} must be an integer")
    return value


def _parse_timestamp(value: str, name: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise ValueError(f"{name} must be an RFC 3339 timestamp") from error
    _utc(parsed, name)
    return parsed


def _parse_item(raw: Any) -> AcceptanceItem:
    payload = _require_mapping(raw, "acceptance item")
    reason = payload.get("blocking_reason")
    return AcceptanceItem(
        item_id=_require_str(payload.get("item_id"), "item_id"),
        stage=_require_str(payload.get("stage"), "stage"),
        title=_require_str(payload.get("title"), "title"),
        mandatory=bool(payload.get("mandatory", True)),
        status=AcceptanceStatus(_require_str(payload.get("status"), "status")),
        evidence_refs=tuple(
            _require_str(reference, "evidence ref")
            for reference in _require_sequence(payload.get("evidence_refs", []), "evidence_refs")
        ),
        blocking_reason=None if reason is None else _require_str(reason, "blocking_reason"),
    )


def _parse_model(raw: Any, name: str) -> ModelDescriptor:
    payload = _require_mapping(raw, name)
    return ModelDescriptor(
        model_id=_require_str(payload.get("model_id"), "model_id"),
        revision=_require_str(payload.get("revision"), "revision"),
        quantization=_require_str(payload.get("quantization"), "quantization"),
        status=SubsystemStatus(_require_str(payload.get("status"), "model status")),
    )


def load_backlog(path: Path) -> AcceptanceBacklog:
    """Load and strictly validate a backlog document."""
    document = _require_mapping(json.loads(path.read_text(encoding="utf-8")), "backlog document")
    schema = _require_str(document.get("schema"), "schema")
    if schema != BACKLOG_SCHEMA:
        raise ValueError(f"backlog schema must be {BACKLOG_SCHEMA}")

    discovery_payload = _require_mapping(document.get("discovery"), "discovery")
    discovery = DiscoveryContext(
        exact_main_sha=_require_str(discovery_payload.get("exact_main_sha"), "exact_main_sha"),
        generated_at=_parse_timestamp(
            _require_str(discovery_payload.get("generated_at"), "generated_at"), "generated_at"
        ),
        open_prs=tuple(
            _require_int(number, "open pr")
            for number in _require_sequence(discovery_payload.get("open_prs", []), "open_prs")
        ),
        open_issues=tuple(
            _require_int(number, "open issue")
            for number in _require_sequence(discovery_payload.get("open_issues", []), "open_issues")
        ),
        stale_branches=tuple(
            _require_str(branch, "stale branch")
            for branch in _require_sequence(
                discovery_payload.get("stale_branches", []), "stale_branches"
            )
        ),
        failing_main_workflows=tuple(
            _require_str(workflow, "failing workflow")
            for workflow in _require_sequence(
                discovery_payload.get("failing_main_workflows", []), "failing_main_workflows"
            )
        ),
    )

    subsystems_payload = _require_mapping(document.get("subsystems"), "subsystems")
    subsystems = {
        name: SubsystemStatus(_require_str(value, f"subsystem {name}"))
        for name, value in subsystems_payload.items()
    }

    models = _require_mapping(document.get("models"), "models")
    return AcceptanceBacklog(
        discovery=discovery,
        items=tuple(
            _parse_item(raw) for raw in _require_sequence(document.get("items"), "items")
        ),
        subsystems=subsystems,
        primary_model=_parse_model(models.get("primary"), "primary model"),
        fallback_model=_parse_model(models.get("fallback"), "fallback model"),
    )
