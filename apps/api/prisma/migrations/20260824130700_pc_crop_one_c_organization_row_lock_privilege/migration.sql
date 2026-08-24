-- PC-CROP Federal Accounting / 1C organization row-lock broker proof.
--
-- SELECT ... FOR SHARE requires both a column-level UPDATE privilege and an
-- applicable UPDATE RLS policy. The public pairing authority must have neither.
-- A separate NOLOGIN/memberless broker owns one fixed lock-only helper. Its
-- permissive UPDATE policy exposes rows to FOR SHARE, while an explicit
-- restrictive WITH CHECK (false) policy makes every real UPDATE fail even if a
-- different PUBLIC policy matches inherited request settings.

REVOKE UPDATE ON public.organizations FROM pc_one_c_connector_authority;
REVOKE UPDATE ("updatedAt") ON public.organizations
  FROM pc_one_c_connector_authority;

DO $one_c_organization_row_lock_broker_proof$
DECLARE
  v_connector_role_oid oid;
  v_lock_role_oid oid;
  v_connector_update_columns text[];
  v_lock_update_columns text[];
  v_lock_policy_count integer;
  v_lock_function_oid oid;
BEGIN
  SELECT role.oid
    INTO v_connector_role_oid
    FROM pg_catalog.pg_roles role
   WHERE role.rolname = 'pc_one_c_connector_authority';
  SELECT role.oid
    INTO v_lock_role_oid
    FROM pg_catalog.pg_roles role
   WHERE role.rolname = 'pc_one_c_organization_lock_authority';

  IF v_connector_role_oid IS NULL OR v_lock_role_oid IS NULL THEN
    RAISE EXCEPTION '1C connector or organization-lock authority role is missing';
  END IF;

  SELECT array_agg(privilege.column_name::text ORDER BY privilege.column_name::text)
    INTO v_connector_update_columns
    FROM information_schema.column_privileges privilege
   WHERE privilege.grantee = 'pc_one_c_connector_authority'
     AND privilege.table_schema = 'public'
     AND privilege.table_name = 'organizations'
     AND privilege.privilege_type = 'UPDATE';

  IF COALESCE(v_connector_update_columns, ARRAY[]::text[]) <> ARRAY[]::text[] THEN
    RAISE EXCEPTION '1C connector authority must have no organization UPDATE privilege';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.table_privileges privilege
     WHERE privilege.grantee = 'pc_one_c_connector_authority'
       AND privilege.table_schema = 'public'
       AND privilege.table_name = 'organizations'
       AND privilege.privilege_type IN (
         'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
       )
  ) THEN
    RAISE EXCEPTION '1C connector authority received a forbidden organization table privilege';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_policy policy
      JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND relation.relname = 'organizations'
       AND policy.polcmd IN ('w', '*')
       AND v_connector_role_oid = ANY(policy.polroles)
  ) THEN
    RAISE EXCEPTION '1C connector authority must not have an organization UPDATE policy';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_roles role
     WHERE role.oid = v_lock_role_oid
       AND (
         role.rolcanlogin
         OR role.rolinherit
         OR role.rolsuper
         OR role.rolbypassrls
         OR role.rolcreatedb
         OR role.rolcreaterole
       )
  ) THEN
    RAISE EXCEPTION '1C organization-lock authority role attributes are too broad';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members membership
     WHERE membership.roleid = v_lock_role_oid
        OR membership.member = v_lock_role_oid
  ) THEN
    RAISE EXCEPTION '1C organization-lock authority must have no membership edges';
  END IF;

  SELECT array_agg(privilege.column_name::text ORDER BY privilege.column_name::text)
    INTO v_lock_update_columns
    FROM information_schema.column_privileges privilege
   WHERE privilege.grantee = 'pc_one_c_organization_lock_authority'
     AND privilege.table_schema = 'public'
     AND privilege.table_name = 'organizations'
     AND privilege.privilege_type = 'UPDATE';

  IF COALESCE(v_lock_update_columns, ARRAY[]::text[])
       IS DISTINCT FROM ARRAY['updatedAt']::text[] THEN
    RAISE EXCEPTION '1C organization-lock UPDATE privilege must be limited to updatedAt';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM information_schema.table_privileges privilege
     WHERE privilege.grantee = 'pc_one_c_organization_lock_authority'
       AND privilege.table_schema = 'public'
       AND privilege.table_name = 'organizations'
       AND privilege.privilege_type IN (
         'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
       )
  ) THEN
    RAISE EXCEPTION '1C organization-lock authority received a forbidden table privilege';
  END IF;

  SELECT count(*)::integer
    INTO v_lock_policy_count
    FROM pg_catalog.pg_policy policy
    JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
   WHERE namespace.nspname = 'public'
     AND relation.relname = 'organizations'
     AND v_lock_role_oid = ANY(policy.polroles);

  IF v_lock_policy_count <> 3 THEN
    RAISE EXCEPTION '1C organization-lock authority must have exactly three bounded policies';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_policy policy
      JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND relation.relname = 'organizations'
       AND policy.polname = 'organizations_one_c_lock_select'
       AND policy.polcmd = 'r'
       AND policy.polpermissive
       AND policy.polroles = ARRAY[v_lock_role_oid]::oid[]
       AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) = 'true'
  ) THEN
    RAISE EXCEPTION '1C organization-lock SELECT policy is not exact';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_policy policy
      JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND relation.relname = 'organizations'
       AND policy.polname = 'organizations_one_c_lock_update'
       AND policy.polcmd = 'w'
       AND policy.polpermissive
       AND policy.polroles = ARRAY[v_lock_role_oid]::oid[]
       AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) = 'true'
       AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid) = 'false'
  ) THEN
    RAISE EXCEPTION '1C organization-lock permissive policy is not lock-only';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_policy policy
      JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND relation.relname = 'organizations'
       AND policy.polname = 'organizations_one_c_lock_no_write'
       AND policy.polcmd = 'w'
       AND NOT policy.polpermissive
       AND policy.polroles = ARRAY[v_lock_role_oid]::oid[]
       AND pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) = 'true'
       AND pg_catalog.pg_get_expr(policy.polwithcheck, policy.polrelid) = 'false'
  ) THEN
    RAISE EXCEPTION '1C organization-lock restrictive no-write policy is missing';
  END IF;

  SELECT pg_catalog.to_regprocedure(
    'connector.lock_one_c_organization(text,text)'
  )::oid INTO v_lock_function_oid;

  IF v_lock_function_oid IS NULL OR NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_proc function
     WHERE function.oid = v_lock_function_oid
       AND function.proowner = v_lock_role_oid
       AND function.prosecdef
  ) THEN
    RAISE EXCEPTION '1C organization-lock helper ownership is not exact';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'pc_one_c_connector_authority',
    v_lock_function_oid,
    'EXECUTE'
  ) OR EXISTS (
    SELECT 1
      FROM pg_catalog.aclexplode(
        COALESCE(
          (SELECT function.proacl FROM pg_catalog.pg_proc function
            WHERE function.oid = v_lock_function_oid),
          pg_catalog.acldefault('f', v_lock_role_oid)
        )
      ) privilege
     WHERE privilege.grantee = 0
       AND privilege.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION '1C organization-lock helper EXECUTE boundary is not exact';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_class relation
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND relation.relname = 'organizations'
       AND relation.relrowsecurity
       AND relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'Organizations must retain enabled and forced row-level security';
  END IF;
END
$one_c_organization_row_lock_broker_proof$;
