BEGIN;

CREATE TABLE IF NOT EXISTS tai_rag_traces (
    request_id TEXT PRIMARY KEY,
    tenant_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('ANSWERED', 'ABSTAINED', 'REJECTED')),
    model_id TEXT NOT NULL,
    model_invoked BOOLEAN NOT NULL,
    generation BIGINT,
    query_sha256 TEXT NOT NULL CHECK (query_sha256 ~ '^[0-9a-f]{64}$'),
    context_sha256 TEXT NOT NULL CHECK (context_sha256 ~ '^[0-9a-f]{64}$'),
    answer_sha256 TEXT CHECK (
        answer_sha256 IS NULL OR answer_sha256 ~ '^[0-9a-f]{64}$'
    ),
    chunk_ids TEXT[] NOT NULL,
    source_ids TEXT[] NOT NULL,
    citations TEXT[] NOT NULL,
    reason TEXT,
    completed_at TIMESTAMPTZ NOT NULL,
    trace_sha256 TEXT NOT NULL CHECK (trace_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_rag_traces_tenant_completed_idx
    ON tai_rag_traces (tenant_id, completed_at DESC, request_id);

CREATE INDEX IF NOT EXISTS tai_rag_traces_generation_idx
    ON tai_rag_traces (generation, completed_at DESC)
    WHERE generation IS NOT NULL;

COMMIT;
