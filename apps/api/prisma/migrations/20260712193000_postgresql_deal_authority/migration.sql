-- PostgreSQL-authoritative deal creation boundary.
--
-- A deal basis exists before the Deal row, therefore ordinary integration_events
-- RLS (which requires an already-visible dealId) cannot expose it safely. This
-- narrow SECURITY DEFINER resolver returns only the latest CONFIRMED auction
-- basis matching the trusted tenant and an explicitly privileged platform role.
-- It does not create or mutate a deal and exposes no unrelated integration data.

CREATE OR REPLACE FUNCTION public.app_verified_deal_basis(
  p_lot_id text,
  p_winner_bid_id text
)
RETURNS TABLE (
  "eventId" text,
  basis jsonb,
  "createdAt" timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $function$
  SELECT
    ie."id" AS "eventId",
    COALESCE(ie."responsePayload", ie."requestPayload")::jsonb AS basis,
    ie."createdAt" AS "createdAt"
  FROM public."integration_events" ie
  WHERE public.app_rls_context_ready()
    AND current_setting('app.current_role', true) IN ('ADMIN', 'SUPPORT_MANAGER')
    AND ie."adapterName" = 'auction'
    AND ie."eventType" = 'DEAL_BASIS_READY'
    AND ie."externalId" = p_lot_id || ':' || p_winner_bid_id
    AND ie."status" = 'CONFIRMED'
    AND COALESCE(ie."responsePayload", ie."requestPayload") IS NOT NULL
    AND COALESCE(ie."responsePayload", ie."requestPayload")::jsonb ->> 'tenantId'
      = current_setting('app.current_tenant_id', true)
    AND COALESCE(ie."responsePayload", ie."requestPayload")::jsonb ->> 'lotId' = p_lot_id
    AND COALESCE(ie."responsePayload", ie."requestPayload")::jsonb ->> 'winnerBidId' = p_winner_bid_id
  ORDER BY ie."createdAt" DESC, ie."id" DESC
  LIMIT 1
$function$;

REVOKE ALL ON FUNCTION public.app_verified_deal_basis(text, text) FROM PUBLIC;

DO $grant_verified_basis$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_deal_api', 'app_integration_worker']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION public.app_verified_deal_basis(text, text) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$grant_verified_basis$;

COMMENT ON FUNCTION public.app_verified_deal_basis(text, text) IS
  'Returns one tenant-scoped confirmed auction deal basis to ADMIN or SUPPORT_MANAGER using complete trusted transaction context.';
