BEGIN;

CREATE TABLE IF NOT EXISTS tai_orchestration_traces (
    trace_id UUID PRIMARY KEY,
    request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 160),
    tenant_id UUID,
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    request_sha256 TEXT NOT NULL CHECK (request_sha256 ~ '^[0-9a-f]{64}$'),
    status TEXT NOT NULL CHECK (
        status IN ('ANSWERED', 'PARTIAL', 'ABSTAINED', 'REJECTED', 'TIMED_OUT', 'CANCELLED')
    ),
    rag_status TEXT NOT NULL CHECK (rag_status IN ('ANSWERED', 'ABSTAINED', 'REJECTED')),
    model_id TEXT NOT NULL CHECK (length(model_id) BETWEEN 1 AND 160),
    model_revision TEXT,
    model_route_id TEXT,
    generation BIGINT,
    source_ids JSONB NOT NULL CHECK (jsonb_typeof(source_ids) = 'array'),
    citations JSONB NOT NULL CHECK (jsonb_typeof(citations) = 'array'),
    tool_plan_sha256 TEXT CHECK (
        tool_plan_sha256 IS NULL OR tool_plan_sha256 ~ '^[0-9a-f]{64}$'
    ),
    tool_status TEXT CHECK (
        tool_status IS NULL OR tool_status IN ('COMPLETED', 'PARTIAL', 'DENIED', 'FAILED')
    ),
    prepared_action_count INTEGER NOT NULL CHECK (prepared_action_count >= 0),
    reason TEXT,
    completed_at TIMESTAMPTZ NOT NULL,
    trace_sha256 TEXT NOT NULL UNIQUE CHECK (trace_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_orchestration_traces_request_idx
    ON tai_orchestration_traces (request_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS tai_orchestration_traces_tenant_idx
    ON tai_orchestration_traces (tenant_id, completed_at DESC);

CREATE TABLE IF NOT EXISTS tai_runtime_evaluation_observations (
    trace_id UUID PRIMARY KEY REFERENCES tai_orchestration_traces(trace_id) ON DELETE RESTRICT,
    request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 160),
    status TEXT NOT NULL CHECK (
        status IN ('ANSWERED', 'PARTIAL', 'ABSTAINED', 'REJECTED', 'TIMED_OUT', 'CANCELLED')
    ),
    tenant_id UUID,
    source_ids JSONB NOT NULL CHECK (jsonb_typeof(source_ids) = 'array'),
    citations JSONB NOT NULL CHECK (jsonb_typeof(citations) = 'array'),
    model_invoked BOOLEAN NOT NULL,
    tool_modes JSONB NOT NULL CHECK (jsonb_typeof(tool_modes) = 'array'),
    tool_status TEXT CHECK (
        tool_status IS NULL OR tool_status IN ('COMPLETED', 'PARTIAL', 'DENIED', 'FAILED')
    ),
    reason TEXT,
    trace_sha256 TEXT NOT NULL CHECK (trace_sha256 ~ '^[0-9a-f]{64}$'),
    observed_at TIMESTAMPTZ NOT NULL,
    observation_sha256 TEXT NOT NULL UNIQUE CHECK (observation_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS tai_runtime_evaluation_observations_status_idx
    ON tai_runtime_evaluation_observations (status, observed_at DESC);
CREATE INDEX IF NOT EXISTS tai_runtime_evaluation_observations_tenant_idx
    ON tai_runtime_evaluation_observations (tenant_id, observed_at DESC);

COMMIT;
