-- Кросс-tenant участие в торгах (CANONICAL_SCENARIO.md §1, PHASE1_BACKLOG №1).
-- Ранее и допуск, и ставка искали лот строго в tenant'е вызывающего,
-- а организация участника обязана была жить в tenant'е лота — торговля между
-- само-зарегистрированными организациями была невозможна. Теперь:
--   * лот ищется по идентификатору; авторитет допуска — роль оператора и
--     проверенный статус организации участника (любой tenant);
--   * авторитет ставки — действующий допуск ADMITTED (org + user), как и прежде;
--   * строки допуска/ставки по-прежнему пишутся в tenant лота — аудит целен.
-- Политики: участник видит свои допуски и допущенные лоты из своего контекста.

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
  -- Кросс-tenant: оператор платформы допускает участника к лоту любого
  -- tenant'а; авторитет — роль оператора и статус организации, не tenant.
  WHERE id = p_lot_id
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
  -- Кросс-tenant: покупатель ставит по лоту любого tenant'а; авторитет —
  -- действующий допуск (participant_org_id/participant_user_id), не tenant.
  WHERE id = p_lot_id
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


-- Участник видит собственные допуски независимо от tenant'а лота.
DROP POLICY IF EXISTS auction_admissions_participant_select ON auction.admissions;
CREATE POLICY auction_admissions_participant_select ON auction.admissions FOR SELECT USING (
  public.app_rls_context_ready()
  AND participant_org_id = current_setting('app.current_org_id', true)
);

-- Допущенный участник видит строку лота (для рабочего экрана торгов).
DROP POLICY IF EXISTS auction_lots_participant_select ON auction.lots;
CREATE POLICY auction_lots_participant_select ON auction.lots FOR SELECT USING (
  public.app_rls_context_ready()
  AND EXISTS (
    SELECT 1
    FROM auction.admissions admission
    WHERE admission.lot_id = lots.id
      AND admission.tenant_id = lots.tenant_id
      AND admission.participant_org_id = current_setting('app.current_org_id', true)
      AND admission.status = 'ADMITTED'
      AND admission.valid_until > now()
  )
);
