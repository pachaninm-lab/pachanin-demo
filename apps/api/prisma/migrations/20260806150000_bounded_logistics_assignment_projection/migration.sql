-- Resolve the identity labels required to materialize a logistics assignment
-- without granting the deal runtime direct visibility into public.users or
-- public.organizations.
--
-- The caller already runs inside RlsTransactionService. This function adds a
-- second, database-authoritative check: the current actor must be an ACTIVE
-- LOGISTICIAN participant of the exact deal and the requested carrier/driver/
-- vehicle/route tuple must have a currently ACTIVE logistics admission. Only
-- the four fields needed to denormalize the shipment are returned.

-- pc_identity_bootstrap is a NOLOGIN/NOBYPASSRLS authority role. It receives
-- only the two additional reads required by this function; runtime principals
-- receive no direct identity-table access from this migration.
GRANT USAGE ON SCHEMA logistics TO pc_identity_bootstrap;
GRANT SELECT ON public."deal_participants" TO pc_identity_bootstrap;
GRANT SELECT ON logistics.deal_admissions TO pc_identity_bootstrap;

CREATE OR REPLACE FUNCTION public.app_logistics_assignment_projection(
  p_deal_id text,
  p_tenant_id text,
  p_carrier_org_id text,
  p_driver_user_id text,
  p_vehicle_id text,
  p_route_from_facility_id text,
  p_route_to_facility_id text
)
RETURNS TABLE (
  driver_id text,
  driver_name text,
  carrier_org_id text,
  carrier_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, logistics, pg_temp
AS $function$
DECLARE
  actor_user_id text := current_setting('app.current_user_id', true);
  actor_org_id text := current_setting('app.current_org_id', true);
  actor_tenant_id text := current_setting('app.current_tenant_id', true);
  actor_role text := current_setting('app.current_role', true);
BEGIN
  IF NULLIF(BTRIM(p_deal_id), '') IS NULL
     OR NULLIF(BTRIM(p_tenant_id), '') IS NULL
     OR NULLIF(BTRIM(p_carrier_org_id), '') IS NULL
     OR NULLIF(BTRIM(p_driver_user_id), '') IS NULL
     OR NULLIF(BTRIM(p_vehicle_id), '') IS NULL
     OR NULLIF(BTRIM(p_route_from_facility_id), '') IS NULL
     OR NULLIF(BTRIM(p_route_to_facility_id), '') IS NULL
  THEN
    RETURN;
  END IF;

  IF actor_tenant_id IS DISTINCT FROM p_tenant_id
     OR actor_role IS DISTINCT FROM 'LOGISTICIAN'
     OR NULLIF(BTRIM(actor_user_id), '') IS NULL
     OR NULLIF(BTRIM(actor_org_id), '') IS NULL
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    driver."id"::text,
    driver."fullName"::text,
    carrier."id"::text,
    carrier."name"::text
  FROM public."users" driver
  JOIN public."user_orgs" driver_membership
    ON driver_membership."userId" = driver."id"
   AND driver_membership."organizationId" = p_carrier_org_id
   AND driver_membership."role" = 'DRIVER'
  JOIN public."organizations" carrier
    ON carrier."id" = p_carrier_org_id
   AND carrier."tenantId" = p_tenant_id
   AND carrier."status" IN ('VERIFIED', 'ACTIVE')
   AND carrier."kycStatus" = 'APPROVED'
  WHERE driver."id" = p_driver_user_id
    AND driver."status" = 'ACTIVE'
    AND driver."deletedAt" IS NULL
    AND EXISTS (
      SELECT 1
      FROM public."deal_participants" participant
      WHERE participant."dealId" = p_deal_id
        AND participant."tenantId" = p_tenant_id
        AND participant."userId" = actor_user_id
        AND participant."organizationId" = actor_org_id
        AND participant."role" = 'LOGISTICIAN'
        AND participant."status" = 'ACTIVE'
    )
    AND EXISTS (
      SELECT 1
      FROM logistics.deal_admissions admission
      WHERE admission.tenant_id = p_tenant_id
        AND admission.deal_id = p_deal_id
        AND admission.carrier_org_id = p_carrier_org_id
        AND admission.driver_user_id = p_driver_user_id
        AND admission.vehicle_id = p_vehicle_id
        AND admission.route_from_facility_id = p_route_from_facility_id
        AND admission.route_to_facility_id = p_route_to_facility_id
        AND admission.status = 'ACTIVE'
        AND admission.valid_from <= now()
        AND (admission.valid_until IS NULL OR admission.valid_until > now())
    )
  LIMIT 1;
END;
$function$;

ALTER FUNCTION public.app_logistics_assignment_projection(text, text, text, text, text, text, text)
  OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION public.app_logistics_assignment_projection(text, text, text, text, text, text, text)
  FROM PUBLIC;

DO $bounded_logistics_projection_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.app_logistics_assignment_projection(text,text,text,text,text,text,text) TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_staff_runtime', 'pc_storage_runtime',
      'one_deal_auth', 'one_deal_storage',
      'app_auth', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.app_logistics_assignment_projection(text,text,text,text,text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$bounded_logistics_projection_grants$;
