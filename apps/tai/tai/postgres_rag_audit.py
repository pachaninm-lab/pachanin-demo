from __future__ import annotations

import hashlib
import json
from collections.abc import Mapping, Sequence
from typing import Any

from tai.postgres_loader_state import ConnectionFactory
from tai.rag_pipeline import GroundedAnswerTrace


class PostgreSQLGroundedAnswerAuditSink:
    """Immutable and idempotent PostgreSQL authority for grounded-answer traces."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def record(self, trace: GroundedAnswerTrace) -> None:
        trace_sha256 = _trace_sha256(trace)
        query = """
            INSERT INTO tai_rag_traces (
                request_id,
                tenant_id,
                status,
                model_id,
                model_revision,
                model_route_id,
                model_attempts,
                model_invoked,
                generation,
                query_sha256,
                context_sha256,
                answer_sha256,
                chunk_ids,
                source_ids,
                citations,
                reason,
                completed_at,
                trace_sha256
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (request_id) DO UPDATE
            SET request_id = EXCLUDED.request_id
            WHERE tai_rag_traces.trace_sha256 = EXCLUDED.trace_sha256
            RETURNING request_id, trace_sha256
        """
        row = self._execute_returning(
            query,
            (
                trace.request_id,
                trace.tenant_id,
                trace.status.value,
                trace.model_id,
                trace.model_revision,
                trace.model_route_id,
                _attempts_payload(trace),
                trace.model_invoked,
                trace.generation,
                trace.query_sha256,
                trace.context_sha256,
                trace.answer_sha256,
                list(trace.chunk_ids),
                list(trace.source_ids),
                list(trace.citations),
                trace.reason,
                trace.completed_at,
                trace_sha256,
            ),
        )
        if row is None:
            raise RuntimeError("request_id is already bound to a different RAG trace")
        if str(row["trace_sha256"]) != trace_sha256:
            raise RuntimeError("persisted RAG trace digest does not match the request")

    def _execute_returning(
        self,
        query: str,
        parameters: Sequence[Any],
    ) -> Mapping[str, Any] | None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    row = cursor.fetchone()
                connection.commit()
                return row
            except Exception:
                connection.rollback()
                raise


def _attempts_payload(trace: GroundedAnswerTrace) -> list[dict[str, str | None]]:
    return [
        {
            "model_id": attempt.model_id,
            "reason": attempt.reason,
            "revision": attempt.revision,
            "status": attempt.status.value,
        }
        for attempt in trace.model_attempts
    ]


def _trace_sha256(trace: GroundedAnswerTrace) -> str:
    payload = {
        "answer_sha256": trace.answer_sha256,
        "chunk_ids": list(trace.chunk_ids),
        "citations": list(trace.citations),
        "completed_at": trace.completed_at.isoformat(),
        "context_sha256": trace.context_sha256,
        "generation": trace.generation,
        "model_attempts": _attempts_payload(trace),
        "model_id": trace.model_id,
        "model_invoked": trace.model_invoked,
        "model_revision": trace.model_revision,
        "model_route_id": trace.model_route_id,
        "query_sha256": trace.query_sha256,
        "reason": trace.reason,
        "request_id": trace.request_id,
        "source_ids": list(trace.source_ids),
        "status": trace.status.value,
        "tenant_id": trace.tenant_id,
    }
    canonical = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    )
    return hashlib.sha256(canonical.encode()).hexdigest()
