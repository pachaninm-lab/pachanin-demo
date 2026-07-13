-- Auction facts are PostgreSQL-authoritative. This migration intentionally creates
-- no fixture lots, bids, awards or Deals. Application users receive SELECT-only
-- access through tenant FORCE-RLS; future mutations must use separately reviewed
-- canonical command functions and cannot be introduced through the read API.

CREATE TABLE public.auction_lots (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  seller_org_id text NOT NULL,
  title text NOT NULL,
  culture text NOT NULL,
  grade text,
  volume_tons numeric(20, 6) NOT NULL CHECK (volume_tons > 0),
  start_price_rub_per_ton bigint NOT NULL CHECK (start_price_rub_per_ton >= 0),
  step_price_rub_per_ton bigint NOT NULL CHECK (step_price_rub_per_ton > 0),
  region text NOT NULL,
  address text,
  status text NOT NULL CHECK (status IN ('DRAFT', 'OPEN', 'BIDDING', 'MATCHED', 'IN_DEAL', 'CLOSED', 'CANCELLED')),
  auction_ends_at timestamptz NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('FGIS', 'ERP', 'MANUAL_VERIFIED', 'OTHER')),
  source_external_id text,
  source_certificate_id text,
  source_verified_at timestamptz,
  admission_status text NOT NULL DEFAULT 'PENDING' CHECK (admission_status IN ('PENDING', 'REVIEW', 'ADMITTED', 'BLOCKED')),
  auto_extend_enabled boolean NOT NULL DEFAULT true,
  auto_extend_window_minutes integer NOT NULL DEFAULT 10 CHECK (auto_extend_window_minutes BETWEEN 0 AND 120),
  auto_extend_minutes integer NOT NULL DEFAULT 10 CHECK (auto_extend_minutes BETWEEN 0 AND 120),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT auction_lots_tenant_id_key UNIQUE (tenant_id, id),
  CONSTRAINT auction_lots_live_source_check CHECK (
    status NOT IN ('BIDDING', 'MATCHED', 'IN_DEAL', 'CLOSED')
    OR (
      source_external_id IS NOT NULL
      AND btrim(source_external_id) <> ''
      AND source_verified_at IS NOT NULL
      AND admission_status = 'ADMITTED'
    )
  )
);

CREATE TABLE public.auction_bids (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  lot_id text NOT NULL,
  buyer_org_id text NOT NULL,
  buyer_name text NOT NULL,
  amount_rub_per_ton bigint NOT NULL CHECK (amount_rub_per_ton > 0),
  volume_tons numeric(20, 6) NOT NULL CHECK (volume_tons > 0),
  status text NOT NULL CHECK (status IN ('PLACED', 'LEADING', 'OUTBID', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'WINNING')),
  placed_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT auction_bids_tenant_lot_id_key UNIQUE (tenant_id, lot_id, id),
  CONSTRAINT auction_bids_lot_fkey FOREIGN KEY (tenant_id, lot_id)
    REFERENCES public.auction_lots (tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE public.auction_awards (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  lot_id text NOT NULL,
  winning_bid_id text NOT NULL,
  deal_id text,
  status text NOT NULL DEFAULT 'AWARDED' CHECK (status IN ('AWARDED', 'DEAL_CREATED', 'REVOKED')),
  awarded_by_actor_id text NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT auction_awards_tenant_lot_key UNIQUE (tenant_id, lot_id),
  CONSTRAINT auction_awards_lot_fkey FOREIGN KEY (tenant_id, lot_id)
    REFERENCES public.auction_lots (tenant_id, id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT auction_awards_winning_bid_fkey FOREIGN KEY (tenant_id, lot_id, winning_bid_id)
    REFERENCES public.auction_bids (tenant_id, lot_id, id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT auction_awards_deal_fkey FOREIGN KEY (deal_id)
    REFERENCES public.deals (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT auction_awards_deal_state_check CHECK (
    (status = 'DEAL_CREATED' AND deal_id IS NOT NULL)
    OR (status <> 'DEAL_CREATED' AND deal_id IS NULL)
  )
);

CREATE INDEX auction_lots_tenant_status_idx
  ON public.auction_lots (tenant_id, status, auction_ends_at DESC, id);
CREATE INDEX auction_lots_seller_idx
  ON public.auction_lots (tenant_id, seller_org_id, updated_at DESC);
CREATE INDEX auction_bids_lot_amount_idx
  ON public.auction_bids (tenant_id, lot_id, amount_rub_per_ton DESC, placed_at ASC, id);
CREATE INDEX auction_bids_buyer_idx
  ON public.auction_bids (tenant_id, buyer_org_id, placed_at DESC);
CREATE INDEX auction_awards_deal_idx
  ON public.auction_awards (tenant_id, deal_id);

CREATE OR REPLACE FUNCTION public.app_auction_touch_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  NEW.updated_at := transaction_timestamp();
  NEW.version := OLD.version + 1;
  RETURN NEW;
END
$function$;

CREATE TRIGGER auction_lots_touch_version
BEFORE UPDATE ON public.auction_lots
FOR EACH ROW EXECUTE FUNCTION public.app_auction_touch_version();

CREATE TRIGGER auction_bids_touch_version
BEFORE UPDATE ON public.auction_bids
FOR EACH ROW EXECUTE FUNCTION public.app_auction_touch_version();

CREATE TRIGGER auction_awards_touch_version
BEFORE UPDATE ON public.auction_awards
FOR EACH ROW EXECUTE FUNCTION public.app_auction_touch_version();

CREATE OR REPLACE FUNCTION public.app_auction_bid_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  lot_record public.auction_lots%ROWTYPE;
BEGIN
  SELECT * INTO lot_record
  FROM public.auction_lots
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.lot_id
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction lot does not exist in the same tenant' USING ERRCODE = '23503';
  END IF;

  IF lot_record.status <> 'BIDDING'
     OR lot_record.admission_status <> 'ADMITTED'
     OR lot_record.source_verified_at IS NULL
     OR lot_record.source_external_id IS NULL
     OR btrim(lot_record.source_external_id) = ''
  THEN
    RAISE EXCEPTION 'auction lot is not open for authoritative bidding' USING ERRCODE = '23514';
  END IF;

  IF NEW.volume_tons > lot_record.volume_tons THEN
    RAISE EXCEPTION 'bid volume exceeds authoritative lot volume' USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER auction_bids_authority_guard
BEFORE INSERT OR UPDATE ON public.auction_bids
FOR EACH ROW EXECUTE FUNCTION public.app_auction_bid_guard();

CREATE OR REPLACE FUNCTION public.app_auction_award_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  lot_record public.auction_lots%ROWTYPE;
  bid_status text;
  deal_tenant_id text;
  deal_source_lot_id text;
BEGIN
  SELECT * INTO lot_record
  FROM public.auction_lots
  WHERE tenant_id = NEW.tenant_id
    AND id = NEW.lot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction lot does not exist in the same tenant' USING ERRCODE = '23503';
  END IF;

  SELECT status INTO bid_status
  FROM public.auction_bids
  WHERE tenant_id = NEW.tenant_id
    AND lot_id = NEW.lot_id
    AND id = NEW.winning_bid_id
  FOR KEY SHARE;

  IF NOT FOUND OR bid_status NOT IN ('ACCEPTED', 'WINNING') THEN
    RAISE EXCEPTION 'award requires an accepted winning bid from the same tenant and lot' USING ERRCODE = '23514';
  END IF;

  IF lot_record.status NOT IN ('MATCHED', 'IN_DEAL', 'CLOSED') THEN
    RAISE EXCEPTION 'award requires a matched authoritative lot' USING ERRCODE = '23514';
  END IF;

  IF NEW.deal_id IS NOT NULL THEN
    SELECT "tenantId", COALESCE("sourceLotId", "lotId")
      INTO deal_tenant_id, deal_source_lot_id
    FROM public.deals
    WHERE id = NEW.deal_id
    FOR KEY SHARE;

    IF NOT FOUND
       OR deal_tenant_id IS DISTINCT FROM NEW.tenant_id
       OR deal_source_lot_id IS DISTINCT FROM NEW.lot_id
    THEN
      RAISE EXCEPTION 'server-issued Deal must match auction tenant and lot' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END
$function$;

CREATE TRIGGER auction_awards_authority_guard
BEFORE INSERT OR UPDATE ON public.auction_awards
FOR EACH ROW EXECUTE FUNCTION public.app_auction_award_guard();

ALTER TABLE public.auction_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_lots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auction_awards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_awards FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auction_lots_tenant_select ON public.auction_lots;
CREATE POLICY auction_lots_tenant_select
ON public.auction_lots
FOR SELECT
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

DROP POLICY IF EXISTS auction_bids_tenant_select ON public.auction_bids;
CREATE POLICY auction_bids_tenant_select
ON public.auction_bids
FOR SELECT
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

DROP POLICY IF EXISTS auction_awards_tenant_select ON public.auction_awards;
CREATE POLICY auction_awards_tenant_select
ON public.auction_awards
FOR SELECT
USING (
  NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
  AND tenant_id = current_setting('app.current_tenant_id', true)
);

DO $auction_authority_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT SELECT ON public.auction_lots, public.auction_bids, public.auction_awards TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_auction_bid_guard() TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_auction_award_guard() TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_auction_touch_version() TO app_deal;
  END IF;
END
$auction_authority_grants$;
