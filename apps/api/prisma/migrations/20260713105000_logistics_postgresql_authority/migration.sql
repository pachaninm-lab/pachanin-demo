-- IR-10.2: the PIN hash copied from normalized admission is assignment authority.
-- Operational PIN verification may update verification state and counters, but
-- no application path may replace the authoritative secret after assignment.
-- Forward-only hardening; no existing migration is rewritten.

CREATE OR REPLACE FUNCTION public.app_logistics_pin_hash_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW."driverPinHash" IS DISTINCT FROM OLD."driverPinHash" THEN
    RAISE EXCEPTION 'shipment driver PIN authority is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS shipments_pin_hash_immutable ON public."shipments";
CREATE TRIGGER shipments_pin_hash_immutable
BEFORE UPDATE OF "driverPinHash" ON public."shipments"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_pin_hash_immutable();

REVOKE ALL ON FUNCTION public.app_logistics_pin_hash_immutable() FROM PUBLIC;
COMMENT ON FUNCTION public.app_logistics_pin_hash_immutable() IS
  'Prevents replacement of the driver PIN hash copied from the consumed normalized logistics admission.';
