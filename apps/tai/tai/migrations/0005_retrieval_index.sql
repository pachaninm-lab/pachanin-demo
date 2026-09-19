BEGIN;

CREATE TABLE IF NOT EXISTS tai_retrieval_generations (
    generation BIGSERIAL PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('BUILDING', 'ACTIVE', 'RETIRED', 'FAILED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    activated_at TIMESTAMPTZ,
    retired_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS tai_retrieval_one_active_generation
    ON tai_retrieval_generations ((status))
    WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS tai_retrieval_chunks (
    generation BIGINT NOT NULL REFERENCES tai_retrieval_generations(generation) ON DELETE RESTRICT,
    chunk_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    document_checksum_sha256 TEXT NOT NULL,
    ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
    tenant_id TEXT,
    trust_score DOUBLE PRECISION NOT NULL CHECK (trust_score >= 0 AND trust_score <= 1),
    valid_until TIMESTAMPTZ,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    chunk_text TEXT NOT NULL,
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(chunk_text, ''))
    ) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (generation, chunk_id),
    UNIQUE (generation, source_id, document_checksum_sha256, ordinal)
);

CREATE INDEX IF NOT EXISTS tai_retrieval_chunks_search_idx
    ON tai_retrieval_chunks USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS tai_retrieval_chunks_authority_idx
    ON tai_retrieval_chunks (generation, tenant_id, revoked, valid_until, trust_score);

CREATE OR REPLACE FUNCTION tai_activate_retrieval_generation(target_generation BIGINT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM tai_retrieval_generations
        WHERE generation = target_generation
          AND status = 'BUILDING'
        FOR UPDATE
    ) THEN
        RAISE EXCEPTION 'retrieval generation is not BUILDING';
    END IF;

    UPDATE tai_retrieval_generations
    SET status = 'RETIRED',
        retired_at = clock_timestamp(),
        version = version + 1
    WHERE status = 'ACTIVE';

    UPDATE tai_retrieval_generations
    SET status = 'ACTIVE',
        activated_at = clock_timestamp(),
        version = version + 1
    WHERE generation = target_generation
      AND status = 'BUILDING';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'retrieval generation activation lost compare-and-swap';
    END IF;
END;
$$;

COMMIT;
