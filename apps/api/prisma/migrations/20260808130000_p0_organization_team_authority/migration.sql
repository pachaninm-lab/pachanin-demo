-- Session-bound organization-team projection under FORCE RLS.
--
-- The auth runtime may request the team snapshot only for one live session and
-- its exact user/membership/organization/tenant tuple. PostgreSQL, rather than
-- JWT fields supplied to the query, decides whether the actor is an active
-- organization administrator and whether MFA is fresh enough to expose
-- inactive memberships or aggregate session activity.

DO $organization_access_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_organization_access_authority'
  ) THEN
    CREATE ROLE pc_organization_access_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_organization_access_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_organization_access_authority'
  ) THEN
    RAISE EXCEPTION 'pc_organization_access_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$organization_access_authority_role$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_organization_team_select ON public."users";
CREATE POLICY users_organization_team_select ON public."users"
  FOR SELECT TO pc_organization_access_authority USING (true);
DROP POLICY IF EXISTS user_orgs_organization_team_select ON public."user_orgs";
CREATE POLICY user_orgs_organization_team_select ON public."user_orgs"
  FOR SELECT TO pc_organization_access_authority USING (true);
DROP POLICY IF EXISTS organizations_organization_team_select ON public."organizations";
CREATE POLICY organizations_organization_team_select ON public."organizations"
  FOR SELECT TO pc_organization_access_authority USING (true);

GRANT USAGE ON SCHEMA public, auth TO pc_organization_access_authority;
REVOKE ALL PRIVILEGES ON public."users", public."user_orgs", public."organizations"
  FROM pc_organization_access_authority;
GRANT SELECT ("id", "fullName", "email", "status", "deletedAt")
  ON public."users" TO pc_organization_access_authority;
GRANT SELECT (
  "id", "userId", "organizationId", "role", "status", "is_org_admin",
  "version", "isDefault", "joinedAt"
) ON public."user_orgs" TO pc_organization_access_authority;
GRANT SELECT ("id", "tenantId", "name", "status")
  ON public."organizations" TO pc_organization_access_authority;
GRANT SELECT (
  "id", user_id, membership_id, organization_id, tenant_id, "status",
  credential_version, mfa_verified_at, last_seen_at, expires_at, revoked_at
) ON auth.sessions TO pc_organization_access_authority;
GRANT SELECT (user_id, credential_version)
  ON auth.credential_states TO pc_organization_access_authority;

CREATE OR REPLACE FUNCTION auth.resolve_organization_admin_session(
  p_session_id text,
  p_user_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text
)
RETURNS TABLE (
  membership_id text,
  role text,
  membership_version bigint,
  organization_id text,
  tenant_id text,
  organization_status text,
  organization_name text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = auth, public, pg_temp
SET row_security = on
AS $function$
  SELECT
    membership."id",
    membership."role",
    membership."version",
    organization."id",
    organization."tenantId",
    organization."status",
    organization."name"
  FROM auth.sessions session
  JOIN auth.credential_states credential
    ON credential.user_id = session.user_id
   AND credential.credential_version = session.credential_version
  JOIN public."users" subject
    ON subject."id" = session.user_id
   AND subject."status" = 'ACTIVE'
   AND subject."deletedAt" IS NULL
  JOIN public."user_orgs" membership
    ON membership."id" = session.membership_id
   AND membership."userId" = session.user_id
   AND membership."organizationId" = session.organization_id
   AND membership."status" = 'ACTIVE'
   AND membership.is_org_admin
   AND membership."role" IN (
     'FARMER', 'BUYER', 'LOGISTICIAN', 'DRIVER', 'ELEVATOR',
     'LAB', 'SURVEYOR', 'ACCOUNTING', 'GUEST'
   )
  JOIN public."organizations" organization
    ON organization."id" = session.organization_id
   AND organization."tenantId" = session.tenant_id
   AND organization."status" = 'VERIFIED'
  WHERE session."id" = p_session_id
    AND session.user_id = p_user_id
    AND session.membership_id = p_membership_id
    AND session.organization_id = p_organization_id
    AND session.tenant_id = p_tenant_id
    AND session."status" = 'ACTIVE'
    AND session.revoked_at IS NULL
    AND session.expires_at > now()
    AND session.mfa_verified_at IS NOT NULL
    AND session.mfa_verified_at >= now() - interval '15 minutes'
    AND session.mfa_verified_at <= now() + interval '30 seconds'
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION auth.organization_team_snapshot(
  p_session_id text,
  p_user_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text
)
RETURNS TABLE (
  actor_role text,
  actor_is_org_admin boolean,
  actor_has_fresh_mfa boolean,
  organization_name text,
  membership_id text,
  member_user_id text,
  full_name text,
  email text,
  member_role text,
  user_status text,
  membership_status text,
  member_is_org_admin boolean,
  membership_version bigint,
  is_default boolean,
  joined_at timestamptz,
  active_session_count bigint,
  last_session_seen_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = auth, public, pg_temp
SET row_security = on
AS $function$
  WITH actor AS MATERIALIZED (
    SELECT
      membership."role" AS actor_role,
      membership.is_org_admin AS actor_is_org_admin,
      (
        membership.is_org_admin
        AND session.mfa_verified_at IS NOT NULL
        AND session.mfa_verified_at >= now() - interval '15 minutes'
        AND session.mfa_verified_at <= now() + interval '30 seconds'
      ) AS actor_has_fresh_mfa,
      organization."name" AS organization_name
    FROM auth.sessions session
    JOIN auth.credential_states credential
      ON credential.user_id = session.user_id
     AND credential.credential_version = session.credential_version
    JOIN public."users" subject
      ON subject."id" = session.user_id
     AND subject."status" = 'ACTIVE'
     AND subject."deletedAt" IS NULL
    JOIN public."user_orgs" membership
      ON membership."id" = session.membership_id
     AND membership."userId" = session.user_id
     AND membership."organizationId" = session.organization_id
     AND membership."status" = 'ACTIVE'
    JOIN public."organizations" organization
      ON organization."id" = session.organization_id
     AND organization."tenantId" = session.tenant_id
     AND organization."status" = 'VERIFIED'
    WHERE session."id" = p_session_id
      AND session.user_id = p_user_id
      AND session.membership_id = p_membership_id
      AND session.organization_id = p_organization_id
      AND session.tenant_id = p_tenant_id
      AND session."status" = 'ACTIVE'
      AND session.revoked_at IS NULL
      AND session.expires_at > now()
    LIMIT 1
  ), team_members AS MATERIALIZED (
    SELECT
      member."id" AS membership_id,
      subject."id" AS member_user_id,
      subject."fullName" AS full_name,
      subject."email",
      member."role" AS member_role,
      subject."status" AS user_status,
      member."status" AS membership_status,
      member.is_org_admin AS member_is_org_admin,
      member."version" AS membership_version,
      member."isDefault" AS is_default,
      member."joinedAt" AS joined_at
    FROM actor
    JOIN public."user_orgs" member
      ON member."organizationId" = p_organization_id
    JOIN public."users" subject
      ON subject."id" = member."userId"
     AND subject."deletedAt" IS NULL
    WHERE member."status" = 'ACTIVE'
       OR (actor.actor_is_org_admin AND actor.actor_has_fresh_mfa)
    ORDER BY member."joinedAt" ASC, member."id" ASC
    LIMIT 100
  ), session_summary AS (
    SELECT
      live.membership_id,
      count(*)::bigint AS active_session_count,
      max(live.last_seen_at) AS last_session_seen_at
    FROM actor
    JOIN team_members member ON true
    JOIN auth.sessions live
      ON live.membership_id = member.membership_id
     AND live.user_id = member.member_user_id
     AND live.organization_id = p_organization_id
     AND live.tenant_id = p_tenant_id
     AND live."status" = 'ACTIVE'
     AND live.revoked_at IS NULL
     AND live.expires_at > now()
    WHERE actor.actor_is_org_admin AND actor.actor_has_fresh_mfa
    GROUP BY live.membership_id
  )
  SELECT
    actor.actor_role,
    actor.actor_is_org_admin,
    actor.actor_has_fresh_mfa,
    actor.organization_name,
    member.membership_id,
    member.member_user_id,
    member.full_name,
    member.email,
    member.member_role,
    member.user_status,
    member.membership_status,
    member.member_is_org_admin,
    member.membership_version,
    member.is_default,
    member.joined_at,
    CASE WHEN actor.actor_is_org_admin AND actor.actor_has_fresh_mfa
      THEN COALESCE(summary.active_session_count, 0::bigint)
      ELSE NULL::bigint
    END,
    CASE WHEN actor.actor_is_org_admin AND actor.actor_has_fresh_mfa
      THEN summary.last_session_seen_at
      ELSE NULL::timestamptz
    END
  FROM actor
  JOIN team_members member ON true
  LEFT JOIN session_summary summary ON summary.membership_id = member.membership_id
  ORDER BY member.joined_at ASC, member.membership_id ASC;
$function$;

CREATE OR REPLACE FUNCTION auth.organization_membership_exists_for_email(
  p_session_id text,
  p_user_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_email text
)
RETURNS TABLE (membership_exists boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = auth, public, pg_temp
SET row_security = on
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM auth.resolve_organization_admin_session(
      p_session_id, p_user_id, p_membership_id, p_organization_id, p_tenant_id
    ) administrator
    JOIN public."user_orgs" member
      ON member."organizationId" = administrator.organization_id
    JOIN public."users" subject
      ON subject."id" = member."userId"
     AND subject."deletedAt" IS NULL
    WHERE subject."email" = lower(btrim(COALESCE(p_email, '')))
  );
$function$;

ALTER FUNCTION auth.organization_team_snapshot(text,text,text,text,text)
  OWNER TO pc_organization_access_authority;
ALTER FUNCTION auth.resolve_organization_admin_session(text,text,text,text,text)
  OWNER TO pc_organization_access_authority;
ALTER FUNCTION auth.organization_membership_exists_for_email(text,text,text,text,text,text)
  OWNER TO pc_organization_access_authority;
REVOKE ALL ON FUNCTION auth.organization_team_snapshot(text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.resolve_organization_admin_session(text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.organization_membership_exists_for_email(text,text,text,text,text,text) FROM PUBLIC;

DO $organization_team_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.organization_team_snapshot(text,text,text,text,text) TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_organization_admin_session(text,text,text,text,text) TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.organization_membership_exists_for_email(text,text,text,text,text,text) TO %I',
      runtime_role
    );
  END LOOP;
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_app', 'one_deal_staff', 'one_deal_storage',
      'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.organization_team_snapshot(text,text,text,text,text) FROM %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_organization_admin_session(text,text,text,text,text) FROM %I',
      runtime_role
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.organization_membership_exists_for_email(text,text,text,text,text,text) FROM %I',
      runtime_role
    );
  END LOOP;
END;
$organization_team_runtime_grants$;

DO $organization_team_authority_proof$
BEGIN
  IF (SELECT count(*) FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname IN (
          'organization_team_snapshot',
          'resolve_organization_admin_session',
          'organization_membership_exists_for_email'
        )
        AND function.prosecdef
        AND owner.rolname = 'pc_organization_access_authority') <> 3 THEN
    RAISE EXCEPTION 'Organization-team function ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_organization_access_authority', 'public.users', 'INSERT')
     OR has_table_privilege('pc_organization_access_authority', 'public.users', 'UPDATE')
     OR has_table_privilege('pc_organization_access_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_organization_access_authority', 'public.user_orgs', 'INSERT')
     OR has_table_privilege('pc_organization_access_authority', 'public.user_orgs', 'UPDATE')
     OR has_table_privilege('pc_organization_access_authority', 'public.user_orgs', 'DELETE')
     OR has_table_privilege('pc_organization_access_authority', 'public.organizations', 'UPDATE') THEN
    RAISE EXCEPTION 'Organization-team authority is broader than read-only projection'
      USING ERRCODE = '42501';
  END IF;
END;
$organization_team_authority_proof$;
