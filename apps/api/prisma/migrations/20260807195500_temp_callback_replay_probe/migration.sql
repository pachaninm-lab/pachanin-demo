-- TEMPORARY exact-head diagnostic. This migration is deleted before merge.
-- It preserves the normal first callback path and deliberately raises on the
-- replay attempt so Security Abuse evidence records the committed operation /
-- callback state after the first successful callback.

CREATE OR REPLACE FUNCTION public.app_bank_callback_scope(
  p_deal_id TEXT,
  p_operation_id TEXT
)
RETURNS TABLE ("tenantId" TEXT, "buyerOrgId" TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
STABLE
AS $function$
DECLARE
  op_status TEXT;
  op_event TEXT;
  op_partner TEXT;
  cb_count BIGINT;
  cb_events TEXT;
BEGIN
  SELECT operation.status, operation.callback_event_id, operation.required_partner_id
  INTO op_status, op_event, op_partner
  FROM settlement.bank_operations operation
  WHERE operation.deal_id = p_deal_id
    AND operation.id = p_operation_id;

  SELECT count(*), string_agg(callback.event_id, ',' ORDER BY callback.event_id)
  INTO cb_count, cb_events
  FROM settlement.bank_callbacks callback
  WHERE callback.deal_id = p_deal_id
    AND callback.operation_id = p_operation_id;

  IF op_status IS DISTINCT FROM 'PENDING' OR COALESCE(cb_count, 0) > 0 THEN
    RAISE EXCEPTION
      'TEMP_CALLBACK_REPLAY_PROBE deal=% operation=% status=% op_event=% op_partner=% callback_count=% callback_events=%',
      p_deal_id, p_operation_id, op_status, op_event, op_partner,
      COALESCE(cb_count, 0), COALESCE(cb_events, '');
  END IF;

  RETURN QUERY
  SELECT deal."tenantId", deal."buyerOrgId"
  FROM settlement.bank_operations operation
  JOIN public.deals deal ON deal.id = operation.deal_id
  WHERE operation.deal_id = p_deal_id
    AND operation.id = p_operation_id
    AND operation.status = 'PENDING'
    AND deal."tenantId" = operation.tenant_id;
END
$function$;
