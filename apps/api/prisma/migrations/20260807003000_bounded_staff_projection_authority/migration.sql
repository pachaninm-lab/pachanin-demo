-- Remove the last identifier-only cross-tenant staff projections.
--
-- The historic staff_organization_directory/users functions accepted only an
-- actor id, and staff_cabinet_deals accepted an actor id plus a session id. An
-- identifier is not a credential. The identity-RLS boundary therefore routes
-- these reads through pc_staff_runtime and requires the same secret-backed,
-- MFA/TTL/permission-bound staff access capability as admission review.

-- pc_staff_authority is NOLOGIN and has no members. It may hold reads that are
-- reachable only through the fixed SECURITY DEFINER bodies below.
GRANT SELECT ON auth.credential_states TO pc_staff_authority;
GRANT SELECT ON public.deals TO pc_staff_authority;

-- Marker policies are safe here for the same reason as the admission marker:
-- the only role admitted by them cannot log in or be SET ROLE'd into. The
-- external functions set the transaction-local marker after capability
-- validation and clear it before returning.
DROP POLICY IF EXISTS organizations_staff_projection ON public.organizations;
CREATE POLICY organizations_staff_projection
ON public.organizations
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_projection_scope', true) = 'directory'
  OR current_setting('app.staff_projection_scope', true) = 'org:' || id
);

DROP POLICY IF EXISTS user_orgs_staff_projection ON public.user_orgs;
CREATE POLICY user_orgs_staff_projection
ON public.user_orgs
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_projection_scope', true) = 'org:' || "organizationId"
);

DROP POLICY IF EXISTS users_staff_projection ON public.users;
CREATE POLICY users_staff_projection
ON public.users
FOR SELECT
TO pc_staff_authority
USING (
  EXISTS (
    SELECT 1
    FROM public.user_orgs membership
    WHERE membership."userId" = users.id
      AND current_setting('app.staff_projection_scope', true)
          = 'org:' || membership."organizationId"
  )
);

DROP POLICY IF EXISTS deals_staff_projection ON public.deals;
CREATE POLICY deals_staff_projection
ON public.deals
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_projection_scope', true) = 'org:' || "sellerOrgId"
  OR current_setting('app.staff_projection_scope', true) = 'org:' || "buyerOrgId"
);

CREATE OR REPLACE FUNCTION auth.staff_projection_capability(
  p_actor_user_id TEXT,
  p_access_session_id TEXT,
  p_capability_hash TEXT,
  p_permission TEXT,
  p_access_mode TEXT,
  p_organization_id TEXT,
  p_require_global BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
DECLARE
  v_role TEXT;
BEGIN
  IF coalesce(trim(p_actor_user_id), '') = ''
     OR coalesce(trim(p_access_session_id), '') = ''
     OR coalesce(trim(p_capability_hash), '') = ''
     OR coalesce(trim(p_permission), '') = ''
     OR coalesce(trim(p_access_mode), '') = ''
  THEN
    RAISE EXCEPTION 'staff projection capability is incomplete' USING ERRCODE = '42501';
  END IF;

  SELECT assignment.role
  INTO v_role
  FROM auth.staff_access_sessions session
  JOIN auth.staff_access_grants grant_row ON grant_row.id = session.grant_id
  JOIN auth.staff_assignments assignment ON assignment.id = grant_row.assignment_id
  WHERE session.id = p_access_session_id
    AND session.actor_user_id = p_actor_user_id
    AND session.token_hash = p_capability_hash
    AND session.status = 'ACTIVE'
    AND session.ended_at IS NULL
    AND session.expires_at > now()
    AND session.mfa_level IN ('TOTP', 'BACKUP', 'WEBAUTHN')
    AND session.permissions ? p_permission
    AND session.access_mode = p_access_mode
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
    AND (
      (p_require_global
        AND grant_row.target_organization_id IS NULL
        AND session.effective_organization_id IS NULL)
      OR
      (NOT p_require_global
        AND p_organization_id IS NOT NULL
        AND (grant_row.target_organization_id IS NULL OR grant_row.target_organization_id = p_organization_id)
        AND (session.effective_organization_id IS NULL OR session.effective_organization_id = p_organization_id))
    )
    AND (
      (p_permission IN ('organization:list', 'user:list')
        AND assignment.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF'))
      OR
      (p_permission = 'cabinet:view-as'
        AND assignment.role IN (
          'PLATFORM_OWNER',
          'PLATFORM_ADMIN',
          'SUPPORT_L2',
          'OPERATIONS_AGENT',
          'OPERATIONS_SUPERVISOR',
          'COMPLIANCE_STAFF'
        ))
    )
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'staff projection capability denied' USING ERRCODE = '42501';
  END IF;
END;
$function$;

ALTER FUNCTION auth.staff_projection_capability(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN)
  OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_projection_capability(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN)
  FROM PUBLIC;

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
BEGIN
  PERFORM auth.staff_projection_capability(
    p_actor_user_id,
    p_access_session_id,
    p_capability_hash,
    'organization:list',
    'CONTROL_PLANE',
    NULL,
    TRUE
  );

  PERFORM set_config('app.staff_projection_scope', 'directory', true);
  RETURN QUERY
  SELECT
    organization.id,
    organization."tenantId",
    organization.name,
    organization.inn,
    organization.status::TEXT,
    organization."kycStatus"::TEXT,
    organization."amlStatus"::TEXT,
    organization."updatedAt"
  FROM public.organizations organization
  ORDER BY organization.status, organization.name, organization.id
  LIMIT 500;
  PERFORM set_config('app.staff_projection_scope', '', true);
END;
$function$;
ALTER FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) FROM PUBLIC;

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
BEGIN
  PERFORM auth.staff_projection_capability(
    p_actor_user_id,
    p_access_session_id,
    p_capability_hash,
    'user:list',
    'CONTROL_PLANE',
    p_organization_id,
    FALSE
  );

  PERFORM set_config('app.staff_projection_scope', 'org:' || p_organization_id, true);
  RETURN QUERY
  SELECT
    membership.id,
    user_row.id,
    user_row.email,
    user_row."fullName",
    user_row.status::TEXT,
    COALESCE(credential.mfa_enabled, user_row."mfaEnabled"),
    membership.role::TEXT,
    membership."isDefault",
    membership."joinedAt"
  FROM public.user_orgs membership
  JOIN public.users user_row ON user_row.id = membership."userId"
  LEFT JOIN auth.credential_states credential ON credential.user_id = user_row.id
  WHERE membership."organizationId" = p_organization_id
  ORDER BY membership."joinedAt", membership.id
  LIMIT 500;
  PERFORM set_config('app.staff_projection_scope', '', true);
END;
$function$;
ALTER FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

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
BEGIN
  PERFORM auth.staff_projection_capability(
    p_actor_user_id,
    p_access_session_id,
    p_capability_hash,
    'cabinet:view-as',
    'VIEW_AS',
    p_organization_id,
    FALSE
  );

  IF NOT EXISTS (
    SELECT 1
    FROM auth.staff_access_sessions session
    WHERE session.id = p_access_session_id
      AND session.actor_user_id = p_actor_user_id
      AND session.token_hash = p_capability_hash
      AND session.effective_organization_id = p_organization_id
      AND (session.effective_role IS NULL OR session.effective_role = p_role)
  ) THEN
    RAISE EXCEPTION 'staff cabinet projection scope denied' USING ERRCODE = '42501';
  END IF;

  PERFORM set_config('app.staff_projection_scope', 'org:' || p_organization_id, true);
  RETURN QUERY
  SELECT
    deal.id,
    deal."dealNumber",
    deal.status,
    deal."nextAction",
    deal."slaAt",
    deal."updatedAt"
  FROM public.deals deal
  WHERE deal."sellerOrgId" = p_organization_id
     OR deal."buyerOrgId" = p_organization_id
  ORDER BY deal."updatedAt" DESC, deal.id DESC
  LIMIT 100;
  PERFORM set_config('app.staff_projection_scope', '', true);
END;
$function$;
ALTER FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT)
  OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

-- The old signatures are identifier-only authority and are deliberately
-- removed, not merely left unused by application code.
DROP FUNCTION auth.staff_organization_directory(TEXT);
DROP FUNCTION auth.staff_organization_users(TEXT, TEXT);
DROP FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT);

DO $grant_bounded_staff_projections$
BEGIN
  GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
  GRANT EXECUTE ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT)
    TO pc_staff_runtime;
  GRANT EXECUTE ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT)
    TO pc_staff_runtime;
  GRANT EXECUTE ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT)
    TO pc_staff_runtime;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_auth_runtime') THEN
    REVOKE ALL ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) FROM pc_auth_runtime;
    REVOKE ALL ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) FROM pc_auth_runtime;
    REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) FROM pc_auth_runtime;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'app_service') THEN
    REVOKE ALL ON FUNCTION auth.staff_organization_directory(TEXT, TEXT, TEXT) FROM app_service;
    REVOKE ALL ON FUNCTION auth.staff_organization_users(TEXT, TEXT, TEXT, TEXT) FROM app_service;
    REVOKE ALL ON FUNCTION auth.staff_cabinet_deals(TEXT, TEXT, TEXT, TEXT, TEXT) FROM app_service;
  END IF;
END;
$grant_bounded_staff_projections$;
