-- Session-bound organization membership commands and token-bound public MFA
-- recovery under identity FORCE RLS.  The two surfaces deliberately have
-- different owners: an organization administrator may mutate only a bounded
-- membership tuple, while a recovery credential may mutate only MFA columns.

DO $membership_and_recovery_authority_roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_organization_membership_command_authority'
  ) THEN
    CREATE ROLE pc_organization_membership_command_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_organization_membership_command_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_mfa_recovery_identity_authority'
  ) THEN
    CREATE ROLE pc_mfa_recovery_identity_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_mfa_recovery_identity_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname IN (
      'pc_organization_membership_command_authority',
      'pc_mfa_recovery_identity_authority'
    )
  ) THEN
    RAISE EXCEPTION 'Membership and MFA recovery authorities must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$membership_and_recovery_authority_roles$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_membership_command_select ON public."users";
CREATE POLICY users_membership_command_select ON public."users"
  FOR SELECT TO pc_organization_membership_command_authority USING (true);
DROP POLICY IF EXISTS users_mfa_recovery_identity_select ON public."users";
CREATE POLICY users_mfa_recovery_identity_select ON public."users"
  FOR SELECT TO pc_mfa_recovery_identity_authority USING (true);
DROP POLICY IF EXISTS users_mfa_recovery_identity_update ON public."users";
CREATE POLICY users_mfa_recovery_identity_update ON public."users"
  FOR UPDATE TO pc_mfa_recovery_identity_authority USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS user_orgs_membership_command_select ON public."user_orgs";
CREATE POLICY user_orgs_membership_command_select ON public."user_orgs"
  FOR SELECT TO pc_organization_membership_command_authority USING (true);
DROP POLICY IF EXISTS user_orgs_membership_command_update ON public."user_orgs";
CREATE POLICY user_orgs_membership_command_update ON public."user_orgs"
  FOR UPDATE TO pc_organization_membership_command_authority USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS user_orgs_mfa_recovery_identity_select ON public."user_orgs";
CREATE POLICY user_orgs_mfa_recovery_identity_select ON public."user_orgs"
  FOR SELECT TO pc_mfa_recovery_identity_authority USING (true);

DROP POLICY IF EXISTS organizations_membership_command_select ON public."organizations";
CREATE POLICY organizations_membership_command_select ON public."organizations"
  FOR SELECT TO pc_organization_membership_command_authority USING (true);
DROP POLICY IF EXISTS organizations_mfa_recovery_identity_select ON public."organizations";
CREATE POLICY organizations_mfa_recovery_identity_select ON public."organizations"
  FOR SELECT TO pc_mfa_recovery_identity_authority USING (true);

GRANT USAGE ON SCHEMA public, auth
  TO pc_organization_membership_command_authority, pc_mfa_recovery_identity_authority;
REVOKE ALL PRIVILEGES ON public."users", public."user_orgs", public."organizations"
  FROM pc_organization_membership_command_authority, pc_mfa_recovery_identity_authority;
GRANT SELECT ("id", "email", "status", "deletedAt")
  ON public."users" TO pc_organization_membership_command_authority;
GRANT SELECT (
  "id", "userId", "organizationId", "role", "status", "isDefault",
  "is_org_admin", "version"
) ON public."user_orgs" TO pc_organization_membership_command_authority;
GRANT SELECT ("id", "tenantId", "status")
  ON public."organizations" TO pc_organization_membership_command_authority;
GRANT UPDATE (
  "role", "status", "isDefault", "is_org_admin", "revoked_at", "version"
) ON public."user_orgs" TO pc_organization_membership_command_authority;
GRANT SELECT ON auth.mfa_recovery_challenges TO pc_organization_membership_command_authority;
GRANT SELECT (user_id, mfa_enabled, mfa_secret_ciphertext)
  ON auth.credential_states TO pc_organization_membership_command_authority;
GRANT SELECT (user_id, status, valid_from, valid_until)
  ON auth.staff_assignments TO pc_organization_membership_command_authority;
GRANT EXECUTE ON FUNCTION auth.resolve_organization_admin_session(
  text, text, text, text, text
) TO pc_organization_membership_command_authority;

GRANT SELECT ("id", "email", "passwordHash", "status", "deletedAt")
  ON public."users" TO pc_mfa_recovery_identity_authority;
GRANT SELECT ("id", "userId", "organizationId", "status")
  ON public."user_orgs" TO pc_mfa_recovery_identity_authority;
GRANT SELECT ("id", "tenantId", "status")
  ON public."organizations" TO pc_mfa_recovery_identity_authority;
GRANT UPDATE ("mfaEnabled", "updatedAt") ON public."users"
  TO pc_mfa_recovery_identity_authority;
GRANT SELECT, UPDATE ON auth.mfa_recovery_challenges
  TO pc_mfa_recovery_identity_authority;
GRANT SELECT ON auth.credential_states TO pc_mfa_recovery_identity_authority;
GRANT UPDATE (
  mfa_enabled, mfa_secret_ciphertext, mfa_key_version, mfa_backup_hashes,
  credential_version, updated_at
) ON auth.credential_states TO pc_mfa_recovery_identity_authority;
GRANT SELECT (user_id, status, valid_from, valid_until)
  ON auth.staff_assignments TO pc_mfa_recovery_identity_authority;

CREATE OR REPLACE FUNCTION auth.change_organization_membership_role(
  p_session_id text,
  p_actor_user_id text,
  p_actor_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_target_membership_id text,
  p_expected_version bigint,
  p_requested_role text
)
RETURNS TABLE (applied boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  administrator_role text;
  affected integer;
BEGIN
  SELECT context.role INTO administrator_role
  FROM auth.resolve_organization_admin_session(
    p_session_id, p_actor_user_id, p_actor_membership_id,
    p_organization_id, p_tenant_id
  ) context;
  IF NOT FOUND OR p_target_membership_id = p_actor_membership_id THEN
    RAISE EXCEPTION 'Organization administrator authority is required'
      USING ERRCODE = '42501';
  END IF;
  IF (CASE administrator_role
    WHEN 'FARMER' THEN p_requested_role IN ('FARMER', 'GUEST')
    WHEN 'BUYER' THEN p_requested_role IN ('BUYER', 'GUEST')
    WHEN 'LOGISTICIAN' THEN p_requested_role IN ('LOGISTICIAN', 'DRIVER', 'GUEST')
    WHEN 'DRIVER' THEN p_requested_role IN ('DRIVER', 'GUEST')
    WHEN 'ELEVATOR' THEN p_requested_role IN ('ELEVATOR', 'LAB', 'GUEST')
    WHEN 'LAB' THEN p_requested_role IN ('LAB', 'GUEST')
    WHEN 'SURVEYOR' THEN p_requested_role IN ('SURVEYOR', 'GUEST')
    WHEN 'ACCOUNTING' THEN p_requested_role IN ('ACCOUNTING', 'GUEST')
    WHEN 'GUEST' THEN p_requested_role = 'GUEST'
    ELSE false
  END) IS NOT TRUE THEN
    RAISE EXCEPTION 'Organization role ceiling would be exceeded'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public."user_orgs" membership
  SET "role" = p_requested_role, "version" = "version" + 1
  WHERE membership."id" = p_target_membership_id
    AND membership."organizationId" = p_organization_id
    AND membership."status" = 'ACTIVE'
    AND membership."version" = p_expected_version;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN QUERY SELECT affected = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.revoke_organization_membership(
  p_session_id text,
  p_actor_user_id text,
  p_actor_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_target_membership_id text,
  p_expected_version bigint
)
RETURNS TABLE (outcome text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  target record;
  administrator_count integer;
  affected integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.resolve_organization_admin_session(
      p_session_id, p_actor_user_id, p_actor_membership_id,
      p_organization_id, p_tenant_id
    )
  ) OR p_target_membership_id = p_actor_membership_id THEN
    RAISE EXCEPTION 'Organization administrator authority is required'
      USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended('organization-admin-revoke:' || p_organization_id, 0)
  );
  SELECT membership."id", membership.is_org_admin
  INTO target
  FROM public."user_orgs" membership
  WHERE membership."id" = p_target_membership_id
    AND membership."organizationId" = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'NOT_FOUND'::text;
    RETURN;
  END IF;
  IF target.is_org_admin THEN
    SELECT count(*)::integer INTO administrator_count
    FROM public."user_orgs" membership
    WHERE membership."organizationId" = p_organization_id
      AND membership."status" = 'ACTIVE'
      AND membership.is_org_admin;
    IF administrator_count <= 1 THEN
      RETURN QUERY SELECT 'LAST_ADMIN'::text;
      RETURN;
    END IF;
  END IF;

  UPDATE public."user_orgs"
  SET "status" = 'REVOKED', revoked_at = now(), "isDefault" = false,
      is_org_admin = false, "version" = "version" + 1
  WHERE "id" = p_target_membership_id
    AND "organizationId" = p_organization_id
    AND "status" = 'ACTIVE'
    AND "version" = p_expected_version;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN QUERY SELECT CASE WHEN affected = 1 THEN 'APPLIED' ELSE 'VERSION_CONFLICT' END;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.prepare_organization_mfa_recovery_target(
  p_session_id text,
  p_actor_user_id text,
  p_actor_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_target_membership_id text,
  p_expected_version bigint
)
RETURNS TABLE (
  prepared boolean,
  target_user_id text,
  target_email text,
  has_other_membership boolean,
  has_staff_assignment boolean,
  mfa_enabled boolean,
  has_mfa_secret boolean,
  new_version bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  target record;
  affected integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.resolve_organization_admin_session(
      p_session_id, p_actor_user_id, p_actor_membership_id,
      p_organization_id, p_tenant_id
    )
  ) OR p_target_membership_id = p_actor_membership_id THEN
    RAISE EXCEPTION 'Organization administrator authority is required'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership."userId" AS user_id, subject."email",
         credential.mfa_enabled,
         credential.mfa_secret_ciphertext IS NOT NULL AS has_mfa_secret,
         EXISTS (
           SELECT 1 FROM public."user_orgs" other_membership
           WHERE other_membership."userId" = membership."userId"
             AND other_membership."organizationId" <> membership."organizationId"
             AND other_membership."status" IN ('PENDING', 'ACTIVE', 'SUSPENDED')
         ) AS has_other_membership,
         EXISTS (
           SELECT 1 FROM auth.staff_assignments assignment
           WHERE assignment.user_id = membership."userId"
             AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
             AND assignment.valid_from <= now()
             AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
         ) AS has_staff_assignment
  INTO target
  FROM public."user_orgs" membership
  JOIN public."organizations" organization
    ON organization."id" = membership."organizationId"
   AND organization."tenantId" = p_tenant_id
   AND organization."status" = 'VERIFIED'
  JOIN public."users" subject
    ON subject."id" = membership."userId"
   AND subject."status" = 'ACTIVE'
   AND subject."deletedAt" IS NULL
  JOIN auth.credential_states credential ON credential.user_id = subject."id"
  WHERE membership."id" = p_target_membership_id
    AND membership."organizationId" = p_organization_id
    AND membership."status" = 'ACTIVE'
    AND membership."version" = p_expected_version
  FOR UPDATE OF membership, subject;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF target.has_other_membership OR target.has_staff_assignment
     OR NOT target.mfa_enabled OR NOT target.has_mfa_secret THEN
    RETURN QUERY SELECT false, target.user_id, target."email",
      target.has_other_membership, target.has_staff_assignment,
      target.mfa_enabled, target.has_mfa_secret, p_expected_version;
    RETURN;
  END IF;

  UPDATE public."user_orgs"
  SET "version" = "version" + 1
  WHERE "id" = p_target_membership_id
    AND "organizationId" = p_organization_id
    AND "status" = 'ACTIVE'
    AND "version" = p_expected_version;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT true, target.user_id, target."email",
    false, false, true, true, p_expected_version + 1;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.organization_mfa_recovery_snapshot(
  p_session_id text,
  p_actor_user_id text,
  p_actor_membership_id text,
  p_organization_id text,
  p_tenant_id text,
  p_challenge_id text
)
RETURNS TABLE (
  id text, user_id text, membership_id text, organization_id text,
  tenant_id text, token_hash text, status text, expires_at timestamptz,
  attempts integer, max_attempts integer, version bigint, email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.resolve_organization_admin_session(
      p_session_id, p_actor_user_id, p_actor_membership_id,
      p_organization_id, p_tenant_id
    )
  ) THEN
    RAISE EXCEPTION 'Organization administrator authority is required'
      USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT challenge.id, challenge.user_id, challenge.membership_id,
         challenge.organization_id, challenge.tenant_id, challenge.token_hash,
         challenge.status, challenge.expires_at, challenge.attempts,
         challenge.max_attempts, challenge.version, subject."email"
  FROM auth.mfa_recovery_challenges challenge
  JOIN public."users" subject ON subject."id" = challenge.user_id
  WHERE challenge.id = p_challenge_id
    AND challenge.organization_id = p_organization_id
    AND challenge.tenant_id = p_tenant_id
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.resolve_mfa_recovery_identity(
  p_challenge_id text,
  p_token_hash text
)
RETURNS TABLE (
  id text, user_id text, membership_id text, organization_id text,
  tenant_id text, token_hash text, status text, expires_at timestamptz,
  attempts integer, max_attempts integer, version bigint, email text,
  password_hash text, user_status text, user_deleted_at timestamptz,
  membership_status text, organization_status text,
  has_other_membership boolean, has_staff_assignment boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
BEGIN
  RETURN QUERY
  SELECT challenge.id, challenge.user_id, challenge.membership_id,
         challenge.organization_id, challenge.tenant_id, challenge.token_hash,
         challenge.status, challenge.expires_at, challenge.attempts,
         challenge.max_attempts, challenge.version, subject."email",
         subject."passwordHash", subject."status", subject."deletedAt",
         membership."status", organization."status",
         EXISTS (
           SELECT 1 FROM public."user_orgs" other_membership
           WHERE other_membership."userId" = challenge.user_id
             AND other_membership."organizationId" <> challenge.organization_id
             AND other_membership."status" IN ('PENDING', 'ACTIVE', 'SUSPENDED')
         ),
         EXISTS (
           SELECT 1 FROM auth.staff_assignments assignment
           WHERE assignment.user_id = challenge.user_id
             AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
             AND assignment.valid_from <= now()
             AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
         )
  FROM auth.mfa_recovery_challenges challenge
  JOIN public."users" subject ON subject."id" = challenge.user_id
  JOIN public."user_orgs" membership
    ON membership."id" = challenge.membership_id
   AND membership."userId" = challenge.user_id
   AND membership."organizationId" = challenge.organization_id
  JOIN public."organizations" organization
    ON organization."id" = challenge.organization_id
   AND organization."tenantId" = challenge.tenant_id
  WHERE challenge.id = p_challenge_id
    AND challenge.token_hash = p_token_hash
    AND challenge.status = 'PENDING'
  FOR UPDATE OF challenge, subject, membership;
END;
$function$;

CREATE OR REPLACE FUNCTION auth.finalize_mfa_recovery_identity(
  p_challenge_id text,
  p_token_hash text,
  p_expected_password_hash text,
  p_expected_version bigint
)
RETURNS TABLE (
  user_id text, membership_id text, organization_id text,
  tenant_id text, email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  challenge record;
  affected integer;
BEGIN
  SELECT candidate.id, candidate.user_id, candidate.membership_id,
         candidate.organization_id, candidate.tenant_id,
         candidate.version, subject."email"
  INTO challenge
  FROM auth.mfa_recovery_challenges candidate
  JOIN public."users" subject
    ON subject."id" = candidate.user_id
   AND subject."status" = 'ACTIVE'
   AND subject."deletedAt" IS NULL
   AND subject."passwordHash" = p_expected_password_hash
  JOIN public."user_orgs" membership
    ON membership."id" = candidate.membership_id
   AND membership."userId" = candidate.user_id
   AND membership."organizationId" = candidate.organization_id
   AND membership."status" = 'ACTIVE'
  JOIN public."organizations" organization
    ON organization."id" = candidate.organization_id
   AND organization."tenantId" = candidate.tenant_id
   AND organization."status" = 'VERIFIED'
  WHERE candidate.id = p_challenge_id
    AND candidate.token_hash = p_token_hash
    AND candidate.status = 'PENDING'
    AND candidate.version = p_expected_version
    AND candidate.expires_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public."user_orgs" other_membership
      WHERE other_membership."userId" = candidate.user_id
        AND other_membership."organizationId" <> candidate.organization_id
        AND other_membership."status" IN ('PENDING', 'ACTIVE', 'SUSPENDED')
    )
    AND NOT EXISTS (
      SELECT 1 FROM auth.staff_assignments assignment
      WHERE assignment.user_id = candidate.user_id
        AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
        AND assignment.valid_from <= now()
        AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    )
  FOR UPDATE OF candidate, subject, membership;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE auth.credential_states credential
  SET mfa_enabled = true, mfa_secret_ciphertext = NULL,
      mfa_key_version = NULL, mfa_backup_hashes = NULL,
      credential_version = credential.credential_version + 1, updated_at = now()
  WHERE credential.user_id = challenge.user_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RETURN;
  END IF;
  UPDATE public."users"
  SET "mfaEnabled" = true, "updatedAt" = now()
  WHERE "id" = challenge.user_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RETURN;
  END IF;
  UPDATE auth.mfa_recovery_challenges
  SET status = 'CONSUMED', consumed_at = now(),
      version = version + 1, updated_at = now()
  WHERE id = challenge.id AND status = 'PENDING' AND version = challenge.version;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RETURN;
  END IF;

  RETURN QUERY SELECT challenge.user_id, challenge.membership_id,
    challenge.organization_id, challenge.tenant_id, challenge."email";
END;
$function$;

ALTER FUNCTION auth.change_organization_membership_role(
  text,text,text,text,text,text,bigint,text
) OWNER TO pc_organization_membership_command_authority;
ALTER FUNCTION auth.revoke_organization_membership(
  text,text,text,text,text,text,bigint
) OWNER TO pc_organization_membership_command_authority;
ALTER FUNCTION auth.prepare_organization_mfa_recovery_target(
  text,text,text,text,text,text,bigint
) OWNER TO pc_organization_membership_command_authority;
ALTER FUNCTION auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)
  OWNER TO pc_organization_membership_command_authority;
ALTER FUNCTION auth.resolve_mfa_recovery_identity(text,text)
  OWNER TO pc_mfa_recovery_identity_authority;
ALTER FUNCTION auth.finalize_mfa_recovery_identity(text,text,text,bigint)
  OWNER TO pc_mfa_recovery_identity_authority;

REVOKE ALL ON FUNCTION auth.change_organization_membership_role(
  text,text,text,text,text,text,bigint,text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.revoke_organization_membership(
  text,text,text,text,text,text,bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.prepare_organization_mfa_recovery_target(
  text,text,text,text,text,text,bigint
) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.resolve_mfa_recovery_identity(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.finalize_mfa_recovery_identity(text,text,text,bigint) FROM PUBLIC;

DO $membership_and_recovery_runtime_grants$
DECLARE
  runtime_role text;
  function_signature text;
  exported_functions text[] := ARRAY[
    'auth.change_organization_membership_role(text,text,text,text,text,text,bigint,text)',
    'auth.revoke_organization_membership(text,text,text,text,text,text,bigint)',
    'auth.prepare_organization_mfa_recovery_target(text,text,text,text,text,text,bigint)',
    'auth.organization_mfa_recovery_snapshot(text,text,text,text,text,text)',
    'auth.resolve_mfa_recovery_identity(text,text)',
    'auth.finalize_mfa_recovery_identity(text,text,text,bigint)'
  ];
BEGIN
  FOREACH function_signature IN ARRAY exported_functions LOOP
    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
    LOOP
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', function_signature, runtime_role);
    END LOOP;
    FOR runtime_role IN
      SELECT rolname FROM pg_catalog.pg_roles
      WHERE rolname IN (
        'pc_deal_runtime', 'pc_staff_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
        'one_deal_app', 'one_deal_staff', 'one_deal_storage',
        'app_runtime', 'app_staff', 'app_storage', 'app_outbox'
      )
    LOOP
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I', function_signature, runtime_role);
    END LOOP;
  END LOOP;
END;
$membership_and_recovery_runtime_grants$;

DO $membership_and_recovery_authority_proof$
BEGIN
  IF (SELECT count(*)
      FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname IN (
          'change_organization_membership_role',
          'revoke_organization_membership',
          'prepare_organization_mfa_recovery_target',
          'organization_mfa_recovery_snapshot'
        )
        AND function.prosecdef
        AND owner.rolname = 'pc_organization_membership_command_authority') <> 4 THEN
    RAISE EXCEPTION 'Organization membership command ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*)
      FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname IN (
          'resolve_mfa_recovery_identity',
          'finalize_mfa_recovery_identity'
        )
        AND function.prosecdef
        AND owner.rolname = 'pc_mfa_recovery_identity_authority') <> 2 THEN
    RAISE EXCEPTION 'MFA recovery identity ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_organization_membership_command_authority', 'public.users', 'INSERT')
     OR has_table_privilege('pc_organization_membership_command_authority', 'public.users', 'UPDATE')
     OR has_table_privilege('pc_organization_membership_command_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_organization_membership_command_authority', 'public.user_orgs', 'INSERT')
     OR has_table_privilege('pc_organization_membership_command_authority', 'public.user_orgs', 'DELETE')
     OR has_table_privilege('pc_organization_membership_command_authority', 'public.organizations', 'INSERT')
     OR has_table_privilege('pc_organization_membership_command_authority', 'public.organizations', 'UPDATE')
     OR has_table_privilege('pc_organization_membership_command_authority', 'public.organizations', 'DELETE') THEN
    RAISE EXCEPTION 'Organization membership authority is broader than its fixed tuple'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_mfa_recovery_identity_authority', 'public.users', 'INSERT')
     OR has_table_privilege('pc_mfa_recovery_identity_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_mfa_recovery_identity_authority', 'public.user_orgs', 'INSERT')
     OR has_table_privilege('pc_mfa_recovery_identity_authority', 'public.user_orgs', 'UPDATE')
     OR has_table_privilege('pc_mfa_recovery_identity_authority', 'public.user_orgs', 'DELETE')
     OR has_table_privilege('pc_mfa_recovery_identity_authority', 'public.organizations', 'INSERT')
     OR has_table_privilege('pc_mfa_recovery_identity_authority', 'public.organizations', 'UPDATE')
     OR has_table_privilege('pc_mfa_recovery_identity_authority', 'public.organizations', 'DELETE') THEN
    RAISE EXCEPTION 'MFA recovery authority is broader than its fixed tuple'
      USING ERRCODE = '42501';
  END IF;
END;
$membership_and_recovery_authority_proof$;
