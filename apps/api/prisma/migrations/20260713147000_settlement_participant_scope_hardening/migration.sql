-- IR-10.4 participant-scope hardening.
-- Human business roles, including ADMIN and SUPPORT_MANAGER, must be explicit
-- active DealParticipants. Only the verified BANK_CALLBACK system actor receives
-- a narrow buyer-organization exception for the exact bound operation.

CREATE OR REPLACE FUNCTION settlement.deal_authorized(
  p_deal_id TEXT,
  p_write BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, settlement
AS $function$
  SELECT settlement.context_ready()
    AND EXISTS (
      SELECT 1
      FROM public."deals" deal
      WHERE deal."id" = p_deal_id
        AND deal."tenantId" = current_setting('app.current_tenant_id', true)
        AND (
          (
            current_setting('app.current_role', true) = 'BANK_CALLBACK'
            AND deal."buyerOrgId" = current_setting('app.current_org_id', true)
          )
          OR EXISTS (
            SELECT 1
            FROM public."deal_participants" participant
            WHERE participant."dealId" = deal."id"
              AND participant."tenantId" = current_setting('app.current_tenant_id', true)
              AND participant."organizationId" = current_setting('app.current_org_id', true)
              AND participant."userId" = current_setting('app.current_user_id', true)
              AND participant."role" = current_setting('app.current_role', true)
              AND participant."status" = 'ACTIVE'
              AND participant."accessLevel" IN (
                CASE WHEN p_write THEN 'WORK' ELSE 'READ' END,
                CASE WHEN p_write THEN 'APPROVE' ELSE 'WORK' END,
                'APPROVE'
              )
          )
        )
        AND (
          NOT p_write
          OR current_setting('app.current_role', true) IN (
            'BUYER', 'ACCOUNTING', 'ADMIN', 'SUPPORT_MANAGER',
            'BANK_CALLBACK', 'ARBITRATOR'
          )
        )
    )
$function$;

COMMENT ON FUNCTION settlement.deal_authorized(TEXT, BOOLEAN) IS
  'Requires exact tenant/org/user/role DealParticipant scope for every human actor; BANK_CALLBACK is limited to the buyer organization after cryptographic operation binding.';
