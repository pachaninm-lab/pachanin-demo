-- A monetary case is inserted before its settlement hold so the transaction can
-- use the dispute id as the hold basis. Permit exactly one NULL -> value binding
-- on the first version transition; all later identity and hold changes remain
-- forbidden.

CREATE OR REPLACE FUNCTION dispute.guard_case_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'dispute cases cannot be deleted' USING ERRCODE = '23514';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.deal_id IS DISTINCT FROM OLD.deal_id OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.initiator_org_id IS DISTINCT FROM OLD.initiator_org_id
     OR NEW.initiator_user_id IS DISTINCT FROM OLD.initiator_user_id
     OR NEW.claim_amount_minor IS DISTINCT FROM OLD.claim_amount_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency THEN
    RAISE EXCEPTION 'dispute identity and claim are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.settlement_hold_id IS DISTINCT FROM OLD.settlement_hold_id
     AND NOT (
       OLD.settlement_hold_id IS NULL
       AND NEW.settlement_hold_id IS NOT NULL
       AND OLD.version = 1
       AND NEW.version = 2
     ) THEN
    RAISE EXCEPTION 'dispute settlement hold binding is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION 'dispute update requires exact CAS version increment' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := transaction_timestamp();
  RETURN NEW;
END
$function$;
