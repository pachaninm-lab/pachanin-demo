-- P0.2-1A — quarantine client self-verification of ФГИС «Зерно» lots.
--
-- `auction.register_verified_lot` accepts `p_source_type` and
-- `p_source_external_id` straight from the caller and then stamps
-- `source_verified_at = clock_timestamp()`, `status = 'BIDDING'` and
-- `admission_status = 'ADMITTED'` on the new row. For `source_type = 'FGIS'`
-- that means the platform records "this lot is backed by a confirmed ФГИС
-- «Зерно» party" purely because a client said so. There is no snapshot of the
-- external party, no re-read before publication, no reservation against its
-- available volume, and no foreign key to anything the provider returned.
--
-- Until the canonical commodity authority exists — immutable party snapshot,
-- current projection, reservation ledger and lot passport, all written by the
-- server from a verified provider response — a confirmed grain lot cannot be
-- published truthfully, so it is not published at all.
--
-- The guard is a trigger on `auction.lots` rather than a rewrite of
-- `register_verified_lot` for three reasons: it is forward-only and narrow, it
-- also covers direct SQL and any future command function, and when the
-- canonical path lands it is replaced in one place by a check that the lot
-- carries a passport and reservation instead of being denied outright.
--
-- Non-FGIS source types are untouched: this slice withdraws the unproven
-- ФГИС claim, it does not change auction behaviour elsewhere.

CREATE OR REPLACE FUNCTION auction.fgis_verified_lot_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auction
AS $function$
BEGIN
  IF NEW.source_type = 'FGIS' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'FGIS_VERIFIED_LOT_PATH_NOT_READY',
      DETAIL  = 'A lot backed by ФГИС «Зерно» cannot be registered until the '
             || 'server-side party snapshot, reservation and passport path exists. '
             || 'The client-supplied source type and external id are not evidence.',
      HINT    = 'Publish through the canonical ФГИС «Зерно» lot command once available.';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS auction_lots_fgis_verified_guard ON auction.lots;
CREATE TRIGGER auction_lots_fgis_verified_guard
BEFORE INSERT OR UPDATE OF source_type, source_external_id, source_verified_at
ON auction.lots
FOR EACH ROW EXECUTE FUNCTION auction.fgis_verified_lot_guard();

-- Existing rows are left in place: this migration withdraws a write path, it
-- does not rewrite history. Any FGIS-typed row already present predates the
-- canonical authority and is reported by the query below during rollout.
DO $do$
DECLARE
  legacy_count bigint;
BEGIN
  SELECT count(*) INTO legacy_count FROM auction.lots WHERE source_type = 'FGIS';
  IF legacy_count > 0 THEN
    RAISE WARNING 'FGIS_VERIFIED_LOT_PATH_NOT_READY: % pre-existing auction lot(s) carry an unverified FGIS source claim and now require reconciliation', legacy_count;
  END IF;
END
$do$;
