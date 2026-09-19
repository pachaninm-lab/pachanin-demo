-- P0 identity/RLS acceptance correction.
--
-- FORCE RLS exposed two pre-existing assumptions in the Settlement callback path:
-- 1) a verified BANK_CALLBACK must be able to transition the exact bound pending
--    bank operation without receiving generic settlement authority;
-- 2) after that transition, replay of the same signed partner/event must still
--    resolve the already-persisted callback and return duplicate=true.
--
-- The industrial PostgreSQL harness and still-supported legacy command path use
-- public.bank_operations. Preserve that compatibility only while a Deal has no
-- Settlement aggregate. Once settlement.payments exists, Settlement becomes the
-- sole callback authority and the legacy branch is structurally excluded.
--
-- A completed operation may establish only the minimal tenant/buyer scope needed
-- to reach idempotent replay handling, and only when the authoritative operation
-- row already contains durable callback evidence. A different event cannot repeat
-- the financial effect because the Deal command state transition is already closed;
-- the exact stored receipt remains the authority for duplicate/mismatch handling.
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

-- Preserve the original two-argument API used by the application.
--
-- Priority 0: current Settlement authority. A pending operation may establish
-- callback context. A completed operation may establish replay scope only when
-- the operation itself contains all callback-binding fields that the forced-RLS
-- transition requires.
--
-- Priority 1: legacy public.bank_operations compatibility. A pending operation
-- may establish initial scope. DONE/FAILED may establish replay-only scope only
-- when durable callback evidence already exists on that exact operation. Legacy
-- authority remains excluded whenever a Settlement payment aggregate exists.
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
  SELECT scoped."tenantId", scoped."buyerOrgId"
  FROM (
    SELECT deal."tenantId", deal."buyerOrgId", 0 AS authority_priority
    FROM settlement.bank_operations operation
    JOIN public.deals deal ON deal.id = operation.deal_id
    WHERE operation.deal_id = p_deal_id
      AND operation.id = p_operation_id
      AND deal."tenantId" = operation.tenant_id
      AND (
        operation.status = 'PENDING'
        OR (
          operation.status IN ('CONFIRMED', 'FAILED')
          AND operation.callback_event_id IS NOT NULL
          AND operation.callback_key_id IS NOT NULL
          AND operation.callback_payload_fingerprint IS NOT NULL
        )
      )

    UNION ALL

    SELECT deal."tenantId", deal."buyerOrgId", 1 AS authority_priority
    FROM public."bank_operations" operation
    JOIN public.deals deal ON deal.id = operation."dealId"
    WHERE operation."dealId" = p_deal_id
      AND operation."id" = p_operation_id
      AND (
        operation."status" = 'PENDING'
        OR (
          operation."status" = 'DONE'
          AND operation."confirmedAt" IS NOT NULL
          AND operation."bankRef" IS NOT NULL
          AND operation."responsePayload" IS NOT NULL
        )
        OR (
          operation."status" = 'FAILED'
          AND operation."failureReason" IS NOT NULL
          AND operation."bankRef" IS NOT NULL
          AND operation."responsePayload" IS NOT NULL
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM settlement.payments authority
        WHERE authority.deal_id = p_deal_id
      )
  ) scoped
  ORDER BY scoped.authority_priority
  LIMIT 1
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
     OR scope_definition NOT LIKE '%callback_event_id%'
     OR scope_definition NOT LIKE '%callback_key_id%'
     OR scope_definition NOT LIKE '%callback_payload_fingerprint%'
     OR (
       scope_definition NOT LIKE '%public."bank_operations"%'
       AND scope_definition NOT LIKE '%public.bank_operations%'
     )
     OR scope_definition NOT LIKE '%confirmedAt%'
     OR scope_definition NOT LIKE '%responsePayload%'
     OR scope_definition NOT LIKE '%failureReason%'
     OR scope_definition NOT LIKE '%settlement.payments%'
     OR scope_definition NOT LIKE '%NOT EXISTS%'
  THEN
    RAISE EXCEPTION 'callback scope does not preserve evidence-bound replay plus fail-closed legacy compatibility'
      USING ERRCODE = '42501';
  END IF;
END
$verified_callback_rls_proof$;
