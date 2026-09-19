from __future__ import annotations

import hashlib
import json
import re
import uuid
from collections.abc import Mapping, Sequence
from datetime import date, datetime
from enum import Enum
from typing import Any

from psycopg.types.json import Jsonb

from tai.knowledge_chunking import KnowledgeChunk
from tai.postgres_loader_state import ConnectionFactory
from tai.public_official_corpus import (
    AuthorityAuditContext,
    PublicArtifactProvenance,
    PublicCorpusSnapshot,
    PublicSourceAdmission,
    QuarantineReason,
    SourceAdmissionStatus,
)
from tai.retrieval_index import RetrievalDocument

_DETAIL_CODE = re.compile(r"^[A-Z0-9_]{3,96}$")
_SHA256 = re.compile(r"^[0-9a-f]{64}$")


def _json_default(value: object) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Enum):
        return str(value.value)
    raise TypeError(f"unsupported canonical audit value: {type(value).__name__}")


def _payload_sha256(payload: Mapping[str, object]) -> str:
    encoded = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        default=_json_default,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _event_sha256(
    *,
    event_type: str,
    audit: AuthorityAuditContext,
    payload_sha256: str,
) -> str:
    canonical = "\n".join(
        [
            "tai.public-corpus.audit.v1",
            event_type,
            audit.actor_id,
            audit.reason_code,
            payload_sha256,
            audit.created_at.isoformat(),
        ]
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class PostgreSQLPublicOfficialCorpusAuthority:
    """Durable authority for AP-14F1A admission, snapshots and withdrawal."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def admit_source(
        self,
        admission: PublicSourceAdmission,
        audit: AuthorityAuditContext,
    ) -> None:
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
        payload = {
            "source_id": admission.source_id,
            "source_class": admission.source_class,
            "rights_decision_id": admission.rights_decision_id,
            "official_uri": admission.official_uri,
            "host_pin": admission.host_pin,
            "rights_review_due_at": admission.rights_review_due_at,
            "admitted_at": admission.admitted_at,
            "trust_score": admission.trust_score,
            "status": admission.status,
        }
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
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
                    )
                    if cursor.fetchone() is None:
                        raise RuntimeError(
                            "source admission conflicts with immutable authority"
                        )
                    self._insert_audit(
                        cursor=cursor,
                        event_type="SOURCE_ADMITTED",
                        audit=audit,
                        payload=payload,
                        source_id=admission.source_id,
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def record_artifact(
        self,
        provenance: PublicArtifactProvenance,
        audit: AuthorityAuditContext,
    ) -> None:
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
        payload = {
            "record_id": provenance.record_id,
            "source_id": provenance.source_id,
            "source_class": provenance.source_class,
            "rights_decision_id": provenance.rights_decision_id,
            "official_uri": provenance.official_uri,
            "host_pin": provenance.host_pin,
            "content_sha256": provenance.content_sha256,
            "media_type": provenance.media_type,
            "size_bytes": provenance.size_bytes,
            "publication_date": provenance.publication_date,
            "effective_date": provenance.effective_date,
            "observed_at": provenance.observed_at,
            "locator_kind": provenance.locator_kind,
            "locator_value": provenance.locator_value,
            "freshness_due_at": provenance.freshness_due_at,
            "unit": provenance.unit,
            "period_start": provenance.period_start,
            "period_end": provenance.period_end,
        }
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
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
                    )
                    if cursor.fetchone() is None:
                        raise RuntimeError(
                            "artifact digest conflicts with immutable provenance"
                        )
                    self._insert_audit(
                        cursor=cursor,
                        event_type="ARTIFACT_ADMITTED",
                        audit=audit,
                        payload=payload,
                        source_id=provenance.source_id,
                        artifact_sha256=provenance.content_sha256,
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def persist_snapshot(
        self,
        snapshot: PublicCorpusSnapshot,
        audit: AuthorityAuditContext,
    ) -> int:
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
        document_by_chunk = {
            item.chunk.chunk_id: item for item in snapshot.retrieval_documents
        }
        payload = {
            "snapshot_sha256": snapshot.snapshot_sha256,
            "created_at": snapshot.created_at,
            "source_ids": list(snapshot.source_ids),
            "artifact_sha256s": list(snapshot.artifact_sha256s),
            "chunks": [
                {
                    "chunk_id": chunk.chunk_id,
                    "artifact_sha256": chunk.document_checksum_sha256,
                    "source_id": chunk.source_id,
                    "ordinal": chunk.ordinal,
                    "text_sha256": hashlib.sha256(
                        chunk.text.encode("utf-8")
                    ).hexdigest(),
                    "token_estimate": chunk.token_estimate,
                    "trust_score": document_by_chunk[chunk.chunk_id].trust_score,
                    "valid_until": document_by_chunk[chunk.chunk_id].valid_until,
                }
                for chunk in snapshot.chunks
            ],
        }
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
                        raise RuntimeError(
                            "snapshot digest conflicts with immutable manifest"
                        )
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
                    self._insert_audit(
                        cursor=cursor,
                        event_type="SNAPSHOT_CREATED",
                        audit=audit,
                        payload=payload,
                        snapshot_id=snapshot_id,
                    )
                connection.commit()
                return snapshot_id
            except Exception:
                connection.rollback()
                raise

    def activate_snapshot(
        self,
        snapshot_id: int,
        audit: AuthorityAuditContext,
    ) -> None:
        if snapshot_id < 1:
            raise ValueError("snapshot_id must be positive")
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT tai_activate_public_corpus_snapshot(%s)",
                        (snapshot_id,),
                    )
                    cursor.fetchone()
                    self._insert_audit(
                        cursor=cursor,
                        event_type="SNAPSHOT_ACTIVATED",
                        audit=audit,
                        payload={"snapshot_id": snapshot_id},
                        snapshot_id=snapshot_id,
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def quarantine(
        self,
        *,
        quarantine_id: uuid.UUID,
        source_id: str,
        artifact_sha256: str | None,
        reason: QuarantineReason,
        detail_code: str,
        audit: AuthorityAuditContext,
    ) -> None:
        normalized_source = source_id.strip()
        normalized_detail = detail_code.strip().upper()
        normalized_artifact = (
            artifact_sha256.strip().lower() if artifact_sha256 is not None else None
        )
        if not normalized_source:
            raise ValueError("quarantine source_id must be non-blank")
        if _DETAIL_CODE.fullmatch(normalized_detail) is None:
            raise ValueError("quarantine detail_code is invalid")
        if normalized_artifact is not None and _SHA256.fullmatch(
            normalized_artifact
        ) is None:
            raise ValueError("quarantine artifact_sha256 is invalid")
        payload = {
            "quarantine_id": str(quarantine_id),
            "source_id": normalized_source,
            "artifact_sha256": normalized_artifact,
            "reason": reason,
            "detail_code": normalized_detail,
            "created_at": audit.created_at,
        }
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO tai_public_corpus_quarantine (
                            quarantine_id, source_id, artifact_sha256,
                            reason_code, detail_code, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (quarantine_id) DO UPDATE
                        SET quarantine_id = EXCLUDED.quarantine_id
                        WHERE tai_public_corpus_quarantine.source_id = EXCLUDED.source_id
                          AND tai_public_corpus_quarantine.artifact_sha256 IS NOT DISTINCT FROM
                              EXCLUDED.artifact_sha256
                          AND tai_public_corpus_quarantine.reason_code = EXCLUDED.reason_code
                          AND tai_public_corpus_quarantine.detail_code = EXCLUDED.detail_code
                          AND tai_public_corpus_quarantine.created_at = EXCLUDED.created_at
                          AND tai_public_corpus_quarantine.released_at IS NULL
                        RETURNING quarantine_id
                        """,
                        (
                            quarantine_id,
                            normalized_source,
                            normalized_artifact,
                            reason.value,
                            normalized_detail,
                            audit.created_at,
                        ),
                    )
                    if cursor.fetchone() is None:
                        raise RuntimeError(
                            "quarantine identity conflicts with immutable evidence"
                        )
                    self._insert_audit(
                        cursor=cursor,
                        event_type="ARTIFACT_QUARANTINED",
                        audit=audit,
                        payload=payload,
                        source_id=normalized_source,
                        artifact_sha256=normalized_artifact,
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def release_quarantine(
        self,
        *,
        quarantine_id: uuid.UUID,
        audit: AuthorityAuditContext,
    ) -> None:
        payload = {"quarantine_id": str(quarantine_id)}
        event_sha, _ = self._audit_digests(
            event_type="QUARANTINE_RELEASED",
            audit=audit,
            payload=payload,
        )
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        UPDATE tai_public_corpus_quarantine
                        SET released_at = %s,
                            release_actor_id = %s,
                            release_audit_sha256 = %s
                        WHERE quarantine_id = %s
                          AND released_at IS NULL
                        RETURNING source_id, artifact_sha256
                        """,
                        (
                            audit.created_at,
                            audit.actor_id,
                            event_sha,
                            quarantine_id,
                        ),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        raise RuntimeError(
                            "open quarantine record not found or already released"
                        )
                    self._insert_audit(
                        cursor=cursor,
                        event_type="QUARANTINE_RELEASED",
                        audit=audit,
                        payload=payload,
                        source_id=str(row["source_id"]),
                        artifact_sha256=(
                            str(row["artifact_sha256"])
                            if row["artifact_sha256"] is not None
                            else None
                        ),
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def withdraw_source(
        self,
        *,
        source_id: str,
        audit: AuthorityAuditContext,
    ) -> None:
        normalized_source = source_id.strip()
        if not normalized_source:
            raise ValueError("withdrawal source_id must be non-blank")
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        "SELECT tai_withdraw_public_corpus_source(%s, %s, %s, %s)",
                        (
                            normalized_source,
                            audit.actor_id,
                            audit.reason_code,
                            audit.created_at,
                        ),
                    )
                    cursor.fetchone()
                    self._insert_audit(
                        cursor=cursor,
                        event_type="SOURCE_WITHDRAWN",
                        audit=audit,
                        payload={"source_id": normalized_source},
                        source_id=normalized_source,
                    )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

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

    def _insert_audit(
        self,
        *,
        cursor: Any,
        event_type: str,
        audit: AuthorityAuditContext,
        payload: Mapping[str, object],
        source_id: str | None = None,
        artifact_sha256: str | None = None,
        snapshot_id: int | None = None,
    ) -> str:
        event_sha, payload_sha = self._audit_digests(
            event_type=event_type,
            audit=audit,
            payload=payload,
        )
        cursor.execute(
            """
            INSERT INTO tai_public_corpus_audit (
                event_sha256, event_type, source_id, artifact_sha256,
                snapshot_id, actor_id, reason_code, payload_sha256, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (event_sha256) DO UPDATE
            SET event_sha256 = EXCLUDED.event_sha256
            WHERE tai_public_corpus_audit.event_type = EXCLUDED.event_type
              AND tai_public_corpus_audit.source_id IS NOT DISTINCT FROM
                  EXCLUDED.source_id
              AND tai_public_corpus_audit.artifact_sha256 IS NOT DISTINCT FROM
                  EXCLUDED.artifact_sha256
              AND tai_public_corpus_audit.snapshot_id IS NOT DISTINCT FROM
                  EXCLUDED.snapshot_id
              AND tai_public_corpus_audit.actor_id = EXCLUDED.actor_id
              AND tai_public_corpus_audit.reason_code = EXCLUDED.reason_code
              AND tai_public_corpus_audit.payload_sha256 = EXCLUDED.payload_sha256
              AND tai_public_corpus_audit.created_at = EXCLUDED.created_at
            RETURNING event_sha256
            """,
            (
                event_sha,
                event_type,
                source_id,
                artifact_sha256,
                snapshot_id,
                audit.actor_id,
                audit.reason_code,
                payload_sha,
                audit.created_at,
            ),
        )
        if cursor.fetchone() is None:
            raise RuntimeError("audit event conflicts with immutable authority")
        return event_sha

    @staticmethod
    def _audit_digests(
        *,
        event_type: str,
        audit: AuthorityAuditContext,
        payload: Mapping[str, object],
    ) -> tuple[str, str]:
        payload_sha = _payload_sha256(payload)
        return (
            _event_sha256(
                event_type=event_type,
                audit=audit,
                payload_sha256=payload_sha,
            ),
            payload_sha,
        )

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
