-- P0 reviewer repair correction (#3799).
--
-- Production rollback-only diagnostic on exact main
-- 561935dbbd6648aad4db0a20a38d5baec1aa6737 classified the existing repair
-- refusal as OWNER_IDENTITY while aggregate reviewer readiness remained
-- 1/1/0/0/0/0 before and after rollback. The readiness authority defines an
-- ACTIVE reviewer assignment without requiring activated_at to be non-NULL.
-- The repair authority incorrectly added that extra condition in its RLS
-- policies and candidate query, making the same reviewer invisible to the
-- repair function. This migration removes only that inconsistent predicate.
--
-- No identity, assignment, password, MFA, session, customer organization or
-- tenant data is changed by this migration. The fixed repair ceremony remains
-- no-argument, SERIALIZABLE, advisory-locked, function-only and fail-closed.

ALTER POLICY users_reviewer_membership_repair_select
ON public."users"
USING (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = public."users"."id"
      AND assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.suspended_at IS NULL
      AND assignment.revoked_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

ALTER POLICY user_orgs_reviewer_membership_repair_select
ON public."user_orgs"
USING (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND (
    "id" = 'membership_pc_reviewer_internal_v1'
    OR EXISTS (
      SELECT 1
      FROM auth.staff_assignments assignment
      WHERE assignment.user_id = public."user_orgs"."userId"
        AND assignment.role = 'PLATFORM_OWNER'
        AND assignment.status = 'ACTIVE'
        AND assignment.suspended_at IS NULL
        AND assignment.revoked_at IS NULL
        AND assignment.valid_from <= now()
        AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    )
  )
);

ALTER POLICY user_orgs_reviewer_membership_repair_insert
ON public."user_orgs"
WITH CHECK (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND "id" = 'membership_pc_reviewer_internal_v1'
  AND "organizationId" = 'org_pc_internal_platform_v1'
  AND "role" = 'GUEST'
  AND "status" = 'ACTIVE'
  AND "requested_workspace" = 'employee'
  AND "isDefault" = true
  AND "is_org_admin" = true
  AND "activated_at" IS NOT NULL
  AND "revoked_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM auth.staff_assignments assignment
    WHERE assignment.user_id = public."user_orgs"."userId"
      AND assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.suspended_at IS NULL
      AND assignment.revoked_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
  )
);

DO $p0_reviewer_owner_identity_semantics$
DECLARE
  v_definition text;
  v_needle constant text := 'assignment.activated_at IS NOT NULL';
  v_occurrences integer;
BEGIN
  IF to_regprocedure('auth.repair_single_reviewer_membership()') IS NULL THEN
    RAISE EXCEPTION 'reviewer membership repair function is required'
      USING ERRCODE = '42883';
  END IF;

  SELECT pg_catalog.pg_get_functiondef(
    'auth.repair_single_reviewer_membership()'::regprocedure
  )
  INTO v_definition;

  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_needle, ''))
  ) / length(v_needle);

  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'reviewer repair activated_at predicate cardinality changed: %', v_occurrences
      USING ERRCODE = '23514';
  END IF;

  EXECUTE replace(v_definition, v_needle, 'TRUE');
END;
$p0_reviewer_owner_identity_semantics$;

DO $p0_reviewer_owner_identity_semantics_proof$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'auth.repair_single_reviewer_membership()'::regprocedure
  )
  INTO v_definition;

  IF position('assignment.activated_at IS NOT NULL' IN v_definition) <> 0 THEN
    RAISE EXCEPTION 'stale activated_at repair predicate remains'
      USING ERRCODE = '23514';
  END IF;

  IF position('assignment.role = ''PLATFORM_OWNER''' IN v_definition) = 0
     OR position('assignment.status = ''ACTIVE''' IN v_definition) = 0
     OR position('assignment.suspended_at IS NULL' IN v_definition) = 0
     OR position('assignment.revoked_at IS NULL' IN v_definition) = 0
     OR position('assignment.valid_from <= now()' IN v_definition) = 0
     OR position('(assignment.valid_until IS NULL OR assignment.valid_until > now())' IN v_definition) = 0
     OR position('Prisma.TransactionIsolationLevel.Serializable' IN v_definition) <> 0
  THEN
    RAISE EXCEPTION 'reviewer repair assignment guard changed unexpectedly'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc function
    JOIN pg_catalog.pg_namespace schema ON schema.oid = function.pronamespace
    JOIN pg_catalog.pg_roles owner ON owner.oid = function.proowner
    WHERE schema.nspname = 'auth'
      AND function.proname = 'repair_single_reviewer_membership'
      AND function.pronargs = 0
      AND function.prosecdef
      AND owner.rolname = 'pc_reviewer_membership_repair_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer repair definer boundary changed unexpectedly'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.repair_single_reviewer_membership()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime reviewer repair EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_reviewer_membership_repair_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'reviewer membership repair authority is not confined'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_owner_identity_semantics_proof$;
