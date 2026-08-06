-- The pre-authentication surface the login path actually needs (#3670).
--
-- 20260806090000 removed BYPASSRLS from the authentication principal and gave
-- it three bootstrap functions instead. Those three cover reading one identity
-- and listing its memberships — but not the shapes the login path really
-- issues, which join public.users, public.user_orgs and public.organizations
-- together, and do so *before* any tenant context exists:
--
--   * resolve an identity and its default membership from an email address;
--   * resolve an identity and one named membership;
--   * resolve the identity behind a live session, so an access token can be
--     verified before the request has a context to be verified against.
--
-- Without these the removal of BYPASSRLS does not tighten the boundary, it
-- breaks authentication: every one of those joins returns zero rows under the
-- identity policies, and no user can log in at all. The provisioning change
-- and these functions are the same change.
--
-- Each is SECURITY DEFINER owned by pc_identity_bootstrap — NOLOGIN, no
-- members, admitted to the identity tables by the bootstrap policies alone —
-- so the body fixed here is the whole of what the pre-auth path can read.

-- The identity behind an email address, together with the membership a login
-- defaults to. Ordering is the login path's own: an explicit default first,
-- then the oldest membership, then a stable tie-break.
CREATE OR REPLACE FUNCTION auth.resolve_login_context_by_email(p_email text)
RETURNS TABLE (
  user_id text,
  email text,
  password_hash text,
  full_name text,
  phone text,
  user_status text,
  membership_id text,
  role text,
  organization_id text,
  organization_status text,
  tenant_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    u."id",
    u."email",
    u."passwordHash",
    u."fullName",
    u."phone",
    u."status",
    uo."id",
    uo."role",
    o."id",
    o."status",
    o."tenantId"
  FROM public."users" u
  JOIN public."user_orgs" uo ON uo."userId" = u."id"
  JOIN public."organizations" o ON o."id" = uo."organizationId"
  WHERE lower(u."email") = lower(p_email)
  ORDER BY uo."isDefault" DESC, uo."joinedAt" ASC, uo."id" ASC
  LIMIT 1;
$function$;

ALTER FUNCTION auth.resolve_login_context_by_email(text) OWNER TO pc_identity_bootstrap;

-- One identity and one named membership: the step between a verified password
-- and a chosen organization. The membership must belong to the identity, so a
-- caller cannot pair somebody else's membership with its own user id.
CREATE OR REPLACE FUNCTION auth.resolve_login_context_by_membership(
  p_user_id text,
  p_membership_id text
)
RETURNS TABLE (
  user_id text,
  email text,
  password_hash text,
  full_name text,
  phone text,
  user_status text,
  membership_id text,
  role text,
  organization_id text,
  organization_status text,
  tenant_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    u."id",
    u."email",
    u."passwordHash",
    u."fullName",
    u."phone",
    u."status",
    uo."id",
    uo."role",
    o."id",
    o."status",
    o."tenantId"
  FROM public."users" u
  JOIN public."user_orgs" uo ON uo."userId" = u."id"
  JOIN public."organizations" o ON o."id" = uo."organizationId"
  WHERE u."id" = p_user_id
    AND uo."id" = p_membership_id
  LIMIT 1;
$function$;

ALTER FUNCTION auth.resolve_login_context_by_membership(text, text) OWNER TO pc_identity_bootstrap;

-- The identity behind a session row. Every column of the tuple must agree:
-- the membership belongs to the user and to the organization the session
-- names, and the organization belongs to the tenant it names. Those were the
-- join conditions of the session query before RLS; keeping them inside the
-- function means a session row whose columns disagree resolves to nothing
-- rather than to whichever identity the first join happened to find.
--
-- Deliberately returns no credential material. Verifying a session does not
-- need the password hash, and the session queries that used to select it did
-- so only because the projection was shared with login.
CREATE OR REPLACE FUNCTION auth.resolve_session_identity(
  p_user_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text
)
RETURNS TABLE (
  user_id text,
  email text,
  full_name text,
  phone text,
  user_status text,
  membership_id text,
  role text,
  organization_id text,
  organization_status text,
  tenant_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    u."id",
    u."email",
    u."fullName",
    u."phone",
    u."status",
    uo."id",
    uo."role",
    o."id",
    o."status",
    o."tenantId"
  FROM public."users" u
  JOIN public."user_orgs" uo
    ON uo."id" = p_membership_id
   AND uo."userId" = u."id"
   AND uo."organizationId" = p_organization_id
  JOIN public."organizations" o
    ON o."id" = p_organization_id
   AND o."tenantId" = p_tenant_id
  WHERE u."id" = p_user_id
  LIMIT 1;
$function$;

ALTER FUNCTION auth.resolve_session_identity(text, text, text, text) OWNER TO pc_identity_bootstrap;

-- Execution privileges ---------------------------------------------------------
--
-- Same discipline as the three that came before: revoked from PUBLIC, granted
-- to the authentication principal by name, and refused to every other runtime
-- so a later blanket grant cannot widen the pre-auth surface by accident.

REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.resolve_login_context_by_membership(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.resolve_session_identity(text, text, text, text) FROM PUBLIC;

DO $login_context_grants$
DECLARE
  runtime_role text;
BEGIN
  -- The authentication principal goes by several names across the deployment
  -- surfaces: pc_auth_runtime in the isolation gate, one_deal_auth in the
  -- one-deal harness and its DR restore, app_auth under Kubernetes. All three
  -- are the same role in different environments, and all three need this.
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_email(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_context_by_membership(text, text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_session_identity(text, text, text, text) TO %I', runtime_role);
    -- The three from 20260806090000 travel with them, so a deployment whose
    -- provisioning predates that migration still ends up correct.
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_identity(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_identity_by_id(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships(text) TO %I', runtime_role);
  END LOOP;

  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime',
      'one_deal_app', 'one_deal_storage',
      'app_runtime', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_context_by_membership(text, text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_session_identity(text, text, text, text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_identity(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_memberships(text) FROM %I', runtime_role);
  END LOOP;
END;
$login_context_grants$;

-- The memberships listing gains the ordering columns the login path uses, so
-- multi-membership selection can be resolved entirely through this surface.
CREATE OR REPLACE FUNCTION auth.resolve_login_memberships_ordered(p_user_id text)
RETURNS TABLE (
  membership_id text,
  user_id text,
  organization_id text,
  role text,
  is_default boolean,
  joined_at timestamp(3) without time zone,
  organization_name text,
  organization_status text,
  tenant_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $function$
  SELECT
    membership."id",
    membership."userId",
    membership."organizationId",
    membership."role",
    membership."isDefault",
    membership."joinedAt",
    organization."name",
    organization."status",
    organization."tenantId"
  FROM public."user_orgs" membership
  JOIN public."organizations" organization
    ON organization."id" = membership."organizationId"
  WHERE membership."userId" = p_user_id
  ORDER BY membership."isDefault" DESC, membership."joinedAt" ASC, membership."id" ASC;
$function$;

ALTER FUNCTION auth.resolve_login_memberships_ordered(text) OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(text) FROM PUBLIC;

DO $memberships_ordered_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_login_memberships_ordered(text) TO %I', runtime_role);
  END LOOP;
END;
$memberships_ordered_grants$;
