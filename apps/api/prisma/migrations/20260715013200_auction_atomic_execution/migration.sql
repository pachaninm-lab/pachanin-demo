-- Until the public auction read envelope is versioned to expose minor units,
-- accepted grain prices remain whole-ruble values represented canonically as
-- kopecks. This prevents the compatibility RUB columns from losing information.

ALTER TABLE auction.lots
  ADD CONSTRAINT auction_lots_start_price_whole_ruble_check
    CHECK (mod(start_price_kopecks_per_ton, 100) = 0),
  ADD CONSTRAINT auction_lots_step_price_whole_ruble_check
    CHECK (mod(step_price_kopecks_per_ton, 100) = 0);

ALTER TABLE auction.bids
  ADD CONSTRAINT auction_bids_amount_whole_ruble_check
    CHECK (mod(amount_kopecks_per_ton, 100) = 0);
