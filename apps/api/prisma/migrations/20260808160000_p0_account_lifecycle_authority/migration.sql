-- Session-bound personal-data export and account anonymization under identity
-- FORCE RLS. Read-only portability and destructive lifecycle mutation have
-- separate owners so neither authority receives the other's capabilities.

DO $account_lifecycle_authority_roles$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_account_export_authority'
  ) THEN
    CREATE ROLE pc_account_export_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_account_export_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_account_anonymization_authority'
  ) THEN
    CREATE ROLE pc_account_anonymization_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_account_anonymization_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname IN (
      'pc_account_export_authority',
      'pc_account_anonymization_authority'
    )
  ) THEN
    RAISE EXCEPTION 'Account lifecycle authorities must have no members'
      USING ERRCODE = '42501';
  END IF;
END;
$account_lifecycle_authority_roles$;

ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_account_export_select ON public."users";
CREATE POLICY users_account_export_select ON public."users"
  FOR SELECT TO pc_account_export_authority USING (true);
DROP POLICY IF EXISTS user_orgs_account_export_select ON public."user_orgs";
CREATE POLICY user_orgs_account_export_select ON public."user_orgs"
  FOR SELECT TO pc_account_export_authority USING (true);
DROP POLICY IF EXISTS organizations_account_export_select ON public."organizations";
CREATE POLICY organizations_account_export_select ON public."organizations"
  FOR SELECT TO pc_account_export_authority USING (true);

DROP POLICY IF EXISTS users_account_anonymization_select ON public."users";
CREATE POLICY users_account_anonymization_select ON public."users"
  FOR SELECT TO pc_account_anonymization_authority USING (true);
DROP POLICY IF EXISTS users_account_anonymization_update ON public."users";
CREATE POLICY users_account_anonymization_update ON public."users"
  FOR UPDATE TO pc_account_anonymization_authority USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS user_orgs_account_anonymization_select ON public."user_orgs";
CREATE POLICY user_orgs_account_anonymization_select ON public."user_orgs"
  FOR SELECT TO pc_account_anonymization_authority USING (true);
DROP POLICY IF EXISTS organizations_account_anonymization_select ON public."organizations";
CREATE POLICY organizations_account_anonymization_select ON public."organizations"
  FOR SELECT TO pc_account_anonymization_authority USING (true);

GRANT USAGE ON SCHEMA public, auth
  TO pc_account_export_authority, pc_account_anonymization_authority;

REVOKE ALL PRIVILEGES ON public."users", public."user_orgs", public."organizations"
  FROM pc_account_export_authority, pc_account_anonymization_authority;

GRANT SELECT ("id", "email", "phone", "fullName", "status", "createdAt", "deletedAt")
  ON public."users" TO pc_account_export_authority;
GRANT SELECT (
  "id", "userId", "organizationId", "role", "status", "joinedAt"
) ON public."user_orgs" TO pc_account_export_authority;
GRANT SELECT ("id", "name", "tenantId", "status")
  ON public."organizations" TO pc_account_export_authority;
GRANT SELECT (
  id, user_id, membership_id, organization_id, tenant_id, status,
  credential_version, expires_at, revoked_at
) ON auth.sessions TO pc_account_export_authority;
GRANT SELECT (
  user_id, credential_version, mfa_enabled, consent_version, consent_at
) ON auth.credential_states TO pc_account_export_authority;

GRANT SELECT ("id", "status", "deletedAt")
  ON public."users" TO pc_account_anonymization_authority;
GRANT UPDATE (
  "email", "phone", "passwordHash", "fullName", "status", "mfaEnabled",
  "mfaSecret", "mfaBackup", "updatedAt", "deletedAt"
) ON public."users" TO pc_account_anonymization_authority;
GRANT SELECT ("id", "userId", "organizationId", "status")
  ON public."user_orgs" TO pc_account_anonymization_authority;
GRANT SELECT ("id", "tenantId", "status")
  ON public."organizations" TO pc_account_anonymization_authority;
GRANT SELECT (
  id, user_id, membership_id, organization_id, tenant_id, status,
  credential_version, expires_at, revoked_at
) ON auth.sessions TO pc_account_anonymization_authority;
GRANT UPDATE (status, revoked_at, revocation_reason, updated_at)
  ON auth.sessions TO pc_account_anonymization_authority;
GRANT SELECT (session_id, status)
  ON auth.refresh_tokens TO pc_account_anonymization_authority;
GRANT UPDATE (status, revoked_at, revocation_reason)
  ON auth.refresh_tokens TO pc_account_anonymization_authority;
GRANT SELECT (user_id, credential_version)
  ON auth.credential_states TO pc_account_anonymization_authority;
GRANT UPDATE (
  credential_version, failed_login_count, locked_until, password_changed_at,
  last_login_at, mfa_enabled,
  mfa_secret_ciphertext, mfa_key_version, mfa_backup_hashes, updated_at
) ON auth.credential_states TO pc_account_anonymization_authority;

CREATE OR REPLACE FUNCTION auth.account_data_export(
  p_session_id text,
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
  created_at timestamptz,
  consent_version text,
  consent_at timestamptz,
  mfa_enabled boolean,
  credential_version integer,
  membership_data jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
  SELECT
    subject."id",
    subject."email",
    subject."fullName",
    subject."phone",
    subject."createdAt",
    credential.consent_version,
    credential.consent_at,
    credential.mfa_enabled,
    credential.credential_version,
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'membershipId', membership."id",
          'role', membership."role",
          'status', membership."status",
          'organizationId', organization."id",
          'organizationName', organization."name",
          'tenantId', organization."tenantId",
          'organizationStatus', organization."status"
        ) ORDER BY membership."joinedAt", membership."id"
      )
      FROM public."user_orgs" membership
      JOIN public."organizations" organization
        ON organization."id" = membership."organizationId"
      WHERE membership."userId" = subject."id"
    ), '[]'::jsonb)
  FROM public."users" subject
  JOIN auth.credential_states credential ON credential.user_id = subject."id"
  WHERE subject."id" = p_user_id
    AND subject."status" = 'ACTIVE'
    AND subject."deletedAt" IS NULL
    AND EXISTS (
      SELECT 1
      FROM auth.sessions session
      JOIN public."user_orgs" current_membership
        ON current_membership."id" = session.membership_id
       AND current_membership."userId" = session.user_id
       AND current_membership."organizationId" = session.organization_id
      JOIN public."organizations" current_organization
        ON current_organization."id" = session.organization_id
       AND current_organization."tenantId" = session.tenant_id
      WHERE session.id = p_session_id
        AND session.user_id = p_user_id
        AND session.membership_id = p_membership_id
        AND session.organization_id = p_organization_id
        AND session.tenant_id = p_tenant_id
        AND session.status = 'ACTIVE'
        AND session.revoked_at IS NULL
        AND session.expires_at > now()
        AND session.credential_version = credential.credential_version
        AND current_membership."status" = 'ACTIVE'
        AND current_organization."status" = 'VERIFIED'
    );
$function$;

CREATE OR REPLACE FUNCTION auth.anonymize_account_identity(
  p_session_id text,
  p_user_id text,
  p_membership_id text,
  p_organization_id text,
  p_tenant_id text
)
RETURNS TABLE (applied boolean, anonymized_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  lifecycle_time timestamptz := clock_timestamp();
  resolved_user_id text;
  affected integer;
BEGIN
  SELECT subject."id"
  INTO resolved_user_id
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
  WHERE session.id = p_session_id
    AND session.user_id = p_user_id
    AND session.membership_id = p_membership_id
    AND session.organization_id = p_organization_id
    AND session.tenant_id = p_tenant_id
    AND session.status = 'ACTIVE'
    AND session.revoked_at IS NULL
    AND session.expires_at > lifecycle_time
  FOR UPDATE OF session, credential, subject;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE auth.sessions
  SET status = 'REVOKED',
      revoked_at = lifecycle_time,
      revocation_reason = 'ACCOUNT_ANONYMIZED',
      updated_at = lifecycle_time
  WHERE user_id = resolved_user_id
    AND status IN ('ACTIVE', 'MFA_PENDING');

  UPDATE auth.refresh_tokens refresh
  SET status = 'REVOKED',
      revoked_at = lifecycle_time,
      revocation_reason = 'ACCOUNT_ANONYMIZED'
  FROM auth.sessions session
  WHERE session.id = refresh.session_id
    AND session.user_id = resolved_user_id
    AND refresh.status IN ('ACTIVE', 'ROTATED');

  UPDATE auth.credential_states credential
  SET credential_version = credential.credential_version + 1,
      failed_login_count = 0,
      locked_until = NULL,
      password_changed_at = NULL,
      last_login_at = NULL,
      mfa_enabled = false,
      mfa_secret_ciphertext = NULL,
      mfa_key_version = NULL,
      mfa_backup_hashes = NULL,
      updated_at = lifecycle_time
  WHERE credential.user_id = resolved_user_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Account credential state is missing'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public."users" subject
  SET "email" = 'anon-' || subject."id" || '@deleted.invalid',
      "fullName" = 'Anonymized User',
      "phone" = NULL,
      "passwordHash" = '',
      "status" = 'BLOCKED',
      "mfaEnabled" = false,
      "mfaSecret" = NULL,
      "mfaBackup" = NULL,
      "deletedAt" = lifecycle_time,
      "updatedAt" = lifecycle_time
  WHERE subject."id" = resolved_user_id
    AND subject."status" = 'ACTIVE'
    AND subject."deletedAt" IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Account anonymization conflict'
      USING ERRCODE = '40001';
  END IF;

  RETURN QUERY SELECT true, lifecycle_time;
END;
$function$;

ALTER FUNCTION auth.account_data_export(text,text,text,text,text)
  OWNER TO pc_account_export_authority;
ALTER FUNCTION auth.anonymize_account_identity(text,text,text,text,text)
  OWNER TO pc_account_anonymization_authority;
REVOKE ALL ON FUNCTION auth.account_data_export(text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.anonymize_account_identity(text,text,text,text,text) FROM PUBLIC;

DO $account_lifecycle_runtime_grants$
DECLARE
  runtime_role text;
  function_signature text;
  exported_functions text[] := ARRAY[
    'auth.account_data_export(text,text,text,text,text)',
    'auth.anonymize_account_identity(text,text,text,text,text)'
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
$account_lifecycle_runtime_grants$;

DO $account_lifecycle_authority_proof$
BEGIN
  IF (SELECT count(*)
      FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname = 'account_data_export'
        AND function.prosecdef
        AND owner.rolname = 'pc_account_export_authority') <> 1 THEN
    RAISE EXCEPTION 'Account export ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*)
      FROM pg_catalog.pg_proc function
      JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
      JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
      WHERE schema.nspname = 'auth'
        AND function.proname = 'anonymize_account_identity'
        AND function.prosecdef
        AND owner.rolname = 'pc_account_anonymization_authority') <> 1 THEN
    RAISE EXCEPTION 'Account anonymization ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_account_export_authority', 'public.users', 'UPDATE')
     OR has_table_privilege('pc_account_export_authority', 'public.user_orgs', 'UPDATE')
     OR has_table_privilege('pc_account_export_authority', 'public.organizations', 'UPDATE')
     OR has_table_privilege('pc_account_export_authority', 'auth.sessions', 'UPDATE')
     OR has_table_privilege('pc_account_export_authority', 'auth.credential_states', 'UPDATE') THEN
    RAISE EXCEPTION 'Account export authority is not read-only'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_account_anonymization_authority', 'public.users', 'INSERT')
     OR has_table_privilege('pc_account_anonymization_authority', 'public.users', 'DELETE')
     OR has_table_privilege('pc_account_anonymization_authority', 'public.user_orgs', 'INSERT')
     OR has_table_privilege('pc_account_anonymization_authority', 'public.user_orgs', 'UPDATE')
     OR has_table_privilege('pc_account_anonymization_authority', 'public.user_orgs', 'DELETE')
     OR has_table_privilege('pc_account_anonymization_authority', 'public.organizations', 'INSERT')
     OR has_table_privilege('pc_account_anonymization_authority', 'public.organizations', 'UPDATE')
     OR has_table_privilege('pc_account_anonymization_authority', 'public.organizations', 'DELETE') THEN
    RAISE EXCEPTION 'Account anonymization authority is broader than its fixed tuple'
      USING ERRCODE = '42501';
  END IF;
END;
$account_lifecycle_authority_proof$;
