BEGIN;

CREATE TABLE IF NOT EXISTS tai_orchestration_idempotency (
    scope_sha256 TEXT PRIMARY KEY CHECK (scope_sha256 ~ '^[0-9a-f]{64}$'),
    request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'COMPLETED')),
    response_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        (status = 'IN_PROGRESS' AND response_payload IS NULL)
        OR
        (status = 'COMPLETED' AND jsonb_typeof(response_payload) = 'object')
    )
);

CREATE INDEX IF NOT EXISTS tai_orchestration_idempotency_status_idx
    ON tai_orchestration_idempotency (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS tai_prepared_actions (
    confirmation_id UUID PRIMARY KEY,
    trace_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    call_id TEXT NOT NULL CHECK (call_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    user_id UUID NOT NULL,
    tenant_id UUID,
    session_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PREPARED', 'EXECUTING', 'COMPLETED')),
    prepared_payload JSONB NOT NULL CHECK (jsonb_typeof(prepared_payload) = 'object'),
    result_payload JSONB CHECK (
        result_payload IS NULL OR jsonb_typeof(result_payload) = 'object'
    ),
    execution_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        (status = 'PREPARED' AND result_payload IS NULL AND completed_at IS NULL)
        OR
        (status = 'EXECUTING' AND result_payload IS NULL AND execution_started_at IS NOT NULL)
        OR
        (status = 'COMPLETED' AND result_payload IS NOT NULL AND completed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS tai_prepared_actions_identity_idx
    ON tai_prepared_actions (tenant_id, user_id, session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tai_prepared_actions_status_idx
    ON tai_prepared_actions (status, expires_at, updated_at);

CREATE UNIQUE INDEX IF NOT EXISTS tai_prepared_actions_request_idx
    ON tai_prepared_actions (request_sha256, confirmation_id);

COMMIT;
