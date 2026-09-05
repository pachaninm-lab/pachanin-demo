-- W2-B: declared Auction lots consume the existing Inventory reservation command.
-- The binding is an immutable stock claim, not independent source verification.
-- Bound stock release/consumption awaits the separately accepted Deal lifecycle.
BEGIN;
DO $authority$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pc_inventory_authority'
    AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls
    AND NOT rolcreatedb AND NOT rolcreaterole)
    OR EXISTS (SELECT 1 FROM pg_auth_members WHERE roleid = 'pc_inventory_authority'::regrole
      OR member = 'pc_inventory_authority'::regrole) THEN
    RAISE EXCEPTION 'INVENTORY_AUTHORITY_MEMBERSHIP_DENIED';
  END IF;
END
$authority$;
GRANT CREATE ON SCHEMA auction TO pc_inventory_authority;

ALTER TABLE auction.lots ADD COLUMN inventory_binding_id text;
CREATE TABLE auction.inventory_bindings (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  lot_id text NOT NULL UNIQUE,
  inventory_position_id text NOT NULL,
  reservation_id text NOT NULL UNIQUE REFERENCES inventory.reservations(id) ON DELETE RESTRICT,
  profile_version_id text NOT NULL REFERENCES public.commodity_profile_versions(id) ON DELETE RESTRICT,
  profile_content_hash text NOT NULL CHECK (profile_content_hash ~ '^[0-9a-f]{64}$'),
  canonical_code text NOT NULL,
  quantity_atoms bigint NOT NULL CHECK (quantity_atoms > 0),
  base_unit_code text NOT NULL,
  base_unit_precision integer NOT NULL CHECK (base_unit_precision BETWEEN 0 AND 6),
  inventory_state_version bigint NOT NULL CHECK (inventory_state_version > 1),
  inventory_command_id text NOT NULL,
  registration_command_id text NOT NULL,
  inventory_event_id text NOT NULL UNIQUE REFERENCES inventory.command_events(id) ON DELETE RESTRICT,
  auction_audit_id text NOT NULL UNIQUE REFERENCES public.audit_events(id) ON DELETE RESTRICT,
  auction_outbox_id text NOT NULL UNIQUE REFERENCES public.outbox_entries(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (tenant_id, id),
  FOREIGN KEY (tenant_id, lot_id) REFERENCES auction.lots(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, organization_id, inventory_position_id)
    REFERENCES inventory.positions(tenant_id, organization_id, id) ON DELETE RESTRICT
);
ALTER TABLE auction.lots ADD CONSTRAINT auction_lot_inventory_binding_fk
  FOREIGN KEY (tenant_id, inventory_binding_id) REFERENCES auction.inventory_bindings(tenant_id, id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE UNIQUE INDEX auction_lot_inventory_binding_unique ON auction.lots(inventory_binding_id)
  WHERE inventory_binding_id IS NOT NULL;

-- Mirror the existing Auction reader roles while checking current database
-- membership. This predicate exposes only a boolean, never a stock position.
CREATE FUNCTION auction.inventory_binding_visible(lot auction.lots) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, auction
SET row_security = on AS $function$
  SELECT public.app_rls_context_ready() AND (lot).tenant_id = public.app_identity_tenant_id()
    AND EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.user_orgs m ON m."userId" = u.id
      JOIN public.organizations o ON o.id = m."organizationId"
      WHERE u.id = public.app_identity_user_id() AND u.status = 'ACTIVE' AND u."deletedAt" IS NULL
        AND m.id = public.app_pc_crop_membership_id() AND m.status = 'ACTIVE'
        AND m."organizationId" = public.app_identity_org_id() AND m.role::text = public.app_identity_role()
        AND o."tenantId" = (lot).tenant_id AND o.status IN ('ACTIVE','VERIFIED')
        AND CASE m.role::text
          WHEN 'FARMER' THEN (lot).seller_org_id = o.id
          WHEN 'BUYER' THEN (lot).status IN ('OPEN','BIDDING','MATCHED','IN_DEAL')
          ELSE m.role::text IN ('SUPPORT_MANAGER','ADMIN','COMPLIANCE_OFFICER','EXECUTIVE')
        END
    );
$function$;

ALTER TABLE auction.inventory_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction.inventory_bindings FORCE ROW LEVEL SECURITY;
CREATE POLICY auction_inventory_binding_visible ON auction.inventory_bindings FOR SELECT USING (
  public.app_rls_context_ready() AND tenant_id = public.app_identity_tenant_id()
  AND EXISTS (SELECT 1 FROM auction.lots l WHERE l.id = inventory_bindings.lot_id
    AND l.tenant_id = inventory_bindings.tenant_id AND auction.inventory_binding_visible(l))
);
CREATE POLICY auction_inventory_binding_insert ON auction.inventory_bindings FOR INSERT
TO pc_inventory_authority WITH CHECK (
  tenant_id = public.app_identity_tenant_id() AND organization_id = public.app_identity_org_id()
  AND public.app_pc_crop_membership_id() IS NOT NULL
);
CREATE TRIGGER auction_inventory_binding_immutable BEFORE INSERT OR UPDATE OR DELETE
  ON auction.inventory_bindings FOR EACH ROW EXECUTE FUNCTION inventory.private_write_guard();
CREATE TRIGGER auction_inventory_binding_no_truncate BEFORE TRUNCATE
  ON auction.inventory_bindings FOR EACH STATEMENT EXECUTE FUNCTION inventory.private_write_guard();
REVOKE ALL ON auction.inventory_bindings FROM PUBLIC;
ALTER TABLE auction.inventory_bindings OWNER TO pc_inventory_authority;

GRANT INSERT ON auction.lots TO pc_inventory_authority;
GRANT SELECT ON auction.command_receipts TO pc_inventory_authority;
-- FOR SHARE also evaluates UPDATE USING policies. Organization administrators
-- can be FARMERs; the older global-ADMIN write policies do not admit their
-- locks. These named owner-only policies permit the existing column-granted
-- row locks and reject every row update through WITH CHECK (false).
CREATE POLICY auction_inventory_membership_lock ON public.user_orgs FOR UPDATE TO pc_inventory_authority
USING (id = public.app_pc_crop_membership_id() AND "userId" = public.app_identity_user_id()
  AND "organizationId" = public.app_identity_org_id() AND status = 'ACTIVE' AND is_org_admin
  AND role::text = public.app_identity_role()) WITH CHECK (false);
CREATE POLICY auction_inventory_organization_lock ON public.organizations FOR UPDATE TO pc_inventory_authority
USING (id = public.app_identity_org_id() AND "tenantId" = public.app_identity_tenant_id()
  AND status = 'ACTIVE' AND public.app_pc_crop_membership_id() IS NOT NULL) WITH CHECK (false);
CREATE POLICY auction_inventory_profile_lock ON public.commodity_profile_versions FOR UPDATE TO pc_inventory_authority
USING (status = 'EFFECTIVE' AND "effectiveFrom" <= clock_timestamp()
  AND ("effectiveTo" IS NULL OR "effectiveTo" > clock_timestamp())
  AND public.app_pc_crop_membership_id() IS NOT NULL) WITH CHECK (false);
CREATE POLICY auction_inventory_lot_insert ON auction.lots FOR INSERT TO pc_inventory_authority
WITH CHECK (tenant_id = public.app_identity_tenant_id() AND seller_org_id = public.app_identity_org_id()
  AND seller_user_id = public.app_identity_user_id() AND inventory_binding_id IS NOT NULL
  AND public.app_pc_crop_membership_id() IS NOT NULL);

-- Preserve the historical source check for unbound rows. New declared rows are
-- admitted through the immutable binding and never acquire a verified timestamp.
ALTER TABLE auction.lots DROP CONSTRAINT auction_lots_live_source_check;
ALTER TABLE auction.lots ADD CONSTRAINT auction_lots_live_source_check CHECK (
  status NOT IN ('BIDDING','MATCHED','IN_DEAL','CLOSED') OR (
    admission_status = 'ADMITTED' AND NULLIF(btrim(source_external_id),'') IS NOT NULL
    AND ((inventory_binding_id IS NULL AND source_verified_at IS NOT NULL)
      OR (inventory_binding_id IS NOT NULL AND source_type = 'OTHER'
        AND source_verified_at IS NULL AND source_certificate_id IS NULL))
  )
);

CREATE FUNCTION auction.inventory_lot_write_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, auction AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user = 'pc_inventory_authority' THEN
      IF NEW.inventory_binding_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUCTION_INVENTORY_BINDING_REQUIRED';
      END IF;
    ELSIF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = current_user AND rolsuper) THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUCTION_INVENTORY_BINDING_REQUIRED';
    END IF;
  ELSIF OLD.inventory_binding_id IS DISTINCT FROM NEW.inventory_binding_id
    OR (OLD.inventory_binding_id IS NOT NULL AND
      ROW(OLD.tenant_id,OLD.seller_org_id,OLD.seller_user_id,OLD.culture,OLD.volume_tons,
        OLD.source_type,OLD.source_external_id,OLD.source_certificate_id,OLD.source_verified_at)
      IS DISTINCT FROM
      ROW(NEW.tenant_id,NEW.seller_org_id,NEW.seller_user_id,NEW.culture,NEW.volume_tons,
        NEW.source_type,NEW.source_external_id,NEW.source_certificate_id,NEW.source_verified_at)) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUCTION_INVENTORY_BINDING_IMMUTABLE';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER auction_inventory_lot_write BEFORE INSERT OR UPDATE ON auction.lots
  FOR EACH ROW EXECUTE FUNCTION auction.inventory_lot_write_guard();

CREATE FUNCTION auction.inventory_reservation_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, auction, inventory AS $function$
DECLARE binding_id text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT l.inventory_binding_id INTO binding_id FROM auction.lots l
    WHERE l.tenant_id = NEW.tenant_id AND l.id = NEW.lot_id;
    IF binding_id IS NOT NULL AND (
      EXISTS (SELECT 1 FROM auction.inventory_bindings b WHERE b.id = binding_id)
      OR EXISTS (SELECT 1 FROM inventory.reservations r WHERE r.tenant_id = NEW.tenant_id AND r.lot_id = NEW.lot_id)
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AUCTION_BOUND_RESERVATION_REUSE_DENIED';
    END IF;
    RETURN NEW;
  END IF;
  SELECT l.inventory_binding_id INTO binding_id FROM auction.lots l
  WHERE l.tenant_id = OLD.tenant_id AND l.id = OLD.lot_id;
  IF binding_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AUCTION_BOUND_RESERVATION_RELEASE_DENIED';
  END IF;
  -- Legacy Inventory release remains the existing command's responsibility.
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER auction_bound_reservation_guard BEFORE INSERT OR UPDATE OR DELETE ON inventory.reservations
  FOR EACH ROW EXECUTE FUNCTION auction.inventory_reservation_guard();

CREATE FUNCTION auction.inventory_registration_evidence_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auction, inventory
SET row_security = on AS $function$
BEGIN
  IF NEW.inventory_binding_id IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auction.inventory_bindings b
    JOIN inventory.reservations r ON r.id = b.reservation_id
    JOIN inventory.command_events e ON e.id = b.inventory_event_id
    JOIN inventory.availability_snapshots s ON s.id = e.snapshot_id
    JOIN auction.command_receipts c ON c.tenant_id = b.tenant_id
      AND c.command_type = 'REGISTER_LOT' AND c.command_id = b.registration_command_id
      AND c.actor_id = NEW.seller_user_id
    WHERE b.id = NEW.inventory_binding_id AND b.tenant_id = NEW.tenant_id
      AND b.organization_id = NEW.seller_org_id AND b.lot_id = NEW.id
      AND b.canonical_code = NEW.culture
      AND r.tenant_id = b.tenant_id AND r.organization_id = b.organization_id
      AND r.lot_id = b.lot_id AND r.position_id = b.inventory_position_id
      AND r.quantity = b.quantity_atoms AND r.status = 'RESERVED'
      AND e.tenant_id = b.tenant_id AND e.organization_id = b.organization_id
      AND e.position_id = b.inventory_position_id AND e.state_version = b.inventory_state_version
      AND e.command_id = b.inventory_command_id AND e.action = 'RESERVE'
      AND e.actor_user_id = NEW.seller_user_id
      AND e.receipt#>>'{reservation,id}' = b.reservation_id
      AND e.receipt#>>'{reservation,lotId}' = b.lot_id
      AND e.receipt#>>'{reservation,quantity}' = b.quantity_atoms::text
      AND s.position_id = b.inventory_position_id AND s.source_state_version = b.inventory_state_version
      AND s.snapshot->>'profileVersionId' = b.profile_version_id
      AND s.snapshot->>'profileContentHash' = b.profile_content_hash
      AND s.snapshot->>'baseUnitCode' = b.base_unit_code
      AND s.snapshot->>'baseUnitPrecision' = b.base_unit_precision::text
      AND c.result->>'lotId' = b.lot_id AND c.result#>>'{binding,id}' = b.id
      AND c.result->>'auditId' = b.auction_audit_id AND c.result->>'outboxId' = b.auction_outbox_id
      AND c.result->>'verificationStatus' = 'DECLARED' AND c.result->>'tradePermission' = 'PUBLIC_ALLOWED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AUCTION_INVENTORY_BINDING_REQUIRED';
  END IF;
  RETURN NULL;
END
$function$;
CREATE CONSTRAINT TRIGGER auction_inventory_registration_evidence AFTER INSERT ON auction.lots
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION auction.inventory_registration_evidence_guard();

-- Retain the existing bid authority, admitting declared stock only through the
-- exact immutable reservation. Legacy lots retain their original source checks.
CREATE OR REPLACE FUNCTION auction.bid_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auction AS $function$
DECLARE lot_record auction.lots%ROWTYPE;
BEGIN
  SELECT * INTO lot_record FROM auction.lots WHERE tenant_id = NEW.tenant_id AND id = NEW.lot_id FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction lot does not exist in the same tenant' USING ERRCODE = '23503'; END IF;
  IF lot_record.status <> 'BIDDING' OR lot_record.admission_status <> 'ADMITTED'
    OR NULLIF(btrim(lot_record.source_external_id),'') IS NULL THEN
    RAISE EXCEPTION 'auction lot is not open for authoritative bidding' USING ERRCODE = '23514';
  END IF;
  IF lot_record.inventory_binding_id IS NULL THEN
    IF lot_record.source_verified_at IS NULL THEN
      RAISE EXCEPTION 'auction lot is not open for authoritative bidding' USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM auction.inventory_bindings b JOIN inventory.reservations r ON r.id = b.reservation_id
    WHERE b.id = lot_record.inventory_binding_id AND b.tenant_id = lot_record.tenant_id
      AND b.organization_id = lot_record.seller_org_id AND b.lot_id = lot_record.id
      AND r.tenant_id = b.tenant_id AND r.organization_id = b.organization_id
      AND r.position_id = b.inventory_position_id AND r.lot_id = b.lot_id
      AND r.quantity = b.quantity_atoms AND r.status = 'RESERVED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'AUCTION_INVENTORY_BINDING_REQUIRED';
  END IF;
  IF NEW.volume_tons > lot_record.volume_tons THEN
    RAISE EXCEPTION 'bid volume exceeds authoritative lot volume' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

-- Revocation alone would be insufficient if a later runtime grant returned:
-- the historical definer is a migration principal and can insert legacy rows.
CREATE OR REPLACE FUNCTION auction.register_verified_lot(
  p_title text,p_culture text,p_grade text,p_volume_tons numeric,
  p_start_price_kopecks_per_ton bigint,p_step_price_kopecks_per_ton bigint,
  p_region text,p_address text,p_auction_ends_at timestamptz,p_source_type text,
  p_source_external_id text,p_source_certificate_id text,p_auto_extend_enabled boolean,
  p_auto_extend_window_minutes integer,p_auto_extend_minutes integer,p_command_id text,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auction AS $function$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'AUCTION_INVENTORY_BINDING_REQUIRED';
END
$function$;

CREATE FUNCTION auction.register_inventory_lot(command jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public, auction, inventory SET row_security = on AS $function$
DECLARE
  required_fields text[] := ARRAY['title','culture','volumeTons','startPriceKopecksPerTon','stepPriceKopecksPerTon',
    'region','auctionEndsAt','sourceType','sourceExternalId','idempotencyKey','commandId','inventoryPositionId',
    'inventoryExpectedVersion','profileVersionId','unitCode','quantity','correlationId','reason'];
  optional_fields text[] := ARRAY['grade','address','sourceCertificateId','autoExtendEnabled','autoExtendWindowMinutes','autoExtendMinutes'];
  field text; normalized jsonb; membership_id text; tenant text; organization text; actor text; request_hash text; replay jsonb;
  lot_id text := 'lot-'||gen_random_uuid()::text; binding_id text := 'auction-inventory-binding-'||gen_random_uuid()::text;
  position inventory.positions%ROWTYPE; batch inventory.batches%ROWTYPE; profile public.commodity_profile_versions%ROWTYPE;
  conversion jsonb; tons_conversion jsonb; ton_code text; ton_atoms bigint; atoms bigint;
  ends_at timestamptz; start_price bigint; step_price bigint; volume_tons numeric;
  auto_extend boolean; extend_window integer; extend_minutes integer;
  stock_identity text; stock_command_id text; stock_idempotency_key text; stock_receipt jsonb; stock_event_id text;
  binding_view jsonb; result jsonb; audit_id text; outbox_id text; occurred_at timestamptz := clock_timestamp();
BEGIN
  IF jsonb_typeof(command) IS DISTINCT FROM 'object' OR length(command::text) > 8192
    OR EXISTS (SELECT 1 FROM jsonb_object_keys(command) k WHERE NOT k = ANY(required_fields||optional_fields)) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
  END IF;
  FOREACH field IN ARRAY required_fields LOOP
    IF jsonb_typeof(command->field) IS DISTINCT FROM 'string' OR NULLIF(btrim(command->>field),'') IS NULL
      OR length(command->>field) > 500 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
    END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['grade','address','sourceCertificateId'] LOOP
    IF command ? field AND command->field <> 'null'::jsonb AND
      (jsonb_typeof(command->field) IS DISTINCT FROM 'string' OR length(command->>field) > 500) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
    END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['commandId','idempotencyKey','correlationId'] LOOP
    IF command->>field !~ '^[A-Za-z0-9][A-Za-z0-9:_.-]{2,239}$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
    END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['startPriceKopecksPerTon','stepPriceKopecksPerTon','inventoryExpectedVersion'] LOOP
    IF command->>field !~ '^(0|[1-9][0-9]{0,18})$' OR (command->>field)::numeric > 9223372036854775807 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
    END IF;
  END LOOP;
  IF command->>'volumeTons' !~ '^(0|[1-9][0-9]{0,13})(\.[0-9]{1,6})?$'
    OR length(btrim(command->>'reason')) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
  END IF;
  IF command->>'sourceType' = 'FGIS' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'FGIS_VERIFIED_LOT_PATH_NOT_READY';
  END IF;
  IF command->>'sourceType' NOT IN ('ERP','MANUAL_VERIFIED','OTHER') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
  END IF;
  IF command ? 'autoExtendEnabled' AND jsonb_typeof(command->'autoExtendEnabled') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_EXTENSION_POLICY_INVALID';
  END IF;
  FOREACH field IN ARRAY ARRAY['autoExtendWindowMinutes','autoExtendMinutes'] LOOP
    IF command ? field AND (jsonb_typeof(command->field) IS DISTINCT FROM 'number'
      OR command->>field !~ '^(0|[1-9][0-9]{0,2})$' OR (command->>field)::integer > 120) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_EXTENSION_POLICY_INVALID';
    END IF;
  END LOOP;
  ends_at := (command->>'auctionEndsAt')::timestamptz;
  IF NOT isfinite(ends_at) THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_END_MUST_BE_FUTURE'; END IF;
  volume_tons := (command->>'volumeTons')::numeric;
  start_price := (command->>'startPriceKopecksPerTon')::bigint;
  step_price := (command->>'stepPriceKopecksPerTon')::bigint;
  IF volume_tons <= 0 OR step_price <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
  END IF;
  auto_extend := COALESCE((command->>'autoExtendEnabled')::boolean,true);
  extend_window := COALESCE((command->>'autoExtendWindowMinutes')::integer,10);
  extend_minutes := COALESCE((command->>'autoExtendMinutes')::integer,10);
  normalized := command || jsonb_build_object('grade',NULLIF(btrim(command->>'grade'),''),
    'address',NULLIF(btrim(command->>'address'),''),'sourceCertificateId',NULLIF(btrim(command->>'sourceCertificateId'),''),
    'autoExtendEnabled',auto_extend,'autoExtendWindowMinutes',extend_window,'autoExtendMinutes',extend_minutes,
    'auctionEndsAt',to_char(ends_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));

  -- Current user, membership and organization rows stay locked through replay
  -- and mutation. Auction adds the established FARMER/KYC/AML admission checks.
  membership_id := inventory.require_actor();
  PERFORM auction.assert_actor(ARRAY['FARMER']);
  tenant := public.app_identity_tenant_id(); organization := public.app_identity_org_id(); actor := public.app_identity_user_id();
  request_hash := encode(digest(convert_to(jsonb_build_object('command',normalized-'commandId',
    'tenantId',tenant,'organizationId',organization,'actorId',actor,'membershipId',membership_id)::text,'UTF8'),'sha256'),'hex');
  replay := auction.replay_command('REGISTER_LOT',command->>'idempotencyKey',request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;
  IF ends_at <= clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_END_MUST_BE_FUTURE'; END IF;

  stock_identity := encode(digest(convert_to(jsonb_build_array(tenant,organization,actor,command->>'idempotencyKey')::text,'UTF8'),'sha256'),'hex');
  stock_command_id := 'auction-stock-command:'||stock_identity;
  stock_idempotency_key := 'auction-stock-idem:'||stock_identity;
  -- Match Inventory's advisory-lock order before taking its physical position.
  -- The nested command then reacquires the same locks without an inversion.
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('inventory-idempotency',tenant,organization,stock_idempotency_key)::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(jsonb_build_array('inventory-command',tenant,organization,stock_command_id)::text,0));
  SELECT p.* INTO position FROM inventory.positions p WHERE p.id = command->>'inventoryPositionId'
    AND p.tenant_id = tenant AND p.organization_id = organization FOR UPDATE;
  IF position.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'INVENTORY_POSITION_NOT_FOUND'; END IF;
  IF position.state_version::text <> command->>'inventoryExpectedVersion' THEN
    RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'INVENTORY_STALE_VERSION';
  END IF;
  SELECT b.* INTO batch FROM inventory.batches b WHERE b.id = position.batch_id;
  IF batch.profile_version_id IS DISTINCT FROM command->>'profileVersionId' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_PROFILE_MISMATCH';
  END IF;
  SELECT v.* INTO profile FROM public.commodity_profile_versions v
  WHERE v.id = batch.profile_version_id AND v.status = 'EFFECTIVE' AND v."contentHash" = batch.profile_content_hash
    AND v."effectiveFrom" <= clock_timestamp() AND (v."effectiveTo" IS NULL OR v."effectiveTo" > clock_timestamp()) FOR SHARE;
  IF profile.id IS NULL THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVENTORY_PROFILE_NOT_EFFECTIVE'; END IF;
  IF profile.content->>'canonicalCode' IS DISTINCT FROM command->>'culture' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_PROFILE_MISMATCH';
  END IF;
  conversion := inventory.quantity_atoms(batch.unit_rules,command->>'unitCode',command->>'quantity');
  IF batch.dimension <> 'MASS' OR conversion->>'dimension' <> 'MASS'
    OR conversion->>'baseUnitCode' <> batch.base_unit_code OR (conversion->>'precision')::integer <> batch.base_unit_precision THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_QUANTITY_MISMATCH';
  END IF;
  atoms := (conversion->>'atoms')::bigint;
  -- TNE is the profile registry's tonne code; TON is an accepted existing
  -- Inventory alias. Both must agree if a pinned profile defines both.
  FOR ton_code IN SELECT u->>'code' FROM jsonb_array_elements(batch.unit_rules) u WHERE u->>'code' IN ('TNE','TON') LOOP
    tons_conversion := inventory.quantity_atoms(batch.unit_rules,ton_code,command->>'volumeTons');
    IF tons_conversion->>'dimension' <> 'MASS' OR tons_conversion->>'baseUnitCode' <> batch.base_unit_code
      OR (ton_atoms IS NOT NULL AND ton_atoms <> (tons_conversion->>'atoms')::bigint) THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_QUANTITY_MISMATCH';
    END IF;
    ton_atoms := (tons_conversion->>'atoms')::bigint;
  END LOOP;
  IF ton_atoms IS NULL OR ton_atoms <> atoms THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_QUANTITY_MISMATCH';
  END IF;
  IF atoms > position.available_quantity THEN RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'INVENTORY_CAPACITY_EXCEEDED'; END IF;
  -- Position/profile locks may have waited past the caller's auction deadline.
  IF ends_at <= clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'AUCTION_END_MUST_BE_FUTURE'; END IF;

  INSERT INTO auction.lots(id,tenant_id,seller_org_id,seller_user_id,title,culture,grade,volume_tons,
    start_price_rub_per_ton,step_price_rub_per_ton,start_price_kopecks_per_ton,step_price_kopecks_per_ton,
    region,address,status,auction_ends_at,source_type,source_external_id,source_certificate_id,source_verified_at,
    admission_status,auto_extend_enabled,auto_extend_window_minutes,auto_extend_minutes,version,created_at,updated_at,inventory_binding_id)
  VALUES(lot_id,tenant,organization,actor,btrim(command->>'title'),profile.content->>'canonicalCode',normalized->>'grade',volume_tons,
    start_price/100,step_price/100,start_price,step_price,btrim(command->>'region'),normalized->>'address','BIDDING',ends_at,
    'OTHER','inventory:'||batch.id,NULL,NULL,'ADMITTED',auto_extend,extend_window,extend_minutes,1,occurred_at,occurred_at,binding_id);
  stock_receipt := inventory.execute_command(jsonb_build_object('action','RESERVE','commandId',stock_command_id,
    'idempotencyKey',stock_idempotency_key,'correlationId',command->>'correlationId','expectedVersion',command->>'inventoryExpectedVersion',
    'reason',command->>'reason','positionId',position.id,'lotId',lot_id,'unitCode',command->>'unitCode','quantity',command->>'quantity'));
  SELECT e.id INTO stock_event_id FROM inventory.command_events e WHERE e.tenant_id = tenant AND e.organization_id = organization
    AND e.command_id = stock_command_id AND e.action = 'RESERVE';
  binding_view := jsonb_build_object('id',binding_id,'positionId',position.id,'reservationId',stock_receipt#>>'{reservation,id}',
    'profileVersionId',batch.profile_version_id,'profileContentHash',batch.profile_content_hash,'canonicalCode',profile.content->>'canonicalCode',
    'quantityAtoms',atoms::text,'baseUnitCode',batch.base_unit_code,'baseUnitPrecision',batch.base_unit_precision,
    'inventoryStateVersion',stock_receipt#>>'{position,stateVersion}');
  audit_id := auction.append_audit('auction.lot.register',lot_id,NULL,
    jsonb_build_object('status','BIDDING','version','1','binding',binding_view,'verificationStatus','DECLARED','tradePermission','PUBLIC_ALLOWED'),
    jsonb_build_object('commandId',command->>'commandId','correlationId',command->>'correlationId','reason',command->>'reason',
      'inventoryCommandId',stock_command_id,'inventoryEventId',stock_event_id,'requestFingerprint',request_hash,
      'submittedSourceClaim',jsonb_build_object('sourceType',command->>'sourceType','sourceExternalId',command->>'sourceExternalId',
        'sourceCertificateId',normalized->>'sourceCertificateId')),command->>'commandId');
  outbox_id := auction.append_outbox('auction.lot.registered',jsonb_build_object('lotId',lot_id,'tenantId',tenant,
    'organizationId',organization,'status','BIDDING','binding',binding_view,'verificationStatus','DECLARED','tradePermission','PUBLIC_ALLOWED'),
    'auction-inventory-event:'||stock_identity,command->>'commandId',audit_id);
  INSERT INTO auction.inventory_bindings(id,tenant_id,organization_id,lot_id,inventory_position_id,reservation_id,
    profile_version_id,profile_content_hash,canonical_code,quantity_atoms,base_unit_code,base_unit_precision,inventory_state_version,
    inventory_command_id,registration_command_id,inventory_event_id,auction_audit_id,auction_outbox_id)
  VALUES(binding_id,tenant,organization,lot_id,position.id,stock_receipt#>>'{reservation,id}',batch.profile_version_id,
    batch.profile_content_hash,profile.content->>'canonicalCode',atoms,batch.base_unit_code,batch.base_unit_precision,
    (stock_receipt#>>'{position,stateVersion}')::bigint,stock_command_id,command->>'commandId',stock_event_id,audit_id,outbox_id);
  result := jsonb_build_object('commandId',command->>'commandId','lotId',lot_id,'status','BIDDING','version','1','auctionEndsAt',ends_at,
    'startPriceKopecksPerTon',start_price::text,'stepPriceKopecksPerTon',step_price::text,
    'requestFingerprint',request_hash,'auditId',audit_id,'outboxId',outbox_id,'duplicate',false,
    'binding',binding_view,'bindingState','INVENTORY_BOUND','verificationStatus','DECLARED','tradePermission','PUBLIC_ALLOWED',
    'independentVerification',NULL);
  PERFORM auction.save_command('REGISTER_LOT',command->>'commandId',command->>'idempotencyKey',request_hash,result);
  RETURN result;
END
$function$;

-- Only the existing memberless authority owns the new executable boundary.
ALTER FUNCTION auction.register_inventory_lot(jsonb) OWNER TO pc_inventory_authority;
ALTER FUNCTION auction.inventory_lot_write_guard() OWNER TO pc_inventory_authority;
ALTER FUNCTION auction.inventory_reservation_guard() OWNER TO pc_inventory_authority;
ALTER FUNCTION auction.inventory_registration_evidence_guard() OWNER TO pc_inventory_authority;
ALTER FUNCTION auction.inventory_binding_visible(auction.lots) OWNER TO pc_inventory_authority;
REVOKE CREATE ON SCHEMA auction FROM pc_inventory_authority;
GRANT EXECUTE ON FUNCTION auction.assert_actor(text[]),auction.replay_command(text,text,text),
  auction.save_command(text,text,text,text,jsonb),auction.append_audit(text,text,jsonb,jsonb,jsonb,text),
  auction.append_outbox(text,jsonb,text,text,text) TO pc_inventory_authority;
REVOKE ALL ON FUNCTION auction.register_inventory_lot(jsonb),auction.inventory_lot_write_guard(),
  auction.inventory_reservation_guard(),auction.inventory_registration_evidence_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.inventory_binding_visible(auction.lots) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auction.inventory_binding_visible(auction.lots) TO PUBLIC;
REVOKE ALL ON FUNCTION auction.register_verified_lot(text,text,text,numeric,bigint,bigint,text,text,timestamptz,text,text,text,boolean,integer,integer,text,text) FROM PUBLIC;
DO $runtime_grants$
DECLARE runtime_role text;
BEGIN
  FOR runtime_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('pc_deal_runtime','one_deal_app','app_deal','app_runtime','app_deal_api') LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auction TO %I',runtime_role);
    EXECUTE format('GRANT SELECT ON auction.inventory_bindings TO %I',runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION auction.register_inventory_lot(jsonb) TO %I',runtime_role);
    EXECUTE format('REVOKE ALL ON FUNCTION auction.register_verified_lot(text,text,text,numeric,bigint,bigint,text,text,timestamptz,text,text,text,boolean,integer,integer,text,text) FROM %I',runtime_role);
  END LOOP;
END
$runtime_grants$;
COMMIT;
