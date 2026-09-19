-- A dispute claim must be initiated by one of the two contractual Deal parties.
-- Neutral actors may submit evidence or exercise assigned oversight authority,
-- but they cannot silently choose the respondent by originating a claim.

CREATE OR REPLACE FUNCTION dispute.validate_party_initiator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, dispute
AS $function$
DECLARE
  deal_row public."deals"%ROWTYPE;
  expected_respondent_org_id text;
BEGIN
  SELECT * INTO deal_row
  FROM public."deals" deal
  WHERE deal."id" = NEW.deal_id
    AND deal."tenantId" = NEW.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_DEAL_NOT_FOUND';
  END IF;

  IF NEW.initiator_org_id NOT IN (deal_row."buyerOrgId", deal_row."sellerOrgId") THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'DISPUTE_PARTY_INITIATOR_REQUIRED';
  END IF;

  expected_respondent_org_id := CASE
    WHEN NEW.initiator_org_id = deal_row."buyerOrgId" THEN deal_row."sellerOrgId"
    ELSE deal_row."buyerOrgId"
  END;

  IF NEW.respondent_org_id IS DISTINCT FROM expected_respondent_org_id THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'DISPUTE_RESPONDENT_SCOPE_INVALID';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS dispute_party_initiator_guard ON dispute.cases;
CREATE TRIGGER dispute_party_initiator_guard
BEFORE INSERT ON dispute.cases
FOR EACH ROW EXECUTE FUNCTION dispute.validate_party_initiator();

REVOKE ALL ON FUNCTION dispute.validate_party_initiator() FROM PUBLIC;
