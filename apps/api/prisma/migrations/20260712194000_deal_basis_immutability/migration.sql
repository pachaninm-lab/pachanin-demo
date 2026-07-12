-- Confirmed commercial basis is immutable after Deal creation.
-- Lifecycle commands may change status, nextAction, version, closedAt and may add
-- operational saga keys such as logisticsBasis. They cannot rewrite the auction
-- basis, counterparties, price, volume, amount or original basis snapshot.

CREATE OR REPLACE FUNCTION public.forbid_deal_basis_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  old_basis jsonb;
  new_basis jsonb;
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
    OLD."incoterms"
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
    NEW."incoterms"
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'confirmed deal commercial basis is immutable',
      CONSTRAINT = 'deals_confirmed_basis_immutable';
  END IF;

  old_basis := jsonb_build_object(
    'source', OLD."sagaState" ->> 'source',
    'integrationEventId', OLD."sagaState" ->> 'integrationEventId',
    'sourceHash', OLD."sagaState" ->> 'sourceHash',
    'lotId', OLD."sagaState" ->> 'lotId',
    'winnerBidId', OLD."sagaState" ->> 'winnerBidId',
    'sellerOrgId', OLD."sagaState" ->> 'sellerOrgId',
    'buyerOrgId', OLD."sagaState" ->> 'buyerOrgId',
    'sellerUserId', OLD."sagaState" ->> 'sellerUserId',
    'buyerUserId', OLD."sagaState" ->> 'buyerUserId',
    'culture', OLD."sagaState" ->> 'culture',
    'cropClass', OLD."sagaState" -> 'cropClass',
    'region', OLD."sagaState" -> 'region',
    'incoterms', OLD."sagaState" -> 'incoterms',
    'volumeTons', OLD."sagaState" ->> 'volumeTons',
    'pricePerTon', OLD."sagaState" ->> 'pricePerTon',
    'totalKopecks', OLD."sagaState" ->> 'totalKopecks',
    'currency', OLD."sagaState" ->> 'currency',
    'paymentTerms', OLD."sagaState" -> 'paymentTerms'
  );
  new_basis := jsonb_build_object(
    'source', NEW."sagaState" ->> 'source',
    'integrationEventId', NEW."sagaState" ->> 'integrationEventId',
    'sourceHash', NEW."sagaState" ->> 'sourceHash',
    'lotId', NEW."sagaState" ->> 'lotId',
    'winnerBidId', NEW."sagaState" ->> 'winnerBidId',
    'sellerOrgId', NEW."sagaState" ->> 'sellerOrgId',
    'buyerOrgId', NEW."sagaState" ->> 'buyerOrgId',
    'sellerUserId', NEW."sagaState" ->> 'sellerUserId',
    'buyerUserId', NEW."sagaState" ->> 'buyerUserId',
    'culture', NEW."sagaState" ->> 'culture',
    'cropClass', NEW."sagaState" -> 'cropClass',
    'region', NEW."sagaState" -> 'region',
    'incoterms', NEW."sagaState" -> 'incoterms',
    'volumeTons', NEW."sagaState" ->> 'volumeTons',
    'pricePerTon', NEW."sagaState" ->> 'pricePerTon',
    'totalKopecks', NEW."sagaState" ->> 'totalKopecks',
    'currency', NEW."sagaState" ->> 'currency',
    'paymentTerms', NEW."sagaState" -> 'paymentTerms'
  );

  IF old_basis IS DISTINCT FROM new_basis THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'confirmed deal saga basis is immutable',
      CONSTRAINT = 'deals_confirmed_saga_basis_immutable';
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
  'Rejects changes to confirmed commercial and saga basis while allowing lifecycle and additive operational saga updates.';
