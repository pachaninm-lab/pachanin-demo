-- P0 identity RLS follow-up: allow the isolated staff projection authority to
-- evaluate the existing Deal SELECT policy without broadening any data access.
--
-- public.deals.deals_select includes app_deal_basis_deal_visible(to_jsonb(deals))
-- as one OR branch. PostgreSQL resolves policy expressions for the invoking
-- authority even when a separate staff-only policy admits the row. The bounded
-- SECURITY DEFINER auth.staff_cabinet_deals() owner therefore needs EXECUTE on
-- this one policy predicate; otherwise the projection fails closed with 42501.
--
-- The predicate itself is SECURITY DEFINER and remains unchanged. This migration
-- grants no table privilege, role membership, LOGIN, SUPERUSER or BYPASSRLS.

DO $staff_projection_deal_basis_dependency_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_staff_authority'
  ) THEN
    RAISE EXCEPTION 'pc_staff_authority is missing'
      USING ERRCODE = '42501';
  END IF;

  IF to_regprocedure('public.app_deal_basis_deal_visible(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'public.app_deal_basis_deal_visible(jsonb) is missing'
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
END;
$staff_projection_deal_basis_dependency_preflight$;

GRANT EXECUTE ON FUNCTION public.app_deal_basis_deal_visible(jsonb)
  TO pc_staff_authority;

DO $staff_projection_deal_basis_dependency_proof$
BEGIN
  IF NOT has_function_privilege(
    'pc_staff_authority',
    'public.app_deal_basis_deal_visible(jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Staff projection authority cannot evaluate Deal basis predicate'
      USING ERRCODE = '42501';
  END IF;

  IF has_function_privilege(
    'pc_staff_authority',
    'public.app_deal_basis_participant_allowed(text,text,text,text,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Staff projection authority received unnecessary participant mutation predicate privilege'
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
$staff_projection_deal_basis_dependency_proof$;
