-- Narrow the uncontexted UPDATE on public."deals" to the two shapes the two
-- contextless system writers actually perform. Remainder of #4814.
--
-- 20260831180000 closed INSERT and DELETE and deliberately left
-- deals_uncontexted_update permissive for the writers that have no user to
-- derive an RLS context from. That pass named two of them. Measuring this one
-- established that there is only ONE, and the record is corrected here rather
-- than carried forward:
--
--   DealAutoService.autoCancel   - a six-hourly sweep across every tenant. Real.
--   DealSagaService.persistSaga  - NOT a live writer. It sets "sagaState", and
--     20260712194000 made that column immutable after creation for EVERY
--     principal, owner and superuser included - measured, not read. Its trigger
--     deals_basis_immutable also sorts before this one, so it rejects the write
--     first and this guard never sees it. persistSaga ends in .catch(() => {}),
--     so the rejection has been swallowed ever since. Saga state is not being
--     persisted at all, and no shape is reserved here for a write that cannot
--     succeed. Recorded separately; this migration does not attempt to fix it.
--
-- A policy cannot express "only these columns changed": USING sees the old row,
-- WITH CHECK sees the new one, and no single expression sees both. A trigger
-- sees both, so the restriction is written here.
--
-- Two properties of triggers make this different from a policy, and both are
-- load-bearing:
--
--   1. A trigger fires for the table owner and for superusers as well. RLS does
--      not (public."deals" carries no FORCE ROW LEVEL SECURITY). Admin
--      connections therefore have to be exempted explicitly, or this would
--      break the seeding and rehearsal paths that legitimately run as admin -
--      canonical-test-deal.seed.ts among them, which the one-deal harness runs
--      with DATABASE_URL="$ADMIN_URL". The principal check below is the same
--      device app_outbox_application_deal_visible already uses.
--   2. A trigger cannot be ORed away by a permissive policy, which is what made
--      the original deals_app_access defect possible in the first place.
--
-- What this does NOT close, stated rather than implied: cancelling ANY tenant's
-- deal without a context remains possible, because that is the shape of
-- autoCancel itself - a deliberate global sweep. What it closes is every other
-- uncontexted mutation: totalRub, pricePerTon, buyerOrgId, sellerOrgId,
-- tenantId, a transition to SIGNED, and the rest of the row.
--
-- The 14-day staleness threshold is deliberately NOT encoded here. It lives in
-- DEAL_AUTO_CANCEL_DAYS, and pinning it in the database would couple the two so
-- that changing an environment variable silently breaks writes.
--
-- V8.2.2 and V8.4.1 are NOT claimed. They are about the cross-tenant READ,
-- which stays open under deals_uncontexted_read.

CREATE OR REPLACE FUNCTION public.app_deals_uncontexted_update_shape()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  old_rest jsonb;
  new_rest jsonb;
BEGIN
  -- Admin, migration and superuser connections are not the principal this
  -- guards. See note 1 above.
  IF current_user NOT IN ('app_runtime', 'app_service', 'app_deal', 'one_deal_app') THEN
    RETURN NEW;
  END IF;

  -- A caller carrying an RLS context is left to the row policies; this trigger
  -- exists for the callers that carry none and adds no authority beyond them.
  IF public.app_rls_context_ready() THEN
    RETURN NEW;
  END IF;

  -- The only shape - DealAutoService.autoCancel: status moves from a staleable value
  -- to CANCELLED and nothing else but updatedAt differs. updatedAt is stamped
  -- by Prisma on every write (the column is @updatedAt in schema.prisma), so it
  -- is expected in both shapes rather than allowed as a courtesy.
  old_rest := to_jsonb(OLD) - 'status' - 'updatedAt';
  new_rest := to_jsonb(NEW) - 'status' - 'updatedAt';
  IF old_rest = new_rest
     AND NEW."status" = 'CANCELLED'
     AND OLD."status" IN ('DRAFT', 'PUBLISHED', 'NEGOTIATING', 'PAYMENT_AWAITING')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = '42501',
    MESSAGE = 'deal update without an RLS context is limited to the auto-cancel shape',
    DETAIL  = format('deal %s, principal %s', OLD."id", current_user);
END
$function$;

REVOKE ALL ON FUNCTION public.app_deals_uncontexted_update_shape() FROM PUBLIC;

DROP TRIGGER IF EXISTS deals_uncontexted_update_shape ON public."deals";
CREATE TRIGGER deals_uncontexted_update_shape
  BEFORE UPDATE ON public."deals"
  FOR EACH ROW EXECUTE FUNCTION public.app_deals_uncontexted_update_shape();

COMMENT ON FUNCTION public.app_deals_uncontexted_update_shape() IS
  'Limits contextless deal UPDATE by the confined runtime principals to the auto-cancel shape. Tracked in #4814.';
