-- Harden the normalized logistics registry.
--
-- 1. A revoked admission may be replaced, but a confirmed/consumed admission is
--    unique per Deal.
-- 2. Every admission is evidence-backed and all referenced actors/assets belong
--    to the same tenant and expected Deal counterparties.
-- 3. PostgreSQL derives the admission fingerprint; callers cannot self-assert it.
-- 4. Verified registry identity and evidence fields are immutable. Lifecycle
--    changes require a monotonic version increment.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE logistics.deal_admissions
  DROP CONSTRAINT IF EXISTS logistics_deal_admissions_deal_unique;
CREATE UNIQUE INDEX IF NOT EXISTS logistics_deal_admissions_one_current_idx
  ON logistics.deal_admissions (deal_id)
  WHERE status IN ('CONFIRMED', 'CONSUMED');

ALTER TABLE logistics.deal_admissions
  ALTER COLUMN evidence_ref SET NOT NULL;
ALTER TABLE logistics.deal_admissions
  ADD CONSTRAINT logistics_deal_admissions_evidence_fk
  FOREIGN KEY (evidence_ref)
  REFERENCES public."evidence_files"(id)
  ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION logistics.registry_row_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, logistics
AS $function$
DECLARE
  old_active boolean;
  new_active boolean;
BEGIN
  old_active := OLD.status IN ('VERIFIED', 'ACTIVE', 'SUSPENDED', 'REVOKED');
  new_active := NEW.status IN ('VERIFIED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

  IF old_active AND ROW(
    OLD.tenant_id,
    OLD.source_hash,
    OLD.evidence_ref,
    OLD.valid_from,
    OLD.valid_until,
    OLD.verified_at,
    OLD.verified_by_user_id
  ) IS DISTINCT FROM ROW(
    NEW.tenant_id,
    NEW.source_hash,
    NEW.evidence_ref,
    NEW.valid_from,
    NEW.valid_until,
    NEW.verified_at,
    NEW.verified_by_user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'verified logistics registry evidence is immutable';
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT public.app_rls_privileged() OR NEW.version <> OLD.version + 1 THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'invalid logistics registry lifecycle transition';
    END IF;
    IF OLD.status = 'REVOKED' OR (OLD.status = 'SUSPENDED' AND NEW.status NOT IN ('ACTIVE', 'REVOKED')) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'invalid terminal logistics registry transition';
    END IF;
  ELSIF NEW.version <> OLD.version THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'logistics registry version may change only with lifecycle status';
  END IF;

  IF NOT new_active THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'unknown logistics registry status';
  END IF;

  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION logistics.validate_carrier_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, logistics
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public."organizations" o
    WHERE o.id = NEW.organization_id
      AND o."tenantId" = NEW.tenant_id
      AND o.status = 'VERIFIED'
      AND o."kycStatus" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'carrier organization is outside verified tenant scope';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION logistics.validate_driver_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, logistics
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM logistics.carriers c
    JOIN public."users" u ON u.id = NEW.user_id
    JOIN public."user_orgs" uo
      ON uo."userId" = u.id
     AND uo."organizationId" = c.organization_id
     AND uo.role = 'DRIVER'
    WHERE c.id = NEW.carrier_id
      AND c.tenant_id = NEW.tenant_id
      AND u.status = 'ACTIVE'
      AND u."deletedAt" IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'driver is outside active carrier membership';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION logistics.validate_vehicle_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, logistics
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM logistics.carriers c
    WHERE c.id = NEW.carrier_id AND c.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'vehicle carrier is outside tenant scope';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION logistics.validate_driver_vehicle_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, logistics
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM logistics.drivers d
    JOIN logistics.vehicles v
      ON v.id = NEW.vehicle_id
     AND v.carrier_id = d.carrier_id
     AND v.tenant_id = d.tenant_id
    WHERE d.id = NEW.driver_id
      AND d.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'driver and vehicle are not in one carrier tenant';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION logistics.validate_facility_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, logistics
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public."organizations" o
    WHERE o.id = NEW.organization_id
      AND o."tenantId" = NEW.tenant_id
      AND o.status = 'VERIFIED'
      AND o."kycStatus" = 'APPROVED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'facility organization is outside verified tenant scope';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION logistics.validate_deal_admission_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, logistics
AS $function$
DECLARE
  material jsonb;
BEGIN
  SELECT jsonb_build_object(
    'tenantId', NEW.tenant_id,
    'dealId', NEW.deal_id,
    'carrierId', c.id,
    'carrierOrgId', c.organization_id,
    'carrierSourceHash', c.source_hash,
    'driverId', d.id,
    'driverUserId', d.user_id,
    'driverSourceHash', d.source_hash,
    'vehicleId', v.id,
    'vehicleSourceHash', v.source_hash,
    'driverVehicleLinkId', link.id,
    'driverVehicleSourceHash', link.source_hash,
    'routeFromFacilityId', origin.id,
    'routeFromSourceHash', origin.source_hash,
    'routeToFacilityId', destination.id,
    'routeToSourceHash', destination.source_hash,
    'validFrom', to_char(NEW.valid_from AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'validUntil', CASE
      WHEN NEW.valid_until IS NULL THEN NULL
      ELSE to_char(NEW.valid_until AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    END,
    'approvedByUserId', NEW.approved_by_user_id,
    'approvedAt', to_char(NEW.approved_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'evidenceRef', NEW.evidence_ref,
    'evidenceHash', evidence.hash
  )
  INTO material
  FROM public."deals" deal
  JOIN logistics.carriers c ON c.id = NEW.carrier_id
  JOIN logistics.drivers d ON d.id = NEW.driver_id
  JOIN logistics.vehicles v ON v.id = NEW.vehicle_id
  JOIN logistics.driver_vehicle_links link ON link.id = NEW.driver_vehicle_link_id
  JOIN logistics.facilities origin ON origin.id = NEW.route_from_facility_id
  JOIN logistics.facilities destination ON destination.id = NEW.route_to_facility_id
  JOIN public."evidence_files" evidence ON evidence.id = NEW.evidence_ref
  WHERE deal.id = NEW.deal_id
    AND deal."tenantId" = NEW.tenant_id
    AND c.tenant_id = NEW.tenant_id
    AND c.organization_id IS NOT DISTINCT FROM NEW.carrier_id
    AND d.tenant_id = NEW.tenant_id
    AND d.carrier_id = c.id
    AND v.tenant_id = NEW.tenant_id
    AND v.carrier_id = c.id
    AND link.tenant_id = NEW.tenant_id
    AND link.driver_id = d.id
    AND link.vehicle_id = v.id
    AND origin.tenant_id = NEW.tenant_id
    AND origin.organization_id = deal."sellerOrgId"
    AND origin.kind IN ('DISPATCH', 'BOTH')
    AND destination.tenant_id = NEW.tenant_id
    AND destination.organization_id = deal."buyerOrgId"
    AND destination.kind IN ('ACCEPTANCE', 'BOTH')
    AND evidence."dealId" = NEW.deal_id
    AND NULLIF(evidence.hash, '') IS NOT NULL
    AND NULLIF(evidence."s3Key", '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public."users" approver
      JOIN public."user_orgs" approver_membership ON approver_membership."userId" = approver.id
      JOIN public."organizations" approver_org ON approver_org.id = approver_membership."organizationId"
      WHERE approver.id = NEW.approved_by_user_id
        AND approver.status = 'ACTIVE'
        AND approver."deletedAt" IS NULL
        AND approver_org."tenantId" = NEW.tenant_id
    );

  IF material IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'logistics admission references an invalid tenant, actor, asset, facility or evidence';
  END IF;

  NEW.source_hash := encode(digest(convert_to(material::text, 'UTF8'), 'sha256'), 'hex');
  RETURN NEW;
END
$function$;

-- Carrier rows need a specialized lifecycle check because VERIFIED is the active state.
DROP TRIGGER IF EXISTS logistics_carriers_validate ON logistics.carriers;
CREATE TRIGGER logistics_carriers_validate
  BEFORE INSERT OR UPDATE ON logistics.carriers
  FOR EACH ROW EXECUTE FUNCTION logistics.validate_carrier_row();
DROP TRIGGER IF EXISTS logistics_carriers_lifecycle ON logistics.carriers;
CREATE TRIGGER logistics_carriers_lifecycle
  BEFORE UPDATE ON logistics.carriers
  FOR EACH ROW EXECUTE FUNCTION logistics.registry_row_lifecycle();

DROP TRIGGER IF EXISTS logistics_drivers_validate ON logistics.drivers;
CREATE TRIGGER logistics_drivers_validate
  BEFORE INSERT OR UPDATE ON logistics.drivers
  FOR EACH ROW EXECUTE FUNCTION logistics.validate_driver_row();
DROP TRIGGER IF EXISTS logistics_drivers_lifecycle ON logistics.drivers;
CREATE TRIGGER logistics_drivers_lifecycle
  BEFORE UPDATE ON logistics.drivers
  FOR EACH ROW EXECUTE FUNCTION logistics.registry_row_lifecycle();

DROP TRIGGER IF EXISTS logistics_vehicles_validate ON logistics.vehicles;
CREATE TRIGGER logistics_vehicles_validate
  BEFORE INSERT OR UPDATE ON logistics.vehicles
  FOR EACH ROW EXECUTE FUNCTION logistics.validate_vehicle_row();
DROP TRIGGER IF EXISTS logistics_vehicles_lifecycle ON logistics.vehicles;
CREATE TRIGGER logistics_vehicles_lifecycle
  BEFORE UPDATE ON logistics.vehicles
  FOR EACH ROW EXECUTE FUNCTION logistics.registry_row_lifecycle();

DROP TRIGGER IF EXISTS logistics_driver_vehicle_validate ON logistics.driver_vehicle_links;
CREATE TRIGGER logistics_driver_vehicle_validate
  BEFORE INSERT OR UPDATE ON logistics.driver_vehicle_links
  FOR EACH ROW EXECUTE FUNCTION logistics.validate_driver_vehicle_row();
DROP TRIGGER IF EXISTS logistics_driver_vehicle_lifecycle ON logistics.driver_vehicle_links;
CREATE TRIGGER logistics_driver_vehicle_lifecycle
  BEFORE UPDATE ON logistics.driver_vehicle_links
  FOR EACH ROW EXECUTE FUNCTION logistics.registry_row_lifecycle();

DROP TRIGGER IF EXISTS logistics_facilities_validate ON logistics.facilities;
CREATE TRIGGER logistics_facilities_validate
  BEFORE INSERT OR UPDATE ON logistics.facilities
  FOR EACH ROW EXECUTE FUNCTION logistics.validate_facility_row();
DROP TRIGGER IF EXISTS logistics_facilities_lifecycle ON logistics.facilities;
CREATE TRIGGER logistics_facilities_lifecycle
  BEFORE UPDATE ON logistics.facilities
  FOR EACH ROW EXECUTE FUNCTION logistics.registry_row_lifecycle();

DROP TRIGGER IF EXISTS logistics_deal_admission_validate ON logistics.deal_admissions;
CREATE TRIGGER logistics_deal_admission_validate
  BEFORE INSERT OR UPDATE OF
    tenant_id,
    deal_id,
    carrier_id,
    driver_id,
    vehicle_id,
    driver_vehicle_link_id,
    route_from_facility_id,
    route_to_facility_id,
    valid_from,
    valid_until,
    approved_by_user_id,
    approved_at,
    evidence_ref
  ON logistics.deal_admissions
  FOR EACH ROW EXECUTE FUNCTION logistics.validate_deal_admission_row();

REVOKE ALL ON FUNCTION logistics.registry_row_lifecycle() FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.validate_carrier_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.validate_driver_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.validate_vehicle_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.validate_driver_vehicle_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.validate_facility_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION logistics.validate_deal_admission_row() FROM PUBLIC;

COMMENT ON FUNCTION logistics.validate_deal_admission_row() IS
  'Validates tenant/relationship/evidence invariants and derives the immutable SHA-256 admission fingerprint.';
