-- PC-CROP Federal Accounting / Wave 6
-- Durable authority for the local/server 1C connector.
--
-- This migration intentionally uses a dedicated PostgreSQL schema instead of
-- adding another public Prisma model family. The connector runtime is an
-- integration/security boundary, not an accounting aggregate. All tables are
-- private; application principals receive EXECUTE on bounded SECURITY DEFINER
-- functions, never arbitrary table CRUD.
--
-- Core invariants:
--   * ConnectorInstallation is separate from OrganizationBinding;
--   * one 1C database may expose many legal entities, but one binding names one
--     platform organization and one exact 1C organization GUID;
--   * pairing and machine bearer plaintext are never persisted;
--   * pairing consume is atomic and one-time;
--   * active installation/GUID cannot be bound to two platform organizations;
--   * active platform organization cannot silently acquire a second binding;
--   * old machine credential is revoked in the same transaction as rotation;
--   * critical transitions use the existing public.audit_events store.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS connector;
REVOKE ALL ON SCHEMA connector FROM PUBLIC;

DO $one_c_authority_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_one_c_connector_authority'
  ) THEN
    CREATE ROLE pc_one_c_connector_authority
      NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_one_c_connector_authority
    NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.pg_auth_members membership
      JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
     WHERE granted.rolname = 'pc_one_c_connector_authority'
  ) THEN
    RAISE EXCEPTION 'pc_one_c_connector_authority must have no members'
      USING ERRCODE = '42501';
  END IF;
END
$one_c_authority_role$;

GRANT USAGE ON SCHEMA connector TO pc_one_c_connector_authority;

CREATE OR REPLACE FUNCTION connector.one_c_commands_are_valid(values text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog, connector
AS $function$
  SELECT
    cardinality(values) BETWEEN 1 AND 7
    AND NOT EXISTS (
      SELECT 1
        FROM unnest(values) AS command(value)
       WHERE command.value NOT IN (
         'UPSERT_COUNTERPARTY',
         'CREATE_SALES_DRAFT',
         'CREATE_PURCHASE_DRAFT',
         'CREATE_CORRECTION_DRAFT',
         'GET_DOCUMENT_STATUS',
         'PUSH_PAYMENT_STATUS',
         'GET_REFERENCE_CANDIDATES'
       )
    )
    AND cardinality(values) = (
      SELECT count(DISTINCT command.value)::integer
        FROM unnest(values) AS command(value)
    );
$function$;

CREATE TABLE connector.one_c_installations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  database_instance_id text NOT NULL,
  platform_version text NOT NULL,
  configuration_name text NOT NULL,
  configuration_version text NOT NULL,
  connector_version text NOT NULL,
  protocol_version text NOT NULL,
  capabilities text[] NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_pairing_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  last_heartbeat_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_installations_database_id_ck
    CHECK (length(btrim(database_instance_id)) BETWEEN 8 AND 160),
  CONSTRAINT one_c_installations_platform_version_ck
    CHECK (length(btrim(platform_version)) BETWEEN 1 AND 96),
  CONSTRAINT one_c_installations_configuration_name_ck
    CHECK (length(btrim(configuration_name)) BETWEEN 1 AND 160),
  CONSTRAINT one_c_installations_configuration_version_ck
    CHECK (length(btrim(configuration_version)) BETWEEN 1 AND 96),
  CONSTRAINT one_c_installations_connector_version_ck
    CHECK (length(btrim(connector_version)) BETWEEN 1 AND 64),
  CONSTRAINT one_c_installations_protocol_ck CHECK (protocol_version = '1'),
  CONSTRAINT one_c_installations_capabilities_ck
    CHECK (connector.one_c_commands_are_valid(capabilities)),
  CONSTRAINT one_c_installations_status_ck
    CHECK (status IN ('ACTIVE', 'REVOKED', 'SECURITY_HOLD')),
  CONSTRAINT one_c_installations_version_ck CHECK (version >= 0),
  CONSTRAINT one_c_installations_tenant_database_key UNIQUE (tenant_id, database_instance_id)
);

CREATE INDEX one_c_installations_status_idx
  ON connector.one_c_installations (tenant_id, status, updated_at DESC, id);

CREATE TABLE connector.one_c_bindings (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  installation_id text NOT NULL,
  one_c_organization_guid text NOT NULL,
  one_c_inn text NOT NULL,
  one_c_kpp text,
  one_c_name text NOT NULL,
  compatibility_profile text NOT NULL DEFAULT 'UNKNOWN',
  capability_profile text[] NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_by_membership_id text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  revoked_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_bindings_installation_fk
    FOREIGN KEY (installation_id)
    REFERENCES connector.one_c_installations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_bindings_organization_fk
    FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_bindings_creator_fk
    FOREIGN KEY (created_by_membership_id, organization_id)
    REFERENCES public.user_orgs(id, "organizationId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_bindings_guid_ck
    CHECK (length(btrim(one_c_organization_guid)) BETWEEN 8 AND 160),
  CONSTRAINT one_c_bindings_inn_ck CHECK (one_c_inn ~ '^[0-9]{10}([0-9]{2})?$'),
  CONSTRAINT one_c_bindings_kpp_ck CHECK (one_c_kpp IS NULL OR one_c_kpp ~ '^[0-9]{9}$'),
  CONSTRAINT one_c_bindings_name_ck CHECK (length(btrim(one_c_name)) BETWEEN 1 AND 512),
  CONSTRAINT one_c_bindings_compatibility_ck
    CHECK (compatibility_profile IN ('BSHP_3', 'KFH', 'BP_3', 'ERP', 'KA', 'UT', 'UNKNOWN')),
  CONSTRAINT one_c_bindings_capability_ck
    CHECK (connector.one_c_commands_are_valid(capability_profile)),
  CONSTRAINT one_c_bindings_status_ck
    CHECK (status IN ('ACTIVE', 'REVOKED', 'SECURITY_HOLD')),
  CONSTRAINT one_c_bindings_revoked_ck
    CHECK ((status = 'ACTIVE' AND revoked_at IS NULL) OR (status <> 'ACTIVE' AND revoked_at IS NOT NULL)),
  CONSTRAINT one_c_bindings_version_ck CHECK (version >= 0)
);

CREATE UNIQUE INDEX one_c_binding_one_active_org_idx
  ON connector.one_c_bindings (tenant_id, organization_id)
  WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX one_c_binding_one_active_entity_idx
  ON connector.one_c_bindings (installation_id, one_c_organization_guid)
  WHERE status = 'ACTIVE';

CREATE INDEX one_c_bindings_installation_idx
  ON connector.one_c_bindings (installation_id, status, updated_at DESC, id);

CREATE TABLE connector.one_c_machine_credentials (
  credential_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  installation_id text NOT NULL,
  binding_id text NOT NULL,
  one_c_organization_guid text NOT NULL,
  protocol_version text NOT NULL,
  allowed_commands text[] NOT NULL,
  salt text NOT NULL,
  secret_hash character(64) NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_machine_credentials_installation_fk
    FOREIGN KEY (installation_id)
    REFERENCES connector.one_c_installations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_machine_credentials_binding_fk
    FOREIGN KEY (binding_id)
    REFERENCES connector.one_c_bindings(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_machine_credentials_organization_fk
    FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_machine_credentials_guid_ck
    CHECK (length(btrim(one_c_organization_guid)) BETWEEN 8 AND 160),
  CONSTRAINT one_c_machine_credentials_protocol_ck CHECK (protocol_version = '1'),
  CONSTRAINT one_c_machine_credentials_commands_ck
    CHECK (connector.one_c_commands_are_valid(allowed_commands)),
  CONSTRAINT one_c_machine_credentials_salt_ck CHECK (salt ~ '^[a-f0-9]{32}$'),
  CONSTRAINT one_c_machine_credentials_hash_ck CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT one_c_machine_credentials_status_ck CHECK (status IN ('ACTIVE', 'REVOKED')),
  CONSTRAINT one_c_machine_credentials_window_ck CHECK (expires_at > issued_at),
  CONSTRAINT one_c_machine_credentials_revoked_ck
    CHECK ((status = 'ACTIVE' AND revoked_at IS NULL) OR (status = 'REVOKED' AND revoked_at IS NOT NULL)),
  CONSTRAINT one_c_machine_credentials_version_ck CHECK (version >= 1)
);

CREATE UNIQUE INDEX one_c_machine_one_active_binding_idx
  ON connector.one_c_machine_credentials (binding_id)
  WHERE status = 'ACTIVE';

CREATE INDEX one_c_machine_credential_expiry_idx
  ON connector.one_c_machine_credentials (status, expires_at, credential_id);

CREATE TABLE connector.one_c_pairing_challenges (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  created_by_membership_id text NOT NULL,
  lookup_hash character(64) NOT NULL UNIQUE,
  salt text NOT NULL,
  code_hash character(64) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  revoked_at timestamptz,
  consumed_installation_id text,
  consumed_binding_id text,
  issued_credential_id text,
  correlation_id text NOT NULL,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT one_c_pairing_challenges_organization_fk
    FOREIGN KEY (organization_id, tenant_id)
    REFERENCES public.organizations(id, "tenantId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_pairing_challenges_creator_fk
    FOREIGN KEY (created_by_membership_id, organization_id)
    REFERENCES public.user_orgs(id, "organizationId")
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_pairing_challenges_installation_fk
    FOREIGN KEY (consumed_installation_id)
    REFERENCES connector.one_c_installations(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_pairing_challenges_binding_fk
    FOREIGN KEY (consumed_binding_id)
    REFERENCES connector.one_c_bindings(id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_pairing_challenges_credential_fk
    FOREIGN KEY (issued_credential_id)
    REFERENCES connector.one_c_machine_credentials(credential_id)
    ON UPDATE RESTRICT ON DELETE RESTRICT,
  CONSTRAINT one_c_pairing_challenges_lookup_ck CHECK (lookup_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT one_c_pairing_challenges_salt_ck CHECK (salt ~ '^[a-f0-9]{32}$'),
  CONSTRAINT one_c_pairing_challenges_hash_ck CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT one_c_pairing_challenges_status_ck CHECK (status IN ('PENDING', 'CONSUMED', 'REVOKED')),
  CONSTRAINT one_c_pairing_challenges_lifecycle_ck CHECK (
    (status = 'PENDING' AND consumed_at IS NULL AND revoked_at IS NULL
      AND consumed_installation_id IS NULL AND consumed_binding_id IS NULL AND issued_credential_id IS NULL)
    OR
    (status = 'CONSUMED' AND consumed_at IS NOT NULL AND revoked_at IS NULL
      AND consumed_installation_id IS NOT NULL AND consumed_binding_id IS NOT NULL AND issued_credential_id IS NOT NULL)
    OR
    (status = 'REVOKED' AND consumed_at IS NULL AND revoked_at IS NOT NULL
      AND consumed_installation_id IS NULL AND consumed_binding_id IS NULL AND issued_credential_id IS NULL)
  ),
  CONSTRAINT one_c_pairing_challenges_version_ck CHECK (version >= 0)
);

CREATE INDEX one_c_pairing_challenges_org_status_idx
  ON connector.one_c_pairing_challenges (tenant_id, organization_id, status, expires_at DESC, id);

-- No lifecycle row is physically deleted. These are security evidence and the
-- identifiers are referenced by audit and future incident-response tooling.
CREATE OR REPLACE FUNCTION connector.reject_one_c_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  RAISE EXCEPTION '1C connector authority rows are retired, not deleted'
    USING ERRCODE = '55000';
END
$function$;

CREATE TRIGGER one_c_installations_no_delete
BEFORE DELETE ON connector.one_c_installations
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_delete();
CREATE TRIGGER one_c_bindings_no_delete
BEFORE DELETE ON connector.one_c_bindings
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_delete();
CREATE TRIGGER one_c_machine_credentials_no_delete
BEFORE DELETE ON connector.one_c_machine_credentials
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_delete();
CREATE TRIGGER one_c_pairing_challenges_no_delete
BEFORE DELETE ON connector.one_c_pairing_challenges
FOR EACH ROW EXECUTE FUNCTION connector.reject_one_c_delete();

CREATE OR REPLACE FUNCTION connector.guard_one_c_installation_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
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

CREATE TRIGGER one_c_installations_guard
BEFORE UPDATE ON connector.one_c_installations
FOR EACH ROW EXECUTE FUNCTION connector.guard_one_c_installation_update();

CREATE OR REPLACE FUNCTION connector.guard_one_c_binding_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.one_c_organization_guid IS DISTINCT FROM OLD.one_c_organization_guid
     OR NEW.one_c_inn IS DISTINCT FROM OLD.one_c_inn
     OR NEW.created_by_membership_id IS DISTINCT FROM OLD.created_by_membership_id
     OR NEW.activated_at IS DISTINCT FROM OLD.activated_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '1C organization binding identity is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION '1C binding version must advance by one' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER one_c_bindings_guard
BEFORE UPDATE ON connector.one_c_bindings
FOR EACH ROW EXECUTE FUNCTION connector.guard_one_c_binding_update();

CREATE OR REPLACE FUNCTION connector.guard_one_c_credential_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.credential_id IS DISTINCT FROM OLD.credential_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.installation_id IS DISTINCT FROM OLD.installation_id
     OR NEW.binding_id IS DISTINCT FROM OLD.binding_id
     OR NEW.one_c_organization_guid IS DISTINCT FROM OLD.one_c_organization_guid
     OR NEW.protocol_version IS DISTINCT FROM OLD.protocol_version
     OR NEW.allowed_commands IS DISTINCT FROM OLD.allowed_commands
     OR NEW.salt IS DISTINCT FROM OLD.salt
     OR NEW.secret_hash IS DISTINCT FROM OLD.secret_hash
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '1C machine credential identity/verifier is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION '1C machine credential version must advance by one' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER one_c_machine_credentials_guard
BEFORE UPDATE ON connector.one_c_machine_credentials
FOR EACH ROW EXECUTE FUNCTION connector.guard_one_c_credential_update();

CREATE OR REPLACE FUNCTION connector.guard_one_c_pairing_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, connector
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.created_by_membership_id IS DISTINCT FROM OLD.created_by_membership_id
     OR NEW.lookup_hash IS DISTINCT FROM OLD.lookup_hash
     OR NEW.salt IS DISTINCT FROM OLD.salt
     OR NEW.code_hash IS DISTINCT FROM OLD.code_hash
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '1C pairing challenge identity/verifier is immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.version <> OLD.version + 1 THEN
    RAISE EXCEPTION '1C pairing challenge version must advance by one' USING ERRCODE = '40001';
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

CREATE TRIGGER one_c_pairing_challenges_guard
BEFORE UPDATE ON connector.one_c_pairing_challenges
FOR EACH ROW EXECUTE FUNCTION connector.guard_one_c_pairing_update();

-- FORCE RLS is the backstop if a future grant accidentally exposes a table.
-- Only the no-login authority role used by the fixed functions below has a
-- policy. Application roles are deliberately absent.
ALTER TABLE connector.one_c_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_installations FORCE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_bindings FORCE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_machine_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_machine_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_pairing_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector.one_c_pairing_challenges FORCE ROW LEVEL SECURITY;

CREATE POLICY one_c_installations_authority_policy
  ON connector.one_c_installations
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);
CREATE POLICY one_c_bindings_authority_policy
  ON connector.one_c_bindings
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);
CREATE POLICY one_c_machine_credentials_authority_policy
  ON connector.one_c_machine_credentials
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);
CREATE POLICY one_c_pairing_challenges_authority_policy
  ON connector.one_c_pairing_challenges
  FOR ALL TO pc_one_c_connector_authority USING (true) WITH CHECK (true);

REVOKE ALL ON ALL TABLES IN SCHEMA connector FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON connector.one_c_installations TO pc_one_c_connector_authority;
GRANT SELECT, INSERT, UPDATE ON connector.one_c_bindings TO pc_one_c_connector_authority;
GRANT SELECT, INSERT, UPDATE ON connector.one_c_machine_credentials TO pc_one_c_connector_authority;
GRANT SELECT, INSERT, UPDATE ON connector.one_c_pairing_challenges TO pc_one_c_connector_authority;

-- The authority only needs identity/account data for binding checks and the
-- existing audit store for evidence. It is no-login and has no members.
GRANT SELECT ("id", "inn", "kpp", "status", "tenantId")
  ON public.organizations TO pc_one_c_connector_authority;
GRANT SELECT ("id", "userId", "organizationId", "role", "status", "job_profile")
  ON public.user_orgs TO pc_one_c_connector_authority;
GRANT SELECT ("id", "status", "deletedAt")
  ON public.users TO pc_one_c_connector_authority;
GRANT SELECT ("id", "tenantId", "orgId", "objectType", "objectId", "hash", "createdAt")
  ON public.audit_events TO pc_one_c_connector_authority;
GRANT INSERT ON public.audit_events TO pc_one_c_connector_authority;

-- Append to the canonical public audit store. The chain is per one-C object,
-- serialized by an advisory lock, so events for one binding/challenge cannot
-- fork. No secret/verifier/discovery body belongs in metadata.
CREATE OR REPLACE FUNCTION connector.append_one_c_audit(
  p_action text,
  p_actor_user_id text,
  p_actor_role text,
  p_tenant_id text,
  p_org_id text,
  p_object_type text,
  p_object_id text,
  p_outcome text,
  p_reason text,
  p_metadata jsonb,
  p_correlation_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_id text := 'one-c-audit-' || gen_random_uuid()::text;
  v_prev_hash text;
  v_hash text;
  v_material jsonb;
BEGIN
  IF p_action IS NULL OR length(btrim(p_action)) NOT BETWEEN 3 AND 128 THEN
    RAISE EXCEPTION 'ONE_C_AUDIT_ACTION_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_object_type NOT IN ('ONE_C_PAIRING', 'ONE_C_BINDING', 'ONE_C_CREDENTIAL') THEN
    RAISE EXCEPTION 'ONE_C_AUDIT_OBJECT_TYPE_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_outcome NOT IN ('SUCCESS', 'DENIED', 'FAILURE') THEN
    RAISE EXCEPTION 'ONE_C_AUDIT_OUTCOME_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_metadata::text ~* '(bearer|secret_hash|code_hash|lookup_hash|salt|pairingCode|authorization)' THEN
    RAISE EXCEPTION 'ONE_C_AUDIT_SECRET_FIELD_REFUSED' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('pc-one-c:' || p_tenant_id || ':' || p_org_id || ':' || p_object_type || ':' || p_object_id, 0)
  );

  SELECT event."hash" INTO v_prev_hash
    FROM public.audit_events event
   WHERE event."tenantId" = p_tenant_id
     AND event."orgId" = p_org_id
     AND event."objectType" = p_object_type
     AND event."objectId" = p_object_id
   ORDER BY event."createdAt" DESC, event."id" DESC
   LIMIT 1;

  v_material := jsonb_build_object(
    'action', p_action,
    'actorUserId', p_actor_user_id,
    'actorRole', p_actor_role,
    'tenantId', p_tenant_id,
    'orgId', p_org_id,
    'objectType', p_object_type,
    'objectId', p_object_id,
    'outcome', p_outcome,
    'reason', p_reason,
    'metadata', COALESCE(p_metadata, '{}'::jsonb),
    'correlationId', p_correlation_id,
    'prevHash', v_prev_hash
  );
  v_hash := encode(digest(convert_to(v_material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.audit_events (
    "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
    "objectType", "objectId", "outcome", "reason", "metadata",
    "correlationId", "hash", "prevHash", "createdAt"
  ) VALUES (
    v_id, p_action, p_actor_user_id, p_actor_role, p_tenant_id, p_org_id,
    p_object_type, p_object_id, p_outcome, p_reason, COALESCE(p_metadata, '{}'::jsonb),
    p_correlation_id, v_hash, v_prev_hash, clock_timestamp()
  );

  RETURN v_id;
END
$function$;

-- Human-side challenge issuance. Capability (`integrations.configure`) remains
-- an application concern; the database independently proves attribution and
-- organization scope from the active membership before minting a challenge.
CREATE OR REPLACE FUNCTION connector.create_one_c_pairing_challenge(
  p_correlation_id text,
  p_ttl_seconds integer DEFAULT 600
)
RETURNS TABLE (
  challenge_id text,
  pairing_code text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_membership_id text;
  v_actor_user_id text;
  v_actor_role text;
  v_org_id text;
  v_tenant_id text;
  v_now timestamptz := clock_timestamp();
  v_id text := 'one-c-pair-' || gen_random_uuid()::text;
  v_code text;
  v_salt text;
  v_lookup_hash text;
  v_code_hash text;
  v_expires timestamptz;
BEGIN
  IF p_ttl_seconds < 60 OR p_ttl_seconds > 3600 THEN
    RAISE EXCEPTION 'ONE_C_PAIRING_TTL_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_CORRELATION_ID_INVALID' USING ERRCODE = '22023';
  END IF;

  v_org_id := current_setting('app.current_org_id', true);
  v_tenant_id := current_setting('app.current_tenant_id', true);
  v_actor_user_id := current_setting('app.current_user_id', true);
  v_actor_role := current_setting('app.current_role', true);
  v_membership_id := public.app_pc_crop_membership_id();

  IF COALESCE(v_org_id, '') = '' OR COALESCE(v_tenant_id, '') = ''
     OR COALESCE(v_actor_user_id, '') = '' OR COALESCE(v_membership_id, '') = '' THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.organizations organization
     WHERE organization.id = v_org_id
       AND organization."tenantId" = v_tenant_id
       AND organization.status IN ('VERIFIED', 'ACTIVE')
  ) THEN
    RAISE EXCEPTION 'ONE_C_VERIFIED_ORGANIZATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  -- A new code supersedes any previous unused code for this organization.
  UPDATE connector.one_c_pairing_challenges challenge
     SET status = 'REVOKED',
         revoked_at = v_now,
         version = challenge.version + 1
   WHERE challenge.tenant_id = v_tenant_id
     AND challenge.organization_id = v_org_id
     AND challenge.status = 'PENDING';

  v_code := rtrim(translate(encode(gen_random_bytes(24), 'base64'), '+/', '-_'), '=');
  v_salt := encode(gen_random_bytes(16), 'hex');
  v_lookup_hash := encode(digest(convert_to(v_code, 'UTF8'), 'sha256'), 'hex');
  v_code_hash := encode(digest(convert_to(v_salt || '.' || v_code, 'UTF8'), 'sha256'), 'hex');
  v_expires := v_now + make_interval(secs => p_ttl_seconds);

  INSERT INTO connector.one_c_pairing_challenges (
    id, tenant_id, organization_id, created_by_membership_id,
    lookup_hash, salt, code_hash, status, expires_at, correlation_id,
    version, created_at, updated_at
  ) VALUES (
    v_id, v_tenant_id, v_org_id, v_membership_id,
    v_lookup_hash, v_salt, v_code_hash, 'PENDING', v_expires, p_correlation_id,
    0, v_now, v_now
  );

  PERFORM connector.append_one_c_audit(
    'ONE_C_PAIRING_CHALLENGE_ISSUED',
    v_actor_user_id,
    COALESCE(v_actor_role, 'UNKNOWN'),
    v_tenant_id,
    v_org_id,
    'ONE_C_PAIRING',
    v_id,
    'SUCCESS',
    'ONE_TIME_PAIRING_CHALLENGE_ISSUED',
    jsonb_build_object('expiresAt', v_expires),
    p_correlation_id
  );

  RETURN QUERY SELECT v_id, v_code, v_expires;
END
$function$;

-- Connector-side one-time pairing. The challenge is locked and verified inside
-- PostgreSQL before any installation, binding or credential can change.
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

  SELECT * INTO v_installation
    FROM connector.one_c_installations installation
   WHERE installation.tenant_id = v_challenge.tenant_id
     AND installation.database_instance_id = btrim(p_database_instance_id)
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
      id, tenant_id, database_instance_id, platform_version, configuration_name,
      configuration_version, connector_version, protocol_version, capabilities,
      status, first_seen_at, last_pairing_at, version, created_at, updated_at
    ) VALUES (
      v_installation_id, v_challenge.tenant_id, btrim(p_database_instance_id),
      btrim(p_platform_version), btrim(p_configuration_name),
      btrim(p_configuration_version), btrim(p_connector_version),
      p_protocol_version, p_capabilities, 'ACTIVE', v_now, v_now, 0, v_now, v_now
    );
  END IF;

  -- Existing active organization binding may only be re-paired to the exact
  -- same installation and exact same 1C legal entity. Anything else is an
  -- explicit rebind lifecycle, never an implicit side effect of a new code.
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

  -- Rotation is atomic: there is never a transaction commit containing two
  -- ACTIVE credentials for one binding.
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

-- Safe server-side verifier projection. A 256-bit credential id/secret pair is
-- verified in application code with timingSafeEqual; this function returns the
-- persisted verifier for exactly one random credential id and no list endpoint.
CREATE OR REPLACE FUNCTION connector.read_one_c_machine_credential(
  p_credential_id text
)
RETURNS TABLE (
  credential_id text,
  salt text,
  secret_hash text,
  installation_id text,
  binding_id text,
  organization_id text,
  one_c_organization_guid text,
  protocol_version text,
  allowed_commands text[],
  issued_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  credential_status text,
  binding_status text,
  installation_status text,
  version bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, connector
AS $function$
  SELECT credential.credential_id,
         credential.salt,
         credential.secret_hash,
         credential.installation_id,
         credential.binding_id,
         credential.organization_id,
         credential.one_c_organization_guid,
         credential.protocol_version,
         credential.allowed_commands,
         credential.issued_at,
         credential.expires_at,
         credential.revoked_at,
         credential.status,
         binding.status,
         installation.status,
         credential.version
    FROM connector.one_c_machine_credentials credential
    JOIN connector.one_c_bindings binding ON binding.id = credential.binding_id
    JOIN connector.one_c_installations installation ON installation.id = credential.installation_id
   WHERE credential.credential_id = p_credential_id
   LIMIT 1;
$function$;

-- Safe human-side status projection. It relies on the authenticated session's
-- active organization membership and returns no pairing or credential verifier.
CREATE OR REPLACE FUNCTION connector.describe_one_c_binding()
RETURNS TABLE (
  binding_id text,
  installation_id text,
  organization_id text,
  one_c_organization_guid text,
  one_c_inn text,
  one_c_kpp text,
  one_c_name text,
  compatibility_profile text,
  capability_profile text[],
  binding_status text,
  platform_version text,
  configuration_name text,
  configuration_version text,
  connector_version text,
  protocol_version text,
  installation_status text,
  last_pairing_at timestamptz,
  last_heartbeat_at timestamptz,
  credential_expires_at timestamptz,
  credential_last_used_at timestamptz
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
  SELECT binding.id,
         installation.id,
         binding.organization_id,
         binding.one_c_organization_guid,
         binding.one_c_inn,
         binding.one_c_kpp,
         binding.one_c_name,
         binding.compatibility_profile,
         binding.capability_profile,
         binding.status,
         installation.platform_version,
         installation.configuration_name,
         installation.configuration_version,
         installation.connector_version,
         installation.protocol_version,
         installation.status,
         installation.last_pairing_at,
         installation.last_heartbeat_at,
         credential.expires_at,
         credential.last_used_at
    FROM connector.one_c_bindings binding
    JOIN connector.one_c_installations installation ON installation.id = binding.installation_id
    LEFT JOIN connector.one_c_machine_credentials credential
      ON credential.binding_id = binding.id AND credential.status = 'ACTIVE'
   WHERE binding.tenant_id = v_tenant_id
     AND binding.organization_id = v_org_id
     AND binding.status = 'ACTIVE'
   ORDER BY binding.updated_at DESC, binding.id DESC
   LIMIT 1;
END
$function$;

-- Explicit human revocation. No delete; current machine credential is revoked in
-- the same transaction and the binding cannot be silently reactivated.
CREATE OR REPLACE FUNCTION connector.revoke_one_c_binding(
  p_binding_id text,
  p_reason text,
  p_correlation_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, connector
AS $function$
DECLARE
  v_membership_id text := public.app_pc_crop_membership_id();
  v_user_id text := current_setting('app.current_user_id', true);
  v_role text := current_setting('app.current_role', true);
  v_org_id text := current_setting('app.current_org_id', true);
  v_tenant_id text := current_setting('app.current_tenant_id', true);
  v_binding connector.one_c_bindings%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_membership_id IS NULL THEN
    RAISE EXCEPTION 'ONE_C_ACTIVE_ORGANIZATION_MEMBERSHIP_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'ONE_C_REVOKE_REASON_INVALID' USING ERRCODE = '22023';
  END IF;
  IF p_correlation_id IS NULL OR p_correlation_id !~ '^[A-Za-z0-9:_.@-]{1,128}$' THEN
    RAISE EXCEPTION 'ONE_C_CORRELATION_ID_INVALID' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_binding
    FROM connector.one_c_bindings binding
   WHERE binding.id = p_binding_id
     AND binding.tenant_id = v_tenant_id
     AND binding.organization_id = v_org_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_binding.status <> 'ACTIVE' THEN
    RETURN true;
  END IF;

  UPDATE connector.one_c_machine_credentials credential
     SET status = 'REVOKED', revoked_at = v_now, version = credential.version + 1
   WHERE credential.binding_id = v_binding.id
     AND credential.status = 'ACTIVE';

  UPDATE connector.one_c_bindings binding
     SET status = 'REVOKED', revoked_at = v_now, version = binding.version + 1
   WHERE binding.id = v_binding.id
     AND binding.status = 'ACTIVE';

  PERFORM connector.append_one_c_audit(
    'ONE_C_BINDING_REVOKED',
    v_user_id,
    COALESCE(v_role, 'UNKNOWN'),
    v_tenant_id,
    v_org_id,
    'ONE_C_BINDING',
    v_binding.id,
    'SUCCESS',
    btrim(p_reason),
    jsonb_build_object('bindingId', v_binding.id, 'installationId', v_binding.installation_id),
    p_correlation_id
  );

  RETURN true;
END
$function$;

-- Function ownership and app-facing EXECUTE grants. Tables remain private.
ALTER FUNCTION connector.one_c_commands_are_valid(text[]) OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.append_one_c_audit(text,text,text,text,text,text,text,text,text,jsonb,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.create_one_c_pairing_challenge(text,integer)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.consume_one_c_pairing(text,text,text,text,text,text,text,text[],text,text,text,text,text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.read_one_c_machine_credential(text)
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.describe_one_c_binding()
  OWNER TO pc_one_c_connector_authority;
ALTER FUNCTION connector.revoke_one_c_binding(text,text,text)
  OWNER TO pc_one_c_connector_authority;

REVOKE ALL ON FUNCTION connector.one_c_commands_are_valid(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.append_one_c_audit(text,text,text,text,text,text,text,text,text,jsonb,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.create_one_c_pairing_challenge(text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.consume_one_c_pairing(text,text,text,text,text,text,text,text[],text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.read_one_c_machine_credential(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.describe_one_c_binding() FROM PUBLIC;
REVOKE ALL ON FUNCTION connector.revoke_one_c_binding(text,text,text) FROM PUBLIC;

DO $one_c_runtime_function_grants$
DECLARE
  role_name text;
BEGIN
  -- Human accounting paths: challenge/status/revoke. Capability checks remain
  -- in the reviewed application repository, while the SQL functions enforce
  -- tenant/org attribution and lifecycle invariants.
  FOREACH role_name IN ARRAY ARRAY[
    'app_runtime', 'app_service', 'pc_accounting_authority', 'pc_accounting_command_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA connector TO %I', role_name);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION connector.create_one_c_pairing_challenge(text,integer) TO %I',
        role_name
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION connector.describe_one_c_binding() TO %I',
        role_name
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION connector.revoke_one_c_binding(text,text,text) TO %I',
        role_name
      );
    END IF;
  END LOOP;

  -- Pairing and credential lookup are connector/API runtime operations. There
  -- is no table grant behind them.
  FOREACH role_name IN ARRAY ARRAY['app_runtime', 'app_service'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION connector.consume_one_c_pairing(text,text,text,text,text,text,text,text[],text,text,text,text,text) TO %I',
        role_name
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION connector.read_one_c_machine_credential(text) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$one_c_runtime_function_grants$;

-- Explicitly assert that no ordinary runtime role acquired connector table CRUD.
DO $one_c_direct_table_denial$
DECLARE
  role_name text;
  table_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'app_runtime', 'app_service', 'pc_accounting_authority', 'pc_accounting_command_authority',
    'pc_staff_runtime', 'pc_registration_authority', 'pc_registration_decision_authority'
  ] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'one_c_installations', 'one_c_bindings', 'one_c_machine_credentials', 'one_c_pairing_challenges'
      ] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON connector.%I FROM %I', table_name, role_name);
      END LOOP;
    END IF;
  END LOOP;
END
$one_c_direct_table_denial$;
