-- P0 identity/RLS exact-head correction.
--
-- public.outbox_entries is FORCE RLS and is shared by two disjoint authorities:
--   * app_outbox: delivery-only SELECT/UPDATE queue state;
--   * deal runtimes: tenant-scoped producer/read and verified bank callback paths.
--
-- Provisioning-order-safe TO PUBLIC policies previously embedded tenant/Deal
-- subqueries directly in policy expressions. PostgreSQL plans every applicable
-- policy for a command; a restricted app_outbox SELECT ... FOR UPDATE could
-- therefore fail on deal_participants before the explicit current_user guard was
-- useful. The worker never needs those dependencies.
--
-- Keep TO PUBLIC for late-provisioned application principals, but move dependency
-- evaluation behind SECURITY INVOKER PL/pgSQL predicates. A non-application
-- principal returns FALSE before any Deal/Settlement statement is executed.
-- No table grant, role membership, ownership, SUPERUSER or BYPASSRLS authority is
-- added.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.app_outbox_application_deal_visible(
  p_deal_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF current_user NOT IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
    RETURN FALSE;
  END IF;
  IF p_deal_id IS NULL OR NOT public.app_rls_context_ready() THEN
    RETURN FALSE;
  END IF;
  RETURN public.app_rls_deal_visible(p_deal_id);
END
$function$;

COMMENT ON FUNCTION public.app_outbox_application_deal_visible(TEXT) IS
  'SECURITY INVOKER outbox predicate. Non-deal principals return false before Deal RLS dependencies are evaluated.';

CREATE OR REPLACE FUNCTION public.app_outbox_settlement_callback_visible(
  p_deal_id TEXT,
  p_idempotency_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, settlement
AS $function$
BEGIN
  IF current_user NOT IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
    RETURN FALSE;
  END IF;
  IF p_deal_id IS NULL
     OR p_idempotency_key IS NULL
     OR NOT settlement.context_ready()
     OR current_setting('app.current_role', true) <> 'BANK_CALLBACK'
  THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM settlement.bank_operations operation
    WHERE 'settlement-bank-request:' || operation.id = p_idempotency_key
      AND operation.deal_id = p_deal_id
      AND operation.status IN ('CONFIRMED', 'FAILED')
      AND operation.callback_event_id IS NOT NULL
      AND operation.callback_key_id IS NOT NULL
      AND operation.callback_payload_fingerprint IS NOT NULL
      AND settlement.verified_bank_callback_context(
        operation.deal_id,
        operation.tenant_id,
        operation.required_partner_id,
        operation.callback_event_id
      )
  );
END
$function$;

COMMENT ON FUNCTION public.app_outbox_settlement_callback_visible(TEXT, TEXT) IS
  'SECURITY INVOKER outbox callback predicate. Non-deal principals return false before Settlement/Deal dependencies are evaluated.';

DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries";
CREATE POLICY outbox_entries_select
ON public."outbox_entries"
FOR SELECT TO PUBLIC
USING (public.app_outbox_application_deal_visible("dealId"));

DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries";
CREATE POLICY outbox_entries_insert
ON public."outbox_entries"
FOR INSERT TO PUBLIC
WITH CHECK (public.app_outbox_application_deal_visible("dealId"));

DROP POLICY IF EXISTS outbox_entries_settlement_callback_select
ON public."outbox_entries";
CREATE POLICY outbox_entries_settlement_callback_select
ON public."outbox_entries"
FOR SELECT TO PUBLIC
USING (
  public.app_outbox_settlement_callback_visible("dealId", "idempotencyKey")
);

DROP POLICY IF EXISTS outbox_entries_settlement_callback_update
ON public."outbox_entries";
CREATE POLICY outbox_entries_settlement_callback_update
ON public."outbox_entries"
FOR UPDATE TO PUBLIC
USING (
  public.app_outbox_settlement_callback_visible("dealId", "idempotencyKey")
)
WITH CHECK (
  public.app_outbox_settlement_callback_visible("dealId", "idempotencyKey")
);

DO $outbox_dependency_isolation_proof$
DECLARE
  app_helper TEXT;
  callback_helper TEXT;
  app_helper_invoker BOOLEAN;
  callback_helper_invoker BOOLEAN;
  tenant_select TEXT;
  tenant_insert TEXT;
  callback_select TEXT;
  callback_update TEXT;
  callback_check TEXT;
  worker_select TEXT;
  worker_update TEXT;
  worker_insert TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid), NOT p.prosecdef
  INTO app_helper, app_helper_invoker
  FROM pg_catalog.pg_proc p
  WHERE p.oid = 'public.app_outbox_application_deal_visible(text)'::regprocedure;

  SELECT pg_get_functiondef(p.oid), NOT p.prosecdef
  INTO callback_helper, callback_helper_invoker
  FROM pg_catalog.pg_proc p
  WHERE p.oid = 'public.app_outbox_settlement_callback_visible(text,text)'::regprocedure;

  SELECT qual INTO tenant_select
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_select' AND cmd='SELECT';
  SELECT with_check INTO tenant_insert
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_insert' AND cmd='INSERT';
  SELECT qual INTO callback_select
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_settlement_callback_select' AND cmd='SELECT';
  SELECT qual, with_check INTO callback_update, callback_check
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_settlement_callback_update' AND cmd='UPDATE';
  SELECT qual INTO worker_select
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_worker_select' AND cmd='SELECT';
  SELECT qual INTO worker_update
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_worker_update' AND cmd='UPDATE';
  SELECT with_check INTO worker_insert
  FROM pg_catalog.pg_policies
  WHERE schemaname='public' AND tablename='outbox_entries'
    AND policyname='outbox_entries_worker_insert' AND cmd='INSERT';

  IF app_helper IS NULL
     OR app_helper_invoker IS DISTINCT FROM TRUE
     OR app_helper NOT LIKE '%current_user NOT IN%'
     OR app_helper NOT LIKE '%app_rls_deal_visible%'
     OR app_helper NOT LIKE '%one_deal_app%'
     OR callback_helper IS NULL
     OR callback_helper_invoker IS DISTINCT FROM TRUE
     OR callback_helper NOT LIKE '%current_user NOT IN%'
     OR callback_helper NOT LIKE '%verified_bank_callback_context%'
     OR callback_helper NOT LIKE '%callback_event_id%'
  THEN
    RAISE EXCEPTION 'outbox dependency-isolation helpers are incomplete'
      USING ERRCODE='42501';
  END IF;

  IF tenant_select IS NULL
     OR tenant_select NOT LIKE '%app_outbox_application_deal_visible%'
     OR tenant_select LIKE '%app_rls_deal_visible%'
     OR tenant_insert IS NULL
     OR tenant_insert NOT LIKE '%app_outbox_application_deal_visible%'
     OR callback_select IS NULL
     OR callback_select NOT LIKE '%app_outbox_settlement_callback_visible%'
     OR callback_update IS NULL
     OR callback_update NOT LIKE '%app_outbox_settlement_callback_visible%'
     OR callback_check IS NULL
     OR callback_check NOT LIKE '%app_outbox_settlement_callback_visible%'
  THEN
    RAISE EXCEPTION 'outbox policies still expose tenant/callback dependencies directly'
      USING ERRCODE='42501';
  END IF;

  IF worker_select IS NULL OR worker_update IS NULL OR worker_insert IS NULL
     OR worker_select NOT LIKE '%app_outbox%'
     OR worker_update NOT LIKE '%app_outbox%'
     OR worker_insert LIKE '%''app_outbox''%'
  THEN
    RAISE EXCEPTION 'dedicated app_outbox delivery boundary was widened or removed'
      USING ERRCODE='42501';
  END IF;
END
$outbox_dependency_isolation_proof$;
