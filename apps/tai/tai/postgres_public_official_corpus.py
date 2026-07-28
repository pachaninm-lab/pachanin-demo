from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from psycopg.types.json import Jsonb

from tai.knowledge_chunking import KnowledgeChunk
from tai.postgres_loader_state import ConnectionFactory
from tai.public_official_corpus import (
    PublicArtifactProvenance,
    PublicCorpusSnapshot,
    PublicSourceAdmission,
    SourceAdmissionStatus,
)
from tai.retrieval_index import RetrievalDocument


class PostgreSQLPublicOfficialCorpusAuthority:
    """Durable authority for AP-14F1A admission, snapshots and withdrawal."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def admit_source(self, admission: PublicSourceAdmission) -> None:
        if admission.status is not SourceAdmissionStatus.ADMITTED:
            raise ValueError("only an ADMITTED source may enter the corpus authority")
        query = """
            INSERT INTO tai_public_corpus_source_admissions (
                source_id, data_plane, source_class, rights_decision_id,
                official_uri, host_pin, rights_review_due_at, admitted_at,
                trust_score, status
            ) VALUES (%s, 'PUBLIC_OFFICIAL', %s, %s, %s, %s, %s, %s, %s, 'ADMITTED')
            ON CONFLICT (source_id) DO UPDATE
            SET source_id = EXCLUDED.source_id
            WHERE tai_public_corpus_source_admissions.data_plane = EXCLUDED.data_plane
              AND tai_public_corpus_source_admissions.source_class = EXCLUDED.source_class
              AND tai_public_corpus_source_admissions.rights_decision_id =
                  EXCLUDED.rights_decision_id
              AND tai_public_corpus_source_admissions.official_uri = EXCLUDED.official_uri
              AND tai_public_corpus_source_admissions.host_pin = EXCLUDED.host_pin
              AND tai_public_corpus_source_admissions.rights_review_due_at =
                  EXCLUDED.rights_review_due_at
              AND tai_public_corpus_source_admissions.admitted_at = EXCLUDED.admitted_at
              AND tai_public_corpus_source_admissions.trust_score = EXCLUDED.trust_score
              AND tai_public_corpus_source_admissions.status = 'ADMITTED'
              AND tai_public_corpus_source_admissions.withdrawn_at IS NULL
              AND tai_public_corpus_source_admissions.withdrawal_reason IS NULL
            RETURNING source_id
        """
        self._execute_required_returning(
            query,
            (
                admission.source_id,
                admission.source_class.value,
                admission.rights_decision_id,
                admission.official_uri,
                admission.host_pin,
                admission.rights_review_due_at,
                admission.admitted_at,
                admission.trust_score,
            ),
            "source admission conflicts with immutable authority",
        )

    def record_artifact(self, provenance: PublicArtifactProvenance) -> None:
        query = """
            INSERT INTO tai_public_corpus_artifacts (
                artifact_sha256, record_id, source_id, source_class,
                rights_decision_id, official_uri, host_pin, media_type,
                size_bytes, publication_date, effective_date, observed_at,
                locator_kind, locator_value, freshness_due_at, unit,
                period_start, period_end, status
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, 'ADMITTED'
            )
            ON CONFLICT (artifact_sha256) DO UPDATE
            SET artifact_sha256 = EXCLUDED.artifact_sha256
            WHERE tai_public_corpus_artifacts.record_id = EXCLUDED.record_id
              AND tai_public_corpus_artifacts.source_id = EXCLUDED.source_id
              AND tai_public_corpus_artifacts.source_class = EXCLUDED.source_class
              AND tai_public_corpus_artifacts.rights_decision_id = EXCLUDED.rights_decision_id
              AND tai_public_corpus_artifacts.official_uri = EXCLUDED.official_uri
              AND tai_public_corpus_artifacts.host_pin = EXCLUDED.host_pin
              AND tai_public_corpus_artifacts.media_type = EXCLUDED.media_type
              AND tai_public_corpus_artifacts.size_bytes = EXCLUDED.size_bytes
              AND tai_public_corpus_artifacts.publication_date IS NOT DISTINCT FROM
                  EXCLUDED.publication_date
              AND tai_public_corpus_artifacts.effective_date IS NOT DISTINCT FROM
                  EXCLUDED.effective_date
              AND tai_public_corpus_artifacts.observed_at = EXCLUDED.observed_at
              AND tai_public_corpus_artifacts.locator_kind = EXCLUDED.locator_kind
              AND tai_public_corpus_artifacts.locator_value = EXCLUDED.locator_value
              AND tai_public_corpus_artifacts.freshness_due_at = EXCLUDED.freshness_due_at
              AND tai_public_corpus_artifacts.unit IS NOT DISTINCT FROM EXCLUDED.unit
              AND tai_public_corpus_artifacts.period_start IS NOT DISTINCT FROM
                  EXCLUDED.period_start
              AND tai_public_corpus_artifacts.period_end IS NOT DISTINCT FROM EXCLUDED.period_end
              AND tai_public_corpus_artifacts.status = 'ADMITTED'
            RETURNING artifact_sha256
        """
        self._execute_required_returning(
            query,
            (
                provenance.content_sha256,
                provenance.record_id,
                provenance.source_id,
                provenance.source_class.value,
                provenance.rights_decision_id,
                provenance.official_uri,
                provenance.host_pin,
                provenance.media_type,
                provenance.size_bytes,
                provenance.publication_date,
                provenance.effective_date,
                provenance.observed_at,
                provenance.locator_kind.value,
                provenance.locator_value,
                provenance.freshness_due_at,
                provenance.unit,
                provenance.period_start,
                provenance.period_end,
            ),
            "artifact digest conflicts with immutable provenance",
        )

    def persist_snapshot(self, snapshot: PublicCorpusSnapshot) -> int:
        insert_snapshot = """
            INSERT INTO tai_public_corpus_snapshots (
                snapshot_sha256, status, created_at, source_ids, artifact_sha256s
            ) VALUES (%s, 'BUILDING', %s, %s, %s)
            ON CONFLICT (snapshot_sha256) DO UPDATE
            SET snapshot_sha256 = EXCLUDED.snapshot_sha256
            WHERE tai_public_corpus_snapshots.status = 'BUILDING'
              AND tai_public_corpus_snapshots.created_at = EXCLUDED.created_at
              AND tai_public_corpus_snapshots.source_ids = EXCLUDED.source_ids
              AND tai_public_corpus_snapshots.artifact_sha256s = EXCLUDED.artifact_sha256s
            RETURNING snapshot_id
        """
        lock_snapshot = """
            SELECT status
            FROM tai_public_corpus_snapshots
            WHERE snapshot_id = %s
            FOR UPDATE
        """
        insert_chunk = """
            INSERT INTO tai_public_corpus_chunks (
                snapshot_id, chunk_id, artifact_sha256, source_id, ordinal,
                chunk_text, token_estimate, trust_score, valid_until
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (snapshot_id, chunk_id) DO UPDATE
            SET chunk_id = EXCLUDED.chunk_id
            WHERE tai_public_corpus_chunks.artifact_sha256 = EXCLUDED.artifact_sha256
              AND tai_public_corpus_chunks.source_id = EXCLUDED.source_id
              AND tai_public_corpus_chunks.ordinal = EXCLUDED.ordinal
              AND tai_public_corpus_chunks.chunk_text = EXCLUDED.chunk_text
              AND tai_public_corpus_chunks.token_estimate = EXCLUDED.token_estimate
              AND tai_public_corpus_chunks.trust_score = EXCLUDED.trust_score
              AND tai_public_corpus_chunks.valid_until = EXCLUDED.valid_until
            RETURNING chunk_id
        """
        document_by_chunk = {item.chunk.chunk_id: item for item in snapshot.retrieval_documents}
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        insert_snapshot,
                        (
                            snapshot.snapshot_sha256,
                            snapshot.created_at,
                            Jsonb(list(snapshot.source_ids)),
                            Jsonb(list(snapshot.artifact_sha256s)),
                        ),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        raise RuntimeError("snapshot digest conflicts with immutable manifest")
                    snapshot_id = int(row["snapshot_id"])
                    cursor.execute(lock_snapshot, (snapshot_id,))
                    status = cursor.fetchone()
                    if status is None or str(status["status"]) != "BUILDING":
                        raise RuntimeError(
                            "snapshot must remain BUILDING while chunks are inserted"
                        )
                    for chunk in snapshot.chunks:
                        document = document_by_chunk[chunk.chunk_id]
                        cursor.execute(
                            insert_chunk,
                            (
                                snapshot_id,
                                chunk.chunk_id,
                                chunk.document_checksum_sha256,
                                chunk.source_id,
                                chunk.ordinal,
                                chunk.text,
                                chunk.token_estimate,
                                document.trust_score,
                                document.valid_until,
                            ),
                        )
                        if cursor.fetchone() is None:
                            raise RuntimeError(
                                "chunk identity conflicts with immutable artifact binding"
                            )
                connection.commit()
                return snapshot_id
            except Exception:
                connection.rollback()
                raise

    def activate_snapshot(self, snapshot_id: int) -> None:
        if snapshot_id < 1:
            raise ValueError("snapshot_id must be positive")
        self._execute("SELECT tai_activate_public_corpus_snapshot(%s)", (snapshot_id,))

    def withdraw_source(
        self,
        *,
        source_id: str,
        actor_id: str,
        reason: str,
        withdrawn_at: datetime,
    ) -> None:
        if not source_id.strip() or not actor_id.strip() or not reason.strip():
            raise ValueError("withdrawal source, actor and reason must be non-blank")
        self._execute(
            "SELECT tai_withdraw_public_corpus_source(%s, %s, %s, %s)",
            (source_id.strip(), actor_id.strip(), reason.strip(), withdrawn_at),
        )

    def active_documents(self, *, now: datetime) -> tuple[RetrievalDocument, ...]:
        query = """
            SELECT chunk_id, source_id, artifact_sha256, ordinal, chunk_text,
                   token_estimate, trust_score, valid_until
            FROM tai_active_public_corpus_chunks_v1
            WHERE valid_until > %s
            ORDER BY chunk_id
        """
        rows = self._execute_all(query, (now,))
        documents: list[RetrievalDocument] = []
        for row in rows:
            chunk = KnowledgeChunk(
                chunk_id=str(row["chunk_id"]),
                source_id=str(row["source_id"]),
                document_checksum_sha256=str(row["artifact_sha256"]),
                ordinal=int(row["ordinal"]),
                text=str(row["chunk_text"]),
                token_estimate=int(row["token_estimate"]),
            )
            documents.append(
                RetrievalDocument(
                    chunk=chunk,
                    tenant_id=None,
                    trust_score=float(row["trust_score"]),
                    valid_until=row["valid_until"],
                    revoked=False,
                )
            )
        return tuple(documents)

    def _execute(self, query: str, parameters: Sequence[Any]) -> None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def _execute_required_returning(
        self,
        query: str,
        parameters: Sequence[Any],
        conflict_message: str,
    ) -> Mapping[str, Any]:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    row = cursor.fetchone()
                    if row is None:
                        raise RuntimeError(conflict_message)
                connection.commit()
                return row
            except Exception:
                connection.rollback()
                raise

    def _execute_all(
        self,
        query: str,
        parameters: Sequence[Any],
    ) -> tuple[Mapping[str, Any], ...]:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    rows: list[Mapping[str, Any]] = []
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
