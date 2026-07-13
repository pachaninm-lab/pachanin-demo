-- IR-10.4 additive corrections before application activation.
-- Payment terms are immutable versions; the highest version is authoritative.

DROP INDEX IF EXISTS settlement.settlement_terms_one_active_key;
ALTER TABLE settlement.payment_terms
  ALTER COLUMN status SET DEFAULT 'ISSUED';
UPDATE settlement.payment_terms SET status = 'ISSUED' WHERE status <> 'ISSUED';
ALTER TABLE settlement.payment_terms
  DROP CONSTRAINT IF EXISTS settlement_terms_status_check;
ALTER TABLE settlement.payment_terms
  ADD CONSTRAINT settlement_terms_status_check CHECK (status = 'ISSUED');

CREATE OR REPLACE FUNCTION settlement.guard_public_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, settlement
AS $function$
DECLARE
  target_deal_id TEXT;
BEGIN
  IF current_setting('app.settlement_projection_write', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    target_deal_id := OLD."dealId";
  ELSE
    target_deal_id := NEW."dealId";
  END IF;

  IF target_deal_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM settlement.payments authority
    WHERE authority.deal_id = target_deal_id
  ) THEN
    RAISE EXCEPTION 'public money tables are read projections; settlement authority must be used'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$function$;
