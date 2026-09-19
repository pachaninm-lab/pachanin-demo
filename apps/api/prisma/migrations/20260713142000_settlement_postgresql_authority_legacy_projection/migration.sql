-- Forward-only compatibility bridge for the legacy public Prisma projection.
-- `amountRub` is not monetary authority: it is forced to NULL and cannot be
-- written. The settlement schema stores every authoritative amount exclusively
-- as BIGINT minor units. Physical removal requires a separately approved
-- destructive migration; until then the column remains always NULL and
-- write-forbidden.

ALTER TABLE public."payments"
  ADD COLUMN IF NOT EXISTS "amountRub" DOUBLE PRECISION;

UPDATE public."payments"
SET "amountRub" = NULL
WHERE "amountRub" IS NOT NULL;

ALTER TABLE public."payments"
  DROP CONSTRAINT IF EXISTS payments_amountRub_forbidden;
ALTER TABLE public."payments"
  ADD CONSTRAINT payments_amountRub_forbidden CHECK ("amountRub" IS NULL);

CREATE OR REPLACE FUNCTION public.app_settlement_forbid_legacy_float_money()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW."amountRub" IS NOT NULL THEN
    RAISE EXCEPTION 'legacy amountRub is forbidden; use integer amountKopecks'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS settlement_forbid_legacy_float_money ON public."payments";
CREATE TRIGGER settlement_forbid_legacy_float_money
BEFORE INSERT OR UPDATE OF "amountRub" ON public."payments"
FOR EACH ROW EXECUTE FUNCTION public.app_settlement_forbid_legacy_float_money();
