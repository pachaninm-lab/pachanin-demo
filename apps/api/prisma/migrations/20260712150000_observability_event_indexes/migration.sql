-- Block 3: Observability — time-range indexes on the event tables that back
-- dashboards, the correlation timeline and future partitioning (GAP-014).

CREATE INDEX IF NOT EXISTS "audit_events_created_idx"
  ON "audit_events" ("createdAt");
CREATE INDEX IF NOT EXISTS "deal_events_deal_created_idx"
  ON "deal_events" ("dealId", "createdAt");
CREATE INDEX IF NOT EXISTS "integration_events_created_idx"
  ON "integration_events" ("createdAt");
CREATE INDEX IF NOT EXISTS "ledger_entries_created_idx"
  ON "ledger_entries" ("createdAt");
CREATE INDEX IF NOT EXISTS "outbox_entries_created_idx"
  ON "outbox_entries" ("createdAt");
