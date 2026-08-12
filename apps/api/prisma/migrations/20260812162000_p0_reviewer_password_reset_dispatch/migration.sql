-- P0 single-reviewer password-reset dispatch authority (#3785).
--
-- Purpose: allow the production auth runtime to start the ordinary public
-- password-reset flow for the one existing PLATFORM_OWNER without publishing
-- that reviewer's email, password-reset token, password, MFA material, tenant,
-- membership or assignment through GitHub Actions, issue comments or artifacts.
--
-- This authority is read-only. It cannot set a password, enroll MFA, create a
-- staff assignment, repair membership, mutate an organization, or bypass RLS.
-- The caller receives one fixed projection (user id + email) only when exactly
-- one structurally valid PLATFORM_OWNER still lacks a usable bcrypt password.
-- Once the password is set, the function fails closed and cannot be used as a
-- general reviewer-directory lookup.

DO $p0_reviewer_password_reset_dispatch_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_reviewer_password_reset_dispatch_authority'
  ) THEN
    CREATE ROLE pc_reviewer_password_reset_dispatch_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  ALTER ROLE pc_reviewer_password_reset_dispatch_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_reviewer_password_reset_dispatch_authority'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE member.rolname = 'pc_reviewer_password_reset_dispatch_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer password-reset dispatch authority must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_password_reset_dispatch_role$;

-- Identity tables are already FORCE-RLS production authorities. Reassert the
-- boundary without changing ownership or granting the runtime any table read.
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_orgs" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public, auth TO pc_reviewer_password_reset_dispatch_authority;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public."users", public."user_orgs", public."organizations", auth.staff_assignments
  FROM pc_reviewer_password_reset_dispatch_authority;

GRANT SELECT ("id", "email", "passwordHash", "status", "deletedAt")
  ON public."users" TO pc_reviewer_password_reset_dispatch_authority;
GRANT SELECT ("userId", "organizationId", "status")
  ON public."user_orgs" TO pc_reviewer_password_reset_dispatch_authority;
GRANT SELECT ("id", "tenantId", "status")
  ON public."organizations" TO pc_reviewer_password_reset_dispatch_authority;
GRANT SELECT (user_id, role, status, revoked_at, suspended_at, valid_from, valid_until)
  ON auth.staff_assignments TO pc_reviewer_password_reset_dispatch_authority;

DROP POLICY IF EXISTS users_reviewer_password_reset_dispatch ON public."users";
CREATE POLICY users_reviewer_password_reset_dispatch
ON public."users"
FOR SELECT
TO pc_reviewer_password_reset_dispatch_authority
USING (
  current_setting('app.reviewer_password_reset_dispatch_scope', true) = 'single'
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

DROP POLICY IF EXISTS user_orgs_reviewer_password_reset_dispatch ON public."user_orgs";
CREATE POLICY user_orgs_reviewer_password_reset_dispatch
ON public."user_orgs"
FOR SELECT
TO pc_reviewer_password_reset_dispatch_authority
USING (
  current_setting('app.reviewer_password_reset_dispatch_scope', true) = 'single'
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

DROP POLICY IF EXISTS organizations_reviewer_password_reset_dispatch ON public."organizations";
CREATE POLICY organizations_reviewer_password_reset_dispatch
ON public."organizations"
FOR SELECT
TO pc_reviewer_password_reset_dispatch_authority
USING (
  current_setting('app.reviewer_password_reset_dispatch_scope', true) = 'single'
  AND EXISTS (
    SELECT 1
    FROM public."user_orgs" membership
    JOIN auth.staff_assignments assignment
      ON assignment.user_id = membership."userId"
    WHERE membership."organizationId" = public."organizations"."id"
      AND assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

-- If staff_assignments has RLS enabled in a production-like contour, admit only
-- the fixed owner rows while the SECURITY DEFINER function's local marker is
-- active. If RLS is disabled for this auth table, the same column grant remains
-- the only read capability of the isolated authority.
DROP POLICY IF EXISTS staff_assignments_reviewer_password_reset_dispatch ON auth.staff_assignments;
CREATE POLICY staff_assignments_reviewer_password_reset_dispatch
ON auth.staff_assignments
FOR SELECT
TO pc_reviewer_password_reset_dispatch_authority
USING (
  current_setting('app.reviewer_password_reset_dispatch_scope', true) = 'single'
  AND role = 'PLATFORM_OWNER'
  AND status = 'ACTIVE'
  AND revoked_at IS NULL
  AND suspended_at IS NULL
  AND valid_from <= now()
  AND (valid_until IS NULL OR valid_until > now())
);

CREATE OR REPLACE FUNCTION auth.resolve_single_reviewer_password_reset_subject()
RETURNS TABLE (
  user_id text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
DECLARE
  resolved_count integer;
  resolved_user_id text;
  resolved_email text;
BEGIN
  PERFORM pg_catalog.set_config(
    'app.reviewer_password_reset_dispatch_scope',
    'single',
    true
  );

  WITH candidates AS (
    SELECT DISTINCT subject."id" AS user_id, subject."email" AS email
    FROM public."users" subject
    JOIN auth.staff_assignments assignment
      ON assignment.user_id = subject."id"
    WHERE assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.revoked_at IS NULL
      AND assignment.suspended_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
      AND subject."status" = 'ACTIVE'
      AND subject."deletedAt" IS NULL
      AND subject."email" = lower(btrim(subject."email"))
      AND position('@' IN subject."email") > 1
      AND COALESCE(subject."passwordHash", '') !~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$'
      AND EXISTS (
        SELECT 1
        FROM public."user_orgs" membership
        JOIN public."organizations" organization
          ON organization."id" = membership."organizationId"
        WHERE membership."userId" = subject."id"
          AND membership."status" = 'ACTIVE'
          AND organization."status" = 'VERIFIED'
          AND COALESCE(btrim(organization."tenantId"), '') <> ''
      )
  )
  SELECT count(*)::integer, min(candidates.user_id), min(candidates.email)
  INTO resolved_count, resolved_user_id, resolved_email
  FROM candidates;

  IF resolved_count <> 1
     OR resolved_user_id IS NULL
     OR resolved_email IS NULL
  THEN
    RAISE EXCEPTION 'single reviewer password-reset subject is not available'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY SELECT resolved_user_id, resolved_email;
END;
$function$;

ALTER FUNCTION auth.resolve_single_reviewer_password_reset_subject()
  OWNER TO pc_reviewer_password_reset_dispatch_authority;
REVOKE ALL ON FUNCTION auth.resolve_single_reviewer_password_reset_subject() FROM PUBLIC;

DO $p0_reviewer_password_reset_dispatch_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth')
  LOOP
    EXECUTE format(
      'GRANT USAGE ON SCHEMA auth TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.resolve_single_reviewer_password_reset_subject() TO %I',
      runtime_role
    );
  END LOOP;

  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_staff_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'one_deal_staff', 'one_deal_app', 'one_deal_storage',
      'app_staff', 'app_runtime', 'app_storage', 'app_outbox'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.resolve_single_reviewer_password_reset_subject() FROM %I',
      runtime_role
    );
  END LOOP;
END;
$p0_reviewer_password_reset_dispatch_grants$;

DO $p0_reviewer_password_reset_dispatch_boundary_proof$
DECLARE
  table_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'resolve_single_reviewer_password_reset_subject'
      AND function.pronargs = 0
      AND function.prosecdef
      AND owner.rolname = 'pc_reviewer_password_reset_dispatch_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer password-reset dispatch function ownership is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_reviewer_password_reset_dispatch_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'reviewer password-reset dispatch authority is not confined'
      USING ERRCODE = '42501';
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'public.users',
    'public.user_orgs',
    'public.organizations',
    'auth.staff_assignments'
  ]
  LOOP
    IF has_table_privilege(
         'pc_reviewer_password_reset_dispatch_authority', table_name, 'INSERT'
       ) OR has_table_privilege(
         'pc_reviewer_password_reset_dispatch_authority', table_name, 'UPDATE'
       ) OR has_table_privilege(
         'pc_reviewer_password_reset_dispatch_authority', table_name, 'DELETE'
       ) OR has_table_privilege(
         'pc_reviewer_password_reset_dispatch_authority', table_name, 'TRUNCATE'
       ) OR has_table_privilege(
         'pc_reviewer_password_reset_dispatch_authority', table_name, 'REFERENCES'
       ) OR has_table_privilege(
         'pc_reviewer_password_reset_dispatch_authority', table_name, 'TRIGGER'
       )
    THEN
      RAISE EXCEPTION 'reviewer password-reset dispatch authority received unintended write privilege on %', table_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  -- The login runtime remains table-free: the only new capability is EXECUTE on
  -- the fixed SECURITY DEFINER projection.
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_auth_runtime'
  ) THEN
    IF has_table_privilege('pc_auth_runtime', 'public.users', 'SELECT')
       OR has_table_privilege('pc_auth_runtime', 'public.user_orgs', 'SELECT')
       OR has_table_privilege('pc_auth_runtime', 'public.organizations', 'SELECT')
       OR has_table_privilege('pc_auth_runtime', 'auth.staff_assignments', 'SELECT')
       OR NOT has_function_privilege(
         'pc_auth_runtime',
         'auth.resolve_single_reviewer_password_reset_subject()',
         'EXECUTE'
       )
    THEN
      RAISE EXCEPTION 'pc_auth_runtime reviewer password-reset dispatch boundary is invalid'
        USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$p0_reviewer_password_reset_dispatch_boundary_proof$;
