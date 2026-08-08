-- P0 identity RLS follow-up: preserve the bounded laboratory identity authority
-- across the existing Deal SELECT policy dependency graph.
--
-- public.app_labs_verified_organization_for_deal() is SECURITY DEFINER and is
-- owned by the NOLOGIN pc_labs_identity_authority role. Its exact-Deal check
-- reads public.deals. The final deals_select RLS policy contains the historical
-- auction-basis predicate public.app_deal_basis_deal_visible(jsonb). PostgreSQL
-- is free to evaluate that OR branch even when app_rls_privileged() is true, so
-- the definer role must be allowed to execute the predicate or the bounded
-- laboratory lookup fails with SQLSTATE 42501.
--
-- Grant only the exact boolean predicate required by that RLS policy. Do not
-- grant table access to integration_events and do not add role memberships,
-- LOGIN, SUPERUSER or BYPASSRLS. The predicate remains SECURITY DEFINER and its
-- own FARMER/context checks remain unchanged.

DO $labs_identity_rls_dependency_preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_labs_identity_authority'
  ) THEN
    RAISE EXCEPTION 'pc_labs_identity_authority is missing'
      USING ERRCODE = '42501';
  END IF;

  IF to_regprocedure('public.app_deal_basis_deal_visible(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Deal RLS basis predicate is missing'
      USING ERRCODE = '42883';
  END IF;
END;
$labs_identity_rls_dependency_preflight$;

GRANT EXECUTE ON FUNCTION public.app_deal_basis_deal_visible(jsonb)
  TO pc_labs_identity_authority;

DO $labs_identity_rls_dependency_proof$
BEGIN
  IF NOT has_function_privilege(
    'pc_labs_identity_authority',
    'public.app_deal_basis_deal_visible(jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Laboratory identity authority cannot evaluate the Deal RLS predicate'
      USING ERRCODE = '42501';
  END IF;

  IF has_table_privilege(
    'pc_labs_identity_authority',
    'public.integration_events',
    'SELECT'
  ) THEN
    RAISE EXCEPTION 'Laboratory identity authority must not read integration_events directly'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_labs_identity_authority'
      AND (rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreatedb OR rolcreaterole)
  ) THEN
    RAISE EXCEPTION 'Laboratory identity authority role became unsafe'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    JOIN pg_catalog.pg_roles member ON member.oid = membership.member
    WHERE granted.rolname = 'pc_labs_identity_authority'
       OR member.rolname = 'pc_labs_identity_authority'
  ) THEN
    RAISE EXCEPTION 'Laboratory identity authority role must remain membership-free'
      USING ERRCODE = '42501';
  END IF;
END;
$labs_identity_rls_dependency_proof$;
