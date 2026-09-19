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

-- The auction close command emits one confirmed DEAL_BASIS_READY event. The
-- existing canonical Deal repository consumes that event under the same
-- restricted application principal. Grant only the operations required for
-- basis consumption and the atomic Deal creation receipt; RLS/FORCE RLS remains
-- the row authority and outbox UPDATE/DELETE stay worker-only/forbidden.
DO $auction_deal_consumer_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT SELECT ON
      public."outbox_entries",
      public."integration_events",
      public."deals",
      public."deal_participants",
      public."deal_events",
      public."audit_events",
      public."organizations",
      public."users",
      public."user_orgs"
    TO app_deal;

    GRANT INSERT ON
      public."deals",
      public."deal_participants",
      public."deal_events",
      public."audit_events",
      public."outbox_entries"
    TO app_deal;

    GRANT UPDATE ("sagaStep", "updatedAt") ON public."deals" TO app_deal;

    GRANT EXECUTE ON FUNCTION public.app_deal_basis_deal_visible(jsonb)
      TO app_deal;
    GRANT EXECUTE ON FUNCTION public.app_deal_basis_participant_allowed(
      text, text, text, text, text
    ) TO app_deal;
  END IF;
END
$auction_deal_consumer_grants$;
