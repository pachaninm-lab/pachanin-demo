-- Forward-only correction for the public settlement projection guard.
-- The original local variable name matched settlement.payments.deal_id and
-- caused PL/pgSQL ambiguity at runtime. Keep the fail-closed boundary intact
-- while making the projection lookup explicit.

CREATE OR REPLACE FUNCTION settlement.guard_public_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
DECLARE
  projection_deal_id TEXT;
BEGIN
  IF current_setting('app.settlement_projection_write', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  projection_deal_id := CASE TG_TABLE_NAME
    WHEN 'payments' THEN COALESCE(NEW."dealId", OLD."dealId")
    WHEN 'bank_operations' THEN COALESCE(NEW."dealId", OLD."dealId")
    WHEN 'ledger_entries' THEN COALESCE(NEW."dealId", OLD."dealId")
  END;

  IF projection_deal_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM settlement.payments authority
    WHERE authority.deal_id = projection_deal_id
  ) THEN
    RAISE EXCEPTION 'public money tables are read projections; settlement authority must be used'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END
$function$;
