-- P0 correction: admit the already-bounded one-time reviewer membership repair
-- through the existing FORCE-RLS staff authority tables.
--
-- The previous migration kept pc_staff_runtime function-only and created a
-- confined no-login, no-inherit, no-bypass security-definer owner. It granted
-- that owner the exact table privileges required by
-- auth.repair_single_reviewer_membership(), but did not add matching FORCE-RLS
-- policies for auth.staff_assignments and auth.staff_access_events. The live
-- ceremony therefore failed closed and its transaction was rolled back.
--
-- This correction adds only one SELECT policy for the unique active
-- PLATFORM_OWNER assignment plus SELECT/INSERT policies for that same actor's
-- append-only audit chain. It adds no update/delete/truncate path, no login,
-- no role membership and no RLS bypass authority.

DO $p0_reviewer_membership_auth_rls_prerequisites$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_reviewer_membership_repair_authority'
      AND NOT rolcanlogin
      AND NOT rolinherit
      AND NOT rolsuper
      AND NOT rolbypassrls
      AND NOT rolcreatedb
      AND NOT rolcreaterole
  ) THEN
    RAISE EXCEPTION 'confined reviewer membership repair authority is required'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_reviewer_membership_repair_authority'
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE member.rolname = 'pc_reviewer_membership_repair_authority'
  ) THEN
    RAISE EXCEPTION 'reviewer membership repair authority must remain membership-isolated'
      USING ERRCODE = '42501';
  END IF;

  IF to_regprocedure('auth.repair_single_reviewer_membership()') IS NULL THEN
    RAISE EXCEPTION 'bounded reviewer membership repair function is required'
      USING ERRCODE = '42883';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'auth'
      AND relation.relname IN ('staff_assignments', 'staff_access_events')
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) <> 2 THEN
    RAISE EXCEPTION 'staff assignments and access events must remain ENABLE + FORCE RLS'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_table_privilege(
    'pc_reviewer_membership_repair_authority',
    'auth.staff_assignments',
    'SELECT'
  ) OR NOT has_table_privilege(
    'pc_reviewer_membership_repair_authority',
    'auth.staff_access_events',
    'SELECT'
  ) OR NOT has_table_privilege(
    'pc_reviewer_membership_repair_authority',
    'auth.staff_access_events',
    'INSERT'
  ) THEN
    RAISE EXCEPTION 'existing bounded reviewer repair grants are incomplete'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_membership_auth_rls_prerequisites$;

DROP POLICY IF EXISTS staff_assignments_reviewer_membership_repair_select
  ON auth.staff_assignments;
CREATE POLICY staff_assignments_reviewer_membership_repair_select
ON auth.staff_assignments
FOR SELECT TO pc_reviewer_membership_repair_authority
USING (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND role = 'PLATFORM_OWNER'
  AND status = 'ACTIVE'
  AND activated_at IS NOT NULL
  AND suspended_at IS NULL
  AND revoked_at IS NULL
  AND valid_from <= now()
  AND (valid_until IS NULL OR valid_until > now())
);

DROP POLICY IF EXISTS staff_access_events_reviewer_membership_repair_select
  ON auth.staff_access_events;
CREATE POLICY staff_access_events_reviewer_membership_repair_select
ON auth.staff_access_events
FOR SELECT TO pc_reviewer_membership_repair_authority
USING (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND actor_user_id = (
    SELECT min(assignment.user_id)
    FROM auth.staff_assignments assignment
    WHERE assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.activated_at IS NOT NULL
      AND assignment.suspended_at IS NULL
      AND assignment.revoked_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    HAVING count(*) = 1
  )
);

DROP POLICY IF EXISTS staff_access_events_reviewer_membership_repair_insert
  ON auth.staff_access_events;
CREATE POLICY staff_access_events_reviewer_membership_repair_insert
ON auth.staff_access_events
FOR INSERT TO pc_reviewer_membership_repair_authority
WITH CHECK (
  current_user = 'pc_reviewer_membership_repair_authority'
  AND current_setting('app.reviewer_membership_repair_scope', true) = 'single'
  AND id = 'sae_p0_reviewer_membership_repair_v1'
  AND actor_user_id = (
    SELECT min(assignment.user_id)
    FROM auth.staff_assignments assignment
    WHERE assignment.role = 'PLATFORM_OWNER'
      AND assignment.status = 'ACTIVE'
      AND assignment.activated_at IS NOT NULL
      AND assignment.suspended_at IS NULL
      AND assignment.revoked_at IS NULL
      AND assignment.valid_from <= now()
      AND (assignment.valid_until IS NULL OR assignment.valid_until > now())
    HAVING count(*) = 1
  )
  AND staff_role = 'PLATFORM_OWNER'
  AND access_session_id IS NULL
  AND grant_id IS NULL
  AND effective_tenant_id = 'tenant_pc_internal_platform_v1'
  AND effective_organization_id = 'org_pc_internal_platform_v1'
  AND effective_user_id = actor_user_id
  AND effective_role = 'GUEST'
  AND access_mode IS NULL
  AND action = 'staff.identity.membership.repaired'
  AND resource_type = 'user_org_membership'
  AND resource_id = 'membership_pc_reviewer_internal_v1'
  AND outcome = 'SUCCESS'
  AND reason = 'P0_REVIEWER_MEMBERSHIP_REPAIR_3799'
  AND ticket_id IS NULL
  AND correlation_id = 'p0-reviewer-membership-repair-v1'
  AND metadata = pg_catalog.jsonb_build_object(
    'schemaVersion', 'auth.staff.reviewer.membership.repaired.v1',
    'organizationKind', 'PLATFORM_INTERNAL',
    'membershipRole', 'GUEST',
    'oneTime', true
  )
  AND (prev_hash IS NULL OR prev_hash ~ '^[0-9a-f]{64}$')
  AND hash ~ '^[0-9a-f]{64}$'
  AND created_at IS NOT NULL
);

DO $p0_reviewer_membership_auth_rls_proof$
DECLARE
  relation_name text;
  privilege_name text;
BEGIN
  IF (
    SELECT count(*)
    FROM pg_catalog.pg_policies policy
    WHERE policy.schemaname = 'auth'
      AND policy.tablename IN ('staff_assignments', 'staff_access_events')
      AND policy.policyname IN (
        'staff_assignments_reviewer_membership_repair_select',
        'staff_access_events_reviewer_membership_repair_select',
        'staff_access_events_reviewer_membership_repair_insert'
      )
  ) <> 3 THEN
    RAISE EXCEPTION 'reviewer membership repair auth RLS policy set is incomplete'
      USING ERRCODE = '42501';
  END IF;

  FOREACH relation_name IN ARRAY ARRAY[
    'auth.staff_assignments',
    'auth.staff_access_events'
  ]
  LOOP
    FOREACH privilege_name IN ARRAY ARRAY[
      'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
    ]
    LOOP
      IF has_table_privilege(
        'pc_reviewer_membership_repair_authority',
        relation_name,
        privilege_name
      ) THEN
        RAISE EXCEPTION 'reviewer repair authority received % on %',
          privilege_name,
          relation_name
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END LOOP;

  IF has_table_privilege('pc_staff_runtime', 'auth.staff_assignments', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_access_events', 'SELECT')
     OR has_table_privilege('pc_staff_runtime', 'auth.staff_access_events', 'INSERT')
  THEN
    RAISE EXCEPTION 'pc_staff_runtime must remain function-only for reviewer repair'
      USING ERRCODE = '42501';
  END IF;

  IF NOT has_function_privilege(
    'pc_staff_runtime',
    'auth.repair_single_reviewer_membership()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'pc_staff_runtime bounded repair EXECUTE grant is missing'
      USING ERRCODE = '42501';
  END IF;
END;
$p0_reviewer_membership_auth_rls_proof$;
