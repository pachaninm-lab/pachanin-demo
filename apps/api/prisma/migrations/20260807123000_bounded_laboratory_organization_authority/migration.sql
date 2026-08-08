-- P0 identity RLS follow-up: bounded laboratory organization verification.
--
-- FORCE RLS on public.organizations intentionally prevents a privileged Deal
-- actor from reading another participant organization's identity row directly.
-- Laboratory provisioning still needs one fact: whether the exact laboratory
-- organization bound to the exact Deal is a verified/approved organization in
-- the same tenant. Exposing the row or weakening organizations_context_select
-- would reopen the identity boundary, so this migration provides a boolean-only
-- SECURITY DEFINER capability instead.

DO $labs_identity_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_labs_identity_authority'
  ) THEN
    CREATE ROLE pc_labs_identity_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_labs_identity_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'Laboratory identity authority role is unsafe'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE granted.rolname = 'pc_labs_identity_authority'
       OR member.rolname = 'pc_labs_identity_authority'
  ) THEN
    RAISE EXCEPTION 'Laboratory identity authority role must have no memberships'
      USING ERRCODE = '42501';
  END IF;
END;
$labs_identity_authority_role$;

-- FORCE RLS remains enabled. The authority role is NOLOGIN and has no members,
-- so these policies are reachable only while executing the fixed definer body.
DROP POLICY IF EXISTS organizations_labs_identity_authority
  ON public."organizations";
CREATE POLICY organizations_labs_identity_authority ON public."organizations"
  FOR SELECT TO pc_labs_identity_authority USING (true);

DROP POLICY IF EXISTS users_labs_identity_authority
  ON public."users";
CREATE POLICY users_labs_identity_authority ON public."users"
  FOR SELECT TO pc_labs_identity_authority USING (true);

DROP POLICY IF EXISTS user_orgs_labs_identity_authority
  ON public."user_orgs";
CREATE POLICY user_orgs_labs_identity_authority ON public."user_orgs"
  FOR SELECT TO pc_labs_identity_authority USING (true);

CREATE OR REPLACE FUNCTION public.app_labs_verified_organization_for_deal(
  p_tenant_id TEXT,
  p_deal_id TEXT,
  p_laboratory_org_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, auth
AS $function$
  SELECT
    NULLIF(BTRIM(p_tenant_id), '') IS NOT NULL
    AND NULLIF(BTRIM(p_deal_id), '') IS NOT NULL
    AND NULLIF(BTRIM(p_laboratory_org_id), '') IS NOT NULL
    AND current_setting('app.current_tenant_id', true) = p_tenant_id
    AND current_setting('app.current_role', true) IN (
      'ADMIN', 'SUPPORT_MANAGER', 'COMPLIANCE_OFFICER'
    )
    -- The caller context must resolve to a real live server-side session and
    -- its exact membership. GUC labels alone are not authority.
    AND EXISTS (
      SELECT 1
      FROM auth.sessions session
      JOIN public."user_orgs" membership
        ON membership."id" = session.membership_id
      JOIN public."users" actor
        ON actor."id" = session.user_id
      JOIN public."organizations" caller_org
        ON caller_org."id" = session.organization_id
      WHERE session.id = current_setting('app.current_session_id', true)
        AND session.user_id = current_setting('app.current_user_id', true)
        AND session.organization_id = current_setting('app.current_org_id', true)
        AND session.tenant_id = p_tenant_id
        AND session.status = 'ACTIVE'
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND membership."userId" = session.user_id
        AND membership."organizationId" = session.organization_id
        AND membership."role" = current_setting('app.current_role', true)
        AND actor.status = 'ACTIVE'
        AND actor."deletedAt" IS NULL
        AND caller_org."tenantId" = p_tenant_id
    )
    -- The request is bound to a Deal that is actually visible to this trusted
    -- privileged context; no arbitrary tenant-wide organization probe.
    AND EXISTS (
      SELECT 1
      FROM public."deals" deal
      WHERE deal."id" = p_deal_id
        AND deal."tenantId" = p_tenant_id
    )
    -- The target must be the LAB participant of that exact Deal and must meet
    -- the same verified/approved organization contract the application used
    -- before identity RLS was enabled.
    AND EXISTS (
      SELECT 1
      FROM public."deal_participants" participant
      JOIN public."organizations" laboratory
        ON laboratory."id" = participant."organizationId"
      WHERE participant."dealId" = p_deal_id
        AND participant."tenantId" = p_tenant_id
        AND participant."organizationId" = p_laboratory_org_id
        AND participant."role" = 'LAB'
        AND participant."status" = 'ACTIVE'
        AND laboratory."tenantId" = p_tenant_id
        AND laboratory.status = 'VERIFIED'
        AND laboratory."kycStatus" = 'APPROVED'
    );
$function$;

ALTER FUNCTION public.app_labs_verified_organization_for_deal(TEXT, TEXT, TEXT)
  OWNER TO pc_labs_identity_authority;
REVOKE ALL ON FUNCTION public.app_labs_verified_organization_for_deal(TEXT, TEXT, TEXT)
  FROM PUBLIC;

GRANT USAGE ON SCHEMA public, auth TO pc_labs_identity_authority;
GRANT SELECT ON
  public."organizations",
  public."users",
  public."user_orgs",
  public."deals",
  public."deal_participants",
  auth.sessions
TO pc_labs_identity_authority;

DO $labs_identity_runtime_grants$
DECLARE
  runtime_role TEXT;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_deal_runtime', 'one_deal_app', 'app_deal', 'app_runtime')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.app_labs_verified_organization_for_deal(text,text,text) TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_staff_runtime', 'pc_storage_runtime',
      'one_deal_auth', 'one_deal_staff', 'one_deal_storage',
      'app_auth', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.app_labs_verified_organization_for_deal(text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$labs_identity_runtime_grants$;
