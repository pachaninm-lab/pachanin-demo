-- P0 reviewer password-reset subject authority (#3785).
--
-- This is a narrow, temporary-in-effect read capability for the ordinary
-- password-reset ceremony. It never sets a password, MFA secret, assignment,
-- membership or tenant value. The sole value returned is the normalized email
-- of the unique ACTIVE PLATFORM_OWNER only while that identity is structurally
-- ready for reset and still has no usable bcrypt password. Once the human sets
-- a password through the normal reset flow, the function fails closed.
--
-- pc_staff_runtime remains table-free. The SECURITY DEFINER owner is the
-- existing NOLOGIN/NOINHERIT/NOBYPASSRLS pc_staff_authority, FORCE-RLS stays on,
-- and access is enabled only by a transaction-local marker inside this function.

DO $p0_reviewer_reset_principals$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority') THEN
    RAISE EXCEPTION 'pc_staff_authority is required for reviewer password reset'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime') THEN
    RAISE EXCEPTION 'pc_staff_runtime is required for reviewer password reset'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority is not confined'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_runtime'
      AND (NOT rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime is not confined'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_reset_principals$;

-- Reassert read-only privileges for the definer and no direct table privileges
-- for the LOGIN runtime. Existing readiness migrations already grant the same
-- SELECT columns to pc_staff_authority; these statements are intentionally
-- idempotent and do not broaden the selected columns.
GRANT USAGE ON SCHEMA public, auth TO pc_staff_authority;
GRANT SELECT ("id", "email", "passwordHash", "status", "deletedAt")
  ON public."users" TO pc_staff_authority;
GRANT SELECT ("id", "userId", "organizationId", "status")
  ON public."user_orgs" TO pc_staff_authority;
GRANT SELECT ("id", "tenantId", "status")
  ON public."organizations" TO pc_staff_authority;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."users", public."user_orgs", public."organizations"
  FROM pc_staff_authority;
REVOKE ALL ON public."users", public."user_orgs", public."organizations"
  FROM pc_staff_runtime;

DROP POLICY IF EXISTS users_staff_reviewer_password_reset_subject ON public."users";
CREATE POLICY users_staff_reviewer_password_reset_subject
ON public."users"
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_reviewer_password_reset_scope', true) = 'subject'
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = public."users"."id"
      AND assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

DROP POLICY IF EXISTS user_orgs_staff_reviewer_password_reset_subject ON public."user_orgs";
CREATE POLICY user_orgs_staff_reviewer_password_reset_subject
ON public."user_orgs"
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_reviewer_password_reset_scope', true) = 'subject'
  AND "id" = 'membership_pc_reviewer_internal_v1'
  AND "organizationId" = 'org_pc_internal_platform_v1'
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = public."user_orgs"."userId"
      AND assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

DROP POLICY IF EXISTS organizations_staff_reviewer_password_reset_subject ON public."organizations";
CREATE POLICY organizations_staff_reviewer_password_reset_subject
ON public."organizations"
FOR SELECT
TO pc_staff_authority
USING (
  current_setting('app.staff_reviewer_password_reset_scope', true) = 'subject'
  AND "id" = 'org_pc_internal_platform_v1'
);

CREATE OR REPLACE FUNCTION auth.staff_reviewer_password_reset_subject()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  v_candidate_count integer;
  v_subject_count integer;
  v_email text;
BEGIN
  PERFORM pg_catalog.set_config(
    'app.staff_reviewer_password_reset_scope',
    'subject',
    true
  );

  SELECT count(DISTINCT assignment.user_id)::integer
  INTO v_candidate_count
  FROM auth.staff_assignments assignment
  WHERE assignment.role = 'PLATFORM_OWNER'
    AND assignment.status = 'ACTIVE'
    AND assignment.revoked_at IS NULL
    AND assignment.suspended_at IS NULL
    AND assignment.valid_from <= now()
    AND (assignment.valid_until IS NULL OR assignment.valid_until > now());

  IF v_candidate_count <> 1 THEN
    RAISE EXCEPTION 'reviewer password-reset subject cardinality is %', v_candidate_count
      USING ERRCODE = '23514';
  END IF;

  SELECT count(*)::integer, min(subject."email")
  INTO v_subject_count, v_email
  FROM public."users" subject
  JOIN auth.staff_assignments assignment
    ON assignment.user_id = subject."id"
   AND assignment.role = 'PLATFORM_OWNER'
   AND assignment.status = 'ACTIVE'
   AND assignment.revoked_at IS NULL
   AND assignment.suspended_at IS NULL
   AND assignment.valid_from <= now()
   AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  WHERE subject."status" = 'ACTIVE'
    AND subject."deletedAt" IS NULL
    AND subject."email" = lower(btrim(subject."email"))
    AND subject."email" ~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$'
    AND (
      subject."passwordHash" IS NULL
      OR subject."passwordHash" !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$'
    )
    AND EXISTS (
      SELECT 1
      FROM public."user_orgs" membership
      JOIN public."organizations" organization
        ON organization."id" = membership."organizationId"
      WHERE membership."id" = 'membership_pc_reviewer_internal_v1'
        AND membership."userId" = subject."id"
        AND membership."organizationId" = 'org_pc_internal_platform_v1'
        AND membership."status" = 'ACTIVE'
        AND organization."id" = 'org_pc_internal_platform_v1'
        AND organization."status" = 'VERIFIED'
        AND coalesce(btrim(organization."tenantId"), '') <> ''
    );

  IF v_subject_count <> 1 OR v_email IS NULL THEN
    RAISE EXCEPTION 'reviewer password-reset subject is not uniquely eligible'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_catalog.set_config(
    'app.staff_reviewer_password_reset_scope',
    '',
    true
  );
  RETURN v_email;
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_catalog.set_config(
    'app.staff_reviewer_password_reset_scope',
    '',
    true
  );
  RAISE;
END;
$function$;

ALTER FUNCTION auth.staff_reviewer_password_reset_subject() OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_reviewer_password_reset_subject() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.staff_reviewer_password_reset_subject() TO pc_staff_runtime;

DO $p0_reviewer_reset_runtime_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'app_staff', 'one_deal_staff',
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'app_auth', 'app_runtime', 'app_storage', 'app_outbox',
      'one_deal_auth', 'one_deal_app', 'one_deal_storage'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_reviewer_password_reset_subject() FROM %I',
      runtime_role
    );
  END LOOP;
END;
$p0_reviewer_reset_runtime_grants$;

DO $p0_reviewer_reset_boundary_proof$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_reviewer_password_reset_subject'
      AND function.pronargs = 0
      AND function.prosecdef
      AND owner.rolname = 'pc_staff_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer password-reset subject definer boundary is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.staff_reviewer_password_reset_subject()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime reset-subject EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'public.users',
    'public.user_orgs',
    'public.organizations',
    'auth.staff_assignments'
  ]
  LOOP
    IF has_table_privilege('pc_staff_runtime', table_name, 'SELECT')
       OR has_table_privilege('pc_staff_runtime', table_name, 'INSERT')
       OR has_table_privilege('pc_staff_runtime', table_name, 'UPDATE')
       OR has_table_privilege('pc_staff_runtime', table_name, 'DELETE')
       OR has_table_privilege('pc_staff_runtime', table_name, 'TRUNCATE')
       OR has_table_privilege('pc_staff_runtime', table_name, 'REFERENCES')
       OR has_table_privilege('pc_staff_runtime', table_name, 'TRIGGER')
    THEN
      RAISE EXCEPTION 'pc_staff_runtime must remain table-free for %', table_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END;
$p0_reviewer_reset_boundary_proof$;
