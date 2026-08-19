-- PC-CROP Federal Accounting / Wave 6 hardening.
--
-- 20260818223200 makes ConnectorInstallation global to the opaque 1C
-- information-base instance and removes tenant_id from the installation row.
-- Replace the earlier trigger function immediately afterwards so no later
-- UPDATE can reference the removed field at runtime.

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
