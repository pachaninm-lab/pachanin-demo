from __future__ import annotations

from collections.abc import Callable
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest

from tai.main import ReadinessStatus
from tai.model_admission import (
    GovernedModelProfileRepository,
    InMemoryModelAdmissionRepository,
    LicenseReviewDecision,
    LicenseReviewEvidence,
    ModelAdmissionAuthority,
    ModelAdmissionAwareReadinessProbe,
    ModelAdmissionCandidate,
    ModelAdmissionPolicy,
    ModelAdmissionRecord,
    ModelAdmissionStatus,
    ModelArtifactEvidence,
    ModelBenchmarkEvidence,
)
from tai.model_runtime import (
    InMemoryModelProfileRepository,
    LocalModelProfile,
    ModelCapability,
    ModelRuntimeClass,
)

NOW = datetime(2026, 7, 19, 6, 0, tzinfo=UTC)
ARTIFACT_SHA = "a" * 64
LICENSE_SHA = "b" * 64
TOKENIZER_SHA = "c" * 64


def _artifact(**changes: object) -> ModelArtifactEvidence:
    values: dict[str, object] = {
        "model_id": "primary-model",
        "revision": "r1",
        "artifact_locator": f"oci://registry.local/tai/primary@sha256:{ARTIFACT_SHA}",
        "artifact_sha256": ARTIFACT_SHA,
        "source_uri": "https://models.example/primary-model",
        "source_revision": "d" * 40,
        "license_spdx": "Apache-2.0",
        "license_text_sha256": LICENSE_SHA,
        "tokenizer_sha256": TOKENIZER_SHA,
        "quantization": "Q4_K_M",
        "runtime_class": ModelRuntimeClass.CPU,
        "artifact_size_bytes": 5_000_000_000,
        "created_at": NOW - timedelta(days=2),
    }
    values.update(changes)
    return ModelArtifactEvidence(**values)  # type: ignore[arg-type]


def _license(**changes: object) -> LicenseReviewEvidence:
    values: dict[str, object] = {
        "model_id": "primary-model",
        "revision": "r1",
        "artifact_sha256": ARTIFACT_SHA,
        "license_spdx": "Apache-2.0",
        "license_text_sha256": LICENSE_SHA,
        "decision": LicenseReviewDecision.APPROVED,
        "reviewed_by": "legal-reviewer-1",
        "reviewed_at": NOW - timedelta(days=1),
        "evidence_locator": "file:///evidence/licenses/primary-model.json",
        "evidence_sha256": "e" * 64,
        "restrictions": (),
    }
    values.update(changes)
    return LicenseReviewEvidence(**values)  # type: ignore[arg-type]


def _benchmark(
    benchmark_id: str,
    runtime_class: ModelRuntimeClass,
    **changes: object,
) -> ModelBenchmarkEvidence:
    values: dict[str, object] = {
        "benchmark_id": benchmark_id,
        "model_id": "primary-model",
        "revision": "r1",
        "artifact_sha256": ARTIFACT_SHA,
        "runtime_class": runtime_class,
        "hardware_profile": (
            "4 vCPU / 16 GiB"
            if runtime_class is ModelRuntimeClass.CPU
            else "A10 24 GiB"
        ),
        "quantization": "Q4_K_M",
        "sample_count": 1_000,
        "platform_accuracy_basis_points": 9_700,
        "agro_accuracy_basis_points": 9_200,
        "prompt_tokens_per_second_milli": 12_000,
        "generation_tokens_per_second_milli": 8_000,
        "p95_latency_ms": 900,
        "peak_memory_mb": 12_000,
        "estimated_cost_rub_per_million_tokens_milli": 500_000,
        "measured_at": NOW - timedelta(hours=12),
        "evidence_locator": f"file:///evidence/benchmarks/{benchmark_id}.json",
        "evidence_sha256": (
            "f" if runtime_class is ModelRuntimeClass.CPU else "1"
        )
        * 64,
    }
    values.update(changes)
    return ModelBenchmarkEvidence(**values)  # type: ignore[arg-type]


def _candidate(**changes: object) -> ModelAdmissionCandidate:
    values: dict[str, object] = {
        "artifact": _artifact(),
        "license_review": _license(),
        "benchmarks": (
            _benchmark("cpu-run", ModelRuntimeClass.CPU),
            _benchmark("gpu-run", ModelRuntimeClass.GPU_SHARED),
        ),
        "fallback_identities": (("fallback-model", "r1"),),
        "evaluated_at": NOW,
    }
    values.update(changes)
    return ModelAdmissionCandidate(**values)  # type: ignore[arg-type]


def test_authority_accepts_pinned_licensed_measured_model_with_fallback() -> None:
    authority = ModelAdmissionAuthority()

    decision = authority.assess(_candidate())

    assert decision.status is ModelAdmissionStatus.ACCEPTED
    assert decision.accepted is True
    assert decision.reasons == ()
    assert len(decision.decision_sha256) == 64
    assert authority.assess(_candidate()) == decision


@pytest.mark.parametrize(
    ("candidate", "reason"),
    [
        (
            _candidate(license_review=_license(decision=LicenseReviewDecision.REJECTED)),
            "LICENSE_REVIEW_NOT_APPROVED",
        ),
        (
            _candidate(artifact=_artifact(license_spdx="Proprietary")),
            "LICENSE_NOT_IN_APPROVED_POLICY",
        ),
        (
            _candidate(license_review=_license(artifact_sha256="2" * 64)),
            "LICENSE_REVIEW_ARTIFACT_MISMATCH",
        ),
        (
            _candidate(benchmarks=(_benchmark("cpu-run", ModelRuntimeClass.CPU),)),
            "GPU_PROFILE_MISSING",
        ),
        (
            _candidate(
                benchmarks=(
                    _benchmark(
                        "cpu-run",
                        ModelRuntimeClass.CPU,
                        platform_accuracy_basis_points=9_000,
                    ),
                    _benchmark("gpu-run", ModelRuntimeClass.GPU_SHARED),
                )
            ),
            "PLATFORM_QUALITY_BELOW_POLICY",
        ),
        (
            _candidate(fallback_identities=(("primary-model", "r1"),)),
            "FALLBACK_MODEL_SELF_REFERENCE",
        ),
        (
            _candidate(fallback_identities=()),
            "FALLBACK_MODEL_MISSING",
        ),
    ],
)
def test_authority_rejects_incomplete_or_unsafe_evidence(
    candidate: ModelAdmissionCandidate,
    reason: str,
) -> None:
    decision = ModelAdmissionAuthority().assess(candidate)

    assert decision.status is ModelAdmissionStatus.REJECTED
    assert decision.accepted is False
    assert reason in decision.reasons


def test_authority_rejects_stale_mismatched_and_undersampled_benchmarks() -> None:
    decision = ModelAdmissionAuthority().assess(
        _candidate(
            benchmarks=(
                _benchmark(
                    "cpu-run",
                    ModelRuntimeClass.CPU,
                    sample_count=10,
                    measured_at=NOW - timedelta(days=181),
                ),
                _benchmark(
                    "gpu-run",
                    ModelRuntimeClass.GPU_SHARED,
                    artifact_sha256="2" * 64,
                ),
            )
        )
    )

    assert decision.status is ModelAdmissionStatus.REJECTED
    assert "BENCHMARK_STALE_OR_FUTURE" in decision.reasons
    assert "BENCHMARK_ARTIFACT_MISMATCH" in decision.reasons
    assert "CPU_PROFILE_MISSING" in decision.reasons
    assert "GPU_PROFILE_MISSING" in decision.reasons


def _profile(model_id: str, artifact_sha256: str) -> LocalModelProfile:
    return LocalModelProfile(
        model_id=model_id,
        revision="r1",
        artifact_locator=f"file:///models/{model_id}.gguf",
        artifact_sha256=artifact_sha256,
        license_ref="Apache-2.0",
        capabilities=frozenset(
            {ModelCapability.TEXT_GENERATION, ModelCapability.RUSSIAN}
        ),
        maximum_context_tokens=8_192,
        maximum_output_tokens=2_048,
        runtime_class=ModelRuntimeClass.CPU,
        quantization="Q4_K_M",
    )


def _admission(
    model_id: str,
    artifact_sha256: str,
    *,
    accepted: bool = True,
) -> ModelAdmissionRecord:
    return ModelAdmissionRecord(
        model_id=model_id,
        revision="r1",
        artifact_sha256=artifact_sha256,
        accepted=accepted,
        decided_at=NOW,
        decision_sha256="9" * 64,
    )


def test_governed_repository_exposes_only_exact_accepted_artifacts() -> None:
    accepted = _profile("accepted", "a" * 64)
    wrong_digest = _profile("wrong-digest", "b" * 64)
    rejected = _profile("rejected", "c" * 64)
    unreviewed = _profile("unreviewed", "d" * 64)
    repository = GovernedModelProfileRepository(
        InMemoryModelProfileRepository((accepted, wrong_digest, rejected, unreviewed)),
        InMemoryModelAdmissionRepository(
            (
                _admission("accepted", "a" * 64),
                _admission("wrong-digest", "e" * 64),
                _admission("rejected", "c" * 64, accepted=False),
            )
        ),
    )

    assert repository.list_profiles() == (accepted,)


class _BaseProbe:
    def __init__(self, ready: bool = True) -> None:
        self._ready = ready

    def check(self) -> ReadinessStatus:
        reasons = () if self._ready else ("BASE_NOT_READY",)
        return ReadinessStatus(self._ready, {"base": "ready"}, reasons)


class _Cursor:
    def __init__(self, row: dict[str, Any] | None) -> None:
        self._row = row
        self.query = ""
        self.parameters: tuple[object, ...] = ()

    def __enter__(self) -> _Cursor:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def execute(self, query: str, parameters: tuple[object, ...]) -> None:
        self.query = query
        self.parameters = parameters

    def fetchone(self) -> dict[str, Any] | None:
        return self._row


class _Connection:
    def __init__(self, row: dict[str, Any] | None, *, fail: bool = False) -> None:
        self.cursor_value = _Cursor(row)
        self.fail = fail
        self.commits = 0
        self.rollbacks = 0

    def __enter__(self) -> _Connection:
        return self

    def __exit__(self, *args: object) -> None:
        del args

    def cursor(self) -> _Cursor:
        if self.fail:
            raise RuntimeError("database unavailable")
        return self.cursor_value

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class _Factory:
    def __init__(self, connection: _Connection) -> None:
        self.connection = connection

    def __call__(self) -> _Connection:
        return self.connection


def test_readiness_requires_every_active_profile_to_be_admitted() -> None:
    connection = _Connection({"active_count": 2, "admitted_count": 2})
    probe = ModelAdmissionAwareReadinessProbe(
        delegate=_BaseProbe(),
        connection_factory=_Factory(connection),
    )

    status = probe.check()

    assert status.ready is True
    assert status.components["model_admission"] == "ready"
    assert connection.commits == 1
    assert "tai_current_model_admission_v1" in connection.cursor_value.query


@pytest.mark.parametrize(
    "connection",
    [
        _Connection({"active_count": 2, "admitted_count": 1}),
        _Connection({"active_count": 0, "admitted_count": 0}),
        _Connection(None),
        _Connection(None, fail=True),
    ],
)
def test_readiness_fails_closed_without_complete_admission(
    connection: _Connection,
) -> None:
    status = ModelAdmissionAwareReadinessProbe(
        delegate=_BaseProbe(),
        connection_factory=_Factory(connection),
    ).check()

    assert status.ready is False
    assert status.components["model_admission"] == "not_admitted"
    assert "MODEL_ARTIFACT_NOT_ADMITTED" in status.reasons


def test_readiness_preserves_delegate_failure() -> None:
    status = ModelAdmissionAwareReadinessProbe(
        delegate=_BaseProbe(ready=False),
        connection_factory=_Factory(
            _Connection({"active_count": 1, "admitted_count": 1})
        ),
    ).check()

    assert status.ready is False
    assert status.reasons == ("BASE_NOT_READY",)


@pytest.mark.parametrize(
    ("factory", "message"),
    [
        (lambda: _artifact(source_uri="http://insecure"), "HTTPS"),
        (lambda: _artifact(source_revision="main"), "pinned"),
        (lambda: _artifact(artifact_size_bytes=0), "positive"),
        (
            lambda: _license(evidence_locator="https://mutable.example/review"),
            "evidence_locator",
        ),
        (
            lambda: _benchmark("cpu", ModelRuntimeClass.CPU, sample_count=0),
            "sample_count",
        ),
        (
            lambda: ModelAdmissionPolicy(maximum_benchmark_age=timedelta(0)),
            "maximum_benchmark_age",
        ),
    ],
)
def test_evidence_and_policy_validation(
    factory: Callable[[], object],
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        factory()


def test_admission_repository_rejects_duplicate_current_identity() -> None:
    record = _admission("model", "a" * 64)
    with pytest.raises(ValueError, match="identity"):
        InMemoryModelAdmissionRepository(
            (record, replace(record, decision_sha256="8" * 64))
        )
