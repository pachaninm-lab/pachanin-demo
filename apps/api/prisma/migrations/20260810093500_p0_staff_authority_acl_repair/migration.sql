-- Forward repair for the bounded staff authority ACL used by the P0 reviewer preflight.
--
-- Production evidence from the exact-main reviewer preflight showed that the
-- SECURITY DEFINER function auth.staff_reviewer_preflight() is owned by the
-- confined NOLOGIN pc_staff_authority role, while that owner no longer has the
-- SELECT privilege on auth.staff_assignments that the original bounded staff
-- authority migration granted. The caller, pc_staff_runtime, correctly has no
-- table privilege and must remain function-only.
--
-- This migration therefore reconciles only the pre-existing authority grant.
-- It does not create/elevate any staff identity, change any assignment row or
-- grant a runtime direct table access.

DO $p0_staff_authority_acl_principals$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority') THEN
    RAISE EXCEPTION 'pc_staff_authority is required for reviewer-preflight ACL repair'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime') THEN
    RAISE EXCEPTION 'pc_staff_runtime is required for reviewer-preflight ACL repair'
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

  IF to_regprocedure('auth.staff_reviewer_preflight()') IS NULL THEN
    RAISE EXCEPTION 'auth.staff_reviewer_preflight() is required before ACL repair'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_reviewer_preflight'
      AND function.pronargs = 0
      AND function.prosecdef
      AND owner.rolname = 'pc_staff_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer-preflight definer ownership is invalid'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_staff_authority_acl_principals$;

-- Restore exactly the authority read established by
-- 20260806103000_bounded_staff_admission_authority. Explicitly remove any write
-- capability first so this repair cannot accidentally turn into a broader ACL.
GRANT USAGE ON SCHEMA auth TO pc_staff_authority;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON auth.staff_assignments FROM pc_staff_authority;
GRANT SELECT ON auth.staff_assignments TO pc_staff_authority;

-- Keep every staff runtime function-only. Aliases are conditional because they
-- exist only in production-like/DR harnesses, not necessarily on REG.RU.
REVOKE ALL PRIVILEGES ON auth.staff_assignments FROM pc_staff_runtime;
DO $p0_staff_runtime_aliases_no_table_access$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('app_staff', 'one_deal_staff')
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON auth.staff_assignments FROM %I',
      runtime_role
    );
  END LOOP;
END;
$p0_staff_runtime_aliases_no_table_access$;

DO $p0_staff_authority_acl_proof$
DECLARE
  active_owners integer;
  usable_reviewers integer;
BEGIN
  IF NOT has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'SELECT') THEN
    RAISE EXCEPTION 'pc_staff_authority staff_assignments SELECT repair is missing'
      USING ERRCODE = '42501';
  END IF;

  IF has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'INSERT')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'UPDATE')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'DELETE')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'TRUNCATE')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'REFERENCES')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'TRIGGER')
  THEN
    RAISE EXCEPTION 'pc_staff_authority received an unintended staff_assignments write privilege'
      USING ERRCODE = '42501';
  END IF;

  IF has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'INSERT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'UPDATE')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'DELETE')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'TRUNCATE')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'REFERENCES')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'TRIGGER')
  THEN
    RAISE EXCEPTION 'pc_staff_runtime must remain table-free for staff_assignments'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime', 'auth.staff_reviewer_preflight()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime reviewer-preflight EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;

  -- Execute the exact aggregate-only definer once during migration. This is a
  -- read-only proof that the repaired owner can actually read its source table;
  -- a missing authority ACL fails the migration instead of surviving to the
  -- owner-only production preflight.
  SELECT result.active_owner_count, result.usable_reviewer_count
  INTO active_owners, usable_reviewers
  FROM auth.staff_reviewer_preflight() AS result;

  IF active_owners IS NULL OR active_owners < 0
     OR usable_reviewers IS NULL OR usable_reviewers < 0
  THEN
    RAISE EXCEPTION 'reviewer-preflight aggregate proof returned invalid counts'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_staff_authority_acl_proof$;
