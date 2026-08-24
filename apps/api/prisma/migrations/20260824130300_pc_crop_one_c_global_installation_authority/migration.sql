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
