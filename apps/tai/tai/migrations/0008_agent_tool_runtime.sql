BEGIN;

CREATE TABLE IF NOT EXISTS tai_agent_tool_events (
    event_id TEXT PRIMARY KEY CHECK (event_id ~ '^[0-9a-f]{64}$'),
    trace_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    call_id TEXT NOT NULL,
    tool_name TEXT NOT NULL,
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
    idempotency_key TEXT CHECK (
        idempotency_key IS NULL OR idempotency_key ~ '^[0-9a-f]{64}$'
    ),
    reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    event_sha256 TEXT NOT NULL CHECK (event_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_agent_tool_events_trace_idx
    ON tai_agent_tool_events (trace_id, plan_id, occurred_at, call_id);

CREATE INDEX IF NOT EXISTS tai_agent_tool_events_tenant_idx
    ON tai_agent_tool_events (tenant_id, occurred_at DESC, event_id);

CREATE INDEX IF NOT EXISTS tai_agent_tool_events_status_idx
    ON tai_agent_tool_events (status, tool_name, occurred_at DESC);

CREATE TABLE IF NOT EXISTS tai_tool_confirmation_uses (
    confirmation_id UUID PRIMARY KEY,
    call_id TEXT NOT NULL,
    request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    idempotency_key TEXT NOT NULL CHECK (idempotency_key ~ '^[0-9a-f]{64}$'),
    user_id UUID NOT NULL,
    tenant_id UUID,
    session_id UUID NOT NULL,
    used_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_tool_confirmation_uses_identity_idx
    ON tai_tool_confirmation_uses (tenant_id, user_id, session_id, used_at DESC);

COMMIT;
