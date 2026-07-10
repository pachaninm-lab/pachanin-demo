-- Прозрачная Цена — operational rollback for production-rls-policies.sql.
-- This removes only policies owned by VP-3.45 and disables RLS/FORCE RLS.
-- It does not drop tables, columns, runtime snapshots, audit, outbox or ledger data.

BEGIN;

DROP POLICY IF EXISTS runtime_attempts_delete_denied ON "deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_attempts_update_denied ON "deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_attempts_insert ON "deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_attempts_select ON "deal_workspace_runtime_transaction_attempts";
ALTER TABLE "deal_workspace_runtime_transaction_attempts" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_workspace_runtime_transaction_attempts" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_snapshots_delete_denied ON "deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS runtime_snapshots_update ON "deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS runtime_snapshots_insert ON "deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS runtime_snapshots_select ON "deal_workspace_runtime_snapshots";
ALTER TABLE "deal_workspace_runtime_snapshots" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "deal_workspace_runtime_snapshots" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_entries_delete_denied ON "outbox_entries";
DROP POLICY IF EXISTS outbox_entries_service_update ON "outbox_entries";
DROP POLICY IF EXISTS outbox_entries_service_insert ON "outbox_entries";
DROP POLICY IF EXISTS outbox_entries_service_select ON "outbox_entries";
ALTER TABLE "outbox_entries" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "outbox_entries" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_events_delete_denied ON "integration_events";
DROP POLICY IF EXISTS integration_events_update_denied ON "integration_events";
DROP POLICY IF EXISTS integration_events_insert ON "integration_events";
DROP POLICY IF EXISTS integration_events_select ON "integration_events";
ALTER TABLE "integration_events" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "integration_events" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_entries_delete_denied ON "ledger_entries";
DROP POLICY IF EXISTS ledger_entries_update_denied ON "ledger_entries";
DROP POLICY IF EXISTS ledger_entries_insert ON "ledger_entries";
DROP POLICY IF EXISTS ledger_entries_select ON "ledger_entries";
ALTER TABLE "ledger_entries" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_delete_denied ON "audit_events";
DROP POLICY IF EXISTS audit_events_update_denied ON "audit_events";
DROP POLICY IF EXISTS audit_events_insert ON "audit_events";
DROP POLICY IF EXISTS audit_events_select ON "audit_events";
ALTER TABLE "audit_events" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_delete_denied ON "organizations";
DROP POLICY IF EXISTS organizations_update ON "organizations";
DROP POLICY IF EXISTS organizations_insert ON "organizations";
DROP POLICY IF EXISTS organizations_select ON "organizations";
ALTER TABLE "organizations" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "organizations" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deals_delete_denied ON "deals";
DROP POLICY IF EXISTS deals_update ON "deals";
DROP POLICY IF EXISTS deals_insert ON "deals";
DROP POLICY IF EXISTS deals_select ON "deals";
ALTER TABLE "deals" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "deals" DISABLE ROW LEVEL SECURITY;

DROP FUNCTION IF EXISTS set_app_context(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS set_app_context(TEXT, TEXT, TEXT, TEXT, TEXT);

COMMIT;
