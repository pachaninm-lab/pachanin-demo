-- PC-CROP Federal Accounting / 1C global installation authority.
--
-- ConnectorInstallation represents one physical/logical 1C information base,
-- not an organization or tenant. The first reviewed migration created a tenant
-- column for compatibility. This additive migration retires that column as a
-- NULL-only tombstone instead of dropping it, then makes database_instance_id
-- the global installation key used by the final pairing function.

DROP INDEX IF EXISTS connector.one_c_installations_status_idx;
ALTER TABLE connector.one_c_installations
  DROP CONSTRAINT IF EXISTS one_c_installations_tenant_database_key;
ALTER TABLE connector.one_c_installations
  ALTER COLUMN tenant_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION connector.guard_one_c_installation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.database_instance_id IS DISTINCT FROM OLD.database_instance_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '1C installation identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF OLD.tenant_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
    RAISE EXCEPTION '1C installation legacy tenant coordinate is retired' USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION '1C installation version must advance by one' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

UPDATE connector.one_c_installations installation
   SET tenant_id = NULL,
       version = installation.version + 1
 WHERE tenant_id IS NOT NULL;

ALTER TABLE connector.one_c_installations
  ADD CONSTRAINT one_c_installations_tenant_retired_ck CHECK (tenant_id IS NULL),
  ADD CONSTRAINT one_c_installations_database_key UNIQUE (database_instance_id);
CREATE INDEX one_c_installations_status_idx
  ON connector.one_c_installations (status, updated_at DESC, id);

-- PostgreSQL applies UPDATE RLS policies to SELECT ... FOR SHARE. Giving that
-- policy to the connector authority would make the public pairing definer a
-- latent organization writer, even if the current function body never updates
-- the row. A separate, memberless broker owns one fixed row-lock helper instead.
-- It can lock a caller-selected organization identity row, but a restrictive
-- WITH CHECK (false) policy makes every actual UPDATE fail even if another
-- PUBLIC permissive policy happens to match inherited request settings.
DO $one_c_organization_lock_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
     WHERE rolname = 'pc_one_c_organization_lock_authority'
  ) THEN
    CREATE ROLE pc_one_c_organization_lock_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  ALTER ROLE pc_one_c_organization_lock_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members membership
      JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = membership.member
     WHERE granted.rolname = 'pc_one_c_organization_lock_authority'
        OR member_role.rolname = 'pc_one_c_organization_lock_authority'
  ) THEN
    RAISE EXCEPTION 'pc_one_c_organization_lock_authority must have no role memberships'
      USING ERRCODE = '42501';
  END IF;
END
$one_c_organization_lock_authority_role$;

GRANT USAGE ON SCHEMA public, connector
  TO pc_one_c_organization_lock_authority;
REVOKE ALL PRIVILEGES ON public.organizations
  FROM pc_one_c_organization_lock_authority;
GRANT SELECT ("id", "inn", "kpp", "status", "tenantId")
  ON public.organizations TO pc_one_c_organization_lock_authority;
GRANT UPDATE ("updatedAt")
  ON public.organizations TO pc_one_c_organization_lock_authority;

DROP POLICY IF EXISTS organizations_one_c_lock_select ON public.organizations;
CREATE POLICY organizations_one_c_lock_select
  ON public.organizations
  FOR SELECT TO pc_one_c_organization_lock_authority
  USING (true);

DROP POLICY IF EXISTS organizations_one_c_lock_update ON public.organizations;
CREATE POLICY organizations_one_c_lock_update
  ON public.organizations
  AS PERMISSIVE
  FOR UPDATE TO pc_one_c_organization_lock_authority
  USING (true)
  WITH CHECK (false);

DROP POLICY IF EXISTS organizations_one_c_lock_no_write ON public.organizations;
CREATE POLICY organizations_one_c_lock_no_write
  ON public.organizations
  AS RESTRICTIVE
  FOR UPDATE TO pc_one_c_organization_lock_authority
  USING (true)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION connector.lock_one_c_organization(
  p_organization_id text,
  p_tenant_id text
)
RETURNS TABLE (
  organization_id text,
  inn text,
  kpp text,
  organization_status text,
  tenant_id text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
  SELECT organization.id,
         organization.inn,
         organization.kpp,
         organization.status::text,
         organization."tenantId"
    FROM public.organizations organization
   WHERE organization.id = p_organization_id
     AND organization."tenantId" = p_tenant_id
   FOR SHARE
$function$;

ALTER FUNCTION connector.lock_one_c_organization(text,text)
  OWNER TO pc_one_c_organization_lock_authority;
REVOKE ALL ON FUNCTION connector.lock_one_c_organization(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION connector.lock_one_c_organization(text,text)
  TO pc_one_c_connector_authority;

DROP POLICY IF EXISTS organizations_one_c_authority_select ON public.organizations;
CREATE POLICY organizations_one_c_authority_select
  ON public.organizations
  FOR SELECT TO pc_one_c_connector_authority
  USING (true);

DROP POLICY IF EXISTS user_orgs_one_c_authority_select ON public.user_orgs;
CREATE POLICY user_orgs_one_c_authority_select
  ON public.user_orgs
  FOR SELECT TO pc_one_c_connector_authority
  USING (true);

DROP POLICY IF EXISTS users_one_c_authority_select ON public.users;
CREATE POLICY users_one_c_authority_select
  ON public.users
  FOR SELECT TO pc_one_c_connector_authority
  USING (true);

DROP POLICY IF EXISTS audit_events_one_c_authority_select ON public.audit_events;
CREATE POLICY audit_events_one_c_authority_select
  ON public.audit_events
  FOR SELECT TO pc_one_c_connector_authority
  USING (
    "objectType" IN ('ONE_C_PAIRING', 'ONE_C_BINDING', 'ONE_C_CREDENTIAL')
    AND "action" LIKE 'ONE_C_%'
  );

DROP POLICY IF EXISTS audit_events_one_c_authority_insert ON public.audit_events;
CREATE POLICY audit_events_one_c_authority_insert
  ON public.audit_events
  FOR INSERT TO pc_one_c_connector_authority
  WITH CHECK (
    "tenantId" IS NOT NULL
    AND "orgId" IS NOT NULL
    AND "objectType" IN ('ONE_C_PAIRING', 'ONE_C_BINDING', 'ONE_C_CREDENTIAL')
    AND "action" LIKE 'ONE_C_%'
  );
