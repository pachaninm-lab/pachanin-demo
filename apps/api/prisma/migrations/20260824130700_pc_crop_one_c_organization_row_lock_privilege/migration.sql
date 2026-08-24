-- PC-CROP Federal Accounting / 1C organization row-lock privilege.
--
-- PostgreSQL requires UPDATE privilege on at least one column when SELECT uses
-- FOR SHARE. The connector authority needs that row lock to keep organization
-- status and INN/KPP stable while a one-time pairing is consumed. It must not
-- receive table-wide UPDATE authority. The only granted column is updatedAt;
-- FORCE RLS remains enabled and no connector-specific UPDATE policy is added,
-- so the privilege satisfies row locking without exposing a direct mutation path.

REVOKE UPDATE ON public.organizations FROM pc_one_c_connector_authority;
GRANT UPDATE ("updatedAt") ON public.organizations TO pc_one_c_connector_authority;

DO $one_c_organization_row_lock_privilege_proof$
DECLARE
  v_role_oid oid;
  v_update_columns text[];
BEGIN
  SELECT role.oid
    INTO v_role_oid
    FROM pg_catalog.pg_roles role
   WHERE role.rolname = 'pc_one_c_connector_authority';

  IF v_role_oid IS NULL THEN
    RAISE EXCEPTION '1C connector authority role is missing';
  END IF;

  SELECT array_agg(privilege.column_name::text ORDER BY privilege.column_name::text)
    INTO v_update_columns
    FROM information_schema.column_privileges privilege
   WHERE privilege.grantee = 'pc_one_c_connector_authority'
     AND privilege.table_schema = 'public'
     AND privilege.table_name = 'organizations'
     AND privilege.privilege_type = 'UPDATE';

  IF COALESCE(v_update_columns, ARRAY[]::text[])
       IS DISTINCT FROM ARRAY['updatedAt']::text[] THEN
    RAISE EXCEPTION '1C organization UPDATE privilege must be limited to updatedAt';
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

  IF NOT has_column_privilege(
    'pc_one_c_connector_authority',
    'public.organizations',
    'updatedAt',
    'UPDATE'
  ) THEN
    RAISE EXCEPTION '1C connector authority lacks the bounded row-lock privilege';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_policy policy
      JOIN pg_catalog.pg_class relation ON relation.oid = policy.polrelid
      JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
     WHERE namespace.nspname = 'public'
       AND relation.relname = 'organizations'
       AND policy.polcmd IN ('w', '*')
       AND v_role_oid = ANY(policy.polroles)
  ) THEN
    RAISE EXCEPTION '1C connector authority must not have an organization UPDATE policy';
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
$one_c_organization_row_lock_privilege_proof$;
