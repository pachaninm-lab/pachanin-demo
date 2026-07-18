BEGIN;

CREATE TABLE IF NOT EXISTS tai_tool_confirmation_uses (
    confirmation_id UUID PRIMARY KEY,
    call_id TEXT NOT NULL CHECK (call_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    idempotency_key TEXT NOT NULL CHECK (length(idempotency_key) BETWEEN 16 AND 160),
    user_id UUID NOT NULL,
    tenant_id UUID,
    session_id UUID NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > issued_at),
    used_at TIMESTAMPTZ NOT NULL CHECK (used_at >= issued_at),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_tool_confirmation_uses_identity_idx
    ON tai_tool_confirmation_uses (tenant_id, user_id, session_id, used_at DESC);

CREATE INDEX IF NOT EXISTS tai_tool_confirmation_uses_expiry_idx
    ON tai_tool_confirmation_uses (expires_at);

CREATE TABLE IF NOT EXISTS tai_agent_audit_events (
    event_id TEXT PRIMARY KEY CHECK (event_id ~ '^[0-9a-f]{64}$'),
    trace_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    call_id TEXT NOT NULL CHECK (call_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
    tool_name TEXT NOT NULL CHECK (tool_name ~ '^[A-Za-z0-9._:-]{1,128}$'),
    mode TEXT NOT NULL CHECK (
        mode IN ('READ_ONLY', 'DRAFT', 'CONFIRMED_WRITE', 'PRIVILEGED_WRITE')
    ),
    status TEXT NOT NULL CHECK (status IN ('SUCCEEDED', 'DENIED', 'FAILED')),
    user_id UUID NOT NULL,
    tenant_id UUID,
    session_id UUID NOT NULL,
    request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    result_sha256 TEXT CHECK (
        result_sha256 IS NULL OR result_sha256 ~ '^[0-9a-f]{64}$'
    ),
    idempotency_key TEXT,
    reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    event_sha256 TEXT NOT NULL UNIQUE CHECK (event_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_agent_audit_events_trace_idx
    ON tai_agent_audit_events (trace_id, occurred_at, call_id);

CREATE INDEX IF NOT EXISTS tai_agent_audit_events_identity_idx
    ON tai_agent_audit_events (tenant_id, user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS tai_agent_audit_events_failures_idx
    ON tai_agent_audit_events (status, occurred_at DESC)
    WHERE status IN ('DENIED', 'FAILED');

COMMIT;
