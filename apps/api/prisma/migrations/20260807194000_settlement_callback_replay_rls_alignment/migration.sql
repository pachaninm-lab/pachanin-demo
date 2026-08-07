-- P0 identity/RLS acceptance correction.
--
-- FORCE RLS exposed two pre-existing assumptions in the Settlement callback path:
-- 1) a verified BANK_CALLBACK must be able to transition the exact bound pending
--    bank operation without receiving generic settlement authority;
-- 2) after that transition, replay of the same signed partner/event must still
--    resolve the already-persisted callback and return duplicate=true.
--
-- Keep the ordinary settlement policies unchanged and add purpose-specific,
-- cryptographically-bound callback policies. No table grant, ownership,
-- BYPASSRLS or human role authority is widened.

ALTER TABLE settlement.bank_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_operations FORCE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement.bank_callbacks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bank_operations_verified_callback_select
ON settlement.bank_operations;
CREATE POLICY bank_operations_verified_callback_select
ON settlement.bank_operations
FOR SELECT TO PUBLIC
USING (
  settlement.context_ready()
  AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
  AND bank_operations.tenant_id = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_user_id', true) = 'bank-callback:' || bank_operations.required_partner_id
  AND EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = bank_operations.deal_id
      AND deal."tenantId" = bank_operations.tenant_id
      AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
  )
);

DROP POLICY IF EXISTS bank_operations_verified_callback_update
ON settlement.bank_operations;
CREATE POLICY bank_operations_verified_callback_update
ON settlement.bank_operations
FOR UPDATE TO PUBLIC
USING (
  settlement.context_ready()
  AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
  AND bank_operations.status = 'PENDING'
  AND bank_operations.tenant_id = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_user_id', true) = 'bank-callback:' || bank_operations.required_partner_id
  AND EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = bank_operations.deal_id
      AND deal."tenantId" = bank_operations.tenant_id
      AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
  )
)
WITH CHECK (
  settlement.context_ready()
  AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
  AND bank_operations.status IN ('CONFIRMED', 'FAILED')
  AND bank_operations.tenant_id = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_user_id', true) = 'bank-callback:' || bank_operations.required_partner_id
  AND bank_operations.callback_event_id IS NOT NULL
  AND bank_operations.callback_key_id IS NOT NULL
  AND bank_operations.callback_payload_fingerprint IS NOT NULL
  AND current_setting('app.current_session_id', true) = 'bank-event:' || bank_operations.callback_event_id
  AND EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = bank_operations.deal_id
      AND deal."tenantId" = bank_operations.tenant_id
      AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
  )
);

DROP POLICY IF EXISTS bank_callbacks_verified_replay_select
ON settlement.bank_callbacks;
CREATE POLICY bank_callbacks_verified_replay_select
ON settlement.bank_callbacks
FOR SELECT TO PUBLIC
USING (
  settlement.context_ready()
  AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
  AND bank_callbacks.tenant_id = current_setting('app.current_tenant_id', true)
  AND current_setting('app.current_user_id', true) = 'bank-callback:' || bank_callbacks.partner_id
  AND current_setting('app.current_session_id', true) = 'bank-event:' || bank_callbacks.event_id
  AND EXISTS (
    SELECT 1
    FROM public.deals deal
    WHERE deal.id = bank_callbacks.deal_id
      AND deal."tenantId" = bank_callbacks.tenant_id
      AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
  )
);

-- Preserve the original two-argument API used by the application. A pending
-- operation may establish the callback context. Once a callback is persisted,
-- the same operation may establish only the minimal tenant/buyer scope needed
-- to enter the replay transaction; the replay itself is then restricted by
-- partner + event through bank_callbacks_verified_replay_select.
CREATE OR REPLACE FUNCTION public.app_bank_callback_scope(
  p_deal_id TEXT,
  p_operation_id TEXT
)
RETURNS TABLE ("tenantId" TEXT, "buyerOrgId" TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
STABLE
AS $function$
  SELECT deal."tenantId", deal."buyerOrgId"
  FROM settlement.bank_operations operation
  JOIN public.deals deal ON deal.id = operation.deal_id
  WHERE operation.deal_id = p_deal_id
    AND operation.id = p_operation_id
    AND deal."tenantId" = operation.tenant_id
    AND (
      operation.status = 'PENDING'
      OR EXISTS (
        SELECT 1
        FROM settlement.bank_callbacks callback
        WHERE callback.operation_id = operation.id
          AND callback.deal_id = operation.deal_id
          AND callback.tenant_id = operation.tenant_id
      )
    )
$function$;

DO $verified_callback_rls_proof$
DECLARE
  operation_select_qual TEXT;
  operation_update_qual TEXT;
  operation_update_check TEXT;
  replay_select_qual TEXT;
  scope_definition TEXT;
BEGIN
  SELECT qual INTO operation_select_qual
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'settlement'
    AND tablename = 'bank_operations'
    AND policyname = 'bank_operations_verified_callback_select'
    AND cmd = 'SELECT';

  SELECT qual, with_check INTO operation_update_qual, operation_update_check
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'settlement'
    AND tablename = 'bank_operations'
    AND policyname = 'bank_operations_verified_callback_update'
    AND cmd = 'UPDATE';

  SELECT qual INTO replay_select_qual
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'settlement'
    AND tablename = 'bank_callbacks'
    AND policyname = 'bank_callbacks_verified_replay_select'
    AND cmd = 'SELECT';

  SELECT pg_get_functiondef('public.app_bank_callback_scope(text,text)'::regprocedure)
  INTO scope_definition;

  IF operation_select_qual IS NULL
     OR operation_select_qual NOT LIKE '%BANK_CALLBACK%'
     OR operation_select_qual NOT LIKE '%bank-callback:%'
     OR operation_select_qual NOT LIKE '%buyerOrgId%'
  THEN
    RAISE EXCEPTION 'verified callback operation SELECT boundary is incomplete'
      USING ERRCODE = '42501';
  END IF;

  IF operation_update_qual IS NULL
     OR operation_update_check IS NULL
     OR operation_update_qual NOT LIKE '%PENDING%'
     OR operation_update_check NOT LIKE '%CONFIRMED%'
     OR operation_update_check NOT LIKE '%FAILED%'
     OR operation_update_check NOT LIKE '%callback_event_id%'
     OR operation_update_check NOT LIKE '%bank-event:%'
  THEN
    RAISE EXCEPTION 'verified callback operation UPDATE boundary is incomplete'
      USING ERRCODE = '42501';
  END IF;

  IF replay_select_qual IS NULL
     OR replay_select_qual NOT LIKE '%BANK_CALLBACK%'
     OR replay_select_qual NOT LIKE '%bank-callback:%'
     OR replay_select_qual NOT LIKE '%bank-event:%'
     OR replay_select_qual NOT LIKE '%buyerOrgId%'
  THEN
    RAISE EXCEPTION 'verified callback replay SELECT boundary is incomplete'
      USING ERRCODE = '42501';
  END IF;

  IF scope_definition IS NULL
     OR scope_definition NOT LIKE '%operation.status = ''PENDING''%'
     OR scope_definition NOT LIKE '%settlement.bank_callbacks%'
  THEN
    RAISE EXCEPTION 'callback scope does not preserve pending + persisted replay authority'
      USING ERRCODE = '42501';
  END IF;
END
$verified_callback_rls_proof$;
