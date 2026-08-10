-- Repair the bounded staff authority ACL discovered by the live P0 reviewer preflight.
--
-- Production proved that pc_staff_runtime correctly cannot read auth.staff_assignments,
-- but the SECURITY DEFINER owner pc_staff_authority also lacked the SELECT that the
-- original bounded-staff migration intended. That made every fixed definer body that
-- consults staff assignments vulnerable to PostgreSQL 42501. Restore the authority
-- grant only; never widen the login-capable runtime.

DO $p0_reviewer_authority_prerequisites$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority') THEN
    RAISE EXCEPTION 'pc_staff_authority is required' USING ERRCODE = '42704';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime') THEN
    RAISE EXCEPTION 'pc_staff_runtime is required' USING ERRCODE = '42704';
  END IF;
  IF to_regprocedure('auth.staff_reviewer_preflight()') IS NULL THEN
    RAISE EXCEPTION 'auth.staff_reviewer_preflight() is required' USING ERRCODE = '42704';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority is not confined' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_runtime'
      AND (NOT rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime is not confined' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles role_row ON role_row.oid = membership.roleid
    WHERE role_row.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles member_row ON member_row.oid = membership.member
    WHERE member_row.rolname IN ('pc_staff_authority', 'pc_staff_runtime')
  ) THEN
    RAISE EXCEPTION 'staff authority/runtime roles must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function_row
    JOIN pg_catalog.pg_namespace schema_row ON schema_row.oid = function_row.pronamespace
    JOIN pg_catalog.pg_roles owner_row ON owner_row.oid = function_row.proowner
    WHERE schema_row.nspname = 'auth'
      AND function_row.proname = 'staff_reviewer_preflight'
      AND function_row.pronargs = 0
      AND function_row.prosecdef
      AND owner_row.rolname = 'pc_staff_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer preflight must remain SECURITY DEFINER owned by pc_staff_authority'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_authority_prerequisites$;

-- This is the authority ACL present in the original bounded staff design.
-- pc_staff_authority is NOLOGIN and has no members; callers reach this data only
-- through fixed SECURITY DEFINER functions whose EXECUTE grants are separately bounded.
GRANT USAGE ON SCHEMA auth TO pc_staff_authority;
GRANT SELECT ON auth.staff_assignments TO pc_staff_authority;

-- Reassert the external boundary in the same forward migration. A previously
-- misprovisioned runtime is narrowed rather than tolerated.
REVOKE ALL PRIVILEGES ON auth.staff_assignments FROM pc_staff_runtime;
GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_reviewer_preflight() TO pc_staff_runtime;

DO $p0_reviewer_staff_alias_boundary$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('app_staff', 'one_deal_staff')
  LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON auth.staff_assignments FROM %I', runtime_role);
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION auth.staff_reviewer_preflight() TO %I', runtime_role);
  END LOOP;
END;
$p0_reviewer_staff_alias_boundary$;

DO $p0_reviewer_authority_acl_proof$
BEGIN
  IF NOT has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'SELECT') THEN
    RAISE EXCEPTION 'pc_staff_authority SELECT on auth.staff_assignments is missing'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'INSERT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'UPDATE')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'DELETE')
  THEN
    RAISE EXCEPTION 'pc_staff_runtime must remain table-blind for auth.staff_assignments'
      USING ERRCODE = '42501';
  END IF;
  IF NOT has_function_privilege(
    'pc_staff_runtime', 'auth.staff_reviewer_preflight()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime reviewer-preflight EXECUTE is missing'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_authority_acl_proof$;
