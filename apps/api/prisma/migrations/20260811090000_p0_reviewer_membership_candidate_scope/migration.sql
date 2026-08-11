-- P0 reviewer membership candidate-scope correction (#3799).
--
-- The exact production rollback-only diagnostic classified the repair refusal
-- as CONFLICTING_EXISTING_MEMBERSHIP while reviewer readiness remained
-- 1/1/0/0/0/0 and no durable mutation occurred. The repair function counted
-- every organization membership owned by the unique reviewer, so an unrelated
-- historic or customer membership was incorrectly treated as a collision.
--
-- This forward-only migration changes only that candidate count. A collision
-- remains any row occupying the fixed membership identifier or the unique
-- reviewer/fixed-internal-organization pair. Unrelated memberships are neither
-- counted nor changed. The existing exact-row validation, fixed-identifier
-- collision check, SERIALIZABLE/advisory lock, FORCE-RLS policy boundary,
-- audit/outbox evidence and function-only runtime authority remain unchanged.
--
-- No identity, assignment, membership, organization, password, MFA, session,
-- customer tenant or evidence row is mutated by this migration.

DO $p0_reviewer_membership_candidate_scope$
DECLARE
  v_definition text;
  v_old_query constant text := $old$  SELECT count(*)::integer
  INTO v_candidate_membership_count
  FROM public."user_orgs" membership
  WHERE membership."userId" = v_user_id;$old$;
  v_new_query constant text := $new$  SELECT count(*)::integer
  INTO v_candidate_membership_count
  FROM public."user_orgs" membership
  WHERE membership."id" = 'membership_pc_reviewer_internal_v1'
     OR (
       membership."userId" = v_user_id
       AND membership."organizationId" = 'org_pc_internal_platform_v1'
     );$new$;
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
    length(v_definition) - length(replace(v_definition, v_old_query, ''))
  ) / length(v_old_query);

  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'reviewer membership candidate query cardinality changed: %', v_occurrences
      USING ERRCODE = '23514';
  END IF;

  EXECUTE replace(v_definition, v_old_query, v_new_query);
END;
$p0_reviewer_membership_candidate_scope$;

DO $p0_reviewer_membership_candidate_scope_proof$
DECLARE
  v_definition text;
  v_old_query constant text := $old$  SELECT count(*)::integer
  INTO v_candidate_membership_count
  FROM public."user_orgs" membership
  WHERE membership."userId" = v_user_id;$old$;
  v_new_query constant text := $new$  SELECT count(*)::integer
  INTO v_candidate_membership_count
  FROM public."user_orgs" membership
  WHERE membership."id" = 'membership_pc_reviewer_internal_v1'
     OR (
       membership."userId" = v_user_id
       AND membership."organizationId" = 'org_pc_internal_platform_v1'
     );$new$;
  v_new_occurrences integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'auth.repair_single_reviewer_membership()'::regprocedure
  )
  INTO v_definition;

  IF position(v_old_query IN v_definition) <> 0 THEN
    RAISE EXCEPTION 'global reviewer membership candidate scan remains'
      USING ERRCODE = '23514';
  END IF;

  v_new_occurrences := (
    length(v_definition) - length(replace(v_definition, v_new_query, ''))
  ) / length(v_new_query);

  IF v_new_occurrences <> 1 THEN
    RAISE EXCEPTION 'bounded reviewer membership candidate query is missing or duplicated: %', v_new_occurrences
      USING ERRCODE = '23514';
  END IF;

  IF position('v_fixed_membership_collision_count' IN v_definition) = 0
     OR position('membership."id" = ''membership_pc_reviewer_internal_v1''' IN v_definition) = 0
     OR position('membership."organizationId" = ''org_pc_internal_platform_v1''' IN v_definition) = 0
     OR position('v_candidate_membership_count = 0' IN v_definition) = 0
     OR position('v_candidate_membership_count = 1' IN v_definition) = 0
     OR position('v_exact_membership_count = 1' IN v_definition) = 0
     OR position('session_user <> ''pc_staff_runtime''' IN v_definition) = 0
     OR position('current_setting(''transaction_isolation'') <> ''serializable''' IN v_definition) = 0
  THEN
    RAISE EXCEPTION 'reviewer repair collision or execution boundary changed unexpectedly'
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
$p0_reviewer_membership_candidate_scope_proof$;
