-- A lot can have at most one persisted accepted/winning bid. The application read
-- model treats any winner without a matching award as contradictory and fails closed.
CREATE UNIQUE INDEX auction_bids_single_winner_idx
ON auction.bids (tenant_id, lot_id)
WHERE status IN ('ACCEPTED', 'WINNING');
