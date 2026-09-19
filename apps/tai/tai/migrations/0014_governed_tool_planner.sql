BEGIN;

CREATE TABLE IF NOT EXISTS tai_tool_planner_decisions (
    trace_id UUID PRIMARY KEY,
    plan_id UUID NOT NULL UNIQUE,
    request_id TEXT NOT NULL CHECK (length(request_id) BETWEEN 1 AND 160),
    tenant_id UUID,
    user_id UUID NOT NULL,
    session_id UUID NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SELECTED', 'NO_MATCH', 'REJECTED')),
    catalog_version TEXT NOT NULL CHECK (catalog_version = 'tai.tool-catalog.safe.v1'),
    input_sha256 TEXT NOT NULL CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
    selected_calls JSONB NOT NULL CHECK (jsonb_typeof(selected_calls) = 'array'),
    reason_codes JSONB NOT NULL CHECK (jsonb_typeof(reason_codes) = 'array'),
    rejection_signals JSONB NOT NULL CHECK (jsonb_typeof(rejection_signals) = 'array'),
    generated_at TIMESTAMPTZ NOT NULL,
    decision_sha256 TEXT NOT NULL UNIQUE CHECK (decision_sha256 ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (
        (status = 'SELECTED' AND jsonb_array_length(selected_calls) = 1)
        OR (status <> 'SELECTED' AND jsonb_array_length(selected_calls) = 0)
    ),
    CHECK (jsonb_array_length(reason_codes) >= 1)
);

CREATE INDEX IF NOT EXISTS tai_tool_planner_decisions_tenant_idx
    ON tai_tool_planner_decisions (tenant_id, generated_at DESC, trace_id);
CREATE INDEX IF NOT EXISTS tai_tool_planner_decisions_status_idx
    ON tai_tool_planner_decisions (status, generated_at DESC, trace_id);
CREATE INDEX IF NOT EXISTS tai_tool_planner_decisions_input_idx
    ON tai_tool_planner_decisions (input_sha256, generated_at DESC);

CREATE OR REPLACE VIEW tai_governed_tool_trace_v1 AS
SELECT
    decision.trace_id,
    decision.plan_id,
    decision.request_id,
    decision.tenant_id,
    decision.user_id,
    decision.session_id,
    decision.status AS planner_status,
    decision.catalog_version,
    decision.input_sha256,
    decision.selected_calls,
    decision.reason_codes,
    decision.rejection_signals,
    decision.generated_at AS planned_at,
    decision.decision_sha256,
    event.call_id,
    event.tool_name,
    event.mode AS tool_mode,
    event.status AS tool_status,
    event.request_sha256 AS tool_request_sha256,
    event.result_sha256 AS tool_result_sha256,
    event.reason AS tool_reason,
    event.occurred_at AS tool_completed_at,
    event.event_sha256 AS tool_event_sha256
FROM tai_tool_planner_decisions AS decision
LEFT JOIN tai_agent_tool_events AS event
    ON event.trace_id = decision.trace_id
    AND event.plan_id = decision.plan_id;

COMMIT;
