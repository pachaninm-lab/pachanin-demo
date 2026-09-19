-- public.ledger_entries is a compatibility projection. Its legacy invariant
-- trigger reads public.accounts, which has no tenant column and therefore must
-- not be exposed directly to the restricted application role. Execute only the
-- trigger check with owner privileges and a fixed search_path instead.

CREATE OR REPLACE FUNCTION public.check_money_invariants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."accounts" account
    WHERE account."id" = NEW."debitAccount"
      AND account."balanceKopecks" < NEW."amountKopecks"
  ) THEN
    RAISE EXCEPTION 'Insufficient balance for account %: balance=%, required=%',
      NEW."debitAccount",
      (SELECT account."balanceKopecks"
       FROM public."accounts" account
       WHERE account."id" = NEW."debitAccount"),
      NEW."amountKopecks"
      USING ERRCODE = '23514';
  END IF;

  IF NEW."entryType" = 'RESERVE' AND EXISTS (
    SELECT 1
    FROM public."accounts" account
    WHERE account."id" = NEW."debitAccount"
      AND account."reservedKopecks" + NEW."amountKopecks" > account."balanceKopecks"
  ) THEN
    RAISE EXCEPTION 'Reserve exceeds balance for account %', NEW."debitAccount"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.check_money_invariants() FROM PUBLIC;

DO $public_ledger_invariant_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT EXECUTE ON FUNCTION public.check_money_invariants() TO app_deal;
    REVOKE ALL ON TABLE public."accounts" FROM app_deal;
  END IF;
END
$public_ledger_invariant_grants$;

COMMENT ON FUNCTION public.check_money_invariants() IS
  'Trigger-only compatibility ledger invariant check; reads accounts without exposing the global table to application roles.';
