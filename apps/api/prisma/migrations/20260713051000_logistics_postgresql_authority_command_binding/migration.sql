-- IR-10.2 follow-up: keep shipment admission binding deterministic for the
-- canonical Deal command path without requiring application-authored authority.
-- The canonical command receipt remains the idempotency source of truth; the
-- shipment id is a deterministic fallback for legacy command code paths.

CREATE OR REPLACE FUNCTION public.app_logistics_bind_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, logistics
AS $function$
DECLARE
  admission_id TEXT;
  command_id TEXT;
BEGIN
  command_id := NULLIF(current_setting('app.current_command_id', true), '');
  IF command_id IS NULL THEN
    command_id := NEW."id";
  END IF;

  UPDATE logistics.deal_admissions admission
  SET status = 'CONSUMED',
      consumed_at = now(),
      consumed_by_command_id = command_id,
      version = version + 1,
      updated_at = now()
  WHERE admission.tenant_id = NEW."tenantId"
    AND admission.deal_id = NEW."dealId"
    AND admission.carrier_org_id = NEW."carrierOrgId"
    AND admission.driver_user_id = NEW."driverUserId"
    AND admission.vehicle_id = NEW."vehicleNumber"
    AND admission.route_from_facility_id = NEW."routeFrom"
    AND admission.route_to_facility_id = NEW."routeTo"
    AND admission.status = 'ACTIVE'
  RETURNING admission.id INTO admission_id;

  IF admission_id IS NULL THEN
    RAISE EXCEPTION 'logistics admission consumption lost a concurrency race'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO logistics.shipment_bindings (
    id, tenant_id, deal_id, admission_id, shipment_id, command_id
  ) VALUES (
    'binding-' || md5(NEW."id" || ':' || admission_id),
    NEW."tenantId", NEW."dealId", admission_id, NEW."id", command_id
  );

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.app_logistics_bind_assignment() FROM PUBLIC;

-- Legacy canonical lifecycle commands pre-date Shipment.version CAS. Preserve
-- explicit increments from the new repository and fill only missing increments.
CREATE OR REPLACE FUNCTION public.app_logistics_increment_shipment_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW."version" = OLD."version" THEN
    NEW."version" := OLD."version" + 1;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS shipments_increment_version ON public."shipments";
CREATE TRIGGER shipments_increment_version
BEFORE UPDATE ON public."shipments"
FOR EACH ROW EXECUTE FUNCTION public.app_logistics_increment_shipment_version();
