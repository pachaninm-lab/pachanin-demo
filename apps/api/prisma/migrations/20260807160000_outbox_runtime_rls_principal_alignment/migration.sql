-- P0 identity/RLS prerequisite: keep the dedicated durable-outbox principal
-- inside FORCE RLS without letting tenant/callback policies reach Deal authority.
--
-- Runtime principals are provisioned at different times in CI and production.
-- In particular, one_deal_app is created after prisma migrate deploy. Therefore
-- policy correctness must not depend on a role existing while migrations run.
--
-- Least-privilege boundary:
--   * app_outbox/app_outbox_worker may SELECT/UPDATE only through worker policy;
--   * app_outbox cannot INSERT or DELETE;
--   * application producers still require complete trusted RLS context and a
--     visible Deal, regardless of the concrete deal-runtime role name;
--   * settlement callback UPDATE remains BANK_CALLBACK/context constrained;
--   * no SUPERUSER, BYPASSRLS, ownership or role membership is introduced.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_entries_worker_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_insert ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_worker_update ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries";

-- PUBLIC here is only the policy audience. SQL table ACLs remain authoritative,
-- and each expression has an explicit database-principal/context guard. This is
-- intentionally provisioning-order safe for roles created after migrations.
CREATE POLICY outbox_entries_worker_select
ON public."outbox_entries"
FOR SELECT TO PUBLIC
USING (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'));

CREATE POLICY outbox_entries_worker_insert
ON public."outbox_entries"
FOR INSERT TO PUBLIC
WITH CHECK (current_user IN ('app_service', 'app_outbox_worker'));

CREATE POLICY outbox_entries_worker_update
ON public."outbox_entries"
FOR UPDATE TO PUBLIC
USING (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'))
WITH CHECK (current_user IN ('app_service', 'app_outbox_worker', 'app_outbox'));

-- Dedicated delivery principals are rejected before any tenant/Deal predicate is
-- evaluated. All application producers remain server-authoritative through the
-- trusted transaction-local RLS context and Deal visibility check.
CREATE POLICY outbox_entries_select
ON public."outbox_entries"
FOR SELECT TO PUBLIC
USING (
  CASE
    WHEN current_user IN ('app_outbox', 'app_outbox_worker') THEN FALSE
    ELSE
      public.app_rls_context_ready()
      AND "dealId" IS NOT NULL
      AND public.app_rls_deal_visible("dealId")
  END
);

CREATE POLICY outbox_entries_insert
ON public."outbox_entries"
FOR INSERT TO PUBLIC
WITH CHECK (
  CASE
    WHEN current_user IN ('app_outbox', 'app_outbox_worker') THEN FALSE
    ELSE
      public.app_rls_context_ready()
      AND "dealId" IS NOT NULL
      AND public.app_rls_deal_visible("dealId")
  END
);

-- The historical Settlement callback UPDATE policy was also created for PUBLIC.
-- Keep it usable by any legitimate deal-runtime principal created before or after
-- migrations, while excluding the dedicated delivery worker before protected
-- Settlement/Deal dependencies can be evaluated.
DO $outbox_callback_scope$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_settlement_callback_update'
  ) THEN
    ALTER POLICY outbox_entries_settlement_callback_update
    ON public."outbox_entries"
    TO PUBLIC
    USING (
      CASE
        WHEN current_user IN ('app_outbox', 'app_outbox_worker') THEN FALSE
        ELSE
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
      END
    )
    WITH CHECK (
      CASE
        WHEN current_user IN ('app_outbox', 'app_outbox_worker') THEN FALSE
        ELSE
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
      END
    );
  END IF;
END
$outbox_callback_scope$;

DO $outbox_runtime_rls_proof$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
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
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_worker_select'
      AND cmd = 'SELECT'
      AND qual LIKE '%app_outbox%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outbox_entries'
      AND policyname = 'outbox_entries_worker_update'
      AND cmd = 'UPDATE'
      AND qual LIKE '%app_outbox%'
  ) THEN
    RAISE EXCEPTION 'dedicated outbox worker RLS policies are missing'
      USING ERRCODE = '42501';
  END IF;
END
$outbox_runtime_rls_proof$;