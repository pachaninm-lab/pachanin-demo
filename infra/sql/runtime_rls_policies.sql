-- P10 SQL-level RLS groundwork for runtime tables
-- Apply only after runtime auth/session variables are set in the DB session.

CREATE SCHEMA IF NOT EXISTS app_runtime;

CREATE OR REPLACE FUNCTION app_runtime.current_company_ids()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(string_to_array(current_setting('app.runtime_company_ids', true), ','), ARRAY[]::text[]);
$$;

CREATE OR REPLACE FUNCTION app_runtime.current_role_codes()
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(string_to_array(current_setting('app.runtime_role_codes', true), ','), ARRAY[]::text[]);
$$;

CREATE OR REPLACE FUNCTION app_runtime.is_privileged()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.runtime_privileged', true) = 'true';
$$;

ALTER TABLE IF EXISTS "RuntimeObjectGrantRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "RuntimeSnapshotRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "RuntimeEventRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "OutboxEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "RuntimeCommandRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "RuntimeTransactionRecord" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_object_grant_select_policy ON "RuntimeObjectGrantRecord";
CREATE POLICY runtime_object_grant_select_policy
ON "RuntimeObjectGrantRecord"
FOR SELECT
USING (
  app_runtime.is_privileged()
  OR company_ids && app_runtime.current_company_ids()
  OR role_codes && app_runtime.current_role_codes()
);

CREATE POLICY IF NOT EXISTS runtime_snapshot_select_policy
ON "RuntimeSnapshotRecord"
FOR SELECT
USING (app_runtime.is_privileged());

CREATE POLICY IF NOT EXISTS runtime_event_select_policy
ON "RuntimeEventRecord"
FOR SELECT
USING (
  app_runtime.is_privileged()
  OR COALESCE(payload->>'aggregateCompanyId', '') = ANY(app_runtime.current_company_ids())
);

CREATE POLICY IF NOT EXISTS runtime_outbox_select_policy
ON "OutboxEvent"
FOR SELECT
USING (app_runtime.is_privileged());

CREATE POLICY IF NOT EXISTS runtime_command_select_policy
ON "RuntimeCommandRecord"
FOR SELECT
USING (
  app_runtime.is_privileged()
  OR COALESCE(payload->>'orgId', '') = ANY(app_runtime.current_company_ids())
);

CREATE POLICY IF NOT EXISTS runtime_transaction_select_policy
ON "RuntimeTransactionRecord"
FOR SELECT
USING (app_runtime.is_privileged());

-- Writes stay privileged until full service-role separation is enforced.
