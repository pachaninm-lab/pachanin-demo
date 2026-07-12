-- Confirmed commercial basis and the initial saga snapshot are immutable after
-- Deal creation. Lifecycle commands may change status, nextAction, version and
-- closedAt. Operational facts belong in normalized PostgreSQL tables, not in a
-- mutable JSON authority bag.

CREATE OR REPLACE FUNCTION public.forbid_deal_basis_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF ROW(
    OLD."tenantId",
    OLD."lotId",
    OLD."sourceLotId",
    OLD."dealNumber",
    OLD."sellerOrgId",
    OLD."buyerOrgId",
    OLD."volumeTons",
    OLD."pricePerTon",
    OLD."totalRub",
    OLD."volumeTonsDec",
    OLD."pricePerTonDec",
    OLD."totalKopecks",
    OLD."currency",
    OLD."culture",
    OLD."cropClass",
    OLD."region",
    OLD."incoterms",
    OLD."sagaState"
  ) IS DISTINCT FROM ROW(
    NEW."tenantId",
    NEW."lotId",
    NEW."sourceLotId",
    NEW."dealNumber",
    NEW."sellerOrgId",
    NEW."buyerOrgId",
    NEW."volumeTons",
    NEW."pricePerTon",
    NEW."totalRub",
    NEW."volumeTonsDec",
    NEW."pricePerTonDec",
    NEW."totalKopecks",
    NEW."currency",
    NEW."culture",
    NEW."cropClass",
    NEW."region",
    NEW."incoterms",
    NEW."sagaState"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'confirmed deal commercial and saga basis is immutable',
      CONSTRAINT = 'deals_confirmed_basis_immutable';
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.forbid_deal_basis_mutation() FROM PUBLIC;
DROP TRIGGER IF EXISTS deals_basis_immutable ON public."deals";
CREATE TRIGGER deals_basis_immutable
  BEFORE UPDATE OF
    "tenantId",
    "lotId",
    "sourceLotId",
    "dealNumber",
    "sellerOrgId",
    "buyerOrgId",
    "volumeTons",
    "pricePerTon",
    "totalRub",
    "volumeTonsDec",
    "pricePerTonDec",
    "totalKopecks",
    "currency",
    "culture",
    "cropClass",
    "region",
    "incoterms",
    "sagaState"
  ON public."deals"
  FOR EACH ROW EXECUTE FUNCTION public.forbid_deal_basis_mutation();

COMMENT ON FUNCTION public.forbid_deal_basis_mutation() IS
  'Rejects any rewrite of the confirmed commercial columns or initial saga snapshot; operational facts use normalized tables.';
