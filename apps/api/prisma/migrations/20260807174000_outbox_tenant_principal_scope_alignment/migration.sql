-- P0 identity/RLS forward-only correction for the outbox tenant policy audience.
--
-- 20260807170500 separated the dedicated app_outbox worker from tenant-facing
-- FORCE-RLS policies, but its tenant audience named only app_runtime/app_service.
-- Existing production/acceptance Deal runtimes also include app_deal and the
-- isolated one-deal principal one_deal_app. Those principals must be able to
-- append an outbox record only when the ordinary tenant/deal RLS context is
-- valid; they must not receive worker, INSERT-bypass or cross-tenant authority.
--
-- Security boundary preserved here:
--   * app_outbox remains confined to the worker SELECT/UPDATE policies;
--   * no SUPERUSER/BYPASSRLS/ownership/membership is introduced;
--   * no unconditional INSERT authority is introduced;
--   * tenant INSERT/SELECT still require app_rls_context_ready() and Deal
--     visibility;
--   * auth/staff/storage principals are deliberately absent.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DO $outbox_tenant_scope$
DECLARE
  tenant_targets TEXT := '';
  tenant_policy_targets TEXT;
BEGIN
  -- Exact application principals only. app_runtime is the production-like
  -- runtime; app_deal is used by the dedicated Deal authority acceptances;
  -- one_deal_app is created after migrations by the isolated one-deal harness,
  -- so the guarded PUBLIC fallback below must also recognize that exact name.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    tenant_targets := 'app_runtime';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    tenant_targets := CASE WHEN tenant_targets = '' THEN 'app_service' ELSE tenant_targets || ', app_service' END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    tenant_targets := CASE WHEN tenant_targets = '' THEN 'app_deal' ELSE tenant_targets || ', app_deal' END;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'one_deal_app') THEN
    tenant_targets := CASE WHEN tenant_targets = '' THEN 'one_deal_app' ELSE tenant_targets || ', one_deal_app' END;
  END IF;

  -- Some isolated harnesses intentionally create the restricted application
  -- role after prisma migrate deploy. In that case the policy is TO PUBLIC but
  -- its CASE guard remains fail-closed for every principal except the exact
  -- application names above; in particular app_outbox cannot enter the tenant
  -- Deal predicate branch.
  tenant_policy_targets := CASE WHEN tenant_targets = '' THEN 'PUBLIC' ELSE tenant_targets END;

  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries"';

  EXECUTE format(
    'CREATE POLICY outbox_entries_select ON public."outbox_entries" FOR SELECT TO %s USING (CASE WHEN current_user IN (''app_runtime'', ''app_service'', ''app_deal'', ''one_deal_app'') THEN public.app_rls_context_ready() AND "dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId") ELSE FALSE END)',
    tenant_policy_targets
  );

  EXECUTE format(
    'CREATE POLICY outbox_entries_insert ON public."outbox_entries" FOR INSERT TO %s WITH CHECK (CASE WHEN current_user IN (''app_runtime'', ''app_service'', ''app_deal'', ''one_deal_app'') THEN public.app_rls_context_ready() AND "dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId") ELSE FALSE END)',
    tenant_policy_targets
  );

  -- Preserve the existing settlement callback predicate verbatim while aligning
  -- only its database-role audience with the same bounded Deal runtime set.
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
        CASE WHEN current_user IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
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
        CASE WHEN current_user IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
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
$outbox_tenant_scope$;

DO $outbox_tenant_scope_proof$
DECLARE
  insert_qual TEXT;
  select_qual TEXT;
BEGIN
  SELECT with_check INTO insert_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_insert';

  SELECT qual INTO select_qual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_select';

  IF insert_qual IS NULL OR select_qual IS NULL THEN
    RAISE EXCEPTION 'bounded tenant outbox policies are missing'
      USING ERRCODE = '42501';
  END IF;

  IF insert_qual NOT LIKE '%app_deal%'
     OR insert_qual NOT LIKE '%one_deal_app%'
     OR insert_qual NOT LIKE '%app_rls_context_ready%'
     OR insert_qual NOT LIKE '%app_rls_deal_visible%'
     OR insert_qual LIKE '%app_outbox%'
     OR select_qual LIKE '%app_outbox%'
  THEN
    RAISE EXCEPTION 'outbox tenant policy audience/predicate is not least-privilege aligned'
      USING ERRCODE = '42501';
  END IF;
END
$outbox_tenant_scope_proof$;
