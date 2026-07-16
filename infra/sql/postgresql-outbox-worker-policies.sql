-- Canonical PostgreSQL RLS overlay for the dedicated durable outbox principal.
--
-- app_outbox is the accepted runtime principal created by infrastructure and
-- constrained by 20260715143000_outbox_worker_principal. The base RLS policy
-- set historically referenced app_outbox_worker and left tenant-facing PUBLIC
-- policies visible to the delivery worker. PostgreSQL may evaluate those
-- policies even when the worker policy is permissive, which reaches
-- deal_participants through app_rls_deal_visible().
--
-- The Settlement callback migration also creates a FOR UPDATE policy without a
-- TO clause. Such a policy applies to PUBLIC, so SELECT ... FOR UPDATE by
-- app_outbox evaluates the callback policy and reaches Deal tenant authority.
-- This overlay scopes every outbox policy to a disjoint database-role set while
-- preserving the callback expression and the worker's least-privilege boundary.
-- The caller owns the transaction. Never add BEGIN/COMMIT here.

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

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_settlement_callback_update'
  ) THEN
    EXECUTE format(
      'ALTER POLICY outbox_entries_settlement_callback_update ON public."outbox_entries" TO %s',
      tenant_targets
    );
  ELSE
    RAISE EXCEPTION 'Expected Settlement callback outbox policy is missing';
  END IF;
END
$outbox_policy_scope$;
