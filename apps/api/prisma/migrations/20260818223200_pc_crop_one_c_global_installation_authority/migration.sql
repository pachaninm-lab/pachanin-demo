-- PC-CROP Federal Accounting / Wave 6 hardening.
--
-- ConnectorInstallation is a physical/logical 1C information-base installation,
-- not an organization tenancy record. One information base may contain several
-- legal entities and those legal entities may map to separate platform tenants.
-- The first runtime migration deliberately kept OrganizationBinding separate,
-- but still keyed the installation by tenant. This migration removes that
-- residual coupling before the slice can be accepted.
--
-- It also gives the no-login connector authority narrow RLS policies on the
-- identity/audit rows its fixed SECURITY DEFINER functions need. The authority
-- role has no members and ordinary application roles still have no table CRUD.

DROP INDEX IF EXISTS connector.one_c_installations_status_idx;
ALTER TABLE connector.one_c_installations
  DROP CONSTRAINT IF EXISTS one_c_installations_tenant_database_key;
ALTER TABLE connector.one_c_installations DROP COLUMN tenant_id;
ALTER TABLE connector.one_c_installations
  ADD CONSTRAINT one_c_installations_database_key UNIQUE (database_instance_id);
CREATE INDEX one_c_installations_status_idx
  ON connector.one_c_installations (status, updated_at DESC, id);

-- FORCE RLS on the identity tables means a grant alone is deliberately useless.
-- This role is NOLOGIN/NOBYPASSRLS and has no members; only the fixed functions
-- it owns can exercise these policies. Column grants remain the second bound.
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

-- Canonical audit store, still append-only. The authority can see/write only
-- its own object family. No pairing code, bearer or verifier is accepted by the
-- append function that owns these writes.
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

-- Re-declare pairing consume with a global installation identity. An advisory
-- lock on databaseInstanceId makes first-seen creation and cross-tenant binding
-- collision checks serialize even when two legal entities pair concurrently.
CREATE OR REPLACE FUNCTION connector.consume_one_c_pairing(
  p_pairing_code text,
  p_database_instance_id text,
  p_platform_version text,
  p_configuration_name text,
  p_configuration_version text,
  p_connector_version text,
  p_protocol_version text,
  p_capabilities text[],
  p_one_c_organization_guid text,
  p_one_c_inn text,
  p_one_c_kpp text,
  p_one_c_name text,
  p_correlation_id text
)
RETURNS TABLE (
  installation_id text,
  binding_id text,
  credential_id text,
  machine_bearer text,
  credential_expires_at timestamptz,
  organization_id text,
  one_c_organization_guid text,
  protocol_version text,
  allowed_commands text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_lookup_hash text;
  v_challenge connector.one_c_pairing_challenges%ROWTYPE;
  v_org record;
  v_creator record;
  v_installation connector.one_c_installations%ROWTYPE;
  v_binding connector.one_c_bindings%ROWTYPE;
  v_collision connector.one_c_bindings%ROWTYPE;
  v_installation_id text;
  v_binding_id text;
  v_credential_id text := gen_random_uuid()::text;
  v_secret text;
  v_salt text;
  v_secret_hash text;
  v_bearer text;
  v_credential_expires timestamptz := v_now + interval '30 days';
BEGIN
  IF p_pairing_code IS NULL OR length(p_pairing_code) NOT BETWEEN 16 AND 256 THEN
    RAISE EXCEPTION 'ONE_C_PAIRING_CODE_INVALID' USING ERRCODE = '42501';
  END IF;
  IF p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_CORRELATION_ID_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_protocol_version <> '1' THEN
    RAISE EXCEPTION 'ONE_C_PROTOCOL_VERSION_UNSUPPORTED' USING ERRCODE = '22023';
  END IF;
  IF NOT connector.one_c_commands_are_valid(p_capabilities) THEN
    RAISE EXCEPTION 'ONE_C_CAPABILITIES_INVALID' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(COALESCE(p_database_instance_id, ''))) NOT BETWEEN 8 AND 160
     OR length(btrim(COALESCE(p_platform_version, ''))) NOT BETWEEN 1 AND 96
     OR length(btrim(COALESCE(p_configuration_name, ''))) NOT BETWEEN 1 AND 160
     OR length(btrim(COALESCE(p_configuration_version, ''))) NOT BETWEEN 1 AND 96
     OR length(btrim(COALESCE(p_connector_version, ''))) NOT BETWEEN 1 AND 64
     OR length(btrim(COALESCE(p_one_c_organization_guid, ''))) NOT BETWEEN 8 AND 160
     OR COALESCE(p_one_c_inn, '') !~ '^[0-9]{10}([0-9]{2})?$'
     OR (p_one_c_kpp IS NOT NULL AND p_one_c_kpp !~ '^[0-9]{9}$')
     OR length(btrim(COALESCE(p_one_c_name, ''))) NOT BETWEEN 1 AND 512 THEN
    RAISE EXCEPTION 'ONE_C_DISCOVERY_BINDING_INVALID' USING ERRCODE = '22023';
  END IF;

  v_lookup_hash := encode(digest(convert_to(p_pairing_code, 'UTF8'), 'sha256'), 'hex');
  SELECT * INTO v_challenge
    FROM connector.one_c_pairing_challenges challenge
   WHERE challenge.lookup_hash = v_lookup_hash
   FOR UPDATE;

  IF NOT FOUND
     OR v_challenge.status <> 'PENDING'
     OR v_challenge.consumed_at IS NOT NULL
     OR v_challenge.revoked_at IS NOT NULL
     OR v_challenge.expires_at <= v_now THEN
    RAISE EXCEPTION 'ONE_C_PAIRING_CHALLENGE_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;

  IF v_challenge.code_hash <> encode(
    digest(convert_to(v_challenge.salt || '.' || p_pairing_code, 'UTF8'), 'sha256'),
    'hex'
  ) THEN
    RAISE EXCEPTION 'ONE_C_PAIRING_SECRET_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT organization.id, organization.inn, organization.kpp,
         organization.status, organization."tenantId"
    INTO v_org
    FROM public.organizations organization
   WHERE organization.id = v_challenge.organization_id
     AND organization."tenantId" = v_challenge.tenant_id
   FOR SHARE;

  IF NOT FOUND OR v_org.status NOT IN ('VERIFIED', 'ACTIVE') THEN
    RAISE EXCEPTION 'ONE_C_VERIFIED_ORGANIZATION_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF btrim(v_org.inn) <> btrim(p_one_c_inn) THEN
    RAISE EXCEPTION 'ONE_C_INN_MISMATCH' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(v_org.kpp, '')), '') IS NOT NULL
     AND btrim(v_org.kpp) <> btrim(COALESCE(p_one_c_kpp, '')) THEN
    RAISE EXCEPTION 'ONE_C_KPP_MISMATCH' USING ERRCODE = '42501';
  END IF;

  SELECT membership."userId" AS user_id, membership.role AS role
    INTO v_creator
    FROM public.user_orgs membership
    JOIN public.users actor ON actor.id = membership."userId"
   WHERE membership.id = v_challenge.created_by_membership_id
     AND membership."organizationId" = v_challenge.organization_id
     AND membership.status = 'ACTIVE'
     AND actor.status = 'ACTIVE'
     AND actor."deletedAt" IS NULL
   LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ONE_C_PAIRING_CREATOR_NO_LONGER_ACTIVE' USING ERRCODE = '42501';
  END IF;

  -- One physical 1C information base is one installation across platform
  -- organizations/tenants. The lock is global for that opaque instance id.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('pc-one-c-installation:' || btrim(p_database_instance_id), 0)
  );

  SELECT * INTO v_installation
    FROM connector.one_c_installations installation
   WHERE installation.database_instance_id = btrim(p_database_instance_id)
   FOR UPDATE;

  IF FOUND THEN
    IF v_installation.status <> 'ACTIVE' THEN
      RAISE EXCEPTION 'ONE_C_INSTALLATION_NOT_ACTIVE' USING ERRCODE = '42501';
    END IF;
    v_installation_id := v_installation.id;
    UPDATE connector.one_c_installations installation
       SET platform_version = btrim(p_platform_version),
           configuration_name = btrim(p_configuration_name),
           configuration_version = btrim(p_configuration_version),
           connector_version = btrim(p_connector_version),
           protocol_version = p_protocol_version,
           capabilities = p_capabilities,
           last_pairing_at = v_now,
           version = installation.version + 1
     WHERE installation.id = v_installation_id;
  ELSE
    v_installation_id := 'one-c-installation-' || gen_random_uuid()::text;
    INSERT INTO connector.one_c_installations (
      id, database_instance_id, platform_version, configuration_name,
      configuration_version, connector_version, protocol_version, capabilities,
      status, first_seen_at, last_pairing_at, version, created_at, updated_at
    ) VALUES (
      v_installation_id, btrim(p_database_instance_id),
      btrim(p_platform_version), btrim(p_configuration_name),
      btrim(p_configuration_version), btrim(p_connector_version),
      p_protocol_version, p_capabilities, 'ACTIVE', v_now, v_now, 0, v_now, v_now
    );
  END IF;

  SELECT * INTO v_binding
    FROM connector.one_c_bindings binding
   WHERE binding.tenant_id = v_challenge.tenant_id
     AND binding.organization_id = v_challenge.organization_id
     AND binding.status = 'ACTIVE'
   FOR UPDATE;

  IF FOUND THEN
    IF v_binding.installation_id <> v_installation_id
       OR v_binding.one_c_organization_guid <> btrim(p_one_c_organization_guid) THEN
      RAISE EXCEPTION 'ONE_C_ORGANIZATION_ALREADY_BOUND' USING ERRCODE = '23505';
    END IF;
    v_binding_id := v_binding.id;
    UPDATE connector.one_c_bindings binding
       SET one_c_kpp = NULLIF(btrim(COALESCE(p_one_c_kpp, '')), ''),
           one_c_name = btrim(p_one_c_name),
           capability_profile = p_capabilities,
           version = binding.version + 1
     WHERE binding.id = v_binding_id;
  ELSE
    SELECT * INTO v_collision
      FROM connector.one_c_bindings binding
     WHERE binding.installation_id = v_installation_id
       AND binding.one_c_organization_guid = btrim(p_one_c_organization_guid)
       AND binding.status = 'ACTIVE'
     FOR UPDATE;
    IF FOUND THEN
      RAISE EXCEPTION 'ONE_C_ENTITY_ALREADY_BOUND_TO_ANOTHER_ORGANIZATION' USING ERRCODE = '23505';
    END IF;

    v_binding_id := 'one-c-binding-' || gen_random_uuid()::text;
    INSERT INTO connector.one_c_bindings (
      id, tenant_id, organization_id, installation_id, one_c_organization_guid,
      one_c_inn, one_c_kpp, one_c_name, compatibility_profile,
      capability_profile, status, created_by_membership_id, activated_at,
      version, created_at, updated_at
    ) VALUES (
      v_binding_id, v_challenge.tenant_id, v_challenge.organization_id,
      v_installation_id, btrim(p_one_c_organization_guid), btrim(p_one_c_inn),
      NULLIF(btrim(COALESCE(p_one_c_kpp, '')), ''), btrim(p_one_c_name),
      'UNKNOWN', p_capabilities, 'ACTIVE', v_challenge.created_by_membership_id,
      v_now, 0, v_now, v_now
    );
  END IF;

  UPDATE connector.one_c_machine_credentials credential
     SET status = 'REVOKED',
         revoked_at = v_now,
         version = credential.version + 1
   WHERE credential.binding_id = v_binding_id
     AND credential.status = 'ACTIVE';

  v_secret := rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  v_salt := encode(gen_random_bytes(16), 'hex');
  v_secret_hash := encode(digest(convert_to(v_salt || '.' || v_secret, 'UTF8'), 'sha256'), 'hex');
  v_bearer := v_credential_id || '.' || v_secret;

  INSERT INTO connector.one_c_machine_credentials (
    credential_id, tenant_id, organization_id, installation_id, binding_id,
    one_c_organization_guid, protocol_version, allowed_commands,
    salt, secret_hash, status, issued_at, expires_at,
    version, created_at, updated_at
  ) VALUES (
    v_credential_id, v_challenge.tenant_id, v_challenge.organization_id,
    v_installation_id, v_binding_id, btrim(p_one_c_organization_guid),
    p_protocol_version, p_capabilities, v_salt, v_secret_hash,
    'ACTIVE', v_now, v_credential_expires, 1, v_now, v_now
  );

  UPDATE connector.one_c_pairing_challenges challenge
     SET status = 'CONSUMED',
         consumed_at = v_now,
         consumed_installation_id = v_installation_id,
         consumed_binding_id = v_binding_id,
         issued_credential_id = v_credential_id,
         version = challenge.version + 1
   WHERE challenge.id = v_challenge.id
     AND challenge.status = 'PENDING';

  PERFORM connector.append_one_c_audit(
    'ONE_C_PAIRING_CONSUMED',
    v_creator.user_id,
    v_creator.role,
    v_challenge.tenant_id,
    v_challenge.organization_id,
    'ONE_C_BINDING',
    v_binding_id,
    'SUCCESS',
    'ONE_C_BINDING_AND_MACHINE_CREDENTIAL_ACTIVATED',
    jsonb_build_object(
      'installationId', v_installation_id,
      'bindingId', v_binding_id,
      'credentialId', v_credential_id,
      'databaseInstanceIdHash', encode(digest(convert_to(btrim(p_database_instance_id), 'UTF8'), 'sha256'), 'hex'),
      'oneCOrganizationGuid', btrim(p_one_c_organization_guid),
      'configurationName', btrim(p_configuration_name),
      'configurationVersion', btrim(p_configuration_version),
      'connectorVersion', btrim(p_connector_version),
      'protocolVersion', p_protocol_version,
      'credentialExpiresAt', v_credential_expires
    ),
    p_correlation_id
  );

  RETURN QUERY SELECT
    v_installation_id,
    v_binding_id,
    v_credential_id,
    v_bearer,
    v_credential_expires,
    v_challenge.organization_id,
    btrim(p_one_c_organization_guid),
    p_protocol_version,
    p_capabilities;
END
$function$;

ALTER FUNCTION connector.consume_one_c_pairing(text,text,text,text,text,text,text,text[],text,text,text,text,text)
  OWNER TO pc_one_c_connector_authority;
REVOKE ALL ON FUNCTION connector.consume_one_c_pairing(text,text,text,text,text,text,text,text[],text,text,text,text,text)
  FROM PUBLIC;

DO $one_c_pairing_runtime_regrant$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_runtime', 'app_service'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION connector.consume_one_c_pairing(text,text,text,text,text,text,text,text[],text,text,text,text,text) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$one_c_pairing_runtime_regrant$;
