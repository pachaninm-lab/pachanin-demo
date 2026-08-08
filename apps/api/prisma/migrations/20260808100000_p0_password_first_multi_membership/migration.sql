-- P0 password-first multi-membership authority.
--
-- The identity-RLS prerequisite deliberately reduced the pre-password surface
-- to resolve_login_credential(email). P0 still needs a user with more than one
-- active organization membership to choose the exact server-authoritative
-- context after bcrypt succeeds. This migration adds that post-password path
-- without reviving the retired broad resolve_login_identity* or
-- resolve_login_memberships* functions and without granting table access or
-- BYPASSRLS to an authentication runtime.

DO $mfa_finalize_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_auth_mfa_authority'
  ) THEN
    CREATE ROLE pc_auth_mfa_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_auth_mfa_authority'
      AND (
        rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls
        OR rolcreatedb OR rolcreaterole
      )
  ) THEN
    RAISE EXCEPTION 'pc_auth_mfa_authority is not confined'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_auth_mfa_authority'
  ) THEN
    RAISE EXCEPTION 'pc_auth_mfa_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$mfa_finalize_authority_role$;

CREATE OR REPLACE FUNCTION auth.resolve_post_password_membership_ids(p_user_id text)
RETURNS TABLE (membership_id text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
SET row_security = on
AS $function$
  SELECT membership."id"
  FROM public."user_orgs" membership
  WHERE membership."userId" = p_user_id
  ORDER BY membership."isDefault" DESC, membership."joinedAt" ASC, membership."id" ASC;
$function$;
ALTER FUNCTION auth.resolve_post_password_membership_ids(text) OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_post_password_membership_ids(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION auth.resolve_post_password_membership_context(
  p_user_id text,
  p_membership_id text
)
RETURNS TABLE (
  user_id text,
  email text,
  full_name text,
  phone text,
  user_status text,
  membership_id text,
  role text,
  is_org_admin boolean,
  membership_status text,
  organization_id text,
  organization_name text,
  organization_status text,
  tenant_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
SET row_security = on
AS $function$
  SELECT
    subject."id",
    subject."email",
    subject."fullName",
    subject."phone",
    subject."status",
    membership."id",
    membership."role",
    membership.is_org_admin,
    membership."status",
    organization."id",
    organization."name",
    organization."status",
    organization."tenantId"
  FROM public."users" subject
  JOIN public."user_orgs" membership
    ON membership."id" = p_membership_id
   AND membership."userId" = subject."id"
  JOIN public."organizations" organization
    ON organization."id" = membership."organizationId"
  WHERE subject."id" = p_user_id
  LIMIT 1;
$function$;
ALTER FUNCTION auth.resolve_post_password_membership_context(text, text)
  OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_post_password_membership_context(text, text) FROM PUBLIC;

-- Session verification requires membership lifecycle and org-admin facts but
-- never credential material. Keep this as a separate tuple so a refresh/MFA
-- lookup cannot accidentally regain the password hash.
CREATE OR REPLACE FUNCTION auth.resolve_session_identity_v2(
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
  is_org_admin boolean,
  membership_status text,
  organization_id text,
  organization_status text,
  tenant_id text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
SET row_security = on
AS $function$
  SELECT
    subject."id",
    subject."email",
    subject."fullName",
    subject."phone",
    subject."status",
    membership."id",
    membership."role",
    membership.is_org_admin,
    membership."status",
    organization."id",
    organization."status",
    organization."tenantId"
  FROM public."users" subject
  JOIN public."user_orgs" membership
    ON membership."id" = p_membership_id
   AND membership."userId" = subject."id"
   AND membership."organizationId" = p_organization_id
  JOIN public."organizations" organization
    ON organization."id" = p_organization_id
   AND organization."tenantId" = p_tenant_id
  WHERE subject."id" = p_user_id
  LIMIT 1;
$function$;
ALTER FUNCTION auth.resolve_session_identity_v2(text, text, text, text)
  OWNER TO pc_identity_bootstrap;
REVOKE ALL ON FUNCTION auth.resolve_session_identity_v2(text, text, text, text) FROM PUBLIC;

-- Enrollment updates the compatibility flag on public.users only after the
-- same transaction has verified the enrollment challenge, activated its
-- session and enabled the authoritative auth.credential_states row.
CREATE OR REPLACE FUNCTION auth.finalize_authenticated_user_mfa(
  p_user_id text,
  p_session_id text,
  p_challenge_id text
)
RETURNS TABLE (updated boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
SET row_security = on
AS $function$
DECLARE
  affected integer;
BEGIN
  UPDATE public."users" subject
  SET "mfaEnabled" = true
  WHERE subject."id" = p_user_id
    AND EXISTS (
      SELECT 1
      FROM auth.sessions session
      JOIN auth.mfa_challenges challenge
        ON challenge."id" = p_challenge_id
       AND challenge.session_id = session."id"
       AND challenge.user_id = p_user_id
       AND challenge."type" = 'TOTP_ENROLL'
       AND challenge."status" = 'VERIFIED'
      JOIN auth.credential_states credential
        ON credential.user_id = p_user_id
       AND credential.mfa_enabled = true
      WHERE session."id" = p_session_id
        AND session.user_id = p_user_id
        AND session."status" = 'ACTIVE'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN QUERY SELECT affected = 1;
END;
$function$;
ALTER FUNCTION auth.finalize_authenticated_user_mfa(text, text, text)
  OWNER TO pc_auth_mfa_authority;
REVOKE ALL ON FUNCTION auth.finalize_authenticated_user_mfa(text, text, text) FROM PUBLIC;

-- Keep the read-only pc_identity_bootstrap invariant intact. MFA compatibility
-- finalization uses its own NOLOGIN/NOBYPASSRLS authority with only the exact
-- reads and one-column update needed by the fixed function body. FORCE RLS
-- remains active and no runtime can SET ROLE into the authority.
GRANT USAGE ON SCHEMA auth, public TO pc_auth_mfa_authority;
GRANT SELECT ON auth.sessions, auth.mfa_challenges, auth.credential_states
  TO pc_auth_mfa_authority;
GRANT SELECT ("id"), UPDATE ("mfaEnabled") ON public."users"
  TO pc_auth_mfa_authority;

DROP POLICY IF EXISTS users_mfa_finalize_select ON public."users";
CREATE POLICY users_mfa_finalize_select ON public."users"
  FOR SELECT TO pc_auth_mfa_authority
  USING (true);

DROP POLICY IF EXISTS users_mfa_finalize_update ON public."users";
CREATE POLICY users_mfa_finalize_update ON public."users"
  FOR UPDATE TO pc_auth_mfa_authority
  USING (true)
  WITH CHECK (true);

DO $mfa_finalize_authority_proof$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'finalize_authenticated_user_mfa'
      AND owner.rolname = 'pc_auth_mfa_authority'
      AND function.prosecdef
  ) THEN
    RAISE EXCEPTION 'Bounded MFA finalizer ownership is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF has_table_privilege('pc_auth_mfa_authority', 'public.users', 'INSERT')
     OR has_table_privilege('pc_auth_mfa_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_auth_mfa_authority', 'public.user_orgs', 'SELECT')
     OR has_table_privilege('pc_auth_mfa_authority', 'public.organizations', 'SELECT') THEN
    RAISE EXCEPTION 'MFA finalizer authority is broader than its fixed tuple'
      USING ERRCODE = '42501';
  END IF;
END;
$mfa_finalize_authority_proof$;

DO $p0_password_first_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_post_password_membership_ids(text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_post_password_membership_context(text,text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_session_identity_v2(text,text,text,text) TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.finalize_authenticated_user_mfa(text,text,text) TO %I', runtime_role);

    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_identity(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_identity_by_id(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_memberships(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_memberships_ordered(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_login_context_by_email(text) FROM %I', runtime_role);
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
      'REVOKE ALL ON FUNCTION auth.resolve_post_password_membership_ids(text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_post_password_membership_context(text,text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_session_identity_v2(text,text,text,text) FROM %I', runtime_role);
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.finalize_authenticated_user_mfa(text,text,text) FROM %I', runtime_role);
  END LOOP;
END;
$p0_password_first_grants$;
