-- VP-3.5 Deal Workspace Runtime Persistence DB Contract
-- Status: contract only. Not an applied production migration.
-- Purpose: define the Postgres-backed persistence shape for runtime snapshots before wiring live DB writes.

CREATE TABLE IF NOT EXISTS deal_workspace_runtime_snapshots (
  id TEXT PRIMARY KEY,
  runtime_snapshot_id TEXT NOT NULL UNIQUE,
  deal_id TEXT NOT NULL,
  intent_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ready_to_persist', 'outbox_required', 'audit_required', 'fully_linked')),
  snapshot_state TEXT NOT NULL CHECK (snapshot_state IN ('updated', 'blocked', 'duplicate', 'failed')),
  status_label TEXT NOT NULL,
  runtime_store_record_id TEXT NOT NULL,
  runtime_store_version TEXT NOT NULL,
  maturity TEXT NOT NULL DEFAULT 'postgres-contract',
  payload JSONB NOT NULL,
  correlation_id TEXT NOT NULL,
  audit_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  outbox_entry_id TEXT NULL,
  audit_event_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dw_runtime_snapshots_deal_created
  ON deal_workspace_runtime_snapshots (deal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dw_runtime_snapshots_intent_state
  ON deal_workspace_runtime_snapshots (intent_id, state);

CREATE INDEX IF NOT EXISTS idx_dw_runtime_snapshots_outbox
  ON deal_workspace_runtime_snapshots (outbox_entry_id);

CREATE INDEX IF NOT EXISTS idx_dw_runtime_snapshots_audit
  ON deal_workspace_runtime_snapshots (audit_event_id);

-- Linkage contract:
-- 1. Insert runtime snapshot in state='ready_to_persist'.
-- 2. Insert outbox_entries row with type='deal_workspace.runtime_snapshot.persisted'.
-- 3. Insert audit_events row with action='deal_workspace.runtime_snapshot.persisted'.
-- 4. Update this row to state='fully_linked' only when both outbox_entry_id and audit_event_id are set.
