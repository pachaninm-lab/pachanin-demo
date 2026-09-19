-- P0 identity/RLS exact-head correction: an UPDATE policy is not sufficient when
-- FORCE RLS also hides the target row from SELECT. PostgreSQL evaluates UPDATE
-- against rows visible to the command principal; the BANK_CALLBACK transaction
-- therefore could satisfy the bounded settlement UPDATE predicate yet update
-- zero outbox rows because the generic tenant SELECT policy deliberately admits
-- ordinary application roles only.
--
-- Add a separate, purpose-specific SELECT policy with the exact same callback
-- authority predicate. This does not broaden the ordinary tenant SELECT policy,
-- does not grant any table privilege, and does not give the durable outbox worker
-- Deal/callback authority.

ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_entries_settlement_callback_select
ON public."outbox_entries";

CREATE POLICY outbox_entries_settlement_callback_select
ON public."outbox_entries"
FOR SELECT TO PUBLIC
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
);

DO $outbox_callback_select_proof$
DECLARE
  callback_select_qual TEXT;
  tenant_select_qual TEXT;
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

  SELECT qual INTO callback_select_qual
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_settlement_callback_select'
    AND cmd = 'SELECT';

  SELECT qual INTO tenant_select_qual
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'outbox_entries'
    AND policyname = 'outbox_entries_select'
    AND cmd = 'SELECT';

  IF callback_select_qual IS NULL
     OR callback_select_qual NOT LIKE '%BANK_CALLBACK%'
     OR callback_select_qual NOT LIKE '%settlement-bank-request:%'
     OR callback_select_qual NOT LIKE '%callback_event_id%'
     OR callback_select_qual NOT LIKE '%buyerOrgId%'
     OR callback_select_qual LIKE '%app_outbox%'
     OR callback_select_qual LIKE '%app_staff%'
  THEN
    RAISE EXCEPTION 'settlement callback SELECT authority is not least-privilege bounded'
      USING ERRCODE = '42501';
  END IF;

  IF tenant_select_qual IS NULL
     OR tenant_select_qual LIKE '%BANK_CALLBACK%'
     OR tenant_select_qual LIKE '%app_outbox%'
  THEN
    RAISE EXCEPTION 'ordinary tenant outbox SELECT policy was broadened unexpectedly'
      USING ERRCODE = '42501';
  END IF;
END
$outbox_callback_select_proof$;
