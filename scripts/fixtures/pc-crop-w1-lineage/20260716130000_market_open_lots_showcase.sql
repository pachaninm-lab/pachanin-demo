-- Обезличенная витрина открытых лотов (решение владельца продукта от 16.07.2026,
-- CANONICAL_SCENARIO.md §1): лот в статусе торгов виден всем допущенным
-- покупателям платформы независимо от tenant продавца, но без наименования
-- продавца, адреса и контактов. Анонимность обеспечивается на уровне SQL:
-- витрина возвращает только безопасные колонки, а доступ к строкам открывает
-- отдельная RLS-политика, активная только внутри функции витрины.

CREATE SCHEMA IF NOT EXISTS market;

-- Показ строк лотов/ставок вне tenant-контекста возможен только когда функция
-- витрины включает транзакционный флаг app.market_showcase. Обычные запросы
-- приложения этот флаг никогда не устанавливают.
DROP POLICY IF EXISTS auction_lots_market_showcase_select ON auction.lots;
CREATE POLICY auction_lots_market_showcase_select ON auction.lots FOR SELECT USING (
  current_setting('app.market_showcase', true) = 'on'
  AND status = 'BIDDING'
);

DROP POLICY IF EXISTS auction_bids_market_showcase_select ON auction.bids;
CREATE POLICY auction_bids_market_showcase_select ON auction.bids FOR SELECT USING (
  current_setting('app.market_showcase', true) = 'on'
);

CREATE OR REPLACE FUNCTION market.list_open_lots(
  p_limit integer DEFAULT 25,
  p_cursor timestamptz DEFAULT NULL
)
RETURNS TABLE (
  lot_id text,
  culture text,
  grade text,
  volume_tons numeric,
  region text,
  start_price_kopecks_per_ton bigint,
  step_price_kopecks_per_ton bigint,
  auction_ends_at timestamptz,
  source_type text,
  bid_count bigint,
  best_price_kopecks_per_ton bigint,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = auction, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.market_showcase', 'on', true);
  RETURN QUERY
    SELECT
      l.id,
      l.culture,
      l.grade,
      l.volume_tons,
      l.region,
      l.start_price_kopecks_per_ton,
      l.step_price_kopecks_per_ton,
      l.auction_ends_at,
      l.source_type,
      (SELECT count(*) FROM auction.bids b WHERE b.lot_id = l.id),
      (SELECT max(b.amount_kopecks_per_ton) FROM auction.bids b WHERE b.lot_id = l.id),
      l.created_at
    FROM auction.lots l
    WHERE l.status = 'BIDDING'
      AND l.auction_ends_at > now()
      AND (p_cursor IS NULL OR l.created_at < p_cursor)
    ORDER BY l.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);
  PERFORM set_config('app.market_showcase', '', true);
  RETURN;
END $$;

-- Витрина листается по created_at среди открытых лотов — частичный индекс
-- держит выборку узкой при федеральном объёме лотов.
CREATE INDEX IF NOT EXISTS lots_market_showcase_idx
  ON auction.lots (created_at DESC)
  WHERE status = 'BIDDING';

REVOKE ALL ON FUNCTION market.list_open_lots(integer, timestamptz) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT USAGE ON SCHEMA market TO app_deal;
    GRANT EXECUTE ON FUNCTION market.list_open_lots(integer, timestamptz) TO app_deal;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    GRANT USAGE ON SCHEMA market TO postgres;
    GRANT EXECUTE ON FUNCTION market.list_open_lots(integer, timestamptz) TO postgres;
  END IF;
END $$;
