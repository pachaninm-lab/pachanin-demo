-- IR-AUCTION follow-up: canonical minor units, actor risk checks, payload-only
-- fingerprints and advisory locking. The previous migration created the bounded
-- command surface; this migration replaces its public command functions before
-- the surface is accepted or merged.

ALTER TABLE auction.lots
  ADD COLUMN IF NOT EXISTS start_price_kopecks_per_ton bigint,
  ADD COLUMN IF NOT EXISTS step_price_kopecks_per_ton bigint;

ALTER TABLE auction.bids
  ADD COLUMN IF NOT EXISTS amount_kopecks_per_ton bigint;

UPDATE auction.lots
SET
  start_price_kopecks_per_ton = start_price_rub_per_ton * 100,
  step_price_kopecks_per_ton = step_price_rub_per_ton * 100
WHERE start_price_kopecks_per_ton IS NULL
   OR step_price_kopecks_per_ton IS NULL;

UPDATE auction.bids
SET amount_kopecks_per_ton = amount_rub_per_ton * 100
WHERE amount_kopecks_per_ton IS NULL;

ALTER TABLE auction.lots
  ALTER COLUMN start_price_kopecks_per_ton SET NOT NULL,
  ALTER COLUMN step_price_kopecks_per_ton SET NOT NULL,
  ADD CONSTRAINT auction_lots_start_price_kopecks_check
    CHECK (start_price_kopecks_per_ton >= 0),
  ADD CONSTRAINT auction_lots_step_price_kopecks_check
    CHECK (step_price_kopecks_per_ton > 0);

ALTER TABLE auction.bids
  ALTER COLUMN amount_kopecks_per_ton SET NOT NULL,
  ADD CONSTRAINT auction_bids_amount_kopecks_check
    CHECK (amount_kopecks_per_ton > 0);

DROP INDEX IF EXISTS auction.auction_bids_lot_kopecks_idx;
CREATE INDEX auction_bids_lot_kopecks_idx
  ON auction.bids (
    tenant_id,
    lot_id,
    amount_kopecks_per_ton DESC,
    placed_at ASC,
    id ASC
  );

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
        AND organization."amlStatus" = 'CLEAR'
        AND organization."sanctionHit" = false
    )
$function$;

CREATE OR REPLACE FUNCTION auction.lock_lot(p_lot_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
BEGIN
  IF NULLIF(btrim(p_lot_id), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_ID_REQUIRED';
  END IF;
  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      current_setting('app.current_tenant_id', true) || ':auction:' || p_lot_id,
      2615
    )
  );
END
$function$;

CREATE OR REPLACE FUNCTION auction.register_verified_lot(
  p_title text,
  p_culture text,
  p_grade text,
  p_volume_tons numeric,
  p_start_price_kopecks_per_ton bigint,
  p_step_price_kopecks_per_ton bigint,
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
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_title, p_culture, COALESCE(p_grade, ''), p_volume_tons::text,
    p_start_price_kopecks_per_ton::text, p_step_price_kopecks_per_ton::text,
    p_region, COALESCE(p_address, ''), p_auction_ends_at::text, p_source_type,
    p_source_external_id, COALESCE(p_source_certificate_id, ''),
    p_auto_extend_enabled::text, p_auto_extend_window_minutes::text,
    p_auto_extend_minutes::text
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('REGISTER_LOT', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  IF p_auction_ends_at <= now_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_END_MUST_BE_FUTURE';
  END IF;
  IF p_volume_tons <= 0
     OR p_start_price_kopecks_per_ton < 0
     OR p_step_price_kopecks_per_ton <= 0
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_TERMS_INVALID';
  END IF;
  IF p_source_type NOT IN ('FGIS', 'ERP', 'MANUAL_VERIFIED', 'OTHER')
     OR NULLIF(btrim(p_source_external_id), '') IS NULL
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_VERIFIED_SOURCE_REQUIRED';
  END IF;
  IF p_auto_extend_window_minutes NOT BETWEEN 0 AND 120
     OR p_auto_extend_minutes NOT BETWEEN 0 AND 120
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_EXTENSION_POLICY_INVALID';
  END IF;

  INSERT INTO auction.lots (
    id, tenant_id, seller_org_id, seller_user_id, title, culture, grade,
    volume_tons, start_price_rub_per_ton, step_price_rub_per_ton,
    start_price_kopecks_per_ton, step_price_kopecks_per_ton,
    region, address, status, auction_ends_at, source_type,
    source_external_id, source_certificate_id, source_verified_at,
    admission_status, auto_extend_enabled, auto_extend_window_minutes,
    auto_extend_minutes, version, created_at, updated_at
  ) VALUES (
    lot_id,
    current_setting('app.current_tenant_id', true),
    current_setting('app.current_org_id', true),
    current_setting('app.current_user_id', true),
    p_title,
    p_culture,
    NULLIF(btrim(p_grade), ''),
    p_volume_tons,
    p_start_price_kopecks_per_ton / 100,
    p_step_price_kopecks_per_ton / 100,
    p_start_price_kopecks_per_ton,
    p_step_price_kopecks_per_ton,
    p_region,
    NULLIF(btrim(p_address), ''),
    'BIDDING',
    p_auction_ends_at,
    p_source_type,
    p_source_external_id,
    NULLIF(btrim(p_source_certificate_id), ''),
    now_at,
    'ADMITTED',
    p_auto_extend_enabled,
    p_auto_extend_window_minutes,
    p_auto_extend_minutes,
    1,
    now_at,
    now_at
  );

  audit_id := auction.append_audit(
    'auction.lot.register',
    lot_id,
    NULL,
    jsonb_build_object(
      'status', 'BIDDING',
      'version', '1',
      'auctionEndsAt', p_auction_ends_at,
      'startPriceKopecksPerTon', p_start_price_kopecks_per_ton::text,
      'stepPriceKopecksPerTon', p_step_price_kopecks_per_ton::text
    ),
    jsonb_build_object(
      'commandId', p_command_id,
      'sourceType', p_source_type,
      'sourceExternalId', p_source_external_id,
      'requestFingerprint', request_hash
    ),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.lot.registered',
    jsonb_build_object(
      'lotId', lot_id,
      'tenantId', current_setting('app.current_tenant_id', true),
      'status', 'BIDDING'
    ),
    'auction-lot-event:' || current_setting('app.current_tenant_id', true) || ':' || p_idempotency_key,
    p_command_id,
    audit_id
  );
  result := jsonb_build_object(
    'lotId', lot_id,
    'status', 'BIDDING',
    'version', '1',
    'auctionEndsAt', p_auction_ends_at,
    'startPriceKopecksPerTon', p_start_price_kopecks_per_ton::text,
    'stepPriceKopecksPerTon', p_step_price_kopecks_per_ton::text,
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'REGISTER_LOT', p_command_id, p_idempotency_key, request_hash, result
  );
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
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_lot_id, p_buyer_org_id, p_buyer_user_id, p_status,
    p_valid_until::text, p_reason, p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('RECORD_ADMISSION', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM auction.lock_lot(p_lot_id);
  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true)
    AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;
  IF lot.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION';
  END IF;
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
    JOIN public."user_orgs" membership
      ON membership."organizationId" = organization."id"
    JOIN public."users" actor
      ON actor."id" = membership."userId"
    WHERE organization."id" = p_buyer_org_id
      AND organization."tenantId" = lot.tenant_id
      AND organization."status" IN ('VERIFIED', 'ACTIVE')
      AND organization."kycStatus" = 'APPROVED'
      AND organization."amlStatus" = 'CLEAR'
      AND organization."sanctionHit" = false
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
    'admission-' || gen_random_uuid()::text,
    lot.tenant_id,
    lot.id,
    p_buyer_org_id,
    p_buyer_user_id,
    'BUYER',
    p_status,
    p_valid_until,
    p_reason,
    current_setting('app.current_user_id', true),
    1,
    now_at,
    now_at
  )
  ON CONFLICT (tenant_id, lot_id, participant_org_id, participant_user_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    valid_until = EXCLUDED.valid_until,
    reason = EXCLUDED.reason,
    decided_by_actor_id = EXCLUDED.decided_by_actor_id
  RETURNING * INTO admission;

  UPDATE auction.lots
  SET status = status
  WHERE tenant_id = lot.tenant_id AND id = lot.id
  RETURNING * INTO lot;

  audit_id := auction.append_audit(
    'auction.admission.record',
    lot.id,
    NULL,
    jsonb_build_object(
      'buyerOrgId', p_buyer_org_id,
      'buyerUserId', p_buyer_user_id,
      'status', admission.status,
      'validUntil', admission.valid_until
    ),
    jsonb_build_object(
      'commandId', p_command_id,
      'reason', p_reason,
      'requestFingerprint', request_hash,
      'admissionVersion', admission.version::text
    ),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.admission.recorded',
    jsonb_build_object(
      'lotId', lot.id,
      'buyerOrgId', p_buyer_org_id,
      'buyerUserId', p_buyer_user_id,
      'status', admission.status
    ),
    'auction-admission-event:' || lot.tenant_id || ':' || p_idempotency_key,
    p_command_id,
    audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id,
    'lotVersion', lot.version::text,
    'admissionId', admission.id,
    'admissionVersion', admission.version::text,
    'status', admission.status,
    'validUntil', admission.valid_until,
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'RECORD_ADMISSION', p_command_id, p_idempotency_key, request_hash, result
  );
  RETURN result;
END
$function$;

CREATE OR REPLACE FUNCTION auction.place_bid(
  p_lot_id text,
  p_amount_kopecks_per_ton bigint,
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
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_lot_id, p_amount_kopecks_per_ton::text, p_volume_tons::text,
    p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('PLACE_BID', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM auction.lock_lot(p_lot_id);
  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true)
    AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;
  IF lot.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION';
  END IF;
  IF lot.status <> 'BIDDING' OR lot.admission_status <> 'ADMITTED' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_OPEN';
  END IF;
  IF now_at >= lot.auction_ends_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_CUTOFF_REACHED';
  END IF;
  IF lot.seller_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELLER_AUTHORITY_MISSING';
  END IF;
  IF p_amount_kopecks_per_ton <= 0
     OR p_volume_tons <= 0
     OR p_volume_tons > lot.volume_tons
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_TERMS_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM auction.admissions admission
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

  SELECT max(amount_kopecks_per_ton) INTO current_top
  FROM auction.bids
  WHERE tenant_id = lot.tenant_id
    AND lot_id = lot.id
    AND status IN ('PLACED', 'LEADING', 'OUTBID');
  IF current_top IS NULL THEN
    IF p_amount_kopecks_per_ton < lot.start_price_kopecks_per_ton THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_BELOW_START';
    END IF;
  ELSE
    IF p_amount_kopecks_per_ton < current_top THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_BELOW_CURRENT';
    END IF;
    IF p_amount_kopecks_per_ton > current_top
       AND p_amount_kopecks_per_ton - current_top < lot.step_price_kopecks_per_ton
    THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BID_STEP_INVALID';
    END IF;
  END IF;

  INSERT INTO auction.bids (
    id, tenant_id, lot_id, buyer_org_id, placed_by_user_id, buyer_name,
    amount_rub_per_ton, amount_kopecks_per_ton, volume_tons, status,
    placed_at, version, command_id, idempotency_key, request_hash,
    created_at, updated_at
  ) VALUES (
    bid_id,
    lot.tenant_id,
    lot.id,
    current_setting('app.current_org_id', true),
    current_setting('app.current_user_id', true),
    current_setting('app.current_org_id', true),
    p_amount_kopecks_per_ton / 100,
    p_amount_kopecks_per_ton,
    p_volume_tons,
    'PLACED',
    now_at,
    1,
    p_command_id,
    p_idempotency_key,
    request_hash,
    now_at,
    now_at
  );

  WITH ranked AS (
    SELECT
      id,
      row_number() OVER (
        ORDER BY amount_kopecks_per_ton DESC, placed_at ASC, id ASC
      ) AS position
    FROM auction.bids
    WHERE tenant_id = lot.tenant_id
      AND lot_id = lot.id
      AND status IN ('PLACED', 'LEADING', 'OUTBID')
  )
  UPDATE auction.bids bid
  SET status = CASE WHEN ranked.position = 1 THEN 'LEADING' ELSE 'OUTBID' END
  FROM ranked
  WHERE bid.id = ranked.id
    AND bid.tenant_id = lot.tenant_id
    AND bid.lot_id = lot.id;

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

  SELECT id, amount_kopecks_per_ton INTO leader_id, leader_amount
  FROM auction.bids
  WHERE tenant_id = lot.tenant_id
    AND lot_id = lot.id
    AND status = 'LEADING'
  ORDER BY amount_kopecks_per_ton DESC, placed_at ASC, id ASC
  LIMIT 1;

  audit_id := auction.append_audit(
    'auction.bid.place',
    lot.id,
    jsonb_build_object(
      'version', p_expected_version::text,
      'leaderAmountKopecksPerTon', current_top
    ),
    jsonb_build_object(
      'version', lot.version::text,
      'bidId', bid_id,
      'leaderId', leader_id,
      'leaderAmountKopecksPerTon', leader_amount::text,
      'auctionEndsAt', lot.auction_ends_at
    ),
    jsonb_build_object(
      'commandId', p_command_id,
      'buyerOrgId', current_setting('app.current_org_id', true),
      'amountKopecksPerTon', p_amount_kopecks_per_ton::text,
      'volumeTons', p_volume_tons::text,
      'requestFingerprint', request_hash
    ),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.bid.placed',
    jsonb_build_object(
      'lotId', lot.id,
      'bidId', bid_id,
      'leaderId', leader_id,
      'lotVersion', lot.version::text
    ),
    'auction-bid-event:' || lot.tenant_id || ':' || p_idempotency_key,
    p_command_id,
    audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id,
    'lotVersion', lot.version::text,
    'bidId', bid_id,
    'bidStatus', CASE WHEN bid_id = leader_id THEN 'LEADING' ELSE 'OUTBID' END,
    'amountKopecksPerTon', p_amount_kopecks_per_ton::text,
    'leaderId', leader_id,
    'leaderAmountKopecksPerTon', leader_amount::text,
    'auctionEndsAt', lot.auction_ends_at,
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'PLACE_BID', p_command_id, p_idempotency_key, request_hash, result
  );
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
  price_per_ton_rub numeric(20, 2);
  basis jsonb;
  source_hash text;
  audit_id text;
  outbox_id text;
  result jsonb;
  now_at timestamptz := clock_timestamp();
BEGIN
  PERFORM auction.assert_actor(
    ARRAY['FARMER', 'ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER']
  );
  request_hash := encode(digest(convert_to(concat_ws('|',
    p_lot_id, p_expected_version::text
  ), 'UTF8'), 'sha256'), 'hex');
  replay := auction.replay_command('CLOSE_LOT', p_idempotency_key, request_hash);
  IF replay IS NOT NULL THEN RETURN replay; END IF;

  PERFORM auction.lock_lot(p_lot_id);
  SELECT * INTO lot
  FROM auction.lots
  WHERE tenant_id = current_setting('app.current_tenant_id', true)
    AND id = p_lot_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_LOT_NOT_FOUND';
  END IF;
  IF current_setting('app.current_role', true) = 'FARMER'
     AND lot.seller_org_id <> current_setting('app.current_org_id', true)
  THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELLER_SCOPE_DENIED';
  END IF;
  IF lot.version <> p_expected_version THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_STALE_VERSION';
  END IF;
  IF lot.status <> 'BIDDING' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_ALREADY_CLOSED';
  END IF;
  IF now_at < lot.auction_ends_at THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NOT_ENDED';
  END IF;
  IF lot.seller_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_SELLER_AUTHORITY_MISSING';
  END IF;

  SELECT bid.* INTO winner
  FROM auction.bids bid
  JOIN auction.admissions admission
    ON admission.tenant_id = bid.tenant_id
   AND admission.lot_id = bid.lot_id
   AND admission.participant_org_id = bid.buyer_org_id
   AND admission.participant_user_id = bid.placed_by_user_id
   AND admission.status = 'ADMITTED'
   AND admission.valid_until >= bid.placed_at
  WHERE bid.tenant_id = lot.tenant_id
    AND bid.lot_id = lot.id
    AND bid.status IN ('PLACED', 'LEADING', 'OUTBID')
  ORDER BY bid.amount_kopecks_per_ton DESC, bid.placed_at ASC, bid.id ASC
  LIMIT 1
  FOR UPDATE OF bid;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_NO_ELIGIBLE_BIDS';
  END IF;
  IF winner.placed_by_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUCTION_BUYER_AUTHORITY_MISSING';
  END IF;

  UPDATE auction.bids
  SET status = CASE WHEN id = winner.id THEN 'WINNING' ELSE 'OUTBID' END
  WHERE tenant_id = lot.tenant_id
    AND lot_id = lot.id
    AND status IN ('PLACED', 'LEADING', 'OUTBID');

  UPDATE auction.lots
  SET status = 'MATCHED'
  WHERE tenant_id = lot.tenant_id AND id = lot.id
  RETURNING * INTO lot;

  INSERT INTO auction.awards (
    id, tenant_id, lot_id, winning_bid_id, deal_id, status,
    awarded_by_actor_id, awarded_at, version, created_at, updated_at
  ) VALUES (
    award_id,
    lot.tenant_id,
    lot.id,
    winner.id,
    NULL,
    'AWARDED',
    current_setting('app.current_user_id', true),
    now_at,
    1,
    now_at,
    now_at
  );

  basis_external_id := lot.id || ':' || winner.id;
  deal_number := 'TP-AUC-' || upper(substr(
    encode(digest(convert_to(basis_external_id, 'UTF8'), 'sha256'), 'hex'),
    1,
    16
  ));
  total_kopecks := round(
    winner.amount_kopecks_per_ton::numeric * winner.volume_tons
  )::bigint;
  price_per_ton_rub := winner.amount_kopecks_per_ton::numeric / 100;
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
    'pricePerTon', price_per_ton_rub::text,
    'totalKopecks', total_kopecks::text,
    'currency', 'RUB'
  );
  source_hash := auction.basis_hash(basis);
  basis := basis || jsonb_build_object('sourceHash', source_hash);

  INSERT INTO public."integration_events" (
    "id", "adapterName", "direction", "eventType", "externalId", "dealId",
    "requestPayload", "responsePayload", "status", "idempotencyKey", "createdAt"
  ) VALUES (
    integration_event_id,
    'auction',
    'INBOUND',
    'DEAL_BASIS_READY',
    basis_external_id,
    NULL,
    basis,
    basis,
    'CONFIRMED',
    'auction-basis:' || lot.tenant_id || ':' || lot.id,
    now_at
  );

  audit_id := auction.append_audit(
    'auction.close',
    lot.id,
    jsonb_build_object(
      'status', 'BIDDING',
      'version', p_expected_version::text
    ),
    jsonb_build_object(
      'status', lot.status,
      'version', lot.version::text,
      'winnerBidId', winner.id,
      'awardId', award_id,
      'basisEventId', integration_event_id
    ),
    jsonb_build_object(
      'commandId', p_command_id,
      'requestFingerprint', request_hash,
      'basisHash', source_hash,
      'amountKopecksPerTon', winner.amount_kopecks_per_ton::text,
      'totalKopecks', total_kopecks::text
    ),
    p_command_id
  );
  outbox_id := auction.append_outbox(
    'auction.deal-basis.ready',
    jsonb_build_object(
      'lotId', lot.id,
      'winnerBidId', winner.id,
      'awardId', award_id,
      'integrationEventId', integration_event_id,
      'basis', basis
    ),
    'auction-basis-outbox:' || lot.tenant_id || ':' || lot.id,
    p_command_id,
    audit_id
  );
  result := jsonb_build_object(
    'lotId', lot.id,
    'lotStatus', lot.status,
    'lotVersion', lot.version::text,
    'winnerBidId', winner.id,
    'amountKopecksPerTon', winner.amount_kopecks_per_ton::text,
    'awardId', award_id,
    'integrationEventId', integration_event_id,
    'basisExternalId', basis_external_id,
    'basisHash', source_hash,
    'requestFingerprint', request_hash,
    'auditId', audit_id,
    'outboxId', outbox_id,
    'duplicate', false
  );
  PERFORM auction.save_command(
    'CLOSE_LOT', p_command_id, p_idempotency_key, request_hash, result
  );
  RETURN result;
END
$function$;

REVOKE ALL ON FUNCTION auction.lock_lot(text) FROM PUBLIC;

DO $auction_atomic_v2_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT EXECUTE ON FUNCTION auction.lock_lot(text) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.register_verified_lot(
      text, text, text, numeric, bigint, bigint, text, text, timestamptz,
      text, text, text, boolean, integer, integer, text, text
    ) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.record_admission(
      text, text, text, text, timestamptz, text, bigint, text, text
    ) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.place_bid(
      text, bigint, numeric, bigint, text, text
    ) TO app_deal;
    GRANT EXECUTE ON FUNCTION auction.close_lot(
      text, bigint, text, text
    ) TO app_deal;
  END IF;
END
$auction_atomic_v2_grants$;
