-- P0 reviewer-preflight RLS repair.
--
-- Live REG.RU evidence on exact main f81777080af499a47082317e703c10da30c0f804
-- proved two separate facts:
--   1. pc_staff_runtime correctly has no direct SELECT on auth.staff_assignments;
--   2. after restoring the pre-existing pc_staff_authority SELECT ACL, the
--      SECURITY DEFINER helper is still stopped by row-level security.
--
-- Do not bypass RLS and do not widen the runtime. Follow the same confined
-- authority pattern used by the bounded staff admission/projection functions:
-- a role-specific policy admits the NOLOGIN authority only while the fixed
-- helper has set an internal transaction-local scope marker.

DO $reviewer_preflight_rls_principals$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_authority') THEN
    RAISE EXCEPTION 'pc_staff_authority is required for reviewer-preflight RLS repair'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_staff_runtime') THEN
    RAISE EXCEPTION 'pc_staff_runtime is required for reviewer-preflight RLS repair'
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

  IF to_regclass('auth.staff_assignments') IS NULL THEN
    RAISE EXCEPTION 'auth.staff_assignments is required for reviewer-preflight RLS repair'
      USING ERRCODE = '42501';
  END IF;
END;
$reviewer_preflight_rls_principals$;

-- Preserve the pre-existing bounded authority read and keep every staff runtime
-- table-free. No RLS enable/force state is weakened by this migration.
GRANT USAGE ON SCHEMA auth TO pc_staff_authority;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON auth.staff_assignments FROM pc_staff_authority;
GRANT SELECT ON auth.staff_assignments TO pc_staff_authority;
REVOKE ALL PRIVILEGES ON auth.staff_assignments FROM pc_staff_runtime;

DO $reviewer_preflight_rls_aliases$
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
$reviewer_preflight_rls_aliases$;

-- The policy is deliberately permissive only for the isolated NOLOGIN authority
-- and only while the helper's transaction-local marker has the exact aggregate
-- value. With the marker unset/empty it admits no row.
DROP POLICY IF EXISTS staff_assignments_reviewer_preflight_select
  ON auth.staff_assignments;
CREATE POLICY staff_assignments_reviewer_preflight_select
  ON auth.staff_assignments
  FOR SELECT
  TO pc_staff_authority
  USING (
    current_setting('app.staff_reviewer_preflight_scope', true) = 'aggregate'
  );

-- PL/pgSQL is used intentionally: unlike the original single SQL statement, the
-- helper can establish and surrender its narrow RLS marker around the aggregate
-- read. set_config is a transaction-local side effect, so VOLATILE is the
-- truthful function classification even though no durable row is modified.
CREATE OR REPLACE FUNCTION auth.staff_reviewer_preflight()
RETURNS TABLE (
  active_owner_count integer,
  usable_reviewer_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = pg_catalog, pg_temp
SET row_security = on
AS $function$
BEGIN
  -- Reassert the safe value inside the fixed definer body as defense in depth
  -- against a caller connection configured with row_security=off.
  PERFORM set_config('row_security', 'on', true);
  PERFORM set_config('app.staff_reviewer_preflight_scope', 'aggregate', true);

  RETURN QUERY
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

  PERFORM set_config('app.staff_reviewer_preflight_scope', '', true);
END;
$function$;

ALTER FUNCTION auth.staff_reviewer_preflight() OWNER TO pc_staff_authority;
REVOKE ALL ON FUNCTION auth.staff_reviewer_preflight() FROM PUBLIC;
GRANT USAGE ON SCHEMA auth TO pc_staff_runtime;
GRANT EXECUTE ON FUNCTION auth.staff_reviewer_preflight() TO pc_staff_runtime;

DO $reviewer_preflight_rls_function_aliases$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('app_staff', 'one_deal_staff')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.staff_reviewer_preflight() TO %I',
      runtime_role
    );
  END LOOP;
END;
$reviewer_preflight_rls_function_aliases$;

DO $reviewer_preflight_rls_proof$
DECLARE
  authority_oid oid;
  active_owners integer;
  usable_reviewers integer;
BEGIN
  SELECT oid INTO authority_oid
  FROM pg_catalog.pg_roles
  WHERE rolname = 'pc_staff_authority';

  IF NOT has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'SELECT') THEN
    RAISE EXCEPTION 'pc_staff_authority reviewer-preflight SELECT is missing'
      USING ERRCODE = '42501';
  END IF;
  IF has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'INSERT')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'UPDATE')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'DELETE')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'TRUNCATE')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'REFERENCES')
     OR has_table_privilege('pc_staff_authority', 'auth.staff_assignments', 'TRIGGER')
  THEN
    RAISE EXCEPTION 'pc_staff_authority reviewer-preflight privilege is broader than SELECT'
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

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policy policy
    JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'auth'
      AND relation.relname = 'staff_assignments'
      AND policy.polname = 'staff_assignments_reviewer_preflight_select'
      AND policy.polcmd = 'r'
      AND cardinality(policy.polroles) = 1
      AND policy.polroles @> ARRAY[authority_oid]::oid[]
      AND position(
        'app.staff_reviewer_preflight_scope'
        IN pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
      ) > 0
      AND position(
        'aggregate'
        IN pg_catalog.pg_get_expr(policy.polqual, policy.polrelid)
      ) > 0
  ) THEN
    RAISE EXCEPTION 'reviewer-preflight RLS policy is missing or broader than the authority marker'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    JOIN pg_catalog.pg_language language ON language.oid = function.prolang
    WHERE schema.nspname = 'auth'
      AND function.proname = 'staff_reviewer_preflight'
      AND function.pronargs = 0
      AND function.prosecdef
      AND function.provolatile = 'v'
      AND owner.rolname = 'pc_staff_authority'
      AND language.lanname = 'plpgsql'
      AND function.proconfig @> ARRAY['row_security=on']::text[]
  ) THEN
    RAISE EXCEPTION 'reviewer-preflight function RLS configuration is invalid'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime', 'auth.staff_reviewer_preflight()', 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime reviewer-preflight EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;

  -- Execute the exact aggregate surface during migration. If row_security=off
  -- leaks from the migration/session context or the policy is ineffective, the
  -- migration fails before a release can claim readiness.
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
$reviewer_preflight_rls_proof$;
