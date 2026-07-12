-- Correct and harden the admission validation introduced in the previous step.
-- `source_hash` remains the external/application canonical fingerprint verified by
-- LogisticsAdmissionService. `integrity_hash` is derived by PostgreSQL from the
-- persisted relational graph and cannot be supplied by a caller.

ALTER TABLE logistics.deal_admissions
  ALTER COLUMN evidence_ref DROP NOT NULL;
ALTER TABLE logistics.deal_admissions
  ADD COLUMN integrity_hash TEXT;

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
  LEFT JOIN public."evidence_files" evidence ON evidence.id = NEW.evidence_ref
  WHERE deal.id = NEW.deal_id
    AND deal."tenantId" = NEW.tenant_id
    AND c.tenant_id = NEW.tenant_id
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
    AND (
      NEW.evidence_ref IS NULL
      OR (
        evidence."dealId" = NEW.deal_id
        AND NULLIF(evidence.hash, '') IS NOT NULL
        AND NULLIF(evidence."s3Key", '') IS NOT NULL
      )
    )
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

  IF NEW.source_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'logistics admission source hash must be lowercase SHA-256';
  END IF;

  NEW.integrity_hash := encode(digest(convert_to(material::text, 'UTF8'), 'sha256'), 'hex');
  RETURN NEW;
END
$function$;

-- Recompute all existing rows under the corrected validator before making the
-- database-derived fingerprint mandatory.
UPDATE logistics.deal_admissions
SET evidence_ref = evidence_ref;

ALTER TABLE logistics.deal_admissions
  ALTER COLUMN integrity_hash SET NOT NULL;
ALTER TABLE logistics.deal_admissions
  ADD CONSTRAINT logistics_deal_admissions_integrity_hash_check
  CHECK (integrity_hash ~ '^[0-9a-f]{64}$');

CREATE OR REPLACE FUNCTION logistics.forbid_integrity_hash_override()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, logistics
AS $function$
BEGIN
  IF OLD.integrity_hash IS DISTINCT FROM NEW.integrity_hash
     AND ROW(
       OLD.tenant_id,
       OLD.deal_id,
       OLD.carrier_id,
       OLD.driver_id,
       OLD.vehicle_id,
       OLD.driver_vehicle_link_id,
       OLD.route_from_facility_id,
       OLD.route_to_facility_id,
       OLD.valid_from,
       OLD.valid_until,
       OLD.approved_by_user_id,
       OLD.approved_at,
       OLD.evidence_ref
     ) IS NOT DISTINCT FROM ROW(
       NEW.tenant_id,
       NEW.deal_id,
       NEW.carrier_id,
       NEW.driver_id,
       NEW.vehicle_id,
       NEW.driver_vehicle_link_id,
       NEW.route_from_facility_id,
       NEW.route_to_facility_id,
       NEW.valid_from,
       NEW.valid_until,
       NEW.approved_by_user_id,
       NEW.approved_at,
       NEW.evidence_ref
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'database-derived logistics admission integrity hash is immutable';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS logistics_deal_admission_integrity_guard ON logistics.deal_admissions;
CREATE TRIGGER logistics_deal_admission_integrity_guard
  BEFORE UPDATE OF integrity_hash ON logistics.deal_admissions
  FOR EACH ROW EXECUTE FUNCTION logistics.forbid_integrity_hash_override();

REVOKE ALL ON FUNCTION logistics.forbid_integrity_hash_override() FROM PUBLIC;
COMMENT ON COLUMN logistics.deal_admissions.integrity_hash IS
  'PostgreSQL-derived SHA-256 fingerprint of the normalized tenant/asset/facility/evidence graph.';
