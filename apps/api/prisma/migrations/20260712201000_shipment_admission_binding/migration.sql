-- Shipment assignment is the atomic consumption point of one normalized Deal
-- logistics admission. The legacy command service writes Shipment inside its
-- canonical transaction; this trigger validates and consumes the admission in
-- that same transaction before DealEvent, AuditEvent and receipt commit.

CREATE OR REPLACE FUNCTION logistics.bind_shipment_to_admission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, logistics
AS $function$
DECLARE
  command_id TEXT;
  existing_binding RECORD;
  resolved RECORD;
BEGIN
  SELECT
    sb.admission_id,
    c.organization_id AS carrier_org_id,
    dr.user_id AS driver_user_id,
    v.id AS vehicle_id,
    origin.id AS route_from_facility_id,
    destination.id AS route_to_facility_id
  INTO existing_binding
  FROM logistics.shipment_bindings sb
  JOIN logistics.deal_admissions da ON da.id = sb.admission_id
  JOIN logistics.carriers c ON c.id = da.carrier_id
  JOIN logistics.drivers dr ON dr.id = da.driver_id
  JOIN logistics.vehicles v ON v.id = da.vehicle_id
  JOIN logistics.facilities origin ON origin.id = da.route_from_facility_id
  JOIN logistics.facilities destination ON destination.id = da.route_to_facility_id
  WHERE sb.shipment_id = NEW.id;

  IF FOUND THEN
    IF NEW."dealId" IS DISTINCT FROM (
      SELECT deal_id FROM logistics.shipment_bindings WHERE shipment_id = NEW.id
    )
      OR NEW."carrierOrgId" IS DISTINCT FROM existing_binding.carrier_org_id
      OR NEW."driverUserId" IS DISTINCT FROM existing_binding.driver_user_id
      OR NEW."vehicleNumber" IS DISTINCT FROM existing_binding.vehicle_id
      OR NEW."routeFrom" IS DISTINCT FROM existing_binding.route_from_facility_id
      OR NEW."routeTo" IS DISTINCT FROM existing_binding.route_to_facility_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'shipment logistics binding is immutable',
        CONSTRAINT = 'shipment_logistics_binding_immutable';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status <> 'ASSIGNED' THEN
    RETURN NEW;
  END IF;

  command_id := NULLIF(current_setting('app.current_command_id', true), '');
  IF command_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'shipment assignment requires a correlated logistics command';
  END IF;

  IF NEW."carrierOrgId" IS NULL
    OR NEW."driverUserId" IS NULL
    OR NEW."vehicleNumber" IS NULL
    OR NEW."routeFrom" IS NULL
    OR NEW."routeTo" IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'shipment assignment is missing normalized logistics identifiers';
  END IF;

  SELECT * INTO resolved
  FROM logistics.resolve_deal_admission(
    NEW."dealId",
    NEW."carrierOrgId",
    NEW."driverUserId",
    NEW."vehicleNumber",
    NEW."routeFrom",
    NEW."routeTo"
  );

  IF resolved.admission_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'shipment assignment has no active normalized logistics admission';
  END IF;

  PERFORM logistics.consume_deal_admission(
    resolved.admission_id,
    NEW.id,
    command_id
  );

  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION logistics.bind_shipment_to_admission() FROM PUBLIC;
DROP TRIGGER IF EXISTS shipment_logistics_admission_binding ON public."shipments";
CREATE TRIGGER shipment_logistics_admission_binding
  AFTER INSERT OR UPDATE OF
    status,
    "dealId",
    "carrierOrgId",
    "driverUserId",
    "vehicleNumber",
    "routeFrom",
    "routeTo"
  ON public."shipments"
  FOR EACH ROW EXECUTE FUNCTION logistics.bind_shipment_to_admission();

COMMENT ON FUNCTION logistics.bind_shipment_to_admission() IS
  'Consumes one valid Deal logistics admission when Shipment becomes ASSIGNED and prevents later reassignment.';
