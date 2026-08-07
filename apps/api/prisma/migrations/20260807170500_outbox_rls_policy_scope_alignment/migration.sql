-- P0 identity/RLS prerequisite: make the migration-owned outbox catalog match
-- the canonical dedicated-worker policy scope.
--
-- FORCE RLS means every policy applicable to current_user is part of query
-- evaluation. The historical tenant/callback policies were created TO PUBLIC.
-- That allowed app_outbox to reach tenant Deal predicates (and their protected
-- dependencies) even though a permissive worker policy also admitted the row.
-- The result was a live, least-privilege worker that could connect but could not
-- claim its first durable batch.
--
-- This migration does not add BYPASSRLS, table ownership, INSERT/DELETE or Deal
-- authority to app_outbox. It only makes worker and tenant policy audiences
-- disjoint. A guarded PUBLIC fallback is retained for migration environments
-- where runtime roles are provisioned after prisma migrate deploy.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DO $outbox_policy_scope$
DECLARE
  worker_targets TEXT := '';
  tenant_targets TEXT := '';
  worker_policy_targets TEXT;
  tenant_policy_targets TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_outbox') THEN
    worker_targets := 'app_outbox';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    worker_targets := CASE
      WHEN worker_targets = '' THEN 'app_service'
      ELSE worker_targets || ', app_service'
    END;
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

  worker_policy_targets := CASE WHEN worker_targets = '' THEN 'PUBLIC' ELSE worker_targets END;
  tenant_policy_targets := CASE WHEN tenant_targets = '' THEN 'PUBLIC' ELSE tenant_targets END;

  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_select ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_insert ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_update ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries"';

  EXECUTE format(
    'CREATE POLICY outbox_entries_worker_select ON public."outbox_entries" FOR SELECT TO %s USING (current_user IN (''app_service'', ''app_outbox''))',
    worker_policy_targets
  );

  -- The delivery worker never creates authoritative outbox entries. app_service
  -- remains the only compatibility principal admitted by the historical worker
  -- INSERT surface.
  EXECUTE format(
    'CREATE POLICY outbox_entries_worker_insert ON public."outbox_entries" FOR INSERT TO %s WITH CHECK (current_user = ''app_service'')',
    CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN 'app_service' ELSE 'PUBLIC' END
  );

  EXECUTE format(
    'CREATE POLICY outbox_entries_worker_update ON public."outbox_entries" FOR UPDATE TO %s USING (current_user IN (''app_service'', ''app_outbox'')) WITH CHECK (current_user IN (''app_service'', ''app_outbox''))',
    worker_policy_targets
  );

  EXECUTE format(
    'CREATE POLICY outbox_entries_select ON public."outbox_entries" FOR SELECT TO %s USING (CASE WHEN current_user IN (''app_runtime'', ''app_service'') THEN public.app_rls_context_ready() AND "dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId") ELSE FALSE END)',
    tenant_policy_targets
  );

  EXECUTE format(
    'CREATE POLICY outbox_entries_insert ON public."outbox_entries" FOR INSERT TO %s WITH CHECK (CASE WHEN current_user IN (''app_runtime'', ''app_service'') THEN public.app_rls_context_ready() AND "dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId") ELSE FALSE END)',
    tenant_policy_targets
  );

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_settlement_callback_update'
  ) THEN
    EXECUTE format($policy$
      ALTER POLICY outbox_entries_settlement_callback_update
      ON public."outbox_entries"
      TO %s
      USING (
        CASE WHEN current_user IN ('app_runtime', 'app_service') THEN
          settlement.context_ready()
          AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
          AND EXISTS (
            SELECT 1
            FROM settlement.bank_operations operation
            JOIN public.deals deal ON deal.id = operation.deal_id
            WHERE 'settlement-bank-request:' || operation.id = outbox_entries."idempotencyKey"
              AND operation.deal_id = outbox_entries."dealId"
              AND operation.tenant_id = current_setting('app.current_tenant_id', true)
              AND operation.status IN ('CONFIRMED', 'FAILED')
              AND operation.callback_event_id IS NOT NULL
              AND operation.callback_key_id IS NOT NULL
              AND operation.callback_payload_fingerprint IS NOT NULL
              AND deal."tenantId" = operation.tenant_id
              AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
          )
        ELSE FALSE END
      )
      WITH CHECK (
        CASE WHEN current_user IN ('app_runtime', 'app_service') THEN
          settlement.context_ready()
          AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
          AND EXISTS (
            SELECT 1
            FROM settlement.bank_operations operation
            JOIN public.deals deal ON deal.id = operation.deal_id
            WHERE 'settlement-bank-request:' || operation.id = outbox_entries."idempotencyKey"
              AND operation.deal_id = outbox_entries."dealId"
              AND operation.tenant_id = current_setting('app.current_tenant_id', true)
              AND operation.status IN ('CONFIRMED', 'FAILED')
              AND operation.callback_event_id IS NOT NULL
              AND operation.callback_key_id IS NOT NULL
              AND operation.callback_payload_fingerprint IS NOT NULL
              AND deal."tenantId" = operation.tenant_id
              AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
          )
        ELSE FALSE END
      )
    $policy$, tenant_policy_targets);
  END IF;
END
$outbox_policy_scope$;

-- Catalog proof: the worker remains FORCE-RLS constrained and no worker policy
-- grants INSERT or DELETE authority to app_outbox.
DO $outbox_policy_scope_proof$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class relation
    JOIN pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'public'
      AND relation.relname = 'outbox_entries'
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'public.outbox_entries must remain ENABLE + FORCE RLS'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_worker_select'
      AND cmd = 'SELECT'
      AND qual LIKE '%app_outbox%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_worker_update'
      AND cmd = 'UPDATE'
      AND qual LIKE '%app_outbox%'
  ) THEN
    RAISE EXCEPTION 'dedicated app_outbox worker policies are missing'
      USING ERRCODE = '42501';
  END IF;
END
$outbox_policy_scope_proof$;