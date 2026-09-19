-- P0 identity RLS follow-up: preserve bounded staff cabinet projections across
-- the existing Deal SELECT policy dependency graph.
--
-- auth.staff_cabinet_deals() is SECURITY DEFINER and is owned by the NOLOGIN,
-- membership-free pc_staff_authority role. Its bounded view-as projection reads
-- public.deals only after validating the secret-backed staff capability and the
-- exact organization/role scope.
--
-- The existing deals_select RLS policy contains a participant EXISTS predicate.
-- PostgreSQL must be able to resolve that predicate even when the independent
-- deals_staff_projection policy admits the exact organization. The definer role
-- therefore needs SELECT privilege on only the participant columns referenced
-- by that policy. Without it the bounded projection fails closed with 42501
-- "permission denied for table deal_participants" before its staff-specific
-- Deal policy can return rows.
--
-- Do not grant table-wide SELECT, role membership, LOGIN, SUPERUSER or
-- BYPASSRLS. FORCE RLS and the existing deal_participants_select policy remain
-- unchanged; this migration only supplies the minimum policy-evaluation
-- dependency to the isolated authority role.

DO $staff_projection_participant_dependency_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority is missing'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deals'
      AND policyname = 'deals_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'deals_select policy is missing'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deal_participants'
      AND policyname = 'deal_participants_select'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION 'deal_participants_select policy is missing'
      USING ERRCODE = '42501';
  END IF;
END;
$staff_projection_participant_dependency_preflight$;

GRANT SELECT (
  "dealId",
  "tenantId",
  "organizationId",
  "userId",
  "role",
  "status",
  "accessLevel"
) ON public."deal_participants" TO pc_staff_authority;

DO $staff_projection_participant_dependency_proof$
DECLARE
  v_column TEXT;
BEGIN
  FOREACH v_column IN ARRAY ARRAY[
    'dealId',
    'tenantId',
    'organizationId',
    'userId',
    'role',
    'status',
    'accessLevel'
  ]
  LOOP
    IF NOT has_column_privilege(
      'pc_staff_authority',
      'public.deal_participants',
      v_column,
      'SELECT'
    ) THEN
      RAISE EXCEPTION 'Staff projection authority cannot evaluate Deal participant predicate column %', v_column
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF has_table_privilege(
    'pc_staff_authority',
    'public.deal_participants',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'Staff projection authority must not receive table-wide deal_participants SELECT'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'public'
      AND relation.relname = 'deal_participants'
      AND (NOT relation.relrowsecurity OR NOT relation.relforcerowsecurity)
  ) THEN
    RAISE EXCEPTION 'deal_participants must remain ENABLE + FORCE RLS'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority role became unsafe'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE granted.rolname = 'pc_staff_authority'
       OR member.rolname = 'pc_staff_authority'
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority must remain membership-free'
      USING ERRCODE = '42501';
  END IF;
END;
$staff_projection_participant_dependency_proof$;
