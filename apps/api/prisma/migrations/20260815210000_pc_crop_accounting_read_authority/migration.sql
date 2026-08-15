-- PC-CROP federal accounting, Wave 2 second slice: read authority for the
-- accounting tables.
--
-- The two tables introduced by this programme were created with row level
-- security enabled and forced and no policy at all, which denies every
-- non-superuser principal. That was the correct posture while nothing read
-- them. This migration opens exactly one door: a dedicated principal that may
-- SELECT delegations and signing authorities belonging to the organization the
-- caller actually holds an active membership in.
--
-- The scoping deliberately does not trust the request context on its own. The
-- runtime principal can execute `SET LOCAL app.current_org_id = '<any org>'`
-- itself, so a policy keyed only on that setting is not a boundary — the
-- identity contour measured exactly that failure and removed the setting it had
-- trusted. Here the setting selects a candidate row set, and
-- app_pc_crop_membership_id() decides whether the caller may have it, by
-- reading an ACTIVE membership out of user_orgs rather than believing a claim.
--
-- The tenant column is checked as well. Each row's (organizationId, tenantId)
-- pair is already guaranteed consistent by a foreign key to organizations, so
-- pinning the row to both claimed values means a forged tenant matches nothing
-- rather than widening the read.
--
-- No write policy is created. Granting an authority or a delegation is a
-- privileged command that belongs with its own reviewed slice; until then the
-- tables are readable and nothing more.

DO $accounting_principal$
DECLARE
  role_name text := 'pc_accounting_authority';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
    EXECUTE format(
      'CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
      role_name
    );
  END IF;
  EXECUTE format(
    'ALTER ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
    role_name
  );
END
$accounting_principal$;

-- Resolve the caller's own ACTIVE membership in the organization it claims.
-- SECURITY DEFINER because the caller has no read of user_orgs itself, STABLE
-- because it is consulted once per row by the planner, and search_path pinned
-- so a caller cannot shadow the tables it reads.
CREATE OR REPLACE FUNCTION public.app_pc_crop_membership_id()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT membership."id"
  FROM public."user_orgs" membership
  WHERE membership."userId" = public.app_identity_user_id()
    AND membership."organizationId" = public.app_identity_org_id()
    AND membership."status" = 'ACTIVE'
  LIMIT 1;
$function$;

DO $accounting_function_owner$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_identity_bootstrap') THEN
    ALTER FUNCTION public.app_pc_crop_membership_id() OWNER TO pc_identity_bootstrap;

    -- The definer needs the rows it reads. The identity contour already grants
    -- pc_identity_bootstrap SELECT on user_orgs, so this is normally a no-op —
    -- but leaving the dependency implicit means a future narrowing of that
    -- grant would break this contour at a distance. Measured: with the grant
    -- withdrawn the function raises "permission denied for table user_orgs",
    -- which fails closed rather than open, yet fails the whole read path. The
    -- four columns named here are exactly what the resolver consults.
    GRANT SELECT ("id", "userId", "organizationId", "status")
      ON public."user_orgs" TO pc_identity_bootstrap;
  END IF;
END
$accounting_function_owner$;

REVOKE ALL ON FUNCTION public.app_pc_crop_membership_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_pc_crop_membership_id() TO PUBLIC;

-- A delegation is visible to the membership that received it, the membership
-- that granted it, and an organization administrator. Nobody else, and never
-- across an organization or a tenant boundary.
DROP POLICY IF EXISTS membership_delegations_accounting_select ON public."membership_delegations";
CREATE POLICY membership_delegations_accounting_select ON public."membership_delegations"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND (
      "toMembershipId" = public.app_pc_crop_membership_id()
      OR "fromMembershipId" = public.app_pc_crop_membership_id()
      OR public.app_identity_is_org_admin()
    )
  );

-- A signing authority is visible to the membership it belongs to and to an
-- organization administrator. A signer must be able to see the bounds it signs
-- within; an administrator must be able to review who may sign what.
DROP POLICY IF EXISTS signing_authorities_accounting_select ON public."signing_authorities";
CREATE POLICY signing_authorities_accounting_select ON public."signing_authorities"
  FOR SELECT
  USING (
    public.app_pc_crop_membership_id() IS NOT NULL
    AND "organizationId" = public.app_identity_org_id()
    AND "tenantId" = public.app_identity_tenant_id()
    AND (
      "membershipId" = public.app_pc_crop_membership_id()
      OR public.app_identity_is_org_admin()
    )
  );

DO $accounting_grants$
DECLARE
  role_name text := 'pc_accounting_authority';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
    RETURN;
  END IF;

  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', role_name);

  -- Start from nothing so a re-run cannot accumulate privileges.
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON public."membership_delegations" FROM %I', role_name);
  EXECUTE format(
    'REVOKE ALL PRIVILEGES ON public."signing_authorities" FROM %I', role_name);

  -- Read only, and only the columns the policy and the resolver need. The
  -- reason column can carry free text a granter typed, so it stays out.
  EXECUTE format(
    'GRANT SELECT ("id", "tenantId", "organizationId", "fromMembershipId",
       "toMembershipId", "capabilities", "startsAt", "endsAt", "status")
     ON public."membership_delegations" TO %I', role_name);

  EXECUTE format(
    'GRANT SELECT ("id", "tenantId", "organizationId", "membershipId",
       "authorityType", "mchdReference", "validFrom", "validTo",
       "allowedDocumentTypes", "amountLimitKopecks", "certificateFingerprint",
       "allowedSigningModes", "status", "lastVerifiedAt")
     ON public."signing_authorities" TO %I', role_name);
END
$accounting_grants$;

-- The principals that must never reach this contour, stated rather than
-- assumed. Each of these serves a different boundary and a later broad grant
-- script should not quietly hand them the accounting tables.
DO $accounting_denials$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pc_auth_mail_runtime',
    'pc_staff_runtime',
    'pc_registration_authority',
    'pc_registration_decision_authority',
    'pc_organization_membership_command_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON public."membership_delegations" FROM %I', role_name);
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON public."signing_authorities" FROM %I', role_name);
    END IF;
  END LOOP;
END
$accounting_denials$;
