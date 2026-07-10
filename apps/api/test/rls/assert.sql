\set ON_ERROR_STOP on

DO $catalog$
DECLARE
  legacy_count INTEGER;
  enabled_count INTEGER;
  forced_count INTEGER;
BEGIN
  SELECT count(*) INTO legacy_count FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN ('deals_app_access','audit_insert_only','audit_select_all','ledger_insert_only','ledger_select_all');
  IF legacy_count <> 0 THEN RAISE EXCEPTION 'Legacy permissive policies remain active: %', legacy_count; END IF;

  SELECT count(*) INTO enabled_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')
    AND c.relrowsecurity;

  SELECT count(*) INTO forced_count
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('deals','organizations','audit_events','ledger_entries','integration_events','outbox_entries','deal_workspace_runtime_snapshots','deal_workspace_runtime_transaction_attempts')
    AND c.relforcerowsecurity;

  IF enabled_count <> 8 OR forced_count <> 8 THEN
    RAISE EXCEPTION 'Expected 8 enabled and forced RLS tables, got enabled %, forced %', enabled_count, forced_count;
  END IF;
END
$catalog$;

SET ROLE app_rls_test;
SET row_security = on;

BEGIN;
SELECT
  set_config('app.current_user_id', 'user-a', true),
  set_config('app.current_org_id', 'org-a-seller', true),
  set_config('app.current_tenant_id', 'tenant-a', true),
  set_config('app.current_role', 'FARMER', true),
  set_config('app.current_session_id', 'session-a', true);
DO $own_graph$
DECLARE c INTEGER;
BEGIN
  SELECT count(*) INTO c FROM public."organizations"; IF c <> 1 THEN RAISE EXCEPTION 'Expected 1 visible organization, got %', c; END IF;
  SELECT count(*) INTO c FROM public."deals"; IF c <> 1 THEN RAISE EXCEPTION 'Expected 1 visible deal, got %', c; END IF;
  SELECT count(*) INTO c FROM public."deals" WHERE "id"='deal-a'; IF c <> 1 THEN RAISE EXCEPTION 'Own deal is not visible'; END IF;
  SELECT count(*) INTO c FROM public."deals" WHERE "id"='deal-b'; IF c <> 0 THEN RAISE EXCEPTION 'Cross-tenant deal is visible'; END IF;
  SELECT count(*) INTO c FROM public."audit_events"; IF c <> 1 THEN RAISE EXCEPTION 'Expected 1 visible audit event, got %', c; END IF;
  SELECT count(*) INTO c FROM public."audit_events" WHERE "id"='audit-b'; IF c <> 0 THEN RAISE EXCEPTION 'Cross-tenant audit event is visible'; END IF;
  SELECT count(*) INTO c FROM public."outbox_entries"; IF c <> 1 THEN RAISE EXCEPTION 'Expected 1 visible outbox entry, got %', c; END IF;
  SELECT count(*) INTO c FROM public."outbox_entries" WHERE "id"='outbox-b'; IF c <> 0 THEN RAISE EXCEPTION 'Cross-tenant outbox entry is visible'; END IF;
  SELECT count(*) INTO c FROM public."deal_workspace_runtime_snapshots"; IF c <> 1 THEN RAISE EXCEPTION 'Expected 1 visible runtime snapshot, got %', c; END IF;
  SELECT count(*) INTO c FROM public."deal_workspace_runtime_snapshots" WHERE "id"='snapshot-record-b'; IF c <> 0 THEN RAISE EXCEPTION 'Cross-tenant runtime snapshot is visible'; END IF;
  SELECT count(*) INTO c FROM public."deal_workspace_runtime_transaction_attempts"; IF c <> 1 THEN RAISE EXCEPTION 'Expected 1 visible runtime attempt, got %', c; END IF;
  SELECT count(*) INTO c FROM public."deal_workspace_runtime_transaction_attempts" WHERE "id"='attempt-b'; IF c <> 0 THEN RAISE EXCEPTION 'Cross-tenant runtime attempt is visible'; END IF;
END
$own_graph$;
COMMIT;

BEGIN;
DO $no_leak$
DECLARE c INTEGER;
BEGIN
  IF NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
    OR NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
    OR NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
    OR NULLIF(current_setting('app.current_role', true), '') IS NOT NULL
    OR NULLIF(current_setting('app.current_session_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Transaction-local RLS context leaked after COMMIT';
  END IF;
  SELECT count(*) INTO c FROM public."deals"; IF c <> 0 THEN RAISE EXCEPTION 'Deal visible without context after COMMIT'; END IF;
  SELECT count(*) INTO c FROM public."audit_events"; IF c <> 0 THEN RAISE EXCEPTION 'Audit visible without context after COMMIT'; END IF;
  SELECT count(*) INTO c FROM public."outbox_entries"; IF c <> 0 THEN RAISE EXCEPTION 'Outbox visible without context after COMMIT'; END IF;
  SELECT count(*) INTO c FROM public."deal_workspace_runtime_snapshots"; IF c <> 0 THEN RAISE EXCEPTION 'Runtime snapshot visible without context after COMMIT'; END IF;
END
$no_leak$;
COMMIT;

BEGIN;
SELECT set_config('app.current_org_id','org-a-seller',true), set_config('app.current_tenant_id','tenant-a',true), set_config('app.current_role','FARMER',true), set_config('app.current_session_id','session-a',true);
DO $missing_user$ DECLARE c INTEGER; BEGIN SELECT count(*) INTO c FROM public."deals"; IF c<>0 THEN RAISE EXCEPTION 'Missing user context allowed rows'; END IF; END $missing_user$;
COMMIT;
BEGIN;
SELECT set_config('app.current_user_id','user-a',true), set_config('app.current_tenant_id','tenant-a',true), set_config('app.current_role','FARMER',true), set_config('app.current_session_id','session-a',true);
DO $missing_org$ DECLARE c INTEGER; BEGIN SELECT count(*) INTO c FROM public."deals"; IF c<>0 THEN RAISE EXCEPTION 'Missing organization context allowed rows'; END IF; END $missing_org$;
COMMIT;
BEGIN;
SELECT set_config('app.current_user_id','user-a',true), set_config('app.current_org_id','org-a-seller',true), set_config('app.current_role','FARMER',true), set_config('app.current_session_id','session-a',true);
DO $missing_tenant$ DECLARE c INTEGER; BEGIN SELECT count(*) INTO c FROM public."deals"; IF c<>0 THEN RAISE EXCEPTION 'Missing tenant context allowed rows'; END IF; END $missing_tenant$;
COMMIT;
BEGIN;
SELECT set_config('app.current_user_id','user-a',true), set_config('app.current_org_id','org-a-seller',true), set_config('app.current_tenant_id','tenant-a',true), set_config('app.current_session_id','session-a',true);
DO $missing_role$ DECLARE c INTEGER; BEGIN SELECT count(*) INTO c FROM public."deals"; IF c<>0 THEN RAISE EXCEPTION 'Missing role context allowed rows'; END IF; END $missing_role$;
COMMIT;
BEGIN;
SELECT set_config('app.current_user_id','user-a',true), set_config('app.current_org_id','org-a-seller',true), set_config('app.current_tenant_id','tenant-a',true), set_config('app.current_role','FARMER',true);
DO $missing_session$ DECLARE c INTEGER; BEGIN SELECT count(*) INTO c FROM public."deals"; IF c<>0 THEN RAISE EXCEPTION 'Missing session context allowed rows'; END IF; END $missing_session$;
COMMIT;
RESET ROLE;
