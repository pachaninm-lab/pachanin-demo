from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from typing import Any

from tai.model_admission import (
    LicenseReviewEvidence,
    ModelAdmissionCandidate,
    ModelAdmissionDecision,
    ModelAdmissionRecord,
)
from tai.postgres_loader_state import ConnectionFactory


class PostgreSQLModelAdmissionRepository:
    """Immutable PostgreSQL authority for model evidence and admission decisions."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record(
        self,
        candidate: ModelAdmissionCandidate,
        decision: ModelAdmissionDecision,
    ) -> None:
        artifact = candidate.artifact
        if (
            decision.model_id,
            decision.revision,
            decision.artifact_sha256,
            decision.decided_at,
        ) != (
            artifact.model_id,
            artifact.revision,
            artifact.artifact_sha256,
            candidate.evaluated_at,
        ):
            raise ValueError("admission decision is not bound to the candidate artifact")

        review_sha256 = _license_review_sha256(candidate.license_review)
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    self._record_artifact(cursor, candidate)
                    self._record_license_review(cursor, candidate, review_sha256)
                    self._record_benchmarks(cursor, candidate)
                    self._record_decision(cursor, candidate, decision, review_sha256)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def list_current(self) -> tuple[ModelAdmissionRecord, ...]:
        query = """
            SELECT
                model_id,
                revision,
                artifact_sha256,
                accepted,
                decided_at,
                decision_sha256
            FROM tai_current_model_admission_v1
            ORDER BY model_id, revision
        """
        rows = self._execute_all(query, ())
        return tuple(
            ModelAdmissionRecord(
                model_id=str(row["model_id"]),
                revision=str(row["revision"]),
                artifact_sha256=str(row["artifact_sha256"]),
                accepted=bool(row["accepted"]),
                decided_at=row["decided_at"],
                decision_sha256=str(row["decision_sha256"]),
            )
            for row in rows
        )

    @staticmethod
    def _record_artifact(cursor: Any, candidate: ModelAdmissionCandidate) -> None:
        artifact = candidate.artifact
        query = """
            INSERT INTO tai_model_artifact_evidence (
                model_id,
                revision,
                artifact_sha256,
                artifact_locator,
                source_uri,
                source_revision,
                license_spdx,
                license_text_sha256,
                tokenizer_sha256,
                quantization,
                runtime_class,
                artifact_size_bytes,
                artifact_created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (model_id, revision, artifact_sha256) DO UPDATE
            SET model_id = EXCLUDED.model_id
            WHERE tai_model_artifact_evidence.artifact_locator = EXCLUDED.artifact_locator
              AND tai_model_artifact_evidence.source_uri = EXCLUDED.source_uri
              AND tai_model_artifact_evidence.source_revision = EXCLUDED.source_revision
              AND tai_model_artifact_evidence.license_spdx = EXCLUDED.license_spdx
              AND tai_model_artifact_evidence.license_text_sha256 = EXCLUDED.license_text_sha256
              AND tai_model_artifact_evidence.tokenizer_sha256 = EXCLUDED.tokenizer_sha256
              AND tai_model_artifact_evidence.quantization = EXCLUDED.quantization
              AND tai_model_artifact_evidence.runtime_class = EXCLUDED.runtime_class
              AND tai_model_artifact_evidence.artifact_size_bytes = EXCLUDED.artifact_size_bytes
              AND tai_model_artifact_evidence.artifact_created_at = EXCLUDED.artifact_created_at
            RETURNING artifact_sha256
        """
        cursor.execute(
            query,
            (
                artifact.model_id,
                artifact.revision,
                artifact.artifact_sha256,
                artifact.artifact_locator,
                artifact.source_uri,
                artifact.source_revision,
                artifact.license_spdx,
                artifact.license_text_sha256,
                artifact.tokenizer_sha256,
                artifact.quantization,
                artifact.runtime_class.value,
                artifact.artifact_size_bytes,
                artifact.created_at,
            ),
        )
        if cursor.fetchone() is None:
            raise RuntimeError("artifact identity is already bound to different evidence")

    @staticmethod
    def _record_license_review(
        cursor: Any,
        candidate: ModelAdmissionCandidate,
        review_sha256: str,
    ) -> None:
        review = candidate.license_review
        query = """
            INSERT INTO tai_model_license_reviews (
                review_sha256,
                model_id,
                revision,
                artifact_sha256,
                license_spdx,
                license_text_sha256,
                decision,
                reviewed_by,
                reviewed_at,
                evidence_locator,
                evidence_sha256,
                restrictions
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (review_sha256) DO UPDATE
            SET review_sha256 = EXCLUDED.review_sha256
            WHERE tai_model_license_reviews.model_id = EXCLUDED.model_id
              AND tai_model_license_reviews.revision = EXCLUDED.revision
              AND tai_model_license_reviews.artifact_sha256 = EXCLUDED.artifact_sha256
              AND tai_model_license_reviews.license_spdx = EXCLUDED.license_spdx
              AND tai_model_license_reviews.license_text_sha256 = EXCLUDED.license_text_sha256
              AND tai_model_license_reviews.decision = EXCLUDED.decision
              AND tai_model_license_reviews.reviewed_by = EXCLUDED.reviewed_by
              AND tai_model_license_reviews.reviewed_at = EXCLUDED.reviewed_at
              AND tai_model_license_reviews.evidence_locator = EXCLUDED.evidence_locator
              AND tai_model_license_reviews.evidence_sha256 = EXCLUDED.evidence_sha256
              AND tai_model_license_reviews.restrictions = EXCLUDED.restrictions
            RETURNING review_sha256
        """
        cursor.execute(
            query,
            (
                review_sha256,
                review.model_id,
                review.revision,
                review.artifact_sha256,
                review.license_spdx,
                review.license_text_sha256,
                review.decision.value,
                review.reviewed_by,
                review.reviewed_at,
                review.evidence_locator,
                review.evidence_sha256,
                list(review.restrictions),
            ),
        )
        if cursor.fetchone() is None:
            raise RuntimeError("license review digest is already bound to different evidence")

    @staticmethod
    def _record_benchmarks(cursor: Any, candidate: ModelAdmissionCandidate) -> None:
        query = """
            INSERT INTO tai_model_benchmark_evidence (
                benchmark_id,
                model_id,
                revision,
                artifact_sha256,
                runtime_class,
                hardware_profile,
                quantization,
                sample_count,
                platform_accuracy_basis_points,
                agro_accuracy_basis_points,
                prompt_tokens_per_second_milli,
                generation_tokens_per_second_milli,
                p95_latency_ms,
                peak_memory_mb,
                estimated_cost_rub_per_million_tokens_milli,
                measured_at,
                evidence_locator,
                evidence_sha256
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (benchmark_id) DO UPDATE
            SET benchmark_id = EXCLUDED.benchmark_id
            WHERE tai_model_benchmark_evidence.model_id = EXCLUDED.model_id
              AND tai_model_benchmark_evidence.revision = EXCLUDED.revision
              AND tai_model_benchmark_evidence.artifact_sha256 = EXCLUDED.artifact_sha256
              AND tai_model_benchmark_evidence.runtime_class = EXCLUDED.runtime_class
              AND tai_model_benchmark_evidence.hardware_profile = EXCLUDED.hardware_profile
              AND tai_model_benchmark_evidence.quantization = EXCLUDED.quantization
              AND tai_model_benchmark_evidence.sample_count = EXCLUDED.sample_count
              AND tai_model_benchmark_evidence.platform_accuracy_basis_points = EXCLUDED.platform_accuracy_basis_points
              AND tai_model_benchmark_evidence.agro_accuracy_basis_points = EXCLUDED.agro_accuracy_basis_points
              AND tai_model_benchmark_evidence.prompt_tokens_per_second_milli = EXCLUDED.prompt_tokens_per_second_milli
              AND tai_model_benchmark_evidence.generation_tokens_per_second_milli = EXCLUDED.generation_tokens_per_second_milli
              AND tai_model_benchmark_evidence.p95_latency_ms = EXCLUDED.p95_latency_ms
              AND tai_model_benchmark_evidence.peak_memory_mb = EXCLUDED.peak_memory_mb
              AND tai_model_benchmark_evidence.estimated_cost_rub_per_million_tokens_milli = EXCLUDED.estimated_cost_rub_per_million_tokens_milli
              AND tai_model_benchmark_evidence.measured_at = EXCLUDED.measured_at
              AND tai_model_benchmark_evidence.evidence_locator = EXCLUDED.evidence_locator
              AND tai_model_benchmark_evidence.evidence_sha256 = EXCLUDED.evidence_sha256
            RETURNING benchmark_id
        """
        for benchmark in candidate.benchmarks:
            cursor.execute(
                query,
                (
                    benchmark.benchmark_id,
                    benchmark.model_id,
                    benchmark.revision,
                    benchmark.artifact_sha256,
                    benchmark.runtime_class.value,
                    benchmark.hardware_profile,
                    benchmark.quantization,
                    benchmark.sample_count,
                    benchmark.platform_accuracy_basis_points,
                    benchmark.agro_accuracy_basis_points,
                    benchmark.prompt_tokens_per_second_milli,
                    benchmark.generation_tokens_per_second_milli,
                    benchmark.p95_latency_ms,
                    benchmark.peak_memory_mb,
                    benchmark.estimated_cost_rub_per_million_tokens_milli,
                    benchmark.measured_at,
                    benchmark.evidence_locator,
                    benchmark.evidence_sha256,
                ),
            )
            if cursor.fetchone() is None:
                raise RuntimeError(
                    "benchmark identity is already bound to different evidence"
                )

    @staticmethod
    def _record_decision(
        cursor: Any,
        candidate: ModelAdmissionCandidate,
        decision: ModelAdmissionDecision,
        review_sha256: str,
    ) -> None:
        query = """
            INSERT INTO tai_model_admission_decisions (
                decision_sha256,
                model_id,
                revision,
                artifact_sha256,
                status,
                reasons,
                fallback_identities,
                license_review_sha256,
                benchmark_evidence_sha256s,
                decided_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (decision_sha256) DO UPDATE
            SET decision_sha256 = EXCLUDED.decision_sha256
            WHERE tai_model_admission_decisions.model_id = EXCLUDED.model_id
              AND tai_model_admission_decisions.revision = EXCLUDED.revision
              AND tai_model_admission_decisions.artifact_sha256 = EXCLUDED.artifact_sha256
              AND tai_model_admission_decisions.status = EXCLUDED.status
              AND tai_model_admission_decisions.reasons = EXCLUDED.reasons
              AND tai_model_admission_decisions.fallback_identities = EXCLUDED.fallback_identities
              AND tai_model_admission_decisions.license_review_sha256 = EXCLUDED.license_review_sha256
              AND tai_model_admission_decisions.benchmark_evidence_sha256s = EXCLUDED.benchmark_evidence_sha256s
              AND tai_model_admission_decisions.decided_at = EXCLUDED.decided_at
            RETURNING decision_sha256
        """
        cursor.execute(
            query,
            (
                decision.decision_sha256,
                decision.model_id,
                decision.revision,
                decision.artifact_sha256,
                decision.status.value,
                list(decision.reasons),
                [list(item) for item in candidate.fallback_identities],
                review_sha256,
                sorted(item.evidence_sha256 for item in candidate.benchmarks),
                decision.decided_at,
            ),
        )
        if cursor.fetchone() is None:
            raise RuntimeError("decision digest is already bound to different evidence")

    def _execute_all(
        self,
        query: str,
        parameters: Sequence[Any],
    ) -> tuple[Mapping[str, Any], ...]:
        with self._connection_factory() as connection:
            try:
                rows: list[Mapping[str, Any]] = []
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    while True:
                        row = cursor.fetchone()
                        if row is None:
                            break
                        rows.append(row)
                connection.commit()
                return tuple(rows)
            except Exception:
                connection.rollback()
                raise


def _license_review_sha256(review: LicenseReviewEvidence) -> str:
    payload = {
        "artifact_sha256": review.artifact_sha256,
        "decision": review.decision.value,
        "evidence_locator": review.evidence_locator,
        "evidence_sha256": review.evidence_sha256,
        "license_spdx": review.license_spdx,
        "license_text_sha256": review.license_text_sha256,
        "model_id": review.model_id,
        "reviewed_at": review.reviewed_at.isoformat(),
        "reviewed_by": review.reviewed_by,
        "revision": review.revision,
        "restrictions": list(review.restrictions),
        "schema_version": "tai.model-license-review.v1",
    }
    canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
