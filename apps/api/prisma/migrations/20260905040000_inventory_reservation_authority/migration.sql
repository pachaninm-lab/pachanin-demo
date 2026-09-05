-- W2-A. Like the canonical auction authority, this private schema is managed
-- by the migration chain and accessed through bounded SQL commands, not Prisma models.
CREATE SCHEMA inventory;
REVOKE ALL ON SCHEMA inventory FROM PUBLIC;
DO $inventory_principal$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_inventory_authority') THEN
    CREATE ROLE pc_inventory_authority NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  ALTER ROLE pc_inventory_authority NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  IF EXISTS (SELECT 1 FROM pg_auth_members WHERE roleid='pc_inventory_authority'::regrole OR member='pc_inventory_authority'::regrole) THEN
    RAISE EXCEPTION 'INVENTORY_AUTHORITY_MEMBERSHIP_DENIED';
  END IF;
END
$inventory_principal$;
GRANT USAGE, CREATE ON SCHEMA inventory TO pc_inventory_authority;
GRANT USAGE ON SCHEMA public, auction TO pc_inventory_authority;

CREATE TABLE inventory.availability_policies (
  id text PRIMARY KEY,
  version bigint NOT NULL CHECK (version = 1),
  definition jsonb NOT NULL
);
INSERT INTO inventory.availability_policies VALUES ('DECLARED_CAPACITY_V1', 1, '{
  "basis":"declaredQuantity",
  "exclusiveBuckets":["availableQuantity","reservedQuantity","committedQuantity","blockedQuantity","disputedQuantity","depletedQuantity"],
  "formula":"declared - reserved - committed - blocked - disputed - depleted",
  "independentMeasures":["confirmedQuantity","shippedQuantity","acceptedQuantity","soldQuantity"],
  "supportedCommands":["DECLARE","RESERVE","RELEASE"],
  "independentVerificationCreated":false,
  "financialObligationCreated":false
}'::jsonb);

CREATE TABLE inventory.batches (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  stock_key text NOT NULL CHECK (stock_key ~ '^[A-Za-z0-9][A-Za-z0-9:_.-]{2,79}$'),
  source_type text NOT NULL CHECK (source_type IN ('MANUAL','FGIS','1C','ELEVATOR','WAREHOUSE','PARTNER','DOCUMENT_ASSISTED')),
  source_reference text NOT NULL CHECK (length(btrim(source_reference)) BETWEEN 1 AND 256),
  verification_status text NOT NULL DEFAULT 'DECLARED' CHECK (verification_status = 'DECLARED'),
  profile_version_id text NOT NULL REFERENCES public.commodity_profile_versions(id) ON DELETE RESTRICT,
  profile_content_hash text NOT NULL CHECK (profile_content_hash ~ '^[0-9a-f]{64}$'),
  unit_rules jsonb NOT NULL CHECK (jsonb_typeof(unit_rules) = 'array'),
  base_unit_code text NOT NULL,
  base_unit_precision integer NOT NULL CHECK (base_unit_precision BETWEEN 0 AND 6),
  dimension text NOT NULL CHECK (dimension IN ('MASS','VOLUME','COUNT')),
  declared_quantity bigint NOT NULL CHECK (declared_quantity > 0),
  declared_by_membership_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, organization_id, stock_key),
  UNIQUE (tenant_id, organization_id, id),
  FOREIGN KEY (organization_id, tenant_id) REFERENCES public.organizations(id, "tenantId") ON DELETE RESTRICT,
  FOREIGN KEY (declared_by_membership_id, organization_id) REFERENCES public.user_orgs(id, "organizationId") ON DELETE RESTRICT
);

CREATE TABLE inventory.positions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  batch_id text NOT NULL UNIQUE,
  state_version bigint NOT NULL CHECK (state_version > 0),
  policy_id text NOT NULL REFERENCES inventory.availability_policies(id) ON DELETE RESTRICT,
  declared_quantity bigint NOT NULL CHECK (declared_quantity > 0),
  confirmed_quantity bigint NOT NULL DEFAULT 0 CHECK (confirmed_quantity = 0),
  available_quantity bigint NOT NULL CHECK (available_quantity >= 0),
  reserved_quantity bigint NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  committed_quantity bigint NOT NULL DEFAULT 0 CHECK (committed_quantity = 0),
  shipped_quantity bigint NOT NULL DEFAULT 0 CHECK (shipped_quantity = 0),
  accepted_quantity bigint NOT NULL DEFAULT 0 CHECK (accepted_quantity = 0),
  blocked_quantity bigint NOT NULL DEFAULT 0 CHECK (blocked_quantity = 0),
  disputed_quantity bigint NOT NULL DEFAULT 0 CHECK (disputed_quantity = 0),
  sold_quantity bigint NOT NULL DEFAULT 0 CHECK (sold_quantity = 0),
  depleted_quantity bigint NOT NULL DEFAULT 0 CHECK (depleted_quantity = 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, organization_id, id),
  FOREIGN KEY (tenant_id, organization_id, batch_id) REFERENCES inventory.batches(tenant_id, organization_id, id) ON DELETE RESTRICT,
  CONSTRAINT inventory_exclusive_bucket_conservation CHECK (
    declared_quantity::numeric = available_quantity::numeric + reserved_quantity + committed_quantity + blocked_quantity + disputed_quantity + depleted_quantity
  )
);
CREATE INDEX inventory_positions_owner_idx ON inventory.positions(tenant_id, organization_id, id);

CREATE TABLE inventory.reservations (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  position_id text NOT NULL,
  lot_id text NOT NULL,
  quantity bigint NOT NULL CHECK (quantity > 0),
  status text NOT NULL CHECK (status IN ('RESERVED','RELEASED')),
  created_by_membership_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  released_at timestamptz,
  FOREIGN KEY (tenant_id, organization_id, position_id) REFERENCES inventory.positions(tenant_id, organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, lot_id) REFERENCES auction.lots(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by_membership_id, organization_id) REFERENCES public.user_orgs(id, "organizationId") ON DELETE RESTRICT,
  CHECK ((status = 'RESERVED' AND released_at IS NULL) OR (status = 'RELEASED' AND released_at IS NOT NULL))
);
CREATE INDEX inventory_reservations_position_idx ON inventory.reservations(tenant_id, organization_id, position_id, status);
CREATE INDEX inventory_reservations_lot_idx ON inventory.reservations(tenant_id, lot_id, status);

CREATE TABLE inventory.availability_snapshots (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  position_id text NOT NULL,
  source_state_version bigint NOT NULL CHECK (source_state_version > 0),
  policy_id text NOT NULL REFERENCES inventory.availability_policies(id) ON DELETE RESTRICT,
  policy_version bigint NOT NULL CHECK (policy_version = 1),
  snapshot jsonb NOT NULL,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (position_id, source_state_version),
  FOREIGN KEY (tenant_id, organization_id, position_id) REFERENCES inventory.positions(tenant_id, organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE inventory.command_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  position_id text NOT NULL,
  state_version bigint NOT NULL CHECK (state_version > 0),
  command_id text NOT NULL,
  idempotency_key text NOT NULL,
  action text NOT NULL CHECK (action IN ('DECLARE','RESERVE','RELEASE')),
  actor_user_id text NOT NULL,
  actor_membership_id text NOT NULL,
  request_hash text NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  receipt jsonb NOT NULL,
  previous_hash text,
  hash text NOT NULL CHECK (hash ~ '^[0-9a-f]{64}$'),
  snapshot_id text NOT NULL UNIQUE REFERENCES inventory.availability_snapshots(id) ON DELETE RESTRICT,
  audit_id text NOT NULL UNIQUE REFERENCES public.audit_events(id) ON DELETE RESTRICT,
  outbox_id text NOT NULL UNIQUE REFERENCES public.outbox_entries(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, organization_id, command_id),
  UNIQUE (tenant_id, organization_id, idempotency_key),
  UNIQUE (position_id, state_version),
  FOREIGN KEY (tenant_id, organization_id, position_id) REFERENCES inventory.positions(tenant_id, organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (actor_membership_id, organization_id) REFERENCES public.user_orgs(id, "organizationId") ON DELETE RESTRICT
);

-- Only this memberless function owner can write. Accidental broad harness or
-- future app grants still cannot bypass the command boundary or append-only facts.
CREATE FUNCTION inventory.private_write_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, inventory AS $function$
BEGIN
  IF current_user <> 'pc_inventory_authority' OR TG_OP = 'TRUNCATE'
     OR (TG_OP <> 'INSERT' AND TG_TABLE_NAME NOT IN ('positions','reservations'))
     OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'INVENTORY_DIRECT_MUTATION_DENIED';
  END IF;
  RETURN NEW;
END
$function$;

DO $inventory_rls$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['batches','positions','reservations','availability_snapshots','command_events'] LOOP
    EXECUTE format('ALTER TABLE inventory.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE inventory.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY inventory_own_read ON inventory.%I FOR SELECT USING (
      tenant_id = public.app_identity_tenant_id() AND organization_id = public.app_identity_org_id()
      AND public.app_pc_crop_membership_id() IS NOT NULL)', table_name);
    EXECUTE format('CREATE POLICY inventory_command_write ON inventory.%I FOR ALL TO pc_inventory_authority USING (
      tenant_id = public.app_identity_tenant_id() AND organization_id = public.app_identity_org_id()
      AND public.app_pc_crop_membership_id() IS NOT NULL) WITH CHECK (
      tenant_id = public.app_identity_tenant_id() AND organization_id = public.app_identity_org_id()
      AND public.app_pc_crop_membership_id() IS NOT NULL)', table_name);
    EXECUTE format('CREATE TRIGGER inventory_private_write BEFORE INSERT OR UPDATE OR DELETE ON inventory.%I
      FOR EACH ROW EXECUTE FUNCTION inventory.private_write_guard()', table_name);
    EXECUTE format('CREATE TRIGGER inventory_no_truncate BEFORE TRUNCATE ON inventory.%I
      FOR EACH STATEMENT EXECUTE FUNCTION inventory.private_write_guard()', table_name);
    EXECUTE format('ALTER TABLE inventory.%I OWNER TO pc_inventory_authority', table_name);
  END LOOP;
END
$inventory_rls$;
ALTER TABLE inventory.availability_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory.availability_policies FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_policy_read ON inventory.availability_policies FOR SELECT USING (true);
CREATE TRIGGER inventory_policy_immutable BEFORE INSERT OR UPDATE OR DELETE ON inventory.availability_policies
FOR EACH ROW EXECUTE FUNCTION inventory.private_write_guard();
CREATE TRIGGER inventory_policy_no_truncate BEFORE TRUNCATE ON inventory.availability_policies
FOR EACH STATEMENT EXECUTE FUNCTION inventory.private_write_guard();
ALTER TABLE inventory.availability_policies OWNER TO pc_inventory_authority;

-- Column UPDATE grants permit row locks only; no identity-writing function or
-- UPDATE policy is added. Locks serialize membership/organization revocation.
GRANT SELECT ON public.users, public.user_orgs, public.organizations, public.commodity_profile_versions, auction.lots TO pc_inventory_authority;
GRANT UPDATE (version) ON public.user_orgs TO pc_inventory_authority;
GRANT UPDATE ("updatedAt") ON public.users, public.organizations, public.commodity_profile_versions TO pc_inventory_authority;
GRANT UPDATE (updated_at) ON auction.lots TO pc_inventory_authority;
GRANT SELECT, INSERT ON public.audit_events TO pc_inventory_authority;
GRANT INSERT ON public.outbox_entries TO pc_inventory_authority;

-- PostgreSQL plans all applicable TO PUBLIC outbox policies before their
-- principal predicates can reject this owner. Grant only the event columns
-- referenced by the four existing W1 policies. Their FORCE RLS remains active;
-- the memberless owner gains no event mutation or application-facing read API.
GRANT SELECT ("action", "actorRole", "actorUserId", "aggregateVersion", "assignmentId", "auditEventId", "commandId", "correlationId", "organizationId", "outboxEntryId", "requestFingerprint", "tenantId", "toStatus")
  ON public.organization_capability_events TO pc_inventory_authority;
GRANT SELECT ("action", "actorRole", "actorUserId", "aggregateVersion", "auditEventId", "category", "commandId", "correlationId", "entityId", "entityType", "organizationId", "outboxEntryId", "providerId", "requestFingerprint", "resultStatus", "tenantId")
  ON public.provider_registry_events TO pc_inventory_authority;
GRANT SELECT ("action", "actorRole", "actorUserId", "aggregateVersion", "auditEventId", "commandId", "correlationId", "integrationBindingId", "organizationId", "outboxEntryId", "requestFingerprint", "resultStatus", "tenantId")
  ON public.integration_binding_events TO pc_inventory_authority;
GRANT SELECT ("action", "actorRole", "actorUserId", "aggregateId", "aggregateType", "aggregateVersion", "auditEventId", "commandId", "correlationId", "organizationId", "outboxEntryId", "requestFingerprint", "resultStatus", "tenantId")
  ON public.commercial_rule_events TO pc_inventory_authority;

-- The existing outbox producer policies admit named Deal/application roles,
-- not this memberless command owner. Bind its one event shape to the snapshot
-- and audit already inserted by the same transaction; no runtime DML is added.
CREATE POLICY outbox_entries_inventory_insert ON public.outbox_entries
FOR INSERT TO pc_inventory_authority WITH CHECK (
  public.app_rls_context_ready() AND public.app_pc_crop_membership_id() IS NOT NULL
  AND type = 'inventory.position.changed.v1' AND "dealId" IS NULL
  AND "triggeredByUserId" = public.app_identity_user_id()
  AND "idempotencyKey" ~ '^inventory:[0-9a-f]{64}$' AND "runtimeIdempotencyKey" = "idempotencyKey"
  AND payload->>'schema' = 'inventory.command.v1'
  AND payload#>>'{event,type}' = type
  AND payload#>>'{event,tenantId}' = public.app_identity_tenant_id()
  AND payload#>>'{event,organizationId}' = public.app_identity_org_id()
  AND payload#>>'{event,auditId}' = "auditId"
  AND payload#>>'{event,correlationId}' = "correlationId"
  AND payload#>>'{receipt,correlationId}' = "correlationId"
  AND EXISTS (
    SELECT 1 FROM inventory.availability_snapshots s JOIN public.audit_events a ON a.id = outbox_entries."auditId"
    WHERE s.id = outbox_entries.payload#>>'{receipt,snapshotId}'
      AND s.tenant_id = public.app_identity_tenant_id() AND s.organization_id = public.app_identity_org_id()
      AND s.position_id = outbox_entries.payload#>>'{event,aggregateId}'
      AND s.source_state_version::text = outbox_entries.payload#>>'{event,aggregateVersion}'
      AND s.snapshot = outbox_entries.payload#>'{receipt,position}'
      AND s.content_hash = outbox_entries.payload#>>'{receipt,snapshotHash}'
      AND a."tenantId" = s.tenant_id AND a."orgId" = s.organization_id
      AND a."objectType" = 'INVENTORY_POSITION' AND a."objectId" = s.position_id
      AND a."actorUserId" = public.app_identity_user_id() AND a."actorRole" = public.app_identity_role()
      AND a."afterState" = s.snapshot AND a."correlationId" = outbox_entries."correlationId"
      AND a."runtimeIdempotencyKey" = outbox_entries."idempotencyKey"
  )
);

CREATE FUNCTION inventory.require_actor() RETURNS text
LANGUAGE plpgsql VOLATILE SET search_path = pg_catalog, public, inventory AS $function$
DECLARE membership public.user_orgs%ROWTYPE;
BEGIN
  PERFORM 1 FROM public.users u WHERE u.id = public.app_identity_user_id() AND u.status = 'ACTIVE' AND u."deletedAt" IS NULL FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'INVENTORY_ACTOR_INACTIVE'; END IF;
  SELECT m.* INTO membership FROM public.user_orgs m
  WHERE m.id = public.app_pc_crop_membership_id() AND m."userId" = public.app_identity_user_id()
    AND m."organizationId" = public.app_identity_org_id() AND m.status = 'ACTIVE' AND m.is_org_admin
  FOR SHARE;
  IF membership.id IS NULL OR membership.role::text IS DISTINCT FROM public.app_identity_role()
     OR nullif(current_setting('app.current_session_id', true), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'INVENTORY_ORGANIZATION_ADMIN_REQUIRED';
  END IF;
  PERFORM 1 FROM public.organizations o
  WHERE o.id = public.app_identity_org_id() AND o."tenantId" = public.app_identity_tenant_id() AND o.status = 'ACTIVE'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'INVENTORY_ORGANIZATION_INACTIVE'; END IF;
  RETURN membership.id;
END
$function$;

CREATE FUNCTION inventory.quantity_atoms(units jsonb, unit_code text, quantity text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public, inventory AS $function$
DECLARE unit jsonb; base jsonb; q numeric; n numeric; d numeric; top numeric; bottom numeric; atoms numeric; base_precision integer;
BEGIN
  IF quantity IS NULL OR length(quantity) > 32 OR quantity !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$'
     OR jsonb_typeof(units) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_EXACT_QUANTITY_REQUIRED';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(units) u WHERE u->>'code' = unit_code) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_UNIT_UNKNOWN';
  END IF;
  SELECT u INTO unit FROM jsonb_array_elements(units) u WHERE u->>'code' = unit_code;
  IF COALESCE(unit->>'dimension','') NOT IN ('MASS','VOLUME','COUNT') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_UNIT_DIMENSION_INVALID';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(units) u WHERE u->>'dimension' = unit->>'dimension' AND u->'isBase' = 'true'::jsonb) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_BASE_UNIT_INVALID';
  END IF;
  SELECT u INTO base FROM jsonb_array_elements(units) u WHERE u->>'dimension' = unit->>'dimension' AND u->'isBase' = 'true'::jsonb;
  IF COALESCE(unit->>'precision','') !~ '^[0-6]$' OR COALESCE(base->>'precision','') !~ '^[0-6]$'
     OR COALESCE(base->>'code','') = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_UNIT_PRECISION_INVALID';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(jsonb_build_array(
    unit->'numeratorToBase',unit->'denominatorToBase',base->'numeratorToBase',base->'denominatorToBase')) value
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR length(value#>>'{}') > 32
      OR (value#>>'{}') !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_UNIT_RATIO_INVALID';
  END IF;
  q := quantity::numeric;
  n := (unit->>'numeratorToBase')::numeric;
  d := (unit->>'denominatorToBase')::numeric;
  IF n <= 0 OR d <= 0 OR (base->>'numeratorToBase')::numeric <= 0
     OR (base->>'numeratorToBase')::numeric <> (base->>'denominatorToBase')::numeric THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_UNIT_RATIO_INVALID';
  END IF;
  IF q <= 0 OR length(split_part(quantity,'.',2)) > (unit->>'precision')::integer THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_QUANTITY_PRECISION_INVALID';
  END IF;
  base_precision := (base->>'precision')::integer;
  -- Convert decimal ratios to exact integers before division. numeric `/`
  -- rounds repeating fractions; div/mod cannot silently invent an atom.
  top := q * 1000000 * (n * 1000000) * power(10::numeric, base_precision);
  bottom := 1000000 * (d * 1000000);
  IF mod(top,bottom) <> 0 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_QUANTITY_NOT_REPRESENTABLE'; END IF;
  atoms := div(top,bottom);
  IF atoms <= 0 OR atoms > 9223372036854775807 THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_QUANTITY_OVERFLOW'; END IF;
  RETURN jsonb_build_object('atoms',atoms::bigint::text,'baseUnitCode',base->>'code','precision',base_precision,'dimension',unit->>'dimension');
END
$function$;

CREATE FUNCTION inventory.position_view(p inventory.positions) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, inventory AS $function$
SELECT jsonb_build_object(
  'positionId',p.id,'batchId',p.batch_id,'organizationId',p.organization_id,
  'stateVersion',p.state_version::text,'policyId',p.policy_id,'policyVersion','1',
  'declaredQuantity',p.declared_quantity::text,'confirmedQuantity',p.confirmed_quantity::text,
  'availableQuantity',p.available_quantity::text,'reservedQuantity',p.reserved_quantity::text,
  'committedQuantity',p.committed_quantity::text,'shippedQuantity',p.shipped_quantity::text,
  'acceptedQuantity',p.accepted_quantity::text,'blockedQuantity',p.blocked_quantity::text,
  'disputedQuantity',p.disputed_quantity::text,'soldQuantity',p.sold_quantity::text,
  'depletedQuantity',p.depleted_quantity::text,'verificationStatus','DECLARED'
);
$function$;

CREATE FUNCTION inventory.execute_command(command jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, inventory SET row_security = on AS $function$
<<command_state>>
DECLARE
  action text := command->>'action';
  allowed text[] := ARRAY['action','commandId','idempotencyKey','correlationId','expectedVersion','reason'];
  field text; membership_id text; tenant_id text; organization_id text; actor_id text; actor_role text;
  fingerprint text; replay inventory.command_events%ROWTYPE;
  position inventory.positions%ROWTYPE; batch inventory.batches%ROWTYPE; reservation inventory.reservations%ROWTYPE;
  profile public.commodity_profile_versions%ROWTYPE; conversion jsonb; atoms bigint; before_state jsonb; after_state jsonb;
  snapshot_id text := 'inventory-snapshot-' || gen_random_uuid()::text;
  event_id text := 'inventory-event-' || gen_random_uuid()::text;
  audit_id text := 'inventory-audit-' || gen_random_uuid()::text;
  outbox_id text := 'inventory-outbox-' || gen_random_uuid()::text;
  previous_hash text; previous_audit_hash text; event_hash text; audit_hash text; snapshot_hash text;
  outbox_key text; receipt jsonb; audit_material jsonb; occurred_at timestamptz;
BEGIN
  IF jsonb_typeof(command) IS DISTINCT FROM 'object' OR length(command::text) > 8192 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_COMMAND_INVALID';
  END IF;
  CASE action
    WHEN 'DECLARE' THEN allowed := allowed || ARRAY['stockKey','profileVersionId','sourceType','sourceReference','unitCode','quantity'];
    WHEN 'RESERVE' THEN allowed := allowed || ARRAY['positionId','lotId','unitCode','quantity'];
    WHEN 'RELEASE' THEN allowed := allowed || ARRAY['positionId','reservationId'];
    ELSE RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_ACTION_INVALID';
  END CASE;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(command) key WHERE NOT key = ANY(allowed)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_UNKNOWN_FIELD';
  END IF;
  FOREACH field IN ARRAY allowed LOOP
    IF jsonb_typeof(command->field) IS DISTINCT FROM 'string' OR nullif(btrim(command->>field),'') IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_REQUIRED_FIELD';
    END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['commandId','idempotencyKey','correlationId'] LOOP
    IF command->>field !~ '^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_COMMAND_ID_INVALID';
    END IF;
  END LOOP;
  IF command->>'expectedVersion' !~ '^(0|[1-9][0-9]{0,18})$' OR (command->>'expectedVersion')::numeric > 9223372036854775807
     OR length(btrim(command->>'reason')) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_COMMAND_INVALID';
  END IF;
  membership_id := inventory.require_actor();
  tenant_id := public.app_identity_tenant_id(); organization_id := public.app_identity_org_id();
  actor_id := public.app_identity_user_id(); actor_role := public.app_identity_role();
  fingerprint := encode(digest(convert_to(jsonb_build_object('command',command,'actorId',actor_id,'membershipId',membership_id)::text,'UTF8'),'sha256'),'hex');
  -- One lock order for command identities, followed by the physical position.
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('inventory-idempotency',tenant_id,organization_id,command->>'idempotencyKey')::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('inventory-command',tenant_id,organization_id,command->>'commandId')::text,0));
  SELECT e.* INTO replay FROM inventory.command_events e
    WHERE e.tenant_id = command_state.tenant_id AND e.organization_id = command_state.organization_id
      AND (e.idempotency_key = command->>'idempotencyKey' OR e.command_id = command->>'commandId');
  IF replay.id IS NOT NULL THEN
    IF replay.request_hash IS DISTINCT FROM fingerprint THEN RAISE EXCEPTION USING ERRCODE = '23505', MESSAGE = 'INVENTORY_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN replay.receipt || jsonb_build_object('replayed',true);
  END IF;

  IF action = 'DECLARE' THEN
    IF command->>'expectedVersion' <> '0' OR command->>'stockKey' !~ '^[A-Za-z0-9][A-Za-z0-9:_.-]{2,79}$'
       OR length(command->>'sourceReference') > 256 OR command->>'sourceType' NOT IN ('MANUAL','FGIS','1C','ELEVATOR','WAREHOUSE','PARTNER','DOCUMENT_ASSISTED') THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_DECLARATION_INVALID';
    END IF;
    SELECT v.* INTO profile FROM public.commodity_profile_versions v
    WHERE v.id = command->>'profileVersionId' AND v.status = 'EFFECTIVE' AND v."effectiveFrom" <= clock_timestamp()
      AND (v."effectiveTo" IS NULL OR v."effectiveTo" > clock_timestamp()) FOR SHARE;
    IF profile.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_PROFILE_NOT_EFFECTIVE'; END IF;
    conversion := inventory.quantity_atoms(profile.content->'units',command->>'unitCode',command->>'quantity');
    atoms := (conversion->>'atoms')::bigint;
    INSERT INTO inventory.batches(id,tenant_id,organization_id,stock_key,source_type,source_reference,
      profile_version_id,profile_content_hash,unit_rules,base_unit_code,base_unit_precision,dimension,declared_quantity,declared_by_membership_id)
    VALUES ('inventory-batch-'||gen_random_uuid()::text,tenant_id,organization_id,command->>'stockKey',command->>'sourceType',command->>'sourceReference',
      profile.id,profile."contentHash",profile.content->'units',conversion->>'baseUnitCode',(conversion->>'precision')::integer,conversion->>'dimension',atoms,membership_id)
    RETURNING * INTO batch;
    INSERT INTO inventory.positions(id,tenant_id,organization_id,batch_id,state_version,policy_id,declared_quantity,available_quantity)
    VALUES ('inventory-position-'||gen_random_uuid()::text,tenant_id,organization_id,batch.id,1,'DECLARED_CAPACITY_V1',atoms,atoms)
    RETURNING * INTO position;
  ELSE
    SELECT p.* INTO position FROM inventory.positions p WHERE p.id = command->>'positionId'
      AND p.tenant_id = command_state.tenant_id AND p.organization_id = command_state.organization_id FOR UPDATE;
    IF position.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'INVENTORY_POSITION_NOT_FOUND'; END IF;
    IF position.state_version::text <> command->>'expectedVersion' THEN
      RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'INVENTORY_STALE_VERSION';
    END IF;
    before_state := inventory.position_view(position);
    SELECT b.* INTO batch FROM inventory.batches b WHERE b.id = position.batch_id;
    IF action = 'RESERVE' THEN
      -- Legacy lots have no pinned commodity profile. This is an owner-scoped
      -- stock reservation reference; it does not certify lot/profile compatibility
      -- or replace the later mandatory Auction/Deal consumption boundary.
      PERFORM 1 FROM auction.lots l WHERE l.id = command->>'lotId' AND l.tenant_id = command_state.tenant_id
        AND l.seller_org_id = command_state.organization_id AND l.status NOT IN ('CANCELLED','CLOSED') FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'INVENTORY_LOT_NOT_FOUND'; END IF;
      PERFORM 1 FROM public.commodity_profile_versions v WHERE v.id = batch.profile_version_id
        AND v.status = 'EFFECTIVE' AND v."contentHash" = batch.profile_content_hash
        AND v."effectiveFrom" <= clock_timestamp() AND (v."effectiveTo" IS NULL OR v."effectiveTo" > clock_timestamp()) FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_PROFILE_NOT_EFFECTIVE'; END IF;
      conversion := inventory.quantity_atoms(batch.unit_rules,command->>'unitCode',command->>'quantity');
      IF conversion->>'baseUnitCode' <> batch.base_unit_code OR conversion->>'dimension' <> batch.dimension THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_UNIT_DIMENSION_MISMATCH';
      END IF;
      atoms := (conversion->>'atoms')::bigint;
      IF atoms > position.available_quantity THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INVENTORY_CAPACITY_EXCEEDED'; END IF;
      INSERT INTO inventory.reservations(id,tenant_id,organization_id,position_id,lot_id,quantity,status,created_by_membership_id)
      VALUES ('inventory-reservation-'||gen_random_uuid()::text,tenant_id,organization_id,position.id,command->>'lotId',atoms,'RESERVED',membership_id)
      RETURNING * INTO reservation;
      UPDATE inventory.positions p SET reserved_quantity = p.reserved_quantity + atoms, available_quantity = p.available_quantity - atoms,
        state_version = p.state_version + 1, updated_at = clock_timestamp() WHERE p.id = position.id RETURNING p.* INTO position;
    ELSE
      SELECT r.* INTO reservation FROM inventory.reservations r WHERE r.id = command->>'reservationId' AND r.position_id = position.id FOR UPDATE;
      IF reservation.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'INVENTORY_RESERVATION_NOT_FOUND'; END IF;
      IF reservation.status <> 'RESERVED' THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INVENTORY_RESERVATION_ALREADY_RELEASED'; END IF;
      UPDATE inventory.reservations r SET status = 'RELEASED', released_at = clock_timestamp() WHERE r.id = reservation.id RETURNING r.* INTO reservation;
      UPDATE inventory.positions p SET reserved_quantity = p.reserved_quantity - reservation.quantity, available_quantity = p.available_quantity + reservation.quantity,
        state_version = p.state_version + 1, updated_at = clock_timestamp() WHERE p.id = position.id RETURNING p.* INTO position;
    END IF;
  END IF;

  occurred_at := clock_timestamp();
  after_state := inventory.position_view(position) || jsonb_build_object(
    'profileVersionId',batch.profile_version_id,'profileContentHash',batch.profile_content_hash,
    'baseUnitCode',batch.base_unit_code,'baseUnitPrecision',batch.base_unit_precision,'dimension',batch.dimension);
  snapshot_hash := encode(digest(convert_to(after_state::text,'UTF8'),'sha256'),'hex');
  INSERT INTO inventory.availability_snapshots(id,tenant_id,organization_id,position_id,source_state_version,policy_id,policy_version,snapshot,content_hash,created_at)
  VALUES(snapshot_id,tenant_id,organization_id,position.id,position.state_version,position.policy_id,1,after_state,snapshot_hash,occurred_at);
  receipt := jsonb_build_object('commandId',command->>'commandId','idempotencyKey',command->>'idempotencyKey',
    'correlationId',command->>'correlationId','action',action,'position',after_state,'snapshotId',snapshot_id,'snapshotHash',snapshot_hash,
    'reservation',CASE WHEN reservation.id IS NULL THEN NULL ELSE jsonb_build_object('id',reservation.id,'lotId',reservation.lot_id,'quantity',reservation.quantity::text,'status',reservation.status) END,
    'replayed',false,'committedAt',occurred_at,'createsFinancialObligation',false);
  SELECT e.hash INTO previous_hash FROM inventory.command_events e WHERE e.position_id = position.id ORDER BY e.state_version DESC LIMIT 1;
  SELECT a.hash INTO previous_audit_hash FROM public.audit_events a WHERE a."tenantId" = command_state.tenant_id
    AND a."orgId" = command_state.organization_id AND a."objectType" = 'INVENTORY_POSITION' AND a."objectId" = position.id
    ORDER BY a."createdAt" DESC,a.id DESC LIMIT 1;
  outbox_key := 'inventory:'||encode(digest(convert_to(jsonb_build_array(tenant_id,organization_id,command->>'idempotencyKey')::text,'UTF8'),'sha256'),'hex');
  audit_material := jsonb_build_object('id',audit_id,'action','INVENTORY_'||action,'actorUserId',actor_id,'actorRole',actor_role,
    'tenantId',tenant_id,'orgId',organization_id,'objectType','INVENTORY_POSITION','objectId',position.id,
    'beforeState',before_state,'afterState',after_state,'reason',command->>'reason','outcome','SUCCESS',
    'correlationId',command->>'correlationId','requestFingerprint',fingerprint,'prevHash',previous_audit_hash);
  audit_hash := encode(digest(convert_to(audit_material::text,'UTF8'),'sha256'),'hex');
  INSERT INTO public.audit_events(id,action,"actorUserId","actorRole","tenantId","orgId","objectType","objectId",
    "beforeState","afterState",outcome,reason,metadata,"correlationId","runtimeIdempotencyKey",hash,"prevHash","createdAt")
  VALUES(audit_id,'INVENTORY_'||action,actor_id,actor_role,tenant_id,organization_id,'INVENTORY_POSITION',position.id,
    before_state,after_state,'SUCCESS',command->>'reason',jsonb_build_object('schema','inventory.audit.v1','membershipId',membership_id,
      'commandId',command->>'commandId','idempotencyKey',command->>'idempotencyKey','requestFingerprint',fingerprint),
    command->>'correlationId',outbox_key,audit_hash,previous_audit_hash,occurred_at);
  INSERT INTO public.outbox_entries(id,type,payload,status,"triggeredByUserId","idempotencyKey","correlationId","auditId","runtimeIdempotencyKey","maxRetries","nextRetryAt","createdAt")
  VALUES(outbox_id,'inventory.position.changed.v1',jsonb_build_object('schema','inventory.command.v1','requestFingerprint',fingerprint,'receipt',receipt,
    'event',jsonb_build_object('type','inventory.position.changed.v1','tenantId',tenant_id,'organizationId',organization_id,'aggregateId',position.id,
      'aggregateVersion',position.state_version::text,'commandId',command->>'commandId','auditId',audit_id,'correlationId',command->>'correlationId','occurredAt',occurred_at)),
    'PENDING',actor_id,outbox_key,command->>'correlationId',audit_id,outbox_key,5,occurred_at,occurred_at);
  event_hash := encode(digest(convert_to(jsonb_build_object('id',event_id,'requestHash',fingerprint,'receipt',receipt,'previousHash',previous_hash,
    'auditId',audit_id,'auditHash',audit_hash,'outboxId',outbox_id)::text,'UTF8'),'sha256'),'hex');
  INSERT INTO inventory.command_events(id,tenant_id,organization_id,position_id,state_version,command_id,idempotency_key,action,actor_user_id,
    actor_membership_id,request_hash,receipt,previous_hash,hash,snapshot_id,audit_id,outbox_id,created_at)
  VALUES(event_id,tenant_id,organization_id,position.id,position.state_version,command->>'commandId',command->>'idempotencyKey',action,actor_id,
    membership_id,fingerprint,receipt,previous_hash,event_hash,snapshot_id,audit_id,outbox_id,occurred_at);
  RETURN receipt;
END
$function$;

ALTER FUNCTION inventory.execute_command(jsonb) OWNER TO pc_inventory_authority;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA inventory FROM PUBLIC;
REVOKE CREATE ON SCHEMA inventory FROM pc_inventory_authority;
GRANT EXECUTE ON FUNCTION inventory.require_actor(), inventory.quantity_atoms(jsonb,text,text), inventory.position_view(inventory.positions) TO pc_inventory_authority;

DO $inventory_app_grants$
DECLARE runtime_role text;
BEGIN
  FOR runtime_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('pc_deal_runtime','one_deal_app','app_deal','app_runtime','app_deal_api') LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA inventory TO %I',runtime_role);
    EXECUTE format('GRANT SELECT ON ALL TABLES IN SCHEMA inventory TO %I',runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION inventory.execute_command(jsonb), inventory.position_view(inventory.positions) TO %I',runtime_role);
  END LOOP;
END
$inventory_app_grants$;
