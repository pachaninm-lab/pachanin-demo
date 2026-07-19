from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Protocol

from tai.main import ReadinessStatus
from tai.model_runtime import LocalModelProfile, ModelProfileRepository, ModelRuntimeClass
from tai.postgres_loader_state import ConnectionFactory

_IDENTITY = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")
_PORTABLE = re.compile(r"^[A-Za-z0-9._:+/-]{1,160}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_SOURCE_REVISION = re.compile(r"^[0-9a-f]{40,64}$")


class LicenseReviewDecision(StrEnum):
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class ModelAdmissionStatus(StrEnum):
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"


@dataclass(frozen=True, slots=True)
class ModelArtifactEvidence:
    model_id: str
    revision: str
    artifact_locator: str
    artifact_sha256: str
    source_uri: str
    source_revision: str
    license_spdx: str
    license_text_sha256: str
    tokenizer_sha256: str
    quantization: str
    runtime_class: ModelRuntimeClass
    artifact_size_bytes: int
    created_at: datetime

    def __post_init__(self) -> None:
        _validate_identity(self.model_id, "model_id")
        _validate_identity(self.revision, "revision")
        _validate_artifact_locator(self.artifact_locator)
        _validate_sha256(self.artifact_sha256, "artifact_sha256")
        if not self.source_uri.startswith("https://"):
            raise ValueError("source_uri must use HTTPS")
        if _SOURCE_REVISION.fullmatch(self.source_revision) is None:
            raise ValueError("source_revision must be a pinned lowercase commit digest")
        if _PORTABLE.fullmatch(self.license_spdx) is None:
            raise ValueError("license_spdx must be a portable SPDX identifier")
        _validate_sha256(self.license_text_sha256, "license_text_sha256")
        _validate_sha256(self.tokenizer_sha256, "tokenizer_sha256")
        if not self.quantization.strip():
            raise ValueError("quantization must not be blank")
        if self.artifact_size_bytes < 1:
            raise ValueError("artifact_size_bytes must be positive")
        _validate_time(self.created_at, "created_at")


@dataclass(frozen=True, slots=True)
class LicenseReviewEvidence:
    model_id: str
    revision: str
    artifact_sha256: str
    license_spdx: str
    license_text_sha256: str
    decision: LicenseReviewDecision
    reviewed_by: str
    reviewed_at: datetime
    evidence_locator: str
    evidence_sha256: str
    restrictions: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        _validate_identity(self.model_id, "model_id")
        _validate_identity(self.revision, "revision")
        _validate_sha256(self.artifact_sha256, "artifact_sha256")
        if _PORTABLE.fullmatch(self.license_spdx) is None:
            raise ValueError("license_spdx must be a portable SPDX identifier")
        _validate_sha256(self.license_text_sha256, "license_text_sha256")
        if _PORTABLE.fullmatch(self.reviewed_by) is None:
            raise ValueError("reviewed_by must be a portable reviewer identifier")
        _validate_time(self.reviewed_at, "reviewed_at")
        _validate_evidence_locator(self.evidence_locator)
        _validate_sha256(self.evidence_sha256, "evidence_sha256")
        if any(not item.strip() for item in self.restrictions):
            raise ValueError("license restrictions must not contain blank values")
        if len(set(self.restrictions)) != len(self.restrictions):
            raise ValueError("license restrictions must be unique")


@dataclass(frozen=True, slots=True)
class ModelBenchmarkEvidence:
    benchmark_id: str
    model_id: str
    revision: str
    artifact_sha256: str
    runtime_class: ModelRuntimeClass
    hardware_profile: str
    quantization: str
    sample_count: int
    platform_accuracy_basis_points: int
    agro_accuracy_basis_points: int
    prompt_tokens_per_second_milli: int
    generation_tokens_per_second_milli: int
    p95_latency_ms: int
    peak_memory_mb: int
    estimated_cost_rub_per_million_tokens_milli: int
    measured_at: datetime
    evidence_locator: str
    evidence_sha256: str

    def __post_init__(self) -> None:
        _validate_identity(self.benchmark_id, "benchmark_id")
        _validate_identity(self.model_id, "model_id")
        _validate_identity(self.revision, "revision")
        _validate_sha256(self.artifact_sha256, "artifact_sha256")
        if not self.hardware_profile.strip():
            raise ValueError("hardware_profile must not be blank")
        if not self.quantization.strip():
            raise ValueError("quantization must not be blank")
        if self.sample_count < 1:
            raise ValueError("sample_count must be positive")
        for name, value in (
            ("platform_accuracy_basis_points", self.platform_accuracy_basis_points),
            ("agro_accuracy_basis_points", self.agro_accuracy_basis_points),
        ):
            if not 0 <= value <= 10_000:
                raise ValueError(f"{name} must be between 0 and 10000")
        if self.prompt_tokens_per_second_milli < 1:
            raise ValueError("prompt_tokens_per_second_milli must be positive")
        if self.generation_tokens_per_second_milli < 1:
            raise ValueError("generation_tokens_per_second_milli must be positive")
        if self.p95_latency_ms < 1:
            raise ValueError("p95_latency_ms must be positive")
        if self.peak_memory_mb < 1:
            raise ValueError("peak_memory_mb must be positive")
        if self.estimated_cost_rub_per_million_tokens_milli < 0:
            raise ValueError("estimated operating cost must not be negative")
        _validate_time(self.measured_at, "measured_at")
        _validate_evidence_locator(self.evidence_locator)
        _validate_sha256(self.evidence_sha256, "evidence_sha256")


@dataclass(frozen=True, slots=True)
class ModelAdmissionCandidate:
    artifact: ModelArtifactEvidence
    license_review: LicenseReviewEvidence
    benchmarks: tuple[ModelBenchmarkEvidence, ...]
    fallback_identities: tuple[tuple[str, str], ...]
    evaluated_at: datetime

    def __post_init__(self) -> None:
        _validate_time(self.evaluated_at, "evaluated_at")
        for model_id, revision in self.fallback_identities:
            _validate_identity(model_id, "fallback model_id")
            _validate_identity(revision, "fallback revision")
        if len(set(self.fallback_identities)) != len(self.fallback_identities):
            raise ValueError("fallback identities must be unique")


@dataclass(frozen=True, slots=True)
class ModelAdmissionPolicy:
    approved_licenses: frozenset[str] = frozenset(
        {"Apache-2.0", "MIT", "BSD-2-Clause", "BSD-3-Clause"}
    )
    minimum_sample_count: int = 100
    minimum_platform_accuracy_basis_points: int = 9_500
    minimum_agro_accuracy_basis_points: int = 9_000
    maximum_benchmark_age: timedelta = timedelta(days=180)
    require_cpu_profile: bool = True
    require_gpu_profile: bool = True
    require_fallback: bool = True

    def __post_init__(self) -> None:
        if not self.approved_licenses:
            raise ValueError("approved_licenses must not be empty")
        if self.minimum_sample_count < 1:
            raise ValueError("minimum_sample_count must be positive")
        for name, value in (
            (
                "minimum_platform_accuracy_basis_points",
                self.minimum_platform_accuracy_basis_points,
            ),
            ("minimum_agro_accuracy_basis_points", self.minimum_agro_accuracy_basis_points),
        ):
            if not 0 <= value <= 10_000:
                raise ValueError(f"{name} must be between 0 and 10000")
        if self.maximum_benchmark_age <= timedelta(0):
            raise ValueError("maximum_benchmark_age must be positive")


@dataclass(frozen=True, slots=True)
class ModelAdmissionDecision:
    model_id: str
    revision: str
    artifact_sha256: str
    status: ModelAdmissionStatus
    reasons: tuple[str, ...]
    decided_at: datetime
    decision_sha256: str

    @property
    def accepted(self) -> bool:
        return self.status is ModelAdmissionStatus.ACCEPTED


@dataclass(frozen=True, slots=True)
class ModelAdmissionRecord:
    model_id: str
    revision: str
    artifact_sha256: str
    accepted: bool
    decided_at: datetime
    decision_sha256: str

    def __post_init__(self) -> None:
        _validate_identity(self.model_id, "model_id")
        _validate_identity(self.revision, "revision")
        _validate_sha256(self.artifact_sha256, "artifact_sha256")
        _validate_time(self.decided_at, "decided_at")
        _validate_sha256(self.decision_sha256, "decision_sha256")


class ModelAdmissionRepository(Protocol):
    def list_current(self) -> tuple[ModelAdmissionRecord, ...]: ...


class InMemoryModelAdmissionRepository:
    def __init__(self, records: tuple[ModelAdmissionRecord, ...]) -> None:
        identities = {(item.model_id, item.revision) for item in records}
        if len(identities) != len(records):
            raise ValueError("current admission identity must be unique")
        self._records = records

    def list_current(self) -> tuple[ModelAdmissionRecord, ...]:
        return self._records


class GovernedModelProfileRepository:
    """Expose only profiles bound to the current accepted artifact decision."""

    def __init__(
        self,
        delegate: ModelProfileRepository,
        admissions: ModelAdmissionRepository,
    ) -> None:
        self._delegate = delegate
        self._admissions = admissions

    def list_profiles(self) -> tuple[LocalModelProfile, ...]:
        accepted = {
            (item.model_id, item.revision): item.artifact_sha256
            for item in self._admissions.list_current()
            if item.accepted
        }
        return tuple(
            profile
            for profile in self._delegate.list_profiles()
            if accepted.get((profile.model_id, profile.revision)) == profile.artifact_sha256
        )


class ModelAdmissionAuthority:
    """Deterministic fail-closed admission for local production model artifacts."""

    def __init__(self, policy: ModelAdmissionPolicy | None = None) -> None:
        self._policy = policy or ModelAdmissionPolicy()

    def assess(self, candidate: ModelAdmissionCandidate) -> ModelAdmissionDecision:
        artifact = candidate.artifact
        review = candidate.license_review
        reasons: list[str] = []

        if review.decision is not LicenseReviewDecision.APPROVED:
            reasons.append("LICENSE_REVIEW_NOT_APPROVED")
        if artifact.license_spdx not in self._policy.approved_licenses:
            reasons.append("LICENSE_NOT_IN_APPROVED_POLICY")
        if (
            review.model_id,
            review.revision,
            review.artifact_sha256,
            review.license_spdx,
            review.license_text_sha256,
        ) != (
            artifact.model_id,
            artifact.revision,
            artifact.artifact_sha256,
            artifact.license_spdx,
            artifact.license_text_sha256,
        ):
            reasons.append("LICENSE_REVIEW_ARTIFACT_MISMATCH")

        valid_benchmarks: list[ModelBenchmarkEvidence] = []
        for benchmark in candidate.benchmarks:
            if (
                benchmark.model_id,
                benchmark.revision,
                benchmark.artifact_sha256,
                benchmark.quantization,
            ) != (
                artifact.model_id,
                artifact.revision,
                artifact.artifact_sha256,
                artifact.quantization,
            ):
                reasons.append("BENCHMARK_ARTIFACT_MISMATCH")
                continue
            age = candidate.evaluated_at - benchmark.measured_at
            if age < timedelta(0) or age > self._policy.maximum_benchmark_age:
                reasons.append("BENCHMARK_STALE_OR_FUTURE")
                continue
            if benchmark.sample_count < self._policy.minimum_sample_count:
                reasons.append("BENCHMARK_SAMPLE_COUNT_BELOW_POLICY")
            if (
                benchmark.platform_accuracy_basis_points
                < self._policy.minimum_platform_accuracy_basis_points
            ):
                reasons.append("PLATFORM_QUALITY_BELOW_POLICY")
            if (
                benchmark.agro_accuracy_basis_points
                < self._policy.minimum_agro_accuracy_basis_points
            ):
                reasons.append("AGRO_QUALITY_BELOW_POLICY")
            valid_benchmarks.append(benchmark)

        runtime_classes = {item.runtime_class for item in valid_benchmarks}
        if self._policy.require_cpu_profile and ModelRuntimeClass.CPU not in runtime_classes:
            reasons.append("CPU_PROFILE_MISSING")
        gpu_present = bool(
            runtime_classes
            & {ModelRuntimeClass.GPU_SHARED, ModelRuntimeClass.GPU_DEDICATED}
        )
        if self._policy.require_gpu_profile and not gpu_present:
            reasons.append("GPU_PROFILE_MISSING")

        self_identity = (artifact.model_id, artifact.revision)
        if self._policy.require_fallback and not candidate.fallback_identities:
            reasons.append("FALLBACK_MODEL_MISSING")
        if self_identity in candidate.fallback_identities:
            reasons.append("FALLBACK_MODEL_SELF_REFERENCE")

        unique_reasons = tuple(sorted(set(reasons)))
        status = (
            ModelAdmissionStatus.ACCEPTED
            if not unique_reasons
            else ModelAdmissionStatus.REJECTED
        )
        decision_sha256 = _decision_sha256(candidate, status, unique_reasons)
        return ModelAdmissionDecision(
            model_id=artifact.model_id,
            revision=artifact.revision,
            artifact_sha256=artifact.artifact_sha256,
            status=status,
            reasons=unique_reasons,
            decided_at=candidate.evaluated_at,
            decision_sha256=decision_sha256,
        )


class ModelAdmissionAwareReadinessProbe:
    """Block every production request until every active model artifact is admitted."""

    def __init__(
        self,
        *,
        delegate: object,
        connection_factory: ConnectionFactory,
    ) -> None:
        if not hasattr(delegate, "check"):
            raise TypeError("delegate must provide check()")
        self._delegate = delegate
        self._connection_factory = connection_factory

    def check(self) -> ReadinessStatus:
        base = self._delegate.check()
        components = dict(base.components)
        reasons = list(base.reasons)
        try:
            admitted = self._all_active_profiles_admitted()
        except Exception:
            admitted = False
        components["model_admission"] = "ready" if admitted else "not_admitted"
        if not admitted:
            reasons.append("MODEL_ARTIFACT_NOT_ADMITTED")
        unique_reasons = tuple(dict.fromkeys(reasons))
        return ReadinessStatus(not unique_reasons, components, unique_reasons)

    def _all_active_profiles_admitted(self) -> bool:
        query = """
            SELECT
                COUNT(*) FILTER (WHERE profile.status = 'ACTIVE') AS active_count,
                COUNT(*) FILTER (
                    WHERE profile.status = 'ACTIVE'
                      AND admission.accepted IS TRUE
                      AND admission.artifact_sha256 = profile.artifact_sha256
                ) AS admitted_count
            FROM tai_local_model_profiles AS profile
            LEFT JOIN tai_current_model_admission_v1 AS admission
              ON admission.model_id = profile.model_id
             AND admission.revision = profile.revision
        """
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, ())
                    row = cursor.fetchone()
                connection.commit()
            except Exception:
                connection.rollback()
                raise
        if row is None:
            return False
        active_count = int(row["active_count"])
        admitted_count = int(row["admitted_count"])
        return active_count > 0 and active_count == admitted_count


def _decision_sha256(
    candidate: ModelAdmissionCandidate,
    status: ModelAdmissionStatus,
    reasons: tuple[str, ...],
) -> str:
    artifact = candidate.artifact
    payload = {
        "artifact": {
            "artifact_locator": artifact.artifact_locator,
            "artifact_sha256": artifact.artifact_sha256,
            "artifact_size_bytes": artifact.artifact_size_bytes,
            "created_at": artifact.created_at.isoformat(),
            "license_spdx": artifact.license_spdx,
            "license_text_sha256": artifact.license_text_sha256,
            "model_id": artifact.model_id,
            "quantization": artifact.quantization,
            "revision": artifact.revision,
            "runtime_class": artifact.runtime_class.value,
            "source_revision": artifact.source_revision,
            "source_uri": artifact.source_uri,
            "tokenizer_sha256": artifact.tokenizer_sha256,
        },
        "benchmarks": [
            {
                "agro_accuracy_basis_points": item.agro_accuracy_basis_points,
                "artifact_sha256": item.artifact_sha256,
                "benchmark_id": item.benchmark_id,
                "estimated_cost_rub_per_million_tokens_milli": (
                    item.estimated_cost_rub_per_million_tokens_milli
                ),
                "evidence_sha256": item.evidence_sha256,
                "generation_tokens_per_second_milli": (
                    item.generation_tokens_per_second_milli
                ),
                "hardware_profile": item.hardware_profile,
                "measured_at": item.measured_at.isoformat(),
                "model_id": item.model_id,
                "p95_latency_ms": item.p95_latency_ms,
                "peak_memory_mb": item.peak_memory_mb,
                "platform_accuracy_basis_points": item.platform_accuracy_basis_points,
                "prompt_tokens_per_second_milli": item.prompt_tokens_per_second_milli,
                "quantization": item.quantization,
                "revision": item.revision,
                "runtime_class": item.runtime_class.value,
                "sample_count": item.sample_count,
            }
            for item in sorted(candidate.benchmarks, key=lambda value: value.benchmark_id)
        ],
        "evaluated_at": candidate.evaluated_at.isoformat(),
        "fallback_identities": [list(item) for item in candidate.fallback_identities],
        "license_review": {
            "artifact_sha256": candidate.license_review.artifact_sha256,
            "decision": candidate.license_review.decision.value,
            "evidence_sha256": candidate.license_review.evidence_sha256,
            "license_spdx": candidate.license_review.license_spdx,
            "license_text_sha256": candidate.license_review.license_text_sha256,
            "model_id": candidate.license_review.model_id,
            "reviewed_at": candidate.license_review.reviewed_at.isoformat(),
            "reviewed_by": candidate.license_review.reviewed_by,
            "revision": candidate.license_review.revision,
            "restrictions": list(candidate.license_review.restrictions),
        },
        "reasons": list(reasons),
        "schema_version": "tai.model-admission.decision.v1",
        "status": status.value,
    }
    canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _validate_identity(value: str, name: str) -> None:
    if _IDENTITY.fullmatch(value) is None:
        raise ValueError(f"{name} must be a portable bounded identity")


def _validate_sha256(value: str, name: str) -> None:
    if _SHA256.fullmatch(value) is None:
        raise ValueError(f"{name} must be a lowercase SHA-256 digest")


def _validate_artifact_locator(value: str) -> None:
    if value.startswith("file://"):
        return
    if value.startswith("oci://") and "@sha256:" in value:
        return
    raise ValueError("artifact_locator must be a local file or digest-pinned OCI artifact")


def _validate_evidence_locator(value: str) -> None:
    if value.startswith("file://"):
        return
    if value.startswith("oci://") and "@sha256:" in value:
        return
    raise ValueError("evidence_locator must be a local file or digest-pinned OCI artifact")


def _validate_time(value: datetime, name: str) -> None:
    if value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")
