from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from tai.knowledge_chunking import KnowledgeChunk
from tai.postgres_loader_state import ConnectionFactory
from tai.retrieval_index import IndexedChunk, RetrievalDocument


class PostgreSQLRetrievalIndexRepository:
    """Durable retrieval authority with transactional generation activation."""

    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def begin_generation(self) -> int:
        query = """
            INSERT INTO tai_retrieval_generations (status)
            VALUES ('BUILDING')
            RETURNING generation
        """
        row = self._execute_returning(query, ())
        if row is None:
            raise RuntimeError("retrieval generation insert returned no row")
        return int(row["generation"])

    def add(self, generation: int, documents: tuple[RetrievalDocument, ...]) -> None:
        if generation < 1:
            raise ValueError("generation must be positive")
        if not documents:
            return
        status_query = """
            SELECT status
            FROM tai_retrieval_generations
            WHERE generation = %s
            FOR UPDATE
        """
        insert_query = """
            INSERT INTO tai_retrieval_chunks (
                generation,
                chunk_id,
                source_id,
                document_checksum_sha256,
                ordinal,
                tenant_id,
                trust_score,
                valid_until,
                revoked,
                chunk_text
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (generation, chunk_id) DO UPDATE
            SET tenant_id = EXCLUDED.tenant_id,
                trust_score = EXCLUDED.trust_score,
                valid_until = EXCLUDED.valid_until,
                revoked = EXCLUDED.revoked,
                chunk_text = EXCLUDED.chunk_text
            WHERE tai_retrieval_chunks.source_id = EXCLUDED.source_id
              AND tai_retrieval_chunks.document_checksum_sha256 = EXCLUDED.document_checksum_sha256
              AND tai_retrieval_chunks.ordinal = EXCLUDED.ordinal
        """
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(status_query, (generation,))
                    row = cursor.fetchone()
                    if row is None or str(row["status"]) != "BUILDING":
                        raise RuntimeError(
                            "documents can only be added to a building generation"
                        )
                    for document in documents:
                        chunk = document.chunk
                        cursor.execute(
                            insert_query,
                            (
                                generation,
                                chunk.chunk_id,
                                chunk.source_id,
                                chunk.document_checksum_sha256,
                                chunk.ordinal,
                                document.tenant_id,
                                document.trust_score,
                                document.valid_until,
                                document.revoked,
                                chunk.text,
                            ),
                        )
                connection.commit()
            except Exception:
                connection.rollback()
                raise

    def activate(self, generation: int) -> None:
        if generation < 1:
            raise ValueError("generation must be positive")
        self._execute("SELECT tai_activate_retrieval_generation(%s)", (generation,))

    def active_documents(self) -> tuple[IndexedChunk, ...]:
        query = """
            SELECT
                c.generation,
                c.chunk_id,
                c.source_id,
                c.document_checksum_sha256,
                c.ordinal,
                c.tenant_id,
                c.trust_score,
                c.valid_until,
                c.revoked,
                c.chunk_text,
                regexp_split_to_array(
                    trim(regexp_replace(lower(c.chunk_text), '[^0-9a-zа-яё]+', ' ', 'g')),
                    '\\s+'
                ) AS terms
            FROM tai_retrieval_chunks c
            JOIN tai_retrieval_generations g
              ON g.generation = c.generation
             AND g.status = 'ACTIVE'
            ORDER BY c.chunk_id
        """
        rows = self._execute_all(query, ())
        results: list[IndexedChunk] = []
        for row in rows:
            raw_terms = row.get("terms") or []
            frequencies: dict[str, int] = {}
            for raw_term in raw_terms:
                term = str(raw_term).strip()
                if term:
                    frequencies[term] = frequencies.get(term, 0) + 1
            chunk = KnowledgeChunk(
                chunk_id=str(row["chunk_id"]),
                source_id=str(row["source_id"]),
                document_checksum_sha256=str(row["document_checksum_sha256"]),
                ordinal=int(row["ordinal"]),
                text=str(row["chunk_text"]),
                token_estimate=max(1, (len(str(row["chunk_text"])) + 3) // 4),
            )
            results.append(
                IndexedChunk(
                    generation=int(row["generation"]),
                    document=RetrievalDocument(
                        chunk=chunk,
                        tenant_id=(
                            None if row["tenant_id"] is None else str(row["tenant_id"])
                        ),
                        trust_score=float(row["trust_score"]),
                        valid_until=row["valid_until"],
                        revoked=bool(row["revoked"]),
                    ),
                    term_frequencies=tuple(sorted(frequencies.items())),
                    document_length=sum(frequencies.values()),
                )
            )
        return tuple(results)

    def _execute(self, query: str, parameters: Sequence[Any]) -> None:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                connection.commit()
            except Exception:
                connection.rollback()
                raise

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

    def _execute_all(
        self,
        query: str,
        parameters: Sequence[Any],
    ) -> tuple[Mapping[str, Any], ...]:
        with self._connection_factory() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(query, parameters)
                    rows = tuple(cursor.fetchall())
                connection.commit()
                return rows
            except Exception:
                connection.rollback()
                raise
