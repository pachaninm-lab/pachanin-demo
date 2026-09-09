-- Forward-only reconciliation of four source-identified non-main migrations.
-- No business rows or existing Prisma ledger records are changed.
-- Production admission additionally requires exact-image catalog rehearsal and
-- deployed API source compatibility. Archived SQL is never replayed here.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
SET LOCAL search_path = pg_catalog, public, auction, pg_temp;
LOCK TABLE auction.lots, auction.bids, auction.admissions, auction.awards IN SHARE ROW EXCLUSIVE MODE;

DO $lineage_guard$
DECLARE
  archived_count integer;
  exact_count integer;
  historical boolean;
  expected record;
  observed record;
  function_count integer;
  expected_hash text;
BEGIN
  SELECT count(*),count(*) FILTER (WHERE m.checksum=e.checksum AND m.finished_at IS NOT NULL AND m.rolled_back_at IS NULL)
  INTO archived_count,exact_count
  FROM public._prisma_migrations m JOIN (VALUES
    ('20260716130000_market_open_lots_showcase','7fd0342e097c57a7a2832a7099ae973e875a5ccbddeb4cf6722d15aac983e08c'),
    ('20260716150000_auction_cross_tenant_participation','bc8ac2be7aad0d45e742d5669a5ae2fed4938caba0c2e11abc5962974c5c775b'),
    ('20260716160000_auction_participant_workspace','cf9d849fd6504443aac60fa7bffa0eb06b69f45b0aaf02524530f99092b1abd4'),
    ('20260717170000_deal_cross_tenant_participation','e78fc2adb8332da2b242c1335d7082416f9fe4f901fbb872c186926969892598')
  ) e(name,checksum) ON e.name=m.migration_name;
  IF archived_count NOT IN (0,4) OR archived_count<>exact_count OR (
    archived_count=4 AND (SELECT count(DISTINCT migration_name) FROM public._prisma_migrations
      WHERE migration_name IN ('20260716130000_market_open_lots_showcase','20260716150000_auction_cross_tenant_participation','20260716160000_auction_participant_workspace','20260717170000_deal_cross_tenant_participation'))<>4
  ) THEN RAISE EXCEPTION 'W1_LINEAGE_LEDGER_UNRECOGNIZED'; END IF;
  historical := archived_count=4;
  FOR expected IN SELECT * FROM (VALUES
    ('market','list_open_lots','integer,timestamp with time zone','c7082b888eabd00420bb7f3007425290c08d32891330601e3d2f90821ddd931f',NULL,false,'plpgsql','v','search_path=auction, pg_temp'),
    ('auction','record_admission','text,text,text,text,timestamp with time zone,text,bigint,text,text','9a650b0d744fe12453525dc810ac14fe0ddf6959dde7f70341f16f882b79073a','ee7af2664b44e3189d48ff8ce60641069a27dd4b2eebb2f23eae55dc561f6f1a',true,'plpgsql','v','search_path=pg_catalog, public, auction'),
    ('auction','place_bid','text,bigint,numeric,bigint,text,text','68cb115eb01829e921f4d06867f1f17cdcaa999c5e6207a9e97fec7b62a25e0e','9f61cb01e25f93e9a6044c0fd59e3db96b5cedcc121ffadcfea23007917b1a0b',true,'plpgsql','v','search_path=pg_catalog, public, auction'),
    ('dealx','participant_tenant','text,text,text,text','a1b0ff9212bb21b9d025804af49f0fe286adf3ea16b1d9e91682f9574a9af3b9',NULL,true,'sql','s','search_path=public, pg_temp')
  ) e(schema_name,function_name,arguments,historical_hash,canonical_hash,definer,language,volatility,search_path) LOOP
    expected_hash := CASE WHEN historical THEN expected.historical_hash ELSE expected.canonical_hash END;
    SELECT count(*) INTO function_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname=expected.schema_name AND p.proname=expected.function_name;
    IF expected_hash IS NULL THEN
      IF function_count<>0 THEN RAISE EXCEPTION 'W1_LINEAGE_UNEXPECTED_HELPER'; END IF;
      CONTINUE;
    END IF;
    SELECT p.*,l.lanname INTO observed FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
      WHERE p.oid=to_regprocedure(expected.schema_name||'.'||expected.function_name||'('||expected.arguments||')');
    IF NOT FOUND OR function_count<>1 THEN RAISE EXCEPTION 'W1_LINEAGE_FUNCTION_SIGNATURE'; END IF;
    IF observed.prokind<>'f' OR observed.prosecdef IS DISTINCT FROM expected.definer
      OR observed.lanname<>expected.language OR observed.provolatile::text<>expected.volatility
      OR observed.proleakproof OR observed.proisstrict
      OR observed.proconfig IS DISTINCT FROM ARRAY[expected.search_path]
      OR observed.proowner<>(SELECT relowner FROM pg_class WHERE oid='public._prisma_migrations'::regclass)
      OR encode(sha256(convert_to(observed.prosrc,'UTF8')),'hex')<>expected_hash
      OR EXISTS (SELECT 1 FROM aclexplode(COALESCE(observed.proacl,acldefault('f',observed.proowner))) a
        WHERE a.grantee=0 AND a.privilege_type='EXECUTE')
    THEN RAISE EXCEPTION 'W1_LINEAGE_FUNCTION_AUTHORITY'; END IF;
  END LOOP;
END
$lineage_guard$;

-- Compile source policy expressions on empty transaction-local tables so
-- PostgreSQL itself normalizes casts/parentheses. No textual weakening or
-- application-row sampling is used to approve the old predicates.
CREATE TEMP TABLE lots (LIKE auction.lots) ON COMMIT DROP;
CREATE TEMP TABLE bids (LIKE auction.bids) ON COMMIT DROP;
CREATE TEMP TABLE admissions (LIKE auction.admissions) ON COMMIT DROP;
CREATE TEMP TABLE awards (LIKE auction.awards) ON COMMIT DROP;
CREATE POLICY auction_lots_market_showcase_select ON pg_temp.lots FOR SELECT USING (
  current_setting('app.market_showcase', true) = 'on'
  AND status = 'BIDDING'
);

CREATE POLICY auction_bids_market_showcase_select ON pg_temp.bids FOR SELECT USING (
  current_setting('app.market_showcase', true) = 'on'
);

CREATE POLICY auction_admissions_participant_select ON pg_temp.admissions FOR SELECT USING (
  public.app_rls_context_ready()
  AND participant_org_id = current_setting('app.current_org_id', true)
);

CREATE POLICY auction_lots_participant_select ON pg_temp.lots FOR SELECT USING (
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

CREATE POLICY auction_bids_participant_select ON pg_temp.bids FOR SELECT USING (
  public.app_rls_context_ready()
  AND EXISTS (
    SELECT 1
    FROM auction.admissions admission
    WHERE admission.lot_id = bids.lot_id
      AND admission.tenant_id = bids.tenant_id
      AND admission.participant_org_id = current_setting('app.current_org_id', true)
      AND admission.status = 'ADMITTED'
      AND admission.valid_until > now()
  )
);

CREATE POLICY auction_awards_participant_select ON pg_temp.awards FOR SELECT USING (
  public.app_rls_context_ready()
  AND EXISTS (
    SELECT 1
    FROM auction.admissions admission
    WHERE admission.lot_id = awards.lot_id
      AND admission.tenant_id = awards.tenant_id
      AND admission.participant_org_id = current_setting('app.current_org_id', true)
      AND admission.status = 'ADMITTED'
      AND admission.valid_until > now()
  )
);
CREATE INDEX lots_market_showcase_idx ON pg_temp.lots (created_at DESC) WHERE status='BIDDING';

DO $policy_guard$
DECLARE
  historical boolean;
  expected record;
  actual record;
  reference record;
BEGIN
  historical := EXISTS (SELECT 1 FROM public._prisma_migrations WHERE migration_name='20260716130000_market_open_lots_showcase');
  FOR expected IN SELECT * FROM (VALUES
    ('lots','auction_lots_market_showcase_select'),
    ('bids','auction_bids_market_showcase_select'),
    ('admissions','auction_admissions_participant_select'),
    ('lots','auction_lots_participant_select'),
    ('bids','auction_bids_participant_select'),
    ('awards','auction_awards_participant_select')
  ) e(table_name,policy_name) LOOP
    SELECT p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck,p.polrelid) AS with_check INTO actual
    FROM pg_policy p WHERE p.polrelid=to_regclass('auction.'||expected.table_name) AND p.polname=expected.policy_name;
    IF NOT historical THEN
      IF FOUND THEN RAISE EXCEPTION 'W1_LINEAGE_UNEXPECTED_POLICY'; END IF;
      CONTINUE;
    END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'W1_LINEAGE_POLICY_MISSING'; END IF;
    SELECT p.polcmd,p.polpermissive,p.polroles,pg_get_expr(p.polqual,p.polrelid) AS qual,
      pg_get_expr(p.polwithcheck,p.polrelid) AS with_check INTO reference
    FROM pg_policy p WHERE p.polrelid=to_regclass('pg_temp.'||expected.table_name) AND p.polname=expected.policy_name;
    IF actual IS DISTINCT FROM reference THEN RAISE EXCEPTION 'W1_LINEAGE_POLICY_DRIFT'; END IF;
  END LOOP;
  IF historical THEN
    IF to_regclass('auction.lots_market_showcase_idx') IS NULL THEN RAISE EXCEPTION 'W1_LINEAGE_INDEX_MISSING'; END IF;
    SELECT i.indisvalid,i.indisready,i.indisunique,i.indkey::text,i.indclass::text,i.indcollation::text,i.indoption::text,
      pg_get_expr(i.indpred,i.indrelid) AS predicate INTO actual
    FROM pg_index i WHERE i.indexrelid='auction.lots_market_showcase_idx'::regclass;
    SELECT i.indisvalid,i.indisready,i.indisunique,i.indkey::text,i.indclass::text,i.indcollation::text,i.indoption::text,
      pg_get_expr(i.indpred,i.indrelid) AS predicate INTO reference
    FROM pg_index i WHERE i.indexrelid='pg_temp.lots_market_showcase_idx'::regclass;
    IF actual IS DISTINCT FROM reference THEN RAISE EXCEPTION 'W1_LINEAGE_INDEX_DRIFT'; END IF;
  ELSIF to_regclass('auction.lots_market_showcase_idx') IS NOT NULL THEN RAISE EXCEPTION 'W1_LINEAGE_UNEXPECTED_INDEX';
  END IF;
END
$policy_guard$;

DROP POLICY IF EXISTS auction_lots_market_showcase_select ON auction.lots;
DROP POLICY IF EXISTS auction_bids_market_showcase_select ON auction.bids;
DROP POLICY IF EXISTS auction_admissions_participant_select ON auction.admissions;
DROP POLICY IF EXISTS auction_lots_participant_select ON auction.lots;
DROP POLICY IF EXISTS auction_bids_participant_select ON auction.bids;
DROP POLICY IF EXISTS auction_awards_participant_select ON auction.awards;
DROP INDEX IF EXISTS auction.lots_market_showcase_idx;
DROP FUNCTION IF EXISTS market.list_open_lots(integer,timestamp with time zone) RESTRICT;
DROP FUNCTION IF EXISTS dealx.participant_tenant(text,text,text,text) RESTRICT;

-- Byte-identical function declarations from accepted main migration
-- 20260715013100_auction_atomic_execution; CREATE OR REPLACE preserves ACL/owner.
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

COMMIT;
