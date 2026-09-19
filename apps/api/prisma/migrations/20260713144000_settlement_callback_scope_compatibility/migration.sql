-- IR-10.4 callback scope compatibility.
--
-- New Settlement operations retain trusted scope after confirmation so an exact
-- replay can resolve to the existing append-only callback fact. Legacy public
-- PostgreSQL operations remain readable only for deals that do not yet have a
-- Settlement aggregate; once Settlement authority exists, the legacy path is
-- structurally excluded.

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
    JOIN public."deals" deal ON deal."id" = operation.deal_id
    WHERE operation.deal_id = p_deal_id
      AND operation.id = p_operation_id
      AND deal."tenantId" = operation.tenant_id

    UNION ALL

    SELECT deal."tenantId", deal."buyerOrgId", 1 AS authority_priority
    FROM public."bank_operations" operation
    JOIN public."deals" deal ON deal."id" = operation."dealId"
    WHERE operation."dealId" = p_deal_id
      AND operation."id" = p_operation_id
      AND operation."status" = 'PENDING'
      AND NOT EXISTS (
        SELECT 1
        FROM settlement.payments authority
        WHERE authority.deal_id = p_deal_id
      )
  ) scoped
  ORDER BY scoped.authority_priority
  LIMIT 1
$function$;
