BEGIN;

ALTER TABLE tai_tool_planner_decisions
    DROP CONSTRAINT IF EXISTS tai_tool_planner_decisions_catalog_version_check;
ALTER TABLE tai_tool_planner_decisions
    ADD CONSTRAINT tai_tool_planner_decisions_catalog_version_check
    CHECK (
        catalog_version IN (
            'tai.tool-catalog.safe.v1',
            'tai.tool-catalog.governed.v2'
        )
    );

CREATE OR REPLACE VIEW tai_confirmed_tool_trace_v1 AS
SELECT
    decision.trace_id,
    decision.plan_id,
    decision.request_id,
    decision.tenant_id,
    decision.user_id,
    decision.session_id,
    decision.catalog_version,
    decision.input_sha256,
    decision.selected_calls,
    decision.reason_codes,
    decision.generated_at AS planned_at,
    decision.decision_sha256,
    confirmation.confirmation_id,
    confirmation.call_id AS confirmed_call_id,
    confirmation.request_sha256 AS confirmation_request_sha256,
    confirmation.idempotency_key AS confirmation_idempotency_key,
    confirmation.used_at AS confirmed_at,
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
    AND event.plan_id = decision.plan_id
    AND event.mode = 'CONFIRMED_WRITE'
LEFT JOIN tai_tool_confirmation_uses AS confirmation
    ON confirmation.call_id = event.call_id
    AND confirmation.request_sha256 = event.request_sha256
    AND confirmation.idempotency_key = event.idempotency_key
    AND confirmation.user_id = event.user_id
    AND confirmation.tenant_id IS NOT DISTINCT FROM event.tenant_id
    AND confirmation.session_id = event.session_id;

COMMIT;
