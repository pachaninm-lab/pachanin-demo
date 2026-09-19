-- P0 identity/RLS forward-only correction for outbox policy audiences.
-- Policy behavior must not depend on whether runtime roles already exist while
-- prisma migrate deploy runs. TO PUBLIC is used only as a provisioning-order
-- mechanism; table ACLs plus exact current_user predicates remain authoritative.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DO $outbox_scope$
BEGIN
  -- Dedicated delivery worker. app_outbox may SELECT and UPDATE queue state but
  -- receives no INSERT/DELETE authority. app_outbox_worker remains compatible.
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_select ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_insert ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_update ON public."outbox_entries"';

  EXECUTE $policy$
    CREATE POLICY outbox_entries_worker_select
    ON public."outbox_entries"
    FOR SELECT TO PUBLIC
    USING (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'))
  $policy$;

  EXECUTE $policy$
    CREATE POLICY outbox_entries_worker_insert
    ON public."outbox_entries"
    FOR INSERT TO PUBLIC
    WITH CHECK (current_user IN ('app_service', 'app_outbox_worker'))
  $policy$;

  EXECUTE $policy$
    CREATE POLICY outbox_entries_worker_update
    ON public."outbox_entries"
    FOR UPDATE TO PUBLIC
    USING (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'))
    WITH CHECK (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'))
  $policy$;

  -- Deal-scoped application producer/read surface. Dedicated workers are not
  -- admitted through these policies.
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries"';

  EXECUTE $policy$
    CREATE POLICY outbox_entries_select
    ON public."outbox_entries"
    FOR SELECT TO PUBLIC
    USING (
      CASE
        WHEN current_user IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
          public.app_rls_context_ready()
          AND "dealId" IS NOT NULL
          AND public.app_rls_deal_visible("dealId")
        ELSE FALSE
      END
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY outbox_entries_insert
    ON public."outbox_entries"
    FOR INSERT TO PUBLIC
    WITH CHECK (
      CASE
        WHEN current_user IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
          public.app_rls_context_ready()
          AND "dealId" IS NOT NULL
          AND public.app_rls_deal_visible("dealId")
        ELSE FALSE
      END
    )
  $policy$;

  -- Verified Settlement callback: exact application runtime + trusted callback
  -- context + exact operation/deal binding. Dedicated workers remain excluded.
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_settlement_callback_update'
  ) THEN
    ALTER POLICY outbox_entries_settlement_callback_update
    ON public."outbox_entries"
    TO PUBLIC
    USING (
      CASE
        WHEN current_user IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
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
        ELSE FALSE
      END
    )
    WITH CHECK (
      CASE
        WHEN current_user IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
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
        ELSE FALSE
      END
    );
  END IF;
END
$outbox_scope$;

DO $outbox_scope_proof$
DECLARE
  app_select TEXT;
  app_insert TEXT;
  app_select_roles TEXT;
  app_insert_roles TEXT;
  worker_select TEXT;
  worker_insert TEXT;
  worker_update TEXT;
  worker_check TEXT;
  worker_select_roles TEXT;
  worker_insert_roles TEXT;
  worker_update_roles TEXT;
  callback_update TEXT;
  callback_check TEXT;
  callback_roles TEXT;
BEGIN
  SELECT qual, roles::text INTO app_select, app_select_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_select' AND cmd='SELECT';

  SELECT with_check, roles::text INTO app_insert, app_insert_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_insert' AND cmd='INSERT';

  SELECT qual, roles::text INTO worker_select, worker_select_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_worker_select' AND cmd='SELECT';

  SELECT with_check, roles::text INTO worker_insert, worker_insert_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_worker_insert' AND cmd='INSERT';

  SELECT qual, with_check, roles::text
  INTO worker_update, worker_check, worker_update_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_worker_update' AND cmd='UPDATE';

  SELECT qual, with_check, roles::text
  INTO callback_update, callback_check, callback_roles
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_settlement_callback_update' AND cmd='UPDATE';

  IF app_select IS NULL OR app_insert IS NULL
     OR app_select_roles NOT LIKE '%public%'
     OR app_insert_roles NOT LIKE '%public%'
     OR app_select NOT LIKE '%app_rls_context_ready%'
     OR app_select NOT LIKE '%app_rls_deal_visible%'
     OR app_insert NOT LIKE '%app_runtime%'
     OR app_insert NOT LIKE '%app_service%'
     OR app_insert NOT LIKE '%app_deal%'
     OR app_insert NOT LIKE '%one_deal_app%'
     OR app_insert LIKE '%''app_outbox''%'
  THEN
    RAISE EXCEPTION 'deal-scoped outbox policies are not provisioning-order safe and bounded'
      USING ERRCODE='42501';
  END IF;

  IF worker_select IS NULL OR worker_insert IS NULL
     OR worker_update IS NULL OR worker_check IS NULL
     OR worker_select_roles NOT LIKE '%public%'
     OR worker_insert_roles NOT LIKE '%public%'
     OR worker_update_roles NOT LIKE '%public%'
     OR worker_select NOT LIKE '%''app_outbox''%'
     OR worker_update NOT LIKE '%''app_outbox''%'
     OR worker_check NOT LIKE '%''app_outbox''%'
     OR worker_insert LIKE '%''app_outbox''%'
     OR worker_select LIKE '%one_deal_app%'
     OR worker_update LIKE '%one_deal_app%'
  THEN
    RAISE EXCEPTION 'dedicated outbox worker policies are not provisioning-order safe and least-privilege bounded'
      USING ERRCODE='42501';
  END IF;

  IF callback_update IS NULL OR callback_check IS NULL
     OR callback_roles NOT LIKE '%public%'
     OR callback_update NOT LIKE '%one_deal_app%'
     OR callback_update NOT LIKE '%BANK_CALLBACK%'
     OR callback_update NOT LIKE '%settlement-bank-request:%'
     OR callback_update NOT LIKE '%callback_event_id%'
     OR callback_update NOT LIKE '%buyerOrgId%'
     OR callback_update LIKE '%''app_outbox''%'
     OR callback_check NOT LIKE '%BANK_CALLBACK%'
  THEN
    RAISE EXCEPTION 'Settlement callback outbox policy is not provisioning-order safe and bounded'
      USING ERRCODE='42501';
  END IF;
END
$outbox_scope_proof$;
