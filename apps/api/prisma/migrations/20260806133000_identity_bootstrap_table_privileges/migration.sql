-- Restore the base table privileges required by the bounded identity
-- SECURITY DEFINER surface (#3670).
--
-- Row-level policies decide which rows pc_identity_bootstrap may read, but RLS
-- does not grant the underlying table privilege. After BYPASSRLS was removed,
-- the bootstrap functions were correctly owned by pc_identity_bootstrap and
-- admitted by FORCE-RLS policies, yet every call still failed with SQLSTATE
-- 42501 because that owner had no SELECT privilege on the three identity
-- tables its function bodies join.
--
-- Keep this additive and exact: the authority role may read these three tables
-- only. Runtime principals continue to reach the pre-authentication path solely
-- through the named auth.resolve_login_* functions and remain unable to SET
-- ROLE into pc_identity_bootstrap.

DO $identity_bootstrap_table_privileges$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_identity_bootstrap'
  ) THEN
    RAISE EXCEPTION 'pc_identity_bootstrap is required before granting identity reads'
      USING ERRCODE = '42704';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles
    WHERE rolname = 'pc_identity_bootstrap'
      AND (
        rolcanlogin
        OR rolinherit
        OR rolsuper
        OR rolbypassrls
        OR rolcreatedb
        OR rolcreaterole
      )
  ) THEN
    RAISE EXCEPTION 'pc_identity_bootstrap is not a confined authority role'
      USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema
      ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'public'
      AND relation.relname IN ('users', 'user_orgs', 'organizations')
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) <> 3 THEN
    RAISE EXCEPTION 'Identity tables must have ENABLE and FORCE RLS before bootstrap SELECT is granted'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema
      ON schema.oid = relation.relnamespace
    JOIN pg_catalog.pg_roles owner
      ON owner.oid = relation.relowner
    WHERE schema.nspname = 'public'
      AND relation.relname IN ('users', 'user_orgs', 'organizations')
      AND owner.rolname = 'pc_identity_bootstrap'
  ) THEN
    RAISE EXCEPTION 'pc_identity_bootstrap must not own identity tables'
      USING ERRCODE = '42501';
  END IF;
END;
$identity_bootstrap_table_privileges$;

GRANT USAGE ON SCHEMA public TO pc_identity_bootstrap;

-- Remove any accidental write authority before granting the exact read set.
REVOKE ALL PRIVILEGES ON TABLE
  public."users",
  public."user_orgs",
  public."organizations"
FROM pc_identity_bootstrap;

GRANT SELECT ON TABLE
  public."users",
  public."user_orgs",
  public."organizations"
TO pc_identity_bootstrap;

DO $identity_bootstrap_table_privileges_proof$
DECLARE
  relation_name text;
  privilege_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['users', 'user_orgs', 'organizations']
  LOOP
    IF NOT has_table_privilege(
      'pc_identity_bootstrap',
      format('public.%I', relation_name),
      'SELECT'
    ) THEN
      RAISE EXCEPTION 'pc_identity_bootstrap is missing SELECT on public.%', relation_name
        USING ERRCODE = '42501';
    END IF;

    FOREACH privilege_name IN ARRAY ARRAY[
      'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER'
    ]
    LOOP
      IF has_table_privilege(
        'pc_identity_bootstrap',
        format('public.%I', relation_name),
        privilege_name
      ) THEN
        RAISE EXCEPTION 'pc_identity_bootstrap received % on public.%',
          privilege_name,
          relation_name
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END LOOP;
END;
$identity_bootstrap_table_privileges_proof$;
