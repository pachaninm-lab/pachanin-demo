-- P0 farmer/public-market slice: expose only an anonymous, seller-authorized
-- teaser projection for canonical inventory-bound Auction lots.
--
-- The public HTTP surface must never query tenant Auction rows directly. This
-- projection is populated inside the same PostgreSQL transaction as the lot
-- state change. The protected table retains canonical lot_id only as an
-- internal synchronization key; the bounded public function never returns it
-- or any tenant, seller, user, address, source id, certificate id, inventory
-- position or reservation identifier.
BEGIN;

DO $authority$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'pc_inventory_authority'
      AND NOT rolcanlogin AND NOT rolinherit AND NOT rolsuper
      AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole
  ) OR EXISTS (
    SELECT 1 FROM pg_auth_members
    WHERE roleid = 'pc_inventory_authority'::regrole
       OR member = 'pc_inventory_authority'::regrole
  ) THEN
    RAISE EXCEPTION 'PUBLIC_MARKET_AUTHORITY_INVALID';
  END IF;
END
$authority$;

CREATE TABLE auction.public_market_lot_cards (
  lot_id text PRIMARY KEY,
  public_ref text NOT NULL UNIQUE DEFAULT ('market-' || gen_random_uuid()::text),
  culture text NOT NULL,
  grade text,
  volume_tons numeric(20, 6) NOT NULL CHECK (volume_tons > 0),
  start_price_kopecks_per_ton bigint NOT NULL CHECK (start_price_kopecks_per_ton >= 0),
  region text NOT NULL,
  auction_ends_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('BIDDING', 'HIDDEN')),
  verification_status text NOT NULL CHECK (verification_status = 'DECLARED'),
  trade_permission text NOT NULL CHECK (trade_permission = 'PUBLIC_ALLOWED'),
  lot_version bigint NOT NULL CHECK (lot_version > 0),
  projected_at timestamptz NOT NULL DEFAULT transaction_timestamp()
);

CREATE INDEX public_market_lot_cards_live_idx
  ON auction.public_market_lot_cards (auction_ends_at ASC, projected_at DESC, public_ref);

-- Existing W2-B lots were created only by the FARMER-authorized
-- register_inventory_lot command. Backfill only the exact inventory-bound,
-- admitted, live shape; legacy/unbound lots never enter the public projection.
INSERT INTO auction.public_market_lot_cards (
  lot_id, culture, grade, volume_tons, start_price_kopecks_per_ton,
  region, auction_ends_at, status, verification_status, trade_permission,
  lot_version, projected_at
)
SELECT
  l.id,
  l.culture,
  l.grade,
  l.volume_tons,
  l.start_price_kopecks_per_ton,
  l.region,
  l.auction_ends_at,
  'BIDDING',
  'DECLARED',
  'PUBLIC_ALLOWED',
  l.version,
  transaction_timestamp()
FROM auction.lots l
JOIN auction.inventory_bindings b
  ON b.id = l.inventory_binding_id
 AND b.tenant_id = l.tenant_id
 AND b.organization_id = l.seller_org_id
 AND b.lot_id = l.id
WHERE l.inventory_binding_id IS NOT NULL
  AND l.status = 'BIDDING'
  AND l.admission_status = 'ADMITTED'
  AND l.auction_ends_at > transaction_timestamp()
  AND l.start_price_kopecks_per_ton IS NOT NULL
  AND l.source_type = 'OTHER'
  AND l.source_verified_at IS NULL
  AND l.source_certificate_id IS NULL;

ALTER TABLE auction.public_market_lot_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction.public_market_lot_cards FORCE ROW LEVEL SECURITY;
CREATE POLICY public_market_lot_cards_authority
  ON auction.public_market_lot_cards
  FOR ALL
  TO pc_inventory_authority
  USING (true)
  WITH CHECK (true);
REVOKE ALL ON auction.public_market_lot_cards FROM PUBLIC;
ALTER TABLE auction.public_market_lot_cards OWNER TO pc_inventory_authority;

CREATE FUNCTION auction.sync_public_market_lot_card()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auction
SET row_security = on
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE auction.public_market_lot_cards
    SET status = 'HIDDEN',
        lot_version = OLD.version,
        projected_at = transaction_timestamp()
    WHERE lot_id = OLD.id;
    RETURN OLD;
  END IF;

  -- register_inventory_lot is the only accepted writer of new bound lots. It
  -- is FARMER-only and creates BIDDING/PUBLIC_ALLOWED in the same transaction.
  -- The deferred trigger runs after the immutable inventory binding exists.
  IF NEW.inventory_binding_id IS NOT NULL
     AND NEW.status = 'BIDDING'
     AND NEW.admission_status = 'ADMITTED'
     AND NEW.auction_ends_at > transaction_timestamp()
     AND NEW.start_price_kopecks_per_ton IS NOT NULL
     AND NEW.source_type = 'OTHER'
     AND NEW.source_verified_at IS NULL
     AND NEW.source_certificate_id IS NULL
  THEN
    INSERT INTO auction.public_market_lot_cards (
      lot_id, culture, grade, volume_tons, start_price_kopecks_per_ton,
      region, auction_ends_at, status, verification_status, trade_permission,
      lot_version, projected_at
    ) VALUES (
      NEW.id, NEW.culture, NEW.grade, NEW.volume_tons,
      NEW.start_price_kopecks_per_ton, NEW.region, NEW.auction_ends_at,
      'BIDDING', 'DECLARED', 'PUBLIC_ALLOWED', NEW.version,
      transaction_timestamp()
    )
    ON CONFLICT (lot_id) DO UPDATE SET
      culture = EXCLUDED.culture,
      grade = EXCLUDED.grade,
      volume_tons = EXCLUDED.volume_tons,
      start_price_kopecks_per_ton = EXCLUDED.start_price_kopecks_per_ton,
      region = EXCLUDED.region,
      auction_ends_at = EXCLUDED.auction_ends_at,
      status = EXCLUDED.status,
      verification_status = EXCLUDED.verification_status,
      trade_permission = EXCLUDED.trade_permission,
      lot_version = EXCLUDED.lot_version,
      projected_at = EXCLUDED.projected_at;
  ELSE
    UPDATE auction.public_market_lot_cards
    SET status = 'HIDDEN',
        lot_version = NEW.version,
        projected_at = transaction_timestamp()
    WHERE lot_id = NEW.id;
  END IF;

  RETURN NEW;
END
$function$;

ALTER FUNCTION auction.sync_public_market_lot_card() OWNER TO pc_inventory_authority;
REVOKE ALL ON FUNCTION auction.sync_public_market_lot_card() FROM PUBLIC;

-- The lot->inventory binding FK and W2-B evidence trigger are deferred. Keep
-- this projection trigger deferred as well: if any binding/evidence invariant
-- fails, the whole transaction (including this projection write) rolls back.
CREATE CONSTRAINT TRIGGER auction_public_market_lot_sync
AFTER INSERT OR UPDATE OR DELETE ON auction.lots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION auction.sync_public_market_lot_card();

CREATE FUNCTION auction.list_public_market_lot_cards(p_limit integer DEFAULT 12)
RETURNS TABLE (
  public_ref text,
  culture text,
  grade text,
  volume_tons text,
  start_price_kopecks_per_ton text,
  region text,
  auction_ends_at timestamptz,
  status text,
  verification_status text,
  trade_permission text,
  lot_version text,
  projected_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, auction
SET row_security = on
AS $function$
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 24 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PUBLIC_MARKET_LIMIT_INVALID';
  END IF;

  RETURN QUERY
  SELECT
    c.public_ref,
    c.culture,
    c.grade,
    c.volume_tons::text,
    c.start_price_kopecks_per_ton::text,
    c.region,
    c.auction_ends_at,
    c.status,
    c.verification_status,
    c.trade_permission,
    c.lot_version::text,
    c.projected_at
  FROM auction.public_market_lot_cards c
  WHERE c.status = 'BIDDING'
    AND c.trade_permission = 'PUBLIC_ALLOWED'
    AND c.auction_ends_at > transaction_timestamp()
  ORDER BY c.projected_at DESC, c.auction_ends_at ASC, c.public_ref ASC
  LIMIT p_limit;
END
$function$;

ALTER FUNCTION auction.list_public_market_lot_cards(integer) OWNER TO pc_inventory_authority;
REVOKE ALL ON FUNCTION auction.list_public_market_lot_cards(integer) FROM PUBLIC;

DO $runtime_grants$
DECLARE runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname FROM pg_roles
    WHERE rolname IN ('pc_deal_runtime','one_deal_app','app_deal','app_runtime','app_deal_api')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auction TO %I', runtime_role);
    EXECUTE format('GRANT EXECUTE ON FUNCTION auction.list_public_market_lot_cards(integer) TO %I', runtime_role);
    EXECUTE format('REVOKE ALL ON TABLE auction.public_market_lot_cards FROM %I', runtime_role);
    EXECUTE format('REVOKE ALL ON FUNCTION auction.sync_public_market_lot_card() FROM %I', runtime_role);
  END LOOP;
END
$runtime_grants$;

COMMIT;
