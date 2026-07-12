-- A consumed admission remains resolvable only for the exact command that
-- consumed it. This lets the application reach the durable idempotency receipt
-- on retry without reopening the admission for another command or Shipment.

CREATE OR REPLACE FUNCTION logistics.resolve_deal_admission_for_command(
  p_deal_id TEXT,
  p_carrier_org_id TEXT,
  p_driver_user_id TEXT,
  p_vehicle_id TEXT,
  p_route_from_facility_id TEXT,
  p_route_to_facility_id TEXT,
  p_command_id TEXT
)
RETURNS TABLE (
  admission_id TEXT,
  tenant_id TEXT,
  deal_id TEXT,
  carrier_id TEXT,
  carrier_org_id TEXT,
  carrier_name TEXT,
  carrier_source_hash TEXT,
  driver_id TEXT,
  driver_user_id TEXT,
  driver_name TEXT,
  driver_source_hash TEXT,
  vehicle_id TEXT,
  vehicle_registration_number TEXT,
  vehicle_type TEXT,
  vehicle_source_hash TEXT,
  driver_vehicle_link_id TEXT,
  driver_vehicle_source_hash TEXT,
  route_from_facility_id TEXT,
  route_from_name TEXT,
  route_from_source_hash TEXT,
  route_to_facility_id TEXT,
  route_to_name TEXT,
  route_to_source_hash TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  admission_source_hash TEXT,
  admission_integrity_hash TEXT,
  evidence_ref TEXT,
  admission_status TEXT,
  consumed_by_command_id TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, logistics
STABLE
AS $function$
  SELECT
    da.id,
    da.tenant_id,
    da.deal_id,
    c.id,
    c.organization_id,
    carrier_org.name,
    c.source_hash,
    dr.id,
    dr.user_id,
    driver_user."fullName",
    dr.source_hash,
    v.id,
    v.registration_number,
    v.vehicle_type,
    v.source_hash,
    dvl.id,
    dvl.source_hash,
    origin.id,
    origin.name,
    origin.source_hash,
    destination.id,
    destination.name,
    destination.source_hash,
    da.valid_from,
    da.valid_until,
    da.source_hash,
    da.integrity_hash,
    da.evidence_ref,
    da.status,
    da.consumed_by_command_id
  FROM logistics.deal_admissions da
  JOIN public."deals" deal ON deal.id = da.deal_id
  JOIN logistics.carriers c ON c.id = da.carrier_id
  JOIN public."organizations" carrier_org ON carrier_org.id = c.organization_id
  JOIN logistics.drivers dr ON dr.id = da.driver_id
  JOIN public."users" driver_user ON driver_user.id = dr.user_id
  JOIN public."user_orgs" driver_membership
    ON driver_membership."userId" = dr.user_id
   AND driver_membership."organizationId" = c.organization_id
   AND driver_membership.role = 'DRIVER'
  JOIN logistics.vehicles v ON v.id = da.vehicle_id
  JOIN logistics.driver_vehicle_links dvl ON dvl.id = da.driver_vehicle_link_id
  JOIN logistics.facilities origin ON origin.id = da.route_from_facility_id
  JOIN logistics.facilities destination ON destination.id = da.route_to_facility_id
  WHERE public.app_rls_context_ready()
    AND current_setting('app.current_role', true) IN ('LOGISTICIAN', 'SUPPORT_MANAGER', 'ADMIN')
    AND da.tenant_id = current_setting('app.current_tenant_id', true)
    AND da.deal_id = p_deal_id
    AND public.app_rls_deal_visible(da.deal_id)
    AND c.organization_id = p_carrier_org_id
    AND dr.user_id = p_driver_user_id
    AND v.id = p_vehicle_id
    AND origin.id = p_route_from_facility_id
    AND destination.id = p_route_to_facility_id
    AND (
      da.status = 'CONFIRMED'
      OR (
        da.status = 'CONSUMED'
        AND da.consumed_by_command_id = p_command_id
        AND EXISTS (
          SELECT 1
          FROM logistics.shipment_bindings sb
          WHERE sb.admission_id = da.id
            AND sb.deal_id = da.deal_id
            AND sb.tenant_id = da.tenant_id
        )
      )
    )
    AND now() >= da.valid_from
    AND (da.valid_until IS NULL OR now() < da.valid_until)
    AND c.tenant_id = da.tenant_id
    AND c.status = 'VERIFIED'
    AND now() >= c.valid_from
    AND (c.valid_until IS NULL OR now() < c.valid_until)
    AND carrier_org."tenantId" = da.tenant_id
    AND carrier_org.status = 'VERIFIED'
    AND carrier_org."kycStatus" = 'APPROVED'
    AND dr.tenant_id = da.tenant_id
    AND dr.carrier_id = c.id
    AND dr.status = 'ACTIVE'
    AND now() >= dr.valid_from
    AND (dr.valid_until IS NULL OR now() < dr.valid_until)
    AND driver_user.status = 'ACTIVE'
    AND driver_user."deletedAt" IS NULL
    AND v.tenant_id = da.tenant_id
    AND v.carrier_id = c.id
    AND v.status = 'ACTIVE'
    AND now() >= v.valid_from
    AND (v.valid_until IS NULL OR now() < v.valid_until)
    AND dvl.tenant_id = da.tenant_id
    AND dvl.driver_id = dr.id
    AND dvl.vehicle_id = v.id
    AND dvl.status = 'ACTIVE'
    AND now() >= dvl.valid_from
    AND (dvl.valid_until IS NULL OR now() < dvl.valid_until)
    AND origin.tenant_id = da.tenant_id
    AND origin.organization_id = deal."sellerOrgId"
    AND origin.kind IN ('DISPATCH', 'BOTH')
    AND origin.status = 'ACTIVE'
    AND now() >= origin.valid_from
    AND (origin.valid_until IS NULL OR now() < origin.valid_until)
    AND destination.tenant_id = da.tenant_id
    AND destination.organization_id = deal."buyerOrgId"
    AND destination.kind IN ('ACCEPTANCE', 'BOTH')
    AND destination.status = 'ACTIVE'
    AND now() >= destination.valid_from
    AND (destination.valid_until IS NULL OR now() < destination.valid_until)
    AND da.source_hash ~ '^[0-9a-f]{64}$'
    AND da.integrity_hash ~ '^[0-9a-f]{64}$'
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION logistics.resolve_deal_admission_for_command(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

DO $grant_logistics_replay_resolver$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_deal_api', 'one_deal_app']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION logistics.resolve_deal_admission_for_command(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$grant_logistics_replay_resolver$;

COMMENT ON FUNCTION logistics.resolve_deal_admission_for_command(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Resolves a CONFIRMED admission or the exact CONSUMED admission for durable idempotent replay of its command.';
