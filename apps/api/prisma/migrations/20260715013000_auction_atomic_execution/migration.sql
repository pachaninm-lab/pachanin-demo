-- IR-AUCTION: atomic, restart-safe auction execution authority.
--
-- All writes remain behind SECURITY DEFINER command functions. The application
-- principal receives EXECUTE only; it never receives direct INSERT/UPDATE/DELETE
-- authority on auction tables. Every accepted command persists business state,
-- audit, outbox and a deterministic idempotency receipt in one transaction.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE auction.lots
  ADD COLUMN IF NOT EXISTS seller_user_id text;

ALTER TABLE auction.bids
  ADD COLUMN IF NOT EXISTS placed_by_user_id text,
  ADD COLUMN IF NOT EXISTS command_id text,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS request_hash text;

UPDATE auction.lots lot
SET seller_user_id = (
  SELECT membership."userId"
  FROM public."user_orgs" membership
  JOIN public."users" actor ON actor."id" = membership."userId"
  WHERE membership."organizationId" = lot.seller_org_id
    AND membership."role" = 'FARMER'
    AND actor."status" = 'ACTIVE'
    AND actor."deletedAt" IS NULL
  ORDER BY membership."isDefault" DESC, membership."joinedAt" ASC, membership."id" ASC
  LIMIT 1
)
WHERE lot.seller_user_id IS NULL;

UPDATE auction.bids bid
SET placed_by_user_id = (
  SELECT membership."userId"
  FROM public."user_orgs" membership
  JOIN public."users" actor ON actor."id" = membership."userId"
  WHERE membership."organizationId" = bid.buyer_org_id
    AND membership."role" = 'BUYER'
    AND actor."status" = 'ACTIVE'
    AND actor."deletedAt" IS NULL
  ORDER BY membership."isDefault" DESC, membership."joinedAt" ASC, membership."id" ASC
  LIMIT 1
)
WHERE bid.placed_by_user_id IS NULL;

CREATE TABLE IF NOT EXISTS auction.admissions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  lot_id text NOT NULL,
  participant_org_id text NOT NULL,
  participant_user_id text NOT NULL,
  participant_role text NOT NULL CHECK (participant_role = 'BUYER'),
  status text NOT NULL CHECK (status IN ('ADMITTED', 'BLOCKED')),
  valid_until timestamptz NOT NULL,
  reason text NOT NULL,
  decided_by_actor_id text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT auction_admissions_tenant_lot_key
    UNIQUE (tenant_id, lot_id, participant_org_id, participant_user_id),
  CONSTRAINT auction_admissions_lot_fkey
    FOREIGN KEY (tenant_id, lot_id)
    REFERENCES auction.lots (tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS auction.command_receipts (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('REGISTER_LOT', 'RECORD_ADMISSION', 'PLACE_BID', 'CLOSE_LOT')),
  actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  command_id text NOT NULL,
  request_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT auction_command_receipts_scope_key
    UNIQUE (tenant_id, command_type, actor_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS auction_admissions_lookup_idx
  ON auction.admissions (tenant_id, lot_id, participant_org_id, participant_user_id, status, valid_until);
CREATE INDEX IF NOT EXISTS auction_command_receipts_created_idx
  ON auction.command_receipts (tenant_id, created_at DESC, id);
CREATE UNIQUE INDEX IF NOT EXISTS auction_bids_actor_idempotency_idx
  ON auction.bids (tenant_id, buyer_org_id, placed_by_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS integration_events_auction_basis_unique_idx
  ON public."integration_events" ("externalId")
  WHERE "adapterName" = 'auction'
    AND "eventType" = 'DEAL_BASIS_READY'
    AND "status" = 'CONFIRMED';

CREATE OR REPLACE FUNCTION auction.touch_admission_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auction
AS $function$
BEGIN
  NEW.updated_at := transaction_timestamp();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS auction_admissions_touch_version ON auction.admissions;
CREATE TRIGGER auction_admissions_touch_version
BEFORE UPDATE ON auction.admissions
FOR EACH ROW EXECUTE FUNCTION auction.touch_admission_version();

CREATE OR REPLACE FUNCTION auction.current_actor_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
STABLE
AS $function$
  SELECT
    public.app_rls_context_ready()
    AND EXISTS (
      SELECT 1
      FROM public."users" actor
      JOIN public."user_orgs" membership
        ON membership."userId" = actor."id"
      JOIN public."organizations" organization
        ON organization."id" = membership."organizationId"
      WHERE actor."id" = current_setting('app.current_user_id', true)
        AND actor."status" = 'ACTIVE'
        AND actor."deletedAt" IS NULL
        AND membership."organizationId" = current_setting('app.current_org_id', true)
        AND membership."role" = current_setting('app.current_role', true)
        AND organization."tenantId" = current_setting('app.current_tenant_id', true)
        AND organization."status" IN ('VERIFIED', 'ACTIVE')
        AND organization."kycStatus" = 'APPROVED'
    )
$function$;

CREATE OR REPLACE FUNCTION auction.assert_actor(p_allowed_roles text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
BEGIN
  IF NOT public.app_rls_context_ready() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_TRUSTED_CONTEXT_REQUIRED';
  END IF;
  IF NOT (current_setting('app.current_role', true) = ANY(p_allowed_roles)) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ROLE_DENIED';
  END IF;
  IF NOT auction.current_actor_active() THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ACTIVE_MEMBERSHIP_REQUIRED';
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION auction.replay_command(
  p_command_type text,
  p_idempotency_key text,
  p_request_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  stored auction.command_receipts%ROWTYPE;
BEGIN
  SELECT * INTO stored
  FROM auction.command_receipts receipt
  WHERE receipt.tenant_id = current_setting('app.current_tenant_id', true)
    AND receipt.command_type = p_command_type
    AND receipt.actor_id = current_setting('app.current_user_id', true)
    AND receipt.idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF stored.request_hash <> p_request_hash THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_IDEMPOTENCY_PAYLOAD_MISMATCH';
  END IF;
  RETURN stored.result || jsonb_build_object('duplicate', true);
END
$function$;

CREATE OR REPLACE FUNCTION auction.save_command(
  p_command_type text,
  p_command_id text,
  p_idempotency_key text,
  p_request_hash text,
  p_result jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
BEGIN
  INSERT INTO auction.command_receipts (
    id, tenant_id, command_type, actor_id, idempotency_key,
    command_id, request_hash, result, created_at
  ) VALUES (
    'auction-receipt-' || gen_random_uuid()::text,
    current_setting('app.current_tenant_id', true),
    p_command_type,
    current_setting('app.current_user_id', true),
    p_idempotency_key,
    p_command_id,
    p_request_hash,
    p_result,
    clock_timestamp()
  );
END
$function$;

CREATE OR REPLACE FUNCTION auction.append_audit(
  p_action text,
  p_lot_id text,
  p_before jsonb,
  p_after jsonb,
  p_metadata jsonb,
  p_command_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  audit_id text := 'auction-audit-' || gen_random_uuid()::text;
  previous_hash text;
  audit_material jsonb;
  audit_hash text;
BEGIN
  SELECT event."hash" INTO previous_hash
  FROM public."audit_events" event
  WHERE event."tenantId" = current_setting('app.current_tenant_id', true)
    AND event."objectType" = 'auction_lot'
    AND event."objectId" = p_lot_id
  ORDER BY event."createdAt" DESC, event."id" DESC
  LIMIT 1;

  audit_material := jsonb_build_object(
    'id', audit_id,
    'action', p_action,
    'actorUserId', current_setting('app.current_user_id', true),
    'actorRole', current_setting('app.current_role', true),
    'tenantId', current_setting('app.current_tenant_id', true),
    'orgId', current_setting('app.current_org_id', true),
    'objectType', 'auction_lot',
    'objectId', p_lot_id,
    'beforeState', p_before,
    'afterState', p_after,
    'outcome', 'SUCCESS',
    'metadata', p_metadata,
    'correlationId', p_command_id,
    'prevHash', previous_hash
  );
  audit_hash := encode(digest(convert_to(audit_material::text, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public."audit_events" (
    "id", "action", "actorUserId", "actorRole", "tenantId", "orgId",
    "objectType", "objectId", "beforeState", "afterState", "outcome",
    "metadata", "correlationId", "hash", "prevHash", "createdAt"
  ) VALUES (
    audit_id, p_action, current_setting('app.current_user_id', true),
    current_setting('app.current_role', true), current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true), 'auction_lot', p_lot_id,
    p_before, p_after, 'SUCCESS', p_metadata, p_command_id,
    audit_hash, previous_hash, clock_timestamp()
  );
  RETURN audit_id;
END
$function$;

CREATE OR REPLACE FUNCTION auction.append_outbox(
  p_type text,
  p_payload jsonb,
  p_idempotency_key text,
  p_command_id text,
  p_audit_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  outbox_id text := 'auction-outbox-' || gen_random_uuid()::text;
BEGIN
  INSERT INTO public."outbox_entries" (
    "id", "type", "dealId", "payload", "status", "idempotencyKey",
    "maxRetries", "retryCount", "nextRetryAt", "correlationId",
    "auditId", "createdAt"
  ) VALUES (
    outbox_id, p_type, NULL, p_payload, 'PENDING', p_idempotency_key,
    8, 0, clock_timestamp(), p_command_id, p_audit_id, clock_timestamp()
  );
  RETURN outbox_id;
END
$function$;

CREATE OR REPLACE FUNCTION auction.basis_material(p_basis jsonb)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
IMMUTABLE
AS $function$
  SELECT '{' || array_to_string(ARRAY[
    '"buyerOrgId":' || to_jsonb(p_basis ->> 'buyerOrgId')::text,
    '"buyerUserId":' || to_jsonb(p_basis ->> 'buyerUserId')::text,
    CASE WHEN NULLIF(p_basis ->> 'cropClass', '') IS NOT NULL THEN '"cropClass":' || to_jsonb(p_basis ->> 'cropClass')::text END,
    '"culture":' || to_jsonb(p_basis ->> 'culture')::text,
    '"currency":' || to_jsonb(p_basis ->> 'currency')::text,
    '"dealNumber":' || to_jsonb(p_basis ->> 'dealNumber')::text,
    CASE WHEN NULLIF(p_basis ->> 'incoterms', '') IS NOT NULL THEN '"incoterms":' || to_jsonb(p_basis ->> 'incoterms')::text END,
    '"lotId":' || to_jsonb(p_basis ->> 'lotId')::text,
    '"pricePerTon":' || to_jsonb(p_basis ->> 'pricePerTon')::text,
    CASE WHEN NULLIF(p_basis ->> 'region', '') IS NOT NULL THEN '"region":' || to_jsonb(p_basis ->> 'region')::text END,
    '"sellerOrgId":' || to_jsonb(p_basis ->> 'sellerOrgId')::text,
    '"sellerUserId":' || to_jsonb(p_basis ->> 'sellerUserId')::text,
    '"tenantId":' || to_jsonb(p_basis ->> 'tenantId')::text,
    '"totalKopecks":' || to_jsonb(p_basis ->> 'totalKopecks')::text,
    '"volumeTons":' || to_jsonb(p_basis ->> 'volumeTons')::text,
    '"winnerBidId":' || to_jsonb(p_basis ->> 'winnerBidId')::text
  ], ',') || '}'
$function$;

CREATE OR REPLACE FUNCTION auction.basis_hash(p_basis jsonb)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
IMMUTABLE
AS $function$
  SELECT encode(digest(convert_to(auction.basis_material(p_basis), 'UTF8'), 'sha256'), 'hex')
$function$;

CREATE OR REPLACE FUNCTION auction.lot_actor_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
BEGIN
  IF NEW.status IN ('BIDDING', 'MATCHED', 'IN_DEAL', 'CLOSED') THEN
    IF NEW.seller_user_id IS NULL OR btrim(NEW.seller_user_id) = '' THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'authoritative auction lot requires seller user';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public."users" actor
      JOIN public."user_orgs" membership ON membership."userId" = actor."id"
      JOIN public."organizations" organization ON organization."id" = membership."organizationId"
      WHERE actor."id" = NEW.seller_user_id
        AND actor."status" = 'ACTIVE'
        AND actor."deletedAt" IS NULL
        AND membership."organizationId" = NEW.seller_org_id
        AND membership."role" = 'FARMER'
        AND organization."tenantId" = NEW.tenant_id
        AND organization."status" IN ('VERIFIED', 'ACTIVE')
        AND organization."kycStatus" = 'APPROVED'
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'authoritative auction seller membership is invalid';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS auction_lots_actor_guard ON auction.lots;
CREATE TRIGGER auction_lots_actor_guard
BEFORE INSERT OR UPDATE OF status, seller_user_id, seller_org_id, tenant_id ON auction.lots
FOR EACH ROW EXECUTE FUNCTION auction.lot_actor_guard();

CREATE OR REPLACE FUNCTION auction.register_verified_lot(
  p_title text,
  p_culture text,
  p_grade text,
  p_volume_tons numeric,
  p_start_price_rub_per_ton bigint,
  p_step_price_rub_per_ton bigint,
  p_region text,
  p_address text,
  p_auction_ends_at timestamptz,
  p_source_type text,
  p_source_external_id text,
  p_source_certificate_id text,
  p_auto_extend_enabled boolean,
  p_auto_extend_window_minutes integer,
  p_auto_extend_minutes integer,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot_id text := 'lot-' || gen_random_uuid()::text;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(ARRAY['FARMER']);
  request_hash := encode(digest(convert_to(concat_ws('|', p_title, p_culture, COALESCE(p_grade, ''), p_volume_tons::text,
    p_start_price_rub_per_ton::text, p_step_price_rub_per_ton::text, p_region, COALESCE(p_address, ''),
    p_auction_ends_at::text, p_source_type, p_source_external_id, COALESCE(p_source_certificate_id, ''),
    p_auto_extend_enabled::text, p_auto_extend_window_minutes::text, p_auto_extend_minutes::text, p_command_id), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('REGISTER_LOT', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  IF p_auction_ends_at <= now_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_END_MUST_BE_FUTURE';
  END IF;
  IF p_volume_tons <= 0 OR p_start_price_rub_per_ton < 0 OR p_step_price_rub_per_ton <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
  END IF;
  IF p_source_type NOT IN ('FGIS', 'ERP', 'MANUAL_VERIFIED', 'OTHER') OR NULLIF(btrim(p_source_external_id), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_VERIFIED_SOURCE_REQUIRED';
  END IF;
  IF p_auto_extend_window_minutes NOT BETWEEN 0 AND 120 OR p_auto_extend_minutes NOT BETWEEN 0 AND 120 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_EXTENSION_POLICY_INVALID';
  END IF;

  INSERT INTO auction.lots (
    id, tenant_id, seller_org_id, seller_user_id, title, culture, grade,
    volume_tons, start_price_rub_per_ton, step_price_rub_per_ton,
    region, address, status, auction_ends_at, source_type,
    source_external_id, source_certificate_id, source_verified_at,
    admission_status, auto_extend_enabled, auto_extend_window_minutes,
    auto_extend_minutes, version, created_at, updated_at
  ) VALUES (
    lot_id, current_setting('app.current_tenant_id', true), current_setting('app.current_org_id', true),
    current_setting('app.current_user_id', true), p_title, p_culture, NULLIF(btrim(p_grade), ''),
    p_volume_tons, p_start_price_rub_per_ton, p_step_price_rub_per_ton,
    p_region, NULLIF(btrim(p_address), ''), 'BIDDING', p_auction_ends_at, p_source_type,
    p_source_external_id, NULLIF(btrim(p_source_certificate_id), ''), now_at,
    'ADMITTED', p_auto_extend_enabled, p_auto_extend_window_minutes,
    p_auto_extend_minutes, 1, now_at, now_at
  );

  audit_id := auction.append_audit(
    'auction.lot.register', lot_id, NULL,
    jsonb_build_object('status', 'BIDDING', 'version', '1', 'auctionEndsAt', p_auction_ends_at),
    jsonb_build_object('commandId', p_command_id, 'sourceType', p_source_type, 'sourceExternalId', p_source_external_id),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.lot.registered',
    jsonb_build_object('lotId', lot_id, 'tenantId', current_setting('app.current_tenant_id', true), 'status', 'BIDDING'),
    'auction-lot-event:' || current_setting('app.current_tenant_id', true) || ':' || p_idempotency_key,
    p_command_id, audit_id
  );
  result := jsonb_build_object(
    'lotId', lot_id, 'status', 'BIDDING', 'version', '1', 'auctionEndsAt', p_auction_ends_at,
    'auditId', audit_id, 'outboxId', outbox_id, 'duplicate', false
  );
  PERFORM auction.save_command('REGISTER_LOT', p_command_id, p_idempotency_key, request_hash, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION auction.record_admission(
  p_lot_id text,
  p_buyer_org_id text,
  p_buyer_user_id text,
  p_status text,
  p_valid_until timestamptz,
  p_reason text,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot auction.lots%ROWTYPE;
  admission auction.admissions%ROWTYPE;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(ARRAY['ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER']);
  request_hash := encode(digest(convert_to(concat_ws('|', p_lot_id, p_buyer_org_id, p_buyer_user_id,
    p_status, p_valid_until::text, p_reason, p_expected_version::text, p_command_id), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('RECORD_ADMISSION', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true) AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND'; END IF;
  IF lot.version <> p_expected_version THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION'; END IF;
  IF lot.status NOT IN ('OPEN', 'BIDDING') OR now_at >= lot.auction_ends_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_OPEN';
  END IF;
  IF p_status NOT IN ('ADMITTED', 'BLOCKED') OR NULLIF(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ADMISSION_DECISION_INVALID';
  END IF;
  IF p_status = 'ADMITTED' AND p_valid_until <= now_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ADMISSION_EXPIRY_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public."organizations" organization
    JOIN public."user_orgs" membership ON membership."organizationId" = organization."id"
    JOIN public."users" actor ON actor."id" = membership."userId"
    WHERE organization."id" = p_buyer_org_id
      AND organization."tenantId" = lot.tenant_id
      AND organization."status" IN ('VERIFIED', 'ACTIVE')
      AND organization."kycStatus" = 'APPROVED'
      AND membership."userId" = p_buyer_user_id
      AND membership."role" = 'BUYER'
      AND actor."status" = 'ACTIVE'
      AND actor."deletedAt" IS NULL
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BUYER_AUTHORITY_INVALID';
  END IF;

  INSERT INTO auction.admissions (
    id, tenant_id, lot_id, participant_org_id, participant_user_id,
    participant_role, status, valid_until, reason, decided_by_actor_id,
    version, created_at, updated_at
  ) VALUES (
    'admission-' || gen_random_uuid()::text, lot.tenant_id, lot.id,
    p_buyer_org_id, p_buyer_user_id, 'BUYER', p_status, p_valid_until,
    p_reason, current_setting('app.current_user_id', true), 1, now_at, now_at
  )
  ON CONFLICT (tenant_id, lot_id, participant_org_id, participant_user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    valid_until = EXCLUDED.valid_until,
    reason = EXCLUDED.reason,
    decided_by_actor_id = EXCLUDED.decided_by_actor_id
  RETURNING * INTO admission;

  UPDATE auction.lots SET status = status WHERE tenant_id = lot.tenant_id AND id = lot.id
  RETURNING * INTO lot;

  audit_id := auction.append_audit(
    'auction.admission.record', lot.id,
    NULL,
    jsonb_build_object('buyerOrgId', p_buyer_org_id, 'buyerUserId', p_buyer_user_id, 'status', admission.status, 'validUntil', admission.valid_until),
    jsonb_build_object('commandId', p_command_id, 'reason', p_reason, 'admissionVersion', admission.version::text),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.admission.recorded',
    jsonb_build_object('lotId', lot.id, 'buyerOrgId', p_buyer_org_id, 'buyerUserId', p_buyer_user_id, 'status', admission.status),
    'auction-admission-event:' || lot.tenant_id || ':' || p_idempotency_key,
    p_command_id, audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id, 'lotVersion', lot.version::text, 'admissionId', admission.id,
    'admissionVersion', admission.version::text, 'status', admission.status,
    'validUntil', admission.valid_until, 'auditId', audit_id, 'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command('RECORD_ADMISSION', p_command_id, p_idempotency_key, request_hash, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION auction.place_bid(
  p_lot_id text,
  p_amount_rub_per_ton bigint,
  p_volume_tons numeric,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot auction.lots%ROWTYPE;
  current_top bigint;
  bid_id text := 'bid-' || gen_random_uuid()::text;
  leader_id text;
  leader_amount bigint;
  new_end timestamptz;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(ARRAY['BUYER']);
  request_hash := encode(digest(convert_to(concat_ws('|', p_lot_id, p_amount_rub_per_ton::text,
    p_volume_tons::text, p_expected_version::text, p_command_id), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('PLACE_BID', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true) AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND'; END IF;
  IF lot.version <> p_expected_version THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION'; END IF;
  IF lot.status <> 'BIDDING' OR lot.admission_status <> 'ADMITTED' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_OPEN';
  END IF;
  IF now_at >= lot.auction_ends_at THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_CUTOFF_REACHED'; END IF;
  IF lot.seller_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELLER_AUTHORITY_MISSING'; END IF;
  IF p_amount_rub_per_ton <= 0 OR p_volume_tons <= 0 OR p_volume_tons > lot.volume_tons THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_TERMS_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM auction.admissions admission
    WHERE admission.tenant_id = lot.tenant_id
      AND admission.lot_id = lot.id
      AND admission.participant_org_id = current_setting('app.current_org_id', true)
      AND admission.participant_user_id = current_setting('app.current_user_id', true)
      AND admission.participant_role = 'BUYER'
      AND admission.status = 'ADMITTED'
      AND admission.valid_until > now_at
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ADMISSION_REQUIRED';
  END IF;

  SELECT max(amount_rub_per_ton) INTO current_top
  FROM auction.bids
  WHERE tenant_id = lot.tenant_id AND lot_id = lot.id
    AND status IN ('PLACED', 'LEADING', 'OUTBID');
  IF current_top IS NULL THEN
    IF p_amount_rub_per_ton < lot.start_price_rub_per_ton THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_BELOW_START';
    END IF;
  ELSE
    IF p_amount_rub_per_ton < current_top THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_BELOW_CURRENT';
    END IF;
    IF p_amount_rub_per_ton > current_top AND p_amount_rub_per_ton - current_top < lot.step_price_rub_per_ton THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_STEP_INVALID';
    END IF;
  END IF;

  INSERT INTO auction.bids (
    id, tenant_id, lot_id, buyer_org_id, placed_by_user_id, buyer_name,
    amount_rub_per_ton, volume_tons, status, placed_at, version,
    command_id, idempotency_key, request_hash, created_at, updated_at
  ) VALUES (
    bid_id, lot.tenant_id, lot.id, current_setting('app.current_org_id', true),
    current_setting('app.current_user_id', true), current_setting('app.current_org_id', true),
    p_amount_rub_per_ton, p_volume_tons, 'PLACED', now_at, 1,
    p_command_id, p_idempotency_key, request_hash, now_at, now_at
  );

  WITH ranked AS (
    SELECT id, row_number() OVER (ORDER BY amount_rub_per_ton DESC, placed_at ASC, id ASC) AS position
    FROM auction.bids
    WHERE tenant_id = lot.tenant_id AND lot_id = lot.id
      AND status IN ('PLACED', 'LEADING', 'OUTBID')
  )
  UPDATE auction.bids bid
  SET status = CASE WHEN ranked.position = 1 THEN 'LEADING' ELSE 'OUTBID' END
  FROM ranked
  WHERE bid.id = ranked.id AND bid.tenant_id = lot.tenant_id AND bid.lot_id = lot.id;

  new_end := lot.auction_ends_at;
  IF lot.auto_extend_enabled
     AND lot.auto_extend_window_minutes > 0
     AND lot.auto_extend_minutes > 0
     AND lot.auction_ends_at - now_at <= make_interval(mins => lot.auto_extend_window_minutes)
  THEN
    new_end := lot.auction_ends_at + make_interval(mins => lot.auto_extend_minutes);
  END IF;

  UPDATE auction.lots
  SET auction_ends_at = new_end, status = status
  WHERE tenant_id = lot.tenant_id AND id = lot.id
  RETURNING * INTO lot;

  SELECT id, amount_rub_per_ton INTO leader_id, leader_amount
  FROM auction.bids
  WHERE tenant_id = lot.tenant_id AND lot_id = lot.id AND status = 'LEADING'
  ORDER BY amount_rub_per_ton DESC, placed_at ASC, id ASC
  LIMIT 1;

  audit_id := auction.append_audit(
    'auction.bid.place', lot.id,
    jsonb_build_object('version', p_expected_version::text, 'leaderAmountRubPerTon', current_top),
    jsonb_build_object('version', lot.version::text, 'bidId', bid_id, 'leaderId', leader_id, 'leaderAmountRubPerTon', leader_amount, 'auctionEndsAt', lot.auction_ends_at),
    jsonb_build_object('commandId', p_command_id, 'buyerOrgId', current_setting('app.current_org_id', true), 'amountRubPerTon', p_amount_rub_per_ton::text, 'volumeTons', p_volume_tons::text),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.bid.placed',
    jsonb_build_object('lotId', lot.id, 'bidId', bid_id, 'leaderId', leader_id, 'lotVersion', lot.version::text),
    'auction-bid-event:' || lot.tenant_id || ':' || p_idempotency_key,
    p_command_id, audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id, 'lotVersion', lot.version::text, 'bidId', bid_id,
    'bidStatus', CASE WHEN bid_id = leader_id THEN 'LEADING' ELSE 'OUTBID' END,
    'leaderId', leader_id, 'leaderAmountRubPerTon', leader_amount::text,
    'auctionEndsAt', lot.auction_ends_at, 'auditId', audit_id, 'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command('PLACE_BID', p_command_id, p_idempotency_key, request_hash, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION auction.close_lot(
  p_lot_id text,
  p_expected_version bigint,
  p_command_id text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  request_hash text;
  replay jsonb;
  lot auction.lots%ROWTYPE;
  winner auction.bids%ROWTYPE;
  award_id text := 'award-' || gen_random_uuid()::text;
  integration_event_id text := 'auction-basis-' || gen_random_uuid()::text;
  basis_external_id text;
  deal_number text;
  total_kopecks bigint;
  basis jsonb;
  source_hash text;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(ARRAY['ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER']);
  request_hash := encode(digest(convert_to(concat_ws('|', p_lot_id, p_expected_version::text, p_command_id), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('CLOSE_LOT', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true) AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND'; END IF;
  IF lot.version <> p_expected_version THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION'; END IF;
  IF lot.status <> 'BIDDING' THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ALREADY_CLOSED'; END IF;
  IF now_at < lot.auction_ends_at THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_ENDED'; END IF;
  IF lot.seller_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELLER_AUTHORITY_MISSING'; END IF;

  SELECT bid.* INTO winner
  FROM auction.bids bid
  JOIN auction.admissions admission
    ON admission.tenant_id = bid.tenant_id
   AND admission.lot_id = bid.lot_id
   AND admission.participant_org_id = bid.buyer_org_id
   AND admission.participant_user_id = bid.placed_by_user_id
   AND admission.status = 'ADMITTED'
   AND admission.valid_until >= bid.placed_at
  WHERE bid.tenant_id = lot.tenant_id AND bid.lot_id = lot.id
    AND bid.status IN ('PLACED', 'LEADING', 'OUTBID')
  ORDER BY bid.amount_rub_per_ton DESC, bid.placed_at ASC, bid.id ASC
  LIMIT 1
  FOR UPDATE OF bid;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NO_ELIGIBLE_BIDS'; END IF;
  IF winner.placed_by_user_id IS NULL THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BUYER_AUTHORITY_MISSING'; END IF;

  UPDATE auction.bids
  SET status = CASE WHEN id = winner.id THEN 'WINNING' ELSE 'OUTBID' END
  WHERE tenant_id = lot.tenant_id AND lot_id = lot.id
    AND status IN ('PLACED', 'LEADING', 'OUTBID');

  UPDATE auction.lots SET status = 'MATCHED'
  WHERE tenant_id = lot.tenant_id AND id = lot.id
  RETURNING * INTO lot;

  INSERT INTO auction.awards (
    id, tenant_id, lot_id, winning_bid_id, deal_id, status,
    awarded_by_actor_id, awarded_at, version, created_at, updated_at
  ) VALUES (
    award_id, lot.tenant_id, lot.id, winner.id, NULL, 'AWARDED',
    current_setting('app.current_user_id', true), now_at, 1, now_at, now_at
  );

  basis_external_id := lot.id || ':' || winner.id;
  deal_number := 'TP-AUC-' || upper(substr(encode(digest(convert_to(basis_external_id, 'UTF8'), 'sha256'), 'hex'), 1, 16));
  total_kopecks := round(winner.amount_rub_per_ton::numeric * winner.volume_tons * 100)::bigint;
  basis := jsonb_build_object(
    'dealNumber', deal_number,
    'tenantId', lot.tenant_id,
    'lotId', lot.id,
    'winnerBidId', winner.id,
    'sellerOrgId', lot.seller_org_id,
    'buyerOrgId', winner.buyer_org_id,
    'sellerUserId', lot.seller_user_id,
    'buyerUserId', winner.placed_by_user_id,
    'culture', lot.culture,
    'cropClass', lot.grade,
    'region', lot.region,
    'incoterms', NULL,
    'volumeTons', winner.volume_tons::text,
    'pricePerTon', winner.amount_rub_per_ton::text,
    'totalKopecks', total_kopecks::text,
    'currency', 'RUB'
  );
  source_hash := auction.basis_hash(basis);
  basis := basis || jsonb_build_object('sourceHash', source_hash);

  INSERT INTO public."integration_events" (
    "id", "adapterName", "direction", "eventType", "externalId", "dealId",
    "requestPayload", "responsePayload", "status", "idempotencyKey", "createdAt"
  ) VALUES (
    integration_event_id, 'auction', 'OUTBOUND', 'DEAL_BASIS_READY', basis_external_id, NULL,
    basis, basis, 'CONFIRMED', 'auction-basis:' || lot.tenant_id || ':' || lot.id, now_at
  );

  audit_id := auction.append_audit(
    'auction.close', lot.id,
    jsonb_build_object('status', 'BIDDING', 'version', p_expected_version::text),
    jsonb_build_object('status', lot.status, 'version', lot.version::text, 'winnerBidId', winner.id, 'awardId', award_id, 'basisEventId', integration_event_id),
    jsonb_build_object('commandId', p_command_id, 'basisHash', source_hash, 'totalKopecks', total_kopecks::text),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.deal-basis.ready',
    jsonb_build_object('lotId', lot.id, 'winnerBidId', winner.id, 'awardId', award_id, 'integrationEventId', integration_event_id, 'basis', basis),
    'auction-basis-outbox:' || lot.tenant_id || ':' || lot.id,
    p_command_id, audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id, 'lotStatus', lot.status, 'lotVersion', lot.version::text,
    'winnerBidId', winner.id, 'awardId', award_id, 'integrationEventId', integration_event_id,
    'basisExternalId', basis_external_id, 'basisHash', source_hash,
    'auditId', audit_id, 'outboxId', outbox_id, 'duplicate', false
  );
  PERFORM auction.save_command('CLOSE_LOT', p_command_id, p_idempotency_key, request_hash, result);
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION auction.bind_deal(
  p_lot_id text,
  p_winning_bid_id text,
  p_deal_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  award auction.awards%ROWTYPE;
  lot auction.lots%ROWTYPE;
  deal_tenant text;
  deal_lot text;
  deal_winner text;
BEGIN
  PERFORM auction.assert_actor(ARRAY['FARMER']);
  SELECT * INTO award
  FROM auction.awards
  WHERE tenant_id = current_setting('app.current_tenant_id', true)
    AND lot_id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND OR award.winning_bid_id <> p_winning_bid_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_AWARD_NOT_FOUND';
  END IF;
  IF award.status = 'DEAL_CREATED' THEN
    IF award.deal_id <> p_deal_id THEN RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_AWARD_ALREADY_BOUND'; END IF;
    RETURN jsonb_build_object('awardId', award.id, 'dealId', award.deal_id, 'duplicate', true);
  END IF;

  SELECT deal."tenantId", deal."lotId", deal."sourceLotId"
    INTO deal_tenant, deal_lot, deal_winner
  FROM public."deals" deal
  WHERE deal."id" = p_deal_id
  FOR KEY SHARE;
  IF NOT FOUND
     OR deal_tenant IS DISTINCT FROM award.tenant_id
     OR deal_lot IS DISTINCT FROM award.lot_id
     OR deal_winner IS DISTINCT FROM award.winning_bid_id
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_DEAL_BASIS_MISMATCH';
  END IF;

  UPDATE auction.awards
  SET status = 'DEAL_CREATED', deal_id = p_deal_id
  WHERE id = award.id
  RETURNING * INTO award;
  UPDATE auction.lots SET status = 'IN_DEAL'
  WHERE tenant_id = award.tenant_id AND id = award.lot_id
  RETURNING * INTO lot;
  RETURN jsonb_build_object('awardId', award.id, 'dealId', award.deal_id, 'lotStatus', lot.status, 'duplicate', false);
END
$function$;

-- Correct the original award guard: Deal.lotId identifies the lot while
-- Deal.sourceLotId identifies the winning bid.
CREATE OR REPLACE FUNCTION auction.award_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
DECLARE
  lot_record auction.lots%ROWTYPE;
  bid_status text;
  deal_tenant_id text;
  deal_lot_id text;
  deal_winning_bid_id text;
BEGIN
  SELECT * INTO lot_record
  FROM auction.lots
  WHERE tenant_id = NEW.tenant_id AND id = NEW.lot_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'auction lot does not exist in the same tenant' USING ERRCODE = '23503'; END IF;

  SELECT status INTO bid_status
  FROM auction.bids
  WHERE tenant_id = NEW.tenant_id AND lot_id = NEW.lot_id AND id = NEW.winning_bid_id
  FOR KEY SHARE;
  IF NOT FOUND OR bid_status NOT IN ('ACCEPTED', 'WINNING') THEN
    RAISE EXCEPTION 'award requires an accepted winning bid from the same tenant and lot' USING ERRCODE = '23514';
  END IF;
  IF lot_record.status NOT IN ('MATCHED', 'IN_DEAL', 'CLOSED') THEN
    RAISE EXCEPTION 'award requires a matched authoritative lot' USING ERRCODE = '23514';
  END IF;

  IF NEW.deal_id IS NOT NULL THEN
    SELECT deal."tenantId", deal."lotId", deal."sourceLotId"
      INTO deal_tenant_id, deal_lot_id, deal_winning_bid_id
    FROM public."deals" deal
    WHERE deal."id" = NEW.deal_id
    FOR KEY SHARE;
    IF NOT FOUND
       OR deal_tenant_id IS DISTINCT FROM NEW.tenant_id
       OR deal_lot_id IS DISTINCT FROM NEW.lot_id
       OR deal_winning_bid_id IS DISTINCT FROM NEW.winning_bid_id
    THEN
      RAISE EXCEPTION 'server-issued Deal must match auction tenant, lot and winning bid' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

ALTER TABLE auction.admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction.admissions FORCE ROW LEVEL SECURITY;
ALTER TABLE auction.command_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction.command_receipts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auction_admissions_tenant_select ON auction.admissions;
CREATE POLICY auction_admissions_tenant_select ON auction.admissions FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR participant_org_id = current_setting('app.current_org_id', true)
    OR EXISTS (
      SELECT 1 FROM auction.lots lot
      WHERE lot.tenant_id = admissions.tenant_id
        AND lot.id = admissions.lot_id
        AND lot.seller_org_id = current_setting('app.current_org_id', true)
    )
  )
);

DROP POLICY IF EXISTS auction_command_receipts_actor_select ON auction.command_receipts;
CREATE POLICY auction_command_receipts_actor_select ON auction.command_receipts FOR SELECT USING (
  public.app_rls_context_ready()
  AND tenant_id = current_setting('app.current_tenant_id', true)
  AND (actor_id = current_setting('app.current_user_id', true) OR public.app_rls_privileged())
);

REVOKE ALL ON TABLE auction.admissions FROM PUBLIC;
REVOKE ALL ON TABLE auction.command_receipts FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.touch_admission_version() FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.current_actor_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.assert_actor(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.replay_command(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.save_command(text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.append_audit(text, text, jsonb, jsonb, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.append_outbox(text, jsonb, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.basis_material(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.basis_hash(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.lot_actor_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.register_verified_lot(text, text, text, numeric, bigint, bigint, text, text, timestamptz, text, text, text, boolean, integer, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.record_admission(text, text, text, text, timestamptz, text, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.place_bid(text, bigint, numeric, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.close_lot(text, bigint, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auction.bind_deal(text, text, text) FROM PUBLIC;

DO $auction_atomic_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT USAGE ON SCHEMA auction TO app_deal;
    GRANT SELECT ON auction.admissions, auction.command_receipts TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.register_verified_lot(text, text, text, numeric, bigint, bigint, text, text, timestamptz, text, text, text, boolean, integer, integer, text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.record_admission(text, text, text, text, timestamptz, text, bigint, text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.place_bid(text, bigint, numeric, bigint, text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.close_lot(text, bigint, text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.bind_deal(text, text, text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.basis_material(jsonb), auction.basis_hash(jsonb) TO app_deal;
  END IF;
END
$auction_atomic_grants$;
