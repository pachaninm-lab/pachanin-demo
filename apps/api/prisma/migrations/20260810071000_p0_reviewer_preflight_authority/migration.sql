-- P0 reviewer-preflight authority.
--
-- The dedicated staff runtime is intentionally function-only. It must never
-- regain SELECT on auth.staff_assignments merely so an operational preflight
-- can count reviewers. Expose exactly the two aggregate facts required by the
-- owner-only production acceptance workflow through the existing NOLOGIN
-- pc_staff_authority definer boundary.

DO $reviewer_preflight_principals$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority') THEN
    RAISE EXCEPTION 'pc_staff_authority is required before reviewer preflight authority'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime') THEN
    RAISE EXCEPTION 'pc_staff_runtime is required before reviewer preflight authority'
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

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE member.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
  ) THEN
    RAISE EXCEPTION 'staff authority/runtime roles must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;
END;
$reviewer_preflight_principals$;

CREATE OR REPLACE FUNCTION auth.staff_reviewer_preflight()
RETURNS TABLE (
  active_owner_count integer,
  usable_reviewer_count integer
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
  SELECT
    count(*) FILTER (
      WHERE assignment.role = 'PLATFORM_OWNER'
        AND assignment.status = 'ACTIVE'
        AND assignment.revoked_at IS NULL
        AND assignment.suspended_at IS NULL
        AND assignment.valid_from <= now()
        AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    )::integer AS active_owner_count,
    count(*) FILTER (
      WHERE assignment.role IN ('PLATFORM_OWNER', 'PLATFORM_ADMIN', 'COMPLIANCE_STAFF')
        AND assignment.status IN ('ELIGIBLE', 'ACTIVE')
        AND assignment.revoked_at IS NULL
        AND assignment.suspended_at IS NULL
        AND assignment.valid_from <= now()
        AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    )::integer AS usable_reviewer_count
  FROM auth.staff_assignments assignment;
$function$;

ALTER FUNCTION auth.staff_reviewer_preflight() OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_reviewer_preflight() FROM PUBLIC;

-- Production runtime: function-only access. No table privilege is added here.
GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_reviewer_preflight() TO pc_staff_runtime;

-- Production-like / isolated-DR aliases receive the same function-only surface
-- when those roles already exist. Their bootstrap scripts re-establish it when
-- they are created after migrations.
DO $reviewer_preflight_staff_aliases$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('app_staff', 'one_deal_staff')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION auth.staff_reviewer_preflight() TO %I', runtime_role);
  END LOOP;
END;
$reviewer_preflight_staff_aliases$;

-- Explicitly refuse every non-staff runtime known to the repository. This is
-- defense in depth against a later broad schema-function grant.
DO $reviewer_preflight_revoke_nonstaff$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN (
      'pc_auth_runtime', 'pc_deal_runtime', 'pc_storage_runtime', 'pc_outbox_runtime',
      'app_auth', 'app_runtime', 'app_storage', 'app_outbox',
      'one_deal_auth', 'one_deal_app', 'one_deal_storage'
    )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION auth.staff_reviewer_preflight() FROM %I',
      runtime_role
    );
  END LOOP;
END;
$reviewer_preflight_revoke_nonstaff$;

DO $reviewer_preflight_boundary_proof$
BEGIN
  IF has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'SELECT') THEN
    RAISE EXCEPTION 'pc_staff_runtime must not SELECT auth.staff_assignments'
      USING ERRCODE = '42501';
  END IF;
  IF NOT has_function_privilege(
    'pc_staff_runtime', 'auth.staff_reviewer_preflight()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime reviewer-preflight EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_reviewer_preflight'
      AND function.pronargs = 0
      AND (owner.rolname <> 'pc_staff_authority' OR NOT function.prosecdef)
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_reviewer_preflight'
      AND function.pronargs = 0
      AND owner.rolname = 'pc_staff_authority'
      AND function.prosecdef
  ) THEN
    RAISE EXCEPTION 'reviewer-preflight definer ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
END;
$reviewer_preflight_boundary_proof$;
