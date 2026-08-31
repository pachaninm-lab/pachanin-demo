-- FORCE-RLS callback authority must not depend on recursively evaluating the
-- general Deal participant policy from inside Settlement policies. The public
-- callback entry point has already verified the HMAC before it creates the
-- BANK_CALLBACK RLS context; this helper proves that exact context against the
-- authoritative Deal row and optional partner/event identity.
--
-- It returns only BOOLEAN, grants no table access, and is usable only as a
-- predicate inside the existing forced-RLS policies.

CREATE OR REPLACE FUNCTION settlement.verified_bank_callback_context(
  p_deal_id TEXT,
  p_tenant_id TEXT,
  p_partner_id TEXT DEFAULT NULL,
  p_event_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
  SELECT
    settlement.context_ready()
    AND current_setting('app.current_role', true) = 'BANK_CALLBACK'
    AND p_tenant_id = current_setting('app.current_tenant_id', true)
    AND (
      p_partner_id IS NULL
      OR current_setting('app.current_user_id', true) = 'bank-callback:' || p_partner_id
    )
    AND (
      p_event_id IS NULL
      OR current_setting('app.current_session_id', true) = 'bank-event:' || p_event_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.deals deal
      WHERE deal.id = p_deal_id
        AND deal."tenantId" = p_tenant_id
        AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
    )
$function$;

COMMENT ON FUNCTION settlement.verified_bank_callback_context(TEXT, TEXT, TEXT, TEXT) IS
  'Boolean-only SECURITY DEFINER predicate for a server-created, HMAC-verified BANK_CALLBACK context. It binds tenant, buyer organization and optional partner/event identity without granting caller table access.';

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
  settlement.verified_bank_callback_context(
    bank_operations.deal_id,
    bank_operations.tenant_id,
    bank_operations.required_partner_id,
    NULL
  )
);

DROP POLICY IF EXISTS bank_operations_verified_callback_update
ON settlement.bank_operations;
CREATE POLICY bank_operations_verified_callback_update
ON settlement.bank_operations
FOR UPDATE TO PUBLIC
USING (
  bank_operations.status = 'PENDING'
  AND settlement.verified_bank_callback_context(
    bank_operations.deal_id,
    bank_operations.tenant_id,
    bank_operations.required_partner_id,
    NULL
  )
)
WITH CHECK (
  bank_operations.status IN ('CONFIRMED', 'FAILED')
  AND bank_operations.callback_event_id IS NOT NULL
  AND bank_operations.callback_key_id IS NOT NULL
  AND bank_operations.callback_payload_fingerprint IS NOT NULL
  AND settlement.verified_bank_callback_context(
    bank_operations.deal_id,
    bank_operations.tenant_id,
    bank_operations.required_partner_id,
    bank_operations.callback_event_id
  )
);

DROP POLICY IF EXISTS bank_callbacks_verified_replay_select
ON settlement.bank_callbacks;
CREATE POLICY bank_callbacks_verified_replay_select
ON settlement.bank_callbacks
FOR SELECT TO PUBLIC
USING (
  settlement.verified_bank_callback_context(
    bank_callbacks.deal_id,
    bank_callbacks.tenant_id,
    bank_callbacks.partner_id,
    bank_callbacks.event_id
  )
);

DO $verified_callback_authority_proof$
DECLARE
  helper_definition TEXT;
  operation_update_check TEXT;
  replay_qual TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'settlement.verified_bank_callback_context(text,text,text,text)'::regprocedure
  ) INTO helper_definition;

  IF helper_definition IS NULL
     OR helper_definition NOT LIKE '%SECURITY DEFINER%'
     OR helper_definition NOT LIKE '%BANK_CALLBACK%'
     OR helper_definition NOT LIKE '%buyerOrgId%'
     OR helper_definition NOT LIKE '%bank-callback:%'
     OR helper_definition NOT LIKE '%bank-event:%'
     OR helper_definition LIKE '%RETURNS TABLE%'
  THEN
    RAISE EXCEPTION 'verified callback context helper is not boolean-only and fully bound'
      USING ERRCODE = '42501';
  END IF;

  SELECT with_check INTO operation_update_check
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'settlement'
    AND tablename = 'bank_operations'
    AND policyname = 'bank_operations_verified_callback_update'
    AND cmd = 'UPDATE';

  SELECT qual INTO replay_qual
  FROM pg_catalog.pg_policies
  WHERE schemaname = 'settlement'
    AND tablename = 'bank_callbacks'
    AND policyname = 'bank_callbacks_verified_replay_select'
    AND cmd = 'SELECT';

  IF operation_update_check IS NULL
     OR operation_update_check NOT LIKE '%callback_event_id%'
     OR operation_update_check NOT LIKE '%verified_bank_callback_context%'
     OR replay_qual IS NULL
     OR replay_qual NOT LIKE '%verified_bank_callback_context%'
  THEN
    RAISE EXCEPTION 'verified callback policies are not bound to the authority helper'
      USING ERRCODE = '42501';
  END IF;
END
$verified_callback_authority_proof$;
