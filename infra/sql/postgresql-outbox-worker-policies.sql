-- Canonical PostgreSQL RLS overlay for the dedicated durable outbox principal.
--
-- app_outbox is the accepted runtime principal created by infrastructure and
-- constrained by 20260715143000_outbox_worker_principal. The base RLS policy
-- set historically referenced app_outbox_worker and left tenant-facing PUBLIC
-- policies visible to the delivery worker. PostgreSQL may evaluate those
-- policies even when the worker policy is permissive, which reaches
-- deal_participants through app_rls_deal_visible().
--
-- This overlay scopes worker and tenant policies to disjoint database roles.
-- The CASE boundary also prevents the tenant visibility function from being
-- planned or executed for app_outbox if a CNI/database pool or future policy
-- composition exposes an otherwise non-applicable permissive policy. The
-- worker retains no tenant-table privileges. The caller owns the transaction.
-- Never add BEGIN/COMMIT here.

DROP POLICY IF EXISTS outbox_entries_worker_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_insert ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_update ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries";

DO $outbox_policy_scope$
DECLARE
  worker_targets TEXT := 'app_outbox';
  tenant_targets TEXT := '';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    worker_targets := worker_targets || ', app_service';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    tenant_targets := 'app_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    tenant_targets := CASE
      WHEN tenant_targets = '' THEN 'app_service'
      ELSE tenant_targets || ', app_service'
    END;
  END IF;
  IF tenant_targets = '' THEN
    RAISE EXCEPTION 'No tenant runtime role exists for outbox RLS policies';
  END IF;

  EXECUTE format(
    'CREATE POLICY outbox_entries_worker_select ON public."outbox_entries" FOR SELECT TO %s USING (current_user IN (''app_service'', ''app_outbox''))',
    worker_targets
  );

  -- The delivery worker cannot create authoritative events. app_service remains
  -- the only service-side compatibility principal allowed by this policy.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    EXECUTE 'CREATE POLICY outbox_entries_worker_insert ON public."outbox_entries" FOR INSERT TO app_service WITH CHECK (current_user = ''app_service'')';
  ELSE
    EXECUTE 'CREATE POLICY outbox_entries_worker_insert ON public."outbox_entries" FOR INSERT TO PUBLIC WITH CHECK (current_user = ''app_service'')';
  END IF;

  EXECUTE format(
    'CREATE POLICY outbox_entries_worker_update ON public."outbox_entries" FOR UPDATE TO %s USING (current_user IN (''app_service'', ''app_outbox'')) WITH CHECK (current_user IN (''app_service'', ''app_outbox''))',
    worker_targets
  );

  EXECUTE format(
    'CREATE POLICY outbox_entries_select ON public."outbox_entries" FOR SELECT TO %s USING (CASE WHEN current_user IN (''app_runtime'', ''app_service'') THEN public.app_rls_context_ready() AND "dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId") ELSE FALSE END)',
    tenant_targets
  );

  EXECUTE format(
    'CREATE POLICY outbox_entries_insert ON public."outbox_entries" FOR INSERT TO %s WITH CHECK (CASE WHEN current_user IN (''app_runtime'', ''app_service'') THEN public.app_rls_context_ready() AND "dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId") ELSE FALSE END)',
    tenant_targets
  );
END
$outbox_policy_scope$;
