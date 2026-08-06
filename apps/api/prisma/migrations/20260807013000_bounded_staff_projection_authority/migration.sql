-- Close the remaining identity-bearing staff projection surfaces under the
-- dedicated function-only staff runtime (#3670).
--
-- Historical staff_organization_directory / staff_organization_users accepted
-- only an actor user id and were executable by the auth runtime. An actor id is
-- an identifier, not a credential. staff_cabinet_deals added a session id, but a
-- session id is still not proof of possession. The access-session token digest
-- is the capability proof already used by the bounded admission functions.
--
-- This migration moves these reads behind pc_staff_runtime and adds a bounded
-- deal-scope resolver for the pre-session JIT/VIEW_AS request stage. The staff
-- runtime receives EXECUTE only; pc_staff_authority is NOLOGIN, has no members,
-- and the RLS markers below are therefore unreachable outside these fixed
-- SECURITY DEFINER bodies.

DO $staff_projection_prerequisites$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority')
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime')
  THEN
    RAISE EXCEPTION 'bounded staff authority roles are required' USING ERRCODE = '42704';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority is not confined' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_runtime'
      AND (rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime is not confined' USING ERRCODE = '42501';
  END IF;
END;
$staff_projection_prerequisites$;

-- Generic proof-of-possession resolver. It is INVOKER and executable only by
-- pc_staff_authority, so pc_staff_runtime cannot call it directly to probe staff
-- state. The public projection functions below are SECURITY DEFINER and invoke
-- it as their confined owner.
CREATE OR REPLACE FUNCTION auth.staff_runtime_capability(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT,
  p_permission TEXT,
  OUT staff_role TEXT,
  OUT grant_id TEXT,
  OUT access_mode TEXT,
  OUT ticket_id TEXT,
  OUT reason TEXT,
  OUT target_tenant_id TEXT,
  OUT target_organization_id TEXT,
  OUT target_user_id TEXT,
  OUT target_role TEXT,
  OUT target_deal_id TEXT,
  OUT effective_tenant_id TEXT,
  OUT effective_organization_id TEXT,
  OUT effective_user_id TEXT,
  OUT effective_role TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NULLIF(BTRIM(p_actor_user_id), '') IS NULL
     OR NULLIF(BTRIM(p_access_session_id), '') IS NULL
     OR NULLIF(BTRIM(p_capability_hash), '') IS NULL
     OR NULLIF(BTRIM(p_permission), '') IS NULL
  THEN
    RAISE EXCEPTION 'staff runtime capability is incomplete' USING ERRCODE = '42501';
  END IF;

  SELECT
    assignment.role,
    grant_row.id,
    session_row.access_mode,
    session_row.ticket_id,
    session_row.reason,
    grant_row.target_tenant_id,
    grant_row.target_organization_id,
    grant_row.target_user_id,
    grant_row.target_role,
    grant_row.target_deal_id,
    session_row.effective_tenant_id,
    session_row.effective_organization_id,
    session_row.effective_user_id,
    session_row.effective_role
  INTO
    staff_role,
    grant_id,
    access_mode,
    ticket_id,
    reason,
    target_tenant_id,
    target_organization_id,
    target_user_id,
    target_role,
    target_deal_id,
    effective_tenant_id,
    effective_organization_id,
    effective_user_id,
    effective_role
  FROM auth.staff_access_sessions session_row
  JOIN auth.staff_access_grants grant_row ON grant_row.id = session_row.grant_id
  JOIN auth.staff_assignments assignment ON assignment.id = grant_row.assignment_id
  WHERE session_row.id = p_access_session_id
    AND session_row.actor_user_id = p_actor_user_id
    AND session_row.token_hash = p_capability_hash
    AND session_row.status = 'ACTIVE'
    AND session_row.ended_at IS NULL
    AND session_row.expires_at > now()
    AND session_row.mfa_level IN ('TOTP', 'BACKUP', 'WEBAUTHN')
    AND session_row.permissions ? p_permission
    AND grant_row.grantee_user_id = p_actor_user_id
    AND grant_row.status = 'ACTIVE'
    AND grant_row.revoked_at IS NULL
    AND grant_row.starts_at <= now()
    AND grant_row.expires_at > now()
    AND grant_row.permissions ? p_permission
    AND assignment.user_id = p_actor_user_id
    AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
    AND assignment.revoked_at IS NULL
    AND assignment.suspended_at IS NULL
    AND assignment.valid_from <= now()
    AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  LIMIT 1;

  IF staff_role IS NULL THEN
    RAISE EXCEPTION 'staff runtime capability denied' USING ERRCODE = '42501';
  END IF;
END;
$function$;

ALTER FUNCTION auth.staff_runtime_capability(TEXT, TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_runtime_capability(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.staff_runtime_capability(TEXT, TEXT, TEXT, TEXT)
  TO pc_staff_authority;

-- The authority role receives only the extra reads required by these fixed
-- projections. FORCE RLS remains in force on public identity/deal tables.
GRANT SELECT ON auth.credential_states TO pc_staff_authority;
GRANT SELECT ON public.deals TO pc_staff_authority;

-- Separate markers from the admission functions. Because these policies apply
-- only TO a NOLOGIN role with no members, a runtime that can SET a GUC cannot
-- become the role to which the policy applies.
DROP POLICY IF EXISTS organizations_staff_control_plane_select ON public.organizations;
CREATE POLICY organizations_staff_control_plane_select ON public.organizations
  FOR SELECT TO pc_staff_authority USING (
    current_setting('app.staff_control_plane_scope', true) = 'directory:all'
    OR (
      NULLIF(current_setting('app.staff_control_plane_scope', true), '') IS NOT NULL
      AND id = current_setting('app.staff_control_plane_scope', true)
    )
  );

DROP POLICY IF EXISTS user_orgs_staff_control_plane_select ON public.user_orgs;
CREATE POLICY user_orgs_staff_control_plane_select ON public.user_orgs
  FOR SELECT TO pc_staff_authority USING (
    NULLIF(current_setting('app.staff_control_plane_scope', true), '') IS NOT NULL
    AND "organizationId" = current_setting('app.staff_control_plane_scope', true)
  );

DROP POLICY IF EXISTS users_staff_control_plane_select ON public.users;
CREATE POLICY users_staff_control_plane_select ON public.users
  FOR SELECT TO pc_staff_authority USING (
    NULLIF(current_setting('app.staff_control_plane_scope', true), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_orgs membership
      WHERE membership."userId" = public.users.id
        AND membership."organizationId" = current_setting('app.staff_control_plane_scope', true)
    )
  );

DROP POLICY IF EXISTS deals_staff_control_plane_select ON public.deals;
CREATE POLICY deals_staff_control_plane_select ON public.deals
  FOR SELECT TO pc_staff_authority USING (
    (
      NULLIF(current_setting('app.staff_control_plane_deal_id', true), '') IS NOT NULL
      AND id = current_setting('app.staff_control_plane_deal_id', true)
    )
    OR (
      NULLIF(current_setting('app.staff_control_plane_tenant', true), '') IS NOT NULL
      AND NULLIF(current_setting('app.staff_control_plane_scope', true), '') IS NOT NULL
      AND "tenantId" = current_setting('app.staff_control_plane_tenant', true)
      AND (
        "sellerOrgId" = current_setting('app.staff_control_plane_scope', true)
        OR "buyerOrgId" = current_setting('app.staff_control_plane_scope', true)
      )
    )
  );

-- Directory: platform-wide CONTROL_PLANE permission only. A grant/session scoped
-- to one organization cannot be spent to enumerate the directory.
CREATE OR REPLACE FUNCTION auth.staff_organization_directory(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT
)
RETURNS TABLE (
  id TEXT,
  tenant_id TEXT,
  name TEXT,
  inn TEXT,
  status TEXT,
  kyc_status TEXT,
  aml_status TEXT,
  updated_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $function$
DECLARE
  capability record;
BEGIN
  capability := auth.staff_runtime_capability(
    p_actor_user_id, p_access_session_id, p_capability_hash, 'organization:list'
  );

  IF capability.access_mode <> 'CONTROL_PLANE'
     OR capability.staff_role NOT IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
     OR capability.target_tenant_id IS NOT NULL
     OR capability.target_organization_id IS NOT NULL
     OR capability.effective_tenant_id IS NOT NULL
     OR capability.effective_organization_id IS NOT NULL
  THEN
    RAISE EXCEPTION 'staff organization directory capability denied' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.staff_control_plane_scope', 'directory:all', true);
  RETURN QUERY
  SELECT
    organization.id,
    organization."tenantId",
    organization.name,
    organization.inn,
    organization.status::text,
    organization."kycStatus"::text,
    organization."amlStatus"::text,
    organization."updatedAt"
  FROM public.organizations organization
  ORDER BY organization.status, organization.name, organization.id
  LIMIT 500;
  PERFORM set_config('app.staff_control_plane_scope', '', true);
END;
$function$;

ALTER FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;

-- Organization membership directory: capability may be platform-wide or bound
-- to the requested organization, but may never be bound to a different one.
CREATE OR REPLACE FUNCTION auth.staff_organization_users(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT,
  p_organization_id TEXT
)
RETURNS TABLE (
  membership_id TEXT,
  user_id TEXT,
  email TEXT,
  full_name TEXT,
  user_status TEXT,
  mfa_enabled BOOLEAN,
  role TEXT,
  is_default BOOLEAN,
  joined_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $function$
DECLARE
  capability record;
BEGIN
  IF NULLIF(BTRIM(p_organization_id), '') IS NULL THEN
    RAISE EXCEPTION 'organization id is required' USING ERRCODE = '42501';
  END IF;

  capability := auth.staff_runtime_capability(
    p_actor_user_id, p_access_session_id, p_capability_hash, 'user:list'
  );

  IF capability.access_mode <> 'CONTROL_PLANE'
     OR capability.staff_role NOT IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
     OR (capability.target_organization_id IS NOT NULL AND capability.target_organization_id <> p_organization_id)
     OR (capability.effective_organization_id IS NOT NULL AND capability.effective_organization_id <> p_organization_id)
  THEN
    RAISE EXCEPTION 'staff organization users capability denied' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.staff_control_plane_scope', p_organization_id, true);
  RETURN QUERY
  SELECT
    membership.id,
    target_user.id,
    target_user.email,
    target_user."fullName",
    target_user.status::text,
    COALESCE(credentials.mfa_enabled, target_user."mfaEnabled"),
    membership.role::text,
    membership."isDefault",
    membership."joinedAt"
  FROM public.user_orgs membership
  JOIN public.users target_user ON target_user.id = membership."userId"
  LEFT JOIN auth.credential_states credentials ON credentials.user_id = target_user.id
  WHERE membership."organizationId" = p_organization_id
  ORDER BY membership."joinedAt", membership.id
  LIMIT 500;
  PERFORM set_config('app.staff_control_plane_scope', '', true);
END;
$function$;

ALTER FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;

-- VIEW_AS projection: exact organization/tenant/session capability only.
CREATE OR REPLACE FUNCTION auth.staff_cabinet_deals(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT,
  p_organization_id TEXT,
  p_role TEXT
)
RETURNS TABLE (
  id TEXT,
  deal_number TEXT,
  status TEXT,
  next_action TEXT,
  sla_at TIMESTAMP(3) WITHOUT TIME ZONE,
  updated_at TIMESTAMP(3) WITHOUT TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $function$
DECLARE
  capability record;
BEGIN
  IF NULLIF(BTRIM(p_organization_id), '') IS NULL OR NULLIF(BTRIM(p_role), '') IS NULL THEN
    RAISE EXCEPTION 'VIEW_AS organization and role are required' USING ERRCODE = '42501';
  END IF;

  capability := auth.staff_runtime_capability(
    p_actor_user_id, p_access_session_id, p_capability_hash, 'cabinet:view-as'
  );

  IF capability.access_mode <> 'VIEW_AS'
     OR capability.staff_role NOT IN (
       'PLATFORM_OWNER', 'PLATFORM_ADMIN', 'SUPPORT_L2',
       'OPERATIONS_AGENT', 'OPERATIONS_SUPERVISOR', 'COMPLIANCE_STAFF'
     )
     OR capability.effective_tenant_id IS NULL
     OR capability.effective_organization_id IS DISTINCT FROM p_organization_id
     OR (capability.target_organization_id IS NOT NULL AND capability.target_organization_id <> p_organization_id)
     OR (capability.effective_role IS NOT NULL AND capability.effective_role <> p_role)
     OR (capability.target_role IS NOT NULL AND capability.target_role <> p_role)
  THEN
    RAISE EXCEPTION 'staff cabinet projection capability denied' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.staff_control_plane_scope', p_organization_id, true);
  PERFORM set_config('app.staff_control_plane_tenant', capability.effective_tenant_id, true);
  RETURN QUERY
  SELECT
    deal.id,
    deal."dealNumber",
    deal.status,
    deal."nextAction",
    deal."slaAt",
    deal."updatedAt"
  FROM public.deals deal
  WHERE deal."tenantId" = capability.effective_tenant_id
    AND (deal."sellerOrgId" = p_organization_id OR deal."buyerOrgId" = p_organization_id)
  ORDER BY deal."updatedAt" DESC, deal.id DESC
  LIMIT 100;
  PERFORM set_config('app.staff_control_plane_tenant', '', true);
  PERFORM set_config('app.staff_control_plane_scope', '', true);
END;
$function$;

ALTER FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;

-- Pre-session target lookup for a request that names a Deal. No access-session
-- capability exists yet, so the authority is the separate pc_staff_runtime
-- connection plus an active assignment bound to the authenticated actor.
CREATE OR REPLACE FUNCTION auth.resolve_staff_deal_target_scope(
  p_actor_user_id TEXT,
  p_assignment_id TEXT,
  p_deal_id TEXT
)
RETURNS TABLE (
  tenant_id TEXT,
  seller_organization_id TEXT,
  buyer_organization_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NULLIF(BTRIM(p_actor_user_id), '') IS NULL
     OR NULLIF(BTRIM(p_assignment_id), '') IS NULL
     OR NULLIF(BTRIM(p_deal_id), '') IS NULL
  THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.id = p_assignment_id
      AND assignment.user_id = p_actor_user_id
      AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  ) THEN
    RETURN;
  END IF;

  PERFORM set_config('app.staff_control_plane_deal_id', p_deal_id, true);
  RETURN QUERY
  SELECT deal."tenantId", deal."sellerOrgId", deal."buyerOrgId"
  FROM public.deals deal
  WHERE deal.id = p_deal_id
  LIMIT 1;
  PERFORM set_config('app.staff_control_plane_deal_id', '', true);
END;
$function$;

ALTER FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;

-- Retire the identifier-only legacy entry points. They remain in migration
-- history, but not in the final catalog produced by the forward-only chain.
DROP FUNCTION IF EXISTS auth.staff_organization_directory(TEXT);
DROP FUNCTION IF EXISTS auth.staff_organization_users(TEXT, TEXT);
DROP FUNCTION IF EXISTS auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS auth.staff_resolve_deal_scope(TEXT, TEXT);

REVOKE ALL ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT) FROM PUBLIC;

GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.resolve_staff_deal_target_scope(TEXT, TEXT, TEXT) TO pc_staff_runtime;

DO $deny_legacy_staff_projection_runtimes$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'app_auth', 'app_service', 'app_runtime', 'app_storage', 'app_outbox',
      'one_deal_auth', 'one_deal_app', 'one_deal_storage'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_organization_directory(text,text,text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_organization_users(text,text,text,text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(text,text,text,text,text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_staff_deal_target_scope(text,text,text) FROM %I', runtime_role);
  END LOOP;
END;
$deny_legacy_staff_projection_runtimes$;
