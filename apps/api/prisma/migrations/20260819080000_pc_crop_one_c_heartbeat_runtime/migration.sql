-- PC-CROP Federal Accounting / Wave 6.1
-- Machine-authenticated 1C heartbeat + bounded operational diagnostics.
--
-- The runtime state is one row per OrganizationBinding, not an unbounded event
-- stream. Heartbeats update liveness and machine-safe diagnostic codes while the
-- canonical audit ledger receives only meaningful state transitions. No raw
-- stack trace, hostname, filesystem path, authorization header or free-text
-- diagnostic is accepted or persisted.

CREATE OR REPLACE FUNCTION connector.one_c_diagnostics_are_valid(p_values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, connector
AS $function$
  SELECT
    cardinality(p_values) BETWEEN 0 AND 8
    AND NOT EXISTS (
      SELECT 1
        FROM unnest(p_values) AS diagnostic(code)
       WHERE diagnostic.code NOT IN (
         'ONE_C_UNAVAILABLE',
         'DATABASE_UNAVAILABLE',
         'EXTENSION_VERSION_MISMATCH',
         'PERMISSION_DENIED',
         'CLOCK_SKEW',
         'UNSUPPORTED_CONFIGURATION',
         'BACKGROUND_JOB_DISABLED',
         'NETWORK_DEGRADED',
         'LOCAL_QUEUE_BACKLOG'
       )
    )
    AND cardinality(p_values) = (
      SELECT count(DISTINCT diagnostic.code)::integer
        FROM unnest(p_values) AS diagnostic(code)
    );
$function$;

CREATE TABLE connector.one_c_runtime_state (
  binding_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  installation_id text NOT NULL,
  credential_id text NOT NULL,
  protocol_version text NOT NULL,
  reported_connector_version text NOT NULL,
  reported_platform_version text NOT NULL,
  reported_configuration_version text NOT NULL,
  health_state text NOT NULL,
  diagnostic_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  heartbeat_count bigint NOT NULL DEFAULT 1,
  first_heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_correlation_id text NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_runtime_state_binding_fk
    FOREIGN KEY (binding_id)
    REFERENCES connector.one_c_bindings(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_runtime_state_installation_fk
    FOREIGN KEY (installation_id)
    REFERENCES connector.one_c_installations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_runtime_state_credential_fk
    FOREIGN KEY (credential_id)
    REFERENCES connector.one_c_machine_credentials(credential_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_runtime_state_organization_fk
    FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_runtime_state_protocol_ck CHECK (protocol_version = '1'),
  CONSTRAINT one_c_runtime_state_connector_version_ck
    CHECK (
      length(btrim(reported_connector_version)) BETWEEN 1 AND 64
      AND reported_connector_version ~ '^[A-Za-z0-9._+() -]+$'
    ),
  CONSTRAINT one_c_runtime_state_platform_version_ck
    CHECK (
      length(btrim(reported_platform_version)) BETWEEN 1 AND 96
      AND reported_platform_version ~ '^[A-Za-z0-9._+() -]+$'
    ),
  CONSTRAINT one_c_runtime_state_configuration_version_ck
    CHECK (
      length(btrim(reported_configuration_version)) BETWEEN 1 AND 96
      AND reported_configuration_version ~ '^[A-Za-z0-9._+() -]+$'
    ),
  CONSTRAINT one_c_runtime_state_health_ck
    CHECK (health_state IN ('READY', 'DEGRADED', 'BLOCKED')),
  CONSTRAINT one_c_runtime_state_diagnostics_ck
    CHECK (connector.one_c_diagnostics_are_valid(diagnostic_codes)),
  CONSTRAINT one_c_runtime_state_health_diagnostics_ck
    CHECK (
      (health_state = 'READY' AND cardinality(diagnostic_codes) = 0)
      OR (health_state <> 'READY' AND cardinality(diagnostic_codes) BETWEEN 1 AND 8)
    ),
  CONSTRAINT one_c_runtime_state_count_ck CHECK (heartbeat_count >= 1),
  CONSTRAINT one_c_runtime_state_time_ck CHECK (last_heartbeat_at >= first_heartbeat_at),
  CONSTRAINT one_c_runtime_state_correlation_ck
    CHECK (last_correlation_id ~ '^[A-Za-z0-9:_.@-]{1,128}$'),
  CONSTRAINT one_c_runtime_state_version_ck CHECK (version >= 0)
);

CREATE INDEX one_c_runtime_state_health_idx
  ON connector.one_c_runtime_state (health_state, last_heartbeat_at DESC, binding_id);
CREATE INDEX one_c_runtime_state_org_idx
  ON connector.one_c_runtime_state (tenant_id, organization_id, last_heartbeat_at DESC);

CREATE TRIGGER one_c_runtime_state_no_delete
BEFORE DELETE ON connector.one_c_runtime_state
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_delete();

CREATE OR REPLACE FUNCTION connector.guard_one_c_runtime_state_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.binding_id IS DISTINCT FROM OLD.binding_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.first_heartbeat_at IS DISTINCT FROM OLD.first_heartbeat_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '1C runtime state identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION '1C runtime state version must advance by one' USING ERRCODE = '40001';
  END IF;
  IF NEW.heartbeat_count <> OLD.heartbeat_count + 1 THEN
    RAISE EXCEPTION '1C runtime heartbeat counter must advance by one' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER one_c_runtime_state_guard
BEFORE UPDATE ON connector.one_c_runtime_state
FOR EACH ROW EXECUTE FUNCTION connector.guard_one_c_runtime_state_update();

ALTER TABLE connector.one_c_runtime_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_runtime_state FORCE ROW LEVEL SECURITY;
CREATE POLICY one_c_runtime_state_authority_policy
  ON connector.one_c_runtime_state
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);

REVOKE ALL ON connector.one_c_runtime_state FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON connector.one_c_runtime_state TO pc_one_c_connector_authority;

CREATE OR REPLACE FUNCTION connector.record_one_c_heartbeat(
  p_credential_id text,
  p_protocol_version text,
  p_connector_version text,
  p_platform_version text,
  p_configuration_version text,
  p_health_state text,
  p_diagnostic_codes text[],
  p_correlation_id text
)
RETURNS TABLE (
  received_at timestamptz,
  health_state text,
  diagnostic_codes text[],
  heartbeat_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_credential connector.one_c_machine_credentials%ROWTYPE;
  v_binding connector.one_c_bindings%ROWTYPE;
  v_installation connector.one_c_installations%ROWTYPE;
  v_state connector.one_c_runtime_state%ROWTYPE;
  v_diagnostics text[];
  v_state_changed boolean := false;
  v_count bigint;
BEGIN
  IF p_credential_id IS NULL OR p_credential_id !~ '^[0-9A-Fa-f-]{36}$' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_CREDENTIAL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_CORRELATION_ID_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_protocol_version <> '1' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_PROTOCOL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(COALESCE(p_connector_version, ''))) NOT BETWEEN 1 AND 64
     OR p_connector_version !~ '^[A-Za-z0-9._+() -]+$'
     OR length(btrim(COALESCE(p_platform_version, ''))) NOT BETWEEN 1 AND 96
     OR p_platform_version !~ '^[A-Za-z0-9._+() -]+$'
     OR length(btrim(COALESCE(p_configuration_version, ''))) NOT BETWEEN 1 AND 96
     OR p_configuration_version !~ '^[A-Za-z0-9._+() -]+$' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_VERSION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_health_state NOT IN ('READY', 'DEGRADED', 'BLOCKED') THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_HEALTH_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_diagnostic_codes IS NULL
     OR NOT connector.one_c_diagnostics_are_valid(p_diagnostic_codes) THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID' USING ERRCODE = '22023';
  END IF;
  IF (p_health_state = 'READY' AND cardinality(p_diagnostic_codes) <> 0)
     OR (p_health_state <> 'READY' AND cardinality(p_diagnostic_codes) = 0) THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_DIAGNOSTICS_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT ARRAY(
    SELECT diagnostic.code
      FROM unnest(p_diagnostic_codes) AS diagnostic(code)
     ORDER BY diagnostic.code
  ) INTO v_diagnostics;

  SELECT * INTO v_credential
    FROM connector.one_c_machine_credentials credential
   WHERE credential.credential_id = p_credential_id
   FOR UPDATE;
  IF NOT FOUND
     OR v_credential.status <> 'ACTIVE'
     OR v_credential.revoked_at IS NOT NULL
     OR v_credential.expires_at <= v_now THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_CREDENTIAL_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_binding
    FROM connector.one_c_bindings binding
   WHERE binding.id = v_credential.binding_id
   FOR UPDATE;
  IF NOT FOUND OR v_binding.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_BINDING_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF v_binding.tenant_id <> v_credential.tenant_id
     OR v_binding.organization_id <> v_credential.organization_id
     OR v_binding.installation_id <> v_credential.installation_id
     OR v_binding.one_c_organization_guid <> v_credential.one_c_organization_guid THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_SCOPE_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_installation
    FROM connector.one_c_installations installation
   WHERE installation.id = v_credential.installation_id
   FOR UPDATE;
  IF NOT FOUND OR v_installation.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_INSTALLATION_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF p_protocol_version <> v_credential.protocol_version
     OR p_protocol_version <> v_installation.protocol_version THEN
    RAISE EXCEPTION 'ONE_C_HEARTBEAT_PROTOCOL_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_state
    FROM connector.one_c_runtime_state runtime_state
   WHERE runtime_state.binding_id = v_binding.id
   FOR UPDATE;

  IF FOUND THEN
    v_state_changed :=
      v_state.health_state IS DISTINCT FROM p_health_state
      OR v_state.diagnostic_codes IS DISTINCT FROM v_diagnostics;

    UPDATE connector.one_c_runtime_state runtime_state
       SET credential_id = v_credential.credential_id,
           protocol_version = p_protocol_version,
           reported_connector_version = btrim(p_connector_version),
           reported_platform_version = btrim(p_platform_version),
           reported_configuration_version = btrim(p_configuration_version),
           health_state = p_health_state,
           diagnostic_codes = v_diagnostics,
           heartbeat_count = runtime_state.heartbeat_count + 1,
           last_heartbeat_at = v_now,
           last_correlation_id = p_correlation_id,
           version = runtime_state.version + 1
     WHERE runtime_state.binding_id = v_binding.id
     RETURNING runtime_state.heartbeat_count INTO v_count;
  ELSE
    v_state_changed := true;
    INSERT INTO connector.one_c_runtime_state (
      binding_id, tenant_id, organization_id, installation_id, credential_id,
      protocol_version, reported_connector_version, reported_platform_version,
      reported_configuration_version, health_state, diagnostic_codes,
      heartbeat_count, first_heartbeat_at, last_heartbeat_at,
      last_correlation_id, version, created_at, updated_at
    ) VALUES (
      v_binding.id, v_binding.tenant_id, v_binding.organization_id,
      v_binding.installation_id, v_credential.credential_id,
      p_protocol_version, btrim(p_connector_version), btrim(p_platform_version),
      btrim(p_configuration_version), p_health_state, v_diagnostics,
      1, v_now, v_now, p_correlation_id, 0, v_now, v_now
    )
    RETURNING one_c_runtime_state.heartbeat_count INTO v_count;
  END IF;

  UPDATE connector.one_c_installations installation
     SET last_heartbeat_at = v_now,
         version = installation.version + 1
   WHERE installation.id = v_installation.id;

  UPDATE connector.one_c_machine_credentials credential
     SET last_used_at = v_now,
         version = credential.version + 1
   WHERE credential.credential_id = v_credential.credential_id
     AND credential.status = 'ACTIVE';

  IF v_state_changed THEN
    PERFORM connector.append_one_c_audit(
      'ONE_C_HEARTBEAT_STATE_CHANGED',
      NULL,
      'CONNECTOR_MACHINE',
      v_binding.tenant_id,
      v_binding.organization_id,
      'ONE_C_BINDING',
      v_binding.id,
      'SUCCESS',
      'ONE_C_RUNTIME_STATE_CHANGED',
      jsonb_build_object(
        'bindingId', v_binding.id,
        'installationId', v_binding.installation_id,
        'health', p_health_state,
        'diagnosticCodes', to_jsonb(v_diagnostics),
        'connectorVersion', btrim(p_connector_version),
        'platformVersion', btrim(p_platform_version),
        'configurationVersion', btrim(p_configuration_version)
      ),
      p_correlation_id
    );
  END IF;

  RETURN QUERY SELECT v_now, p_health_state, v_diagnostics, v_count;
END
$function$;

CREATE OR REPLACE FUNCTION connector.read_one_c_runtime_state()
RETURNS TABLE (
  binding_id text,
  last_heartbeat_at timestamptz,
  health_state text,
  diagnostic_codes text[],
  reported_connector_version text,
  reported_platform_version text,
  reported_configuration_version text,
  heartbeat_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_org_id text := current_setting('app.current_org_id', true);
  v_tenant_id text := current_setting('app.current_tenant_id', true);
BEGIN
  IF public.app_pc_crop_membership_id() IS NULL THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT runtime_state.binding_id,
         runtime_state.last_heartbeat_at,
         runtime_state.health_state,
         runtime_state.diagnostic_codes,
         runtime_state.reported_connector_version,
         runtime_state.reported_platform_version,
         runtime_state.reported_configuration_version,
         runtime_state.heartbeat_count
    FROM connector.one_c_runtime_state runtime_state
    JOIN connector.one_c_bindings binding ON binding.id = runtime_state.binding_id
   WHERE binding.tenant_id = v_tenant_id
     AND binding.organization_id = v_org_id
     AND binding.status = 'ACTIVE'
   ORDER BY runtime_state.last_heartbeat_at DESC, runtime_state.binding_id DESC
   LIMIT 1;
END
$function$;

ALTER FUNCTION connector.one_c_diagnostics_are_valid(text[])
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.guard_one_c_runtime_state_update()
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.record_one_c_heartbeat(text,text,text,text,text,text,text[],text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.read_one_c_runtime_state()
  OWNER TO pc_one_c_connector_authority;

REVOKE ALL ON FUNCTION connector.one_c_diagnostics_are_valid(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.guard_one_c_runtime_state_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.record_one_c_heartbeat(text,text,text,text,text,text,text[],text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.read_one_c_runtime_state() FROM PUBLIC;

DO $one_c_heartbeat_function_grants$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_runtime', 'app_service'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA connector TO %I', role_name);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION connector.record_one_c_heartbeat(text,text,text,text,text,text,text[],text) TO %I',
        role_name
      );
    END IF;
  END LOOP;

  FOREACH role_name IN ARRAY ARRAY[
    'app_runtime', 'app_service', 'pc_accounting_authority', 'pc_accounting_command_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA connector TO %I', role_name);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION connector.read_one_c_runtime_state() TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$one_c_heartbeat_function_grants$;

DO $one_c_heartbeat_direct_table_denial$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'app_runtime', 'app_service', 'pc_accounting_authority', 'pc_accounting_command_authority',
    'pc_staff_runtime', 'pc_registration_authority', 'pc_registration_decision_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON connector.one_c_runtime_state FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END
$one_c_heartbeat_direct_table_denial$;
