-- PC-CROP Federal Accounting / Wave 6 hardening.
--
-- The preceding migration makes ConnectorInstallation global to the opaque
-- information-base instance and retires tenant_id as a NULL-only tombstone.
-- Reassert the steady-state guard without tenant-based authority semantics.

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

  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION '1C installation version must advance by one' USING ERRCODE = '40001';
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

ALTER FUNCTION connector.guard_one_c_installation_update()
  OWNER TO pc_one_c_connector_authority;
REVOKE ALL ON FUNCTION connector.guard_one_c_installation_update() FROM PUBLIC;
