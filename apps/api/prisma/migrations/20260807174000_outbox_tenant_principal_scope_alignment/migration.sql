-- P0 identity/RLS forward-only correction for the outbox policy audiences.
--
-- Runtime principals are provisioned at different times in CI and production.
-- Policy correctness must therefore never depend on whether a legitimate role
-- already exists while prisma migrate deploy runs.
--
-- Security boundary preserved here:
--   * app_outbox/app_outbox_worker are confined to worker SELECT/UPDATE policy;
--   * app_outbox still has no INSERT/DELETE table privilege;
--   * no SUPERUSER/BYPASSRLS/ownership/membership is introduced;
--   * tenant INSERT/SELECT require the exact application-principal allowlist,
--     trusted transaction-local RLS context and Deal visibility;
--   * settlement callback UPDATE additionally requires the exact BANK_CALLBACK
--     context and the bound confirmed/failed operation authority;
--   * auth/staff/storage principals are deliberately absent.
--
-- TO PUBLIC is intentional and provisioning-order safe: table ACLs remain
-- authoritative and each policy expression immediately rejects database
-- principals outside its explicit current_user allowlist.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DO $outbox_tenant_scope$
BEGIN
  -- Re-materialize the dedicated worker policies from the canonical production
  -- RLS contract. app_outbox needs SELECT visibility for the SKIP LOCKED claim
  -- subquery and UPDATE visibility for claim/heartbeat/retry/SENT transitions.
  -- It deliberately receives no INSERT policy here.
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_select ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_insert ON public."outbox_entries"';
  EXECUTE 'DROP POLICY IF EXISTS outbox_entries_worker_update ON public."outbox_entries"';

  EXECUTE $policy$
    CREATE POLICY outbox_entries_worker_select
    ON public."outbox_entries"
    FOR SELECT TO PUBLIC
    USING (
      current_user IN ('app_service', 'app_outbox_worker', 'app_outbox')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY outbox_entries_worker_insert
    ON public."outbox_entries"
    FOR INSERT TO PUBLIC
    WITH CHECK (
      current_user IN ('app_service', 'app_outbox_worker')
    )
  $policy$;

  EXECUTE $policy$
    CREATE POLICY outbox_entries_worker_update
    ON public."outbox_entries"
    FOR UPDATE TO PUBLIC
    USING (
      current_user IN ('app_service', 'app_outbox_worker', 'app_outbox')
    )
    WITH CHECK (
      current_user IN ('app_service', 'app_outbox_worker', 'app_outbox')
    )
  $policy$;

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

  -- Preserve the historical settlement callback predicate while making its
  -- audience independent of role-provisioning order. The explicit current_user
  -- allowlist is the database-principal boundary; TO PUBLIC only avoids freezing
  -- the policy audience to whichever roles happened to exist during migrate.
  IF EXISTS (
    SELECT 1
    FROM pg_policies
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
$outbox_tenant_scope$;

DO $outbox_tenant_scope_proof$
DECLARE
  insert_qual TEXT;
  insert_roles TEXT;
  select_qual TEXT;
  select_roles TEXT;
  worker_select_qual TEXT;
  worker_select_roles TEXT;
  worker_insert_qual TEXT;
  worker_insert_roles TEXT;
  worker_update_qual TEXT;
  worker_update_check TEXT;
  worker_update_roles TEXT;
  callback_update_qual TEXT;
  callback_update_check TEXT;
  callback_update_roles TEXT;
BEGIN
  SELECT with_check, roles::text INTO insert_qual, insert_roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_insert';

  SELECT qual, roles::text INTO select_qual, select_roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_select';

  SELECT qual, roles::text INTO worker_select_qual, worker_select_roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_worker_select'
    AND cmd = 'SELECT';

  SELECT with_check, roles::text INTO worker_insert_qual, worker_insert_roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_worker_insert'
    AND cmd = 'INSERT';

  SELECT qual, with_check, roles::text
  INTO worker_update_qual, worker_update_check, worker_update_roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_worker_update'
    AND cmd = 'UPDATE';

  SELECT qual, with_check, roles::text
  INTO callback_update_qual, callback_update_check, callback_update_roles
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_settlement_callback_update'
    AND cmd = 'UPDATE';

  IF insert_qual IS NULL OR select_qual IS NULL THEN
    RAISE EXCEPTION 'bounded tenant outbox policies are missing'
      USING ERRCODE = '42501';
  END IF;

  IF insert_roles NOT LIKE '%public%'
     OR select_roles NOT LIKE '%public%'
     OR insert_qual NOT LIKE '%app_runtime%'
     OR insert_qual NOT LIKE '%app_service%'
     OR insert_qual NOT LIKE '%app_deal%'
     OR insert_qual NOT LIKE '%one_deal_app%'
     OR insert_qual NOT LIKE '%app_rls_context_ready%'
     OR insert_qual NOT LIKE '%app_rls_deal_visible%'
     OR insert_qual LIKE '%app_outbox%'
     OR select_qual LIKE '%app_outbox%'
  THEN
    RAISE EXCEPTION 'outbox tenant policy audience/predicate is not provisioning-order safe and least-privilege aligned'
      USING ERRCODE = '42501';
  END IF;

  IF worker_select_qual IS NULL
     OR worker_insert_qual IS NULL
     OR worker_update_qual IS NULL
     OR worker_update_check IS NULL
     OR worker_select_roles NOT LIKE '%public%'
     OR worker_insert_roles NOT LIKE '%public%'
     OR worker_update_roles NOT LIKE '%public%'
     OR worker_select_qual NOT LIKE '%app_outbox%'
     OR worker_update_qual NOT LIKE '%app_outbox%'
     OR worker_update_check NOT LIKE '%app_outbox%'
     OR worker_insert_qual LIKE '%app_outbox%'
     OR worker_select_qual LIKE '%one_deal_app%'
     OR worker_update_qual LIKE '%one_deal_app%'
  THEN
    RAISE EXCEPTION 'dedicated outbox worker policies are not provisioning-order safe and least-privilege bounded'
      USING ERRCODE = '42501';
  END IF;

  IF callback_update_qual IS NULL
     OR callback_update_check IS NULL
     OR callback_update_roles NOT LIKE '%public%'
     OR callback_update_qual NOT LIKE '%one_deal_app%'
     OR callback_update_qual NOT LIKE '%BANK_CALLBACK%'
     OR callback_update_qual NOT LIKE '%settlement-bank-request:%'
     OR callback_update_qual NOT LIKE '%callback_event_id%'
     OR callback_update_qual NOT LIKE '%buyerOrgId%'
     OR callback_update_qual LIKE '%app_outbox%'
     OR callback_update_check NOT LIKE '%one_deal_app%'
     OR callback_update_check NOT LIKE '%BANK_CALLBACK%'
  THEN
    RAISE EXCEPTION 'settlement callback outbox UPDATE policy is not provisioning-order safe and least-privilege bounded'
      USING ERRCODE = '42501';
  END IF;
END
$outbox_tenant_scope_proof$;
