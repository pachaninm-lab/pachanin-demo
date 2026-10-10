-- Close the INSERT and DELETE halves of the permissive policy that survives on
-- public."deals" in the forward-only chain. Recorded in #4814.
--
-- 0001_postgresql_initial created:
--
--   CREATE POLICY "deals_app_access" ON "deals" USING (TRUE);
--
-- Note what is absent: a FOR clause. PostgreSQL therefore records it as
-- cmd = ALL, and for an ALL policy carrying no WITH CHECK the USING expression
-- is applied to new rows as well. So this one line supplies WITH CHECK (TRUE)
-- on INSERT, and permissive policies combine with OR, which means it ORs away
-- deals_insert - and with it the whole confirmed-basis authority that
-- 20260712193000_postgresql_deal_authority and 20260712195000_deal_insert_basis_only
-- exist to install: the FARMER role requirement, the binding of every
-- authoritative commercial field to one CONFIRMED DEAL_BASIS_READY event, and
-- the 18-key sagaState check.
--
-- Measured on a live PostgreSQL 16 carrying all 182 migrations of this chain,
-- under app_runtime confirmed super=false bypassrls=false, with no RLS context
-- set. All four succeeded before this migration:
--
--   SELECT               -> 2 rows, both tenants
--   UPDATE another tenant-> UPDATE 1
--   INSERT, no basis     -> INSERT 0 1, status 'SIGNED', arbitrary sellerOrgId
--   DELETE another tenant-> DELETE 1
--
-- The forged INSERT is the sharpest of the four: a deal that no auction ever
-- produced, carrying a signed status, accepted by the database.
--
-- Scope, and what this deliberately does NOT do.
--
-- The policy cannot simply be dropped. Closing SELECT would require every
-- reader of deals to run inside an RLS context, and 21 files touch the model;
-- four of them - prisma-deal.repository, postgresql-deal-command.service,
-- deal-command.service and settlement-postgresql.repository - already do,
-- but the export and analytics readers do not.
--
-- Closing UPDATE is blocked for a different and more specific reason: two
-- legitimate writers have no user at all to derive a context from.
-- DealAutoService.autoCancel is a six-hourly sweep across every tenant, and
-- DealSagaService.persistSaga ends its write in .catch(() => {}), so a strict
-- policy would stop the saga persisting SILENTLY. Inventing a system context
-- is not available either: rls-transaction.service.ts records that a setting
-- the confined principal can set itself is not an authority. Restricting the
-- update to the one transition DealAutoService performs cannot be expressed as
-- a policy at all - USING sees the old row and WITH CHECK the new one, and no
-- single expression sees both - so it is a trigger, and a separate pass.
--
-- Both remaining gaps therefore stay open ON PURPOSE, each under its own
-- narrowly named policy rather than riding on one blanket FOR ALL. The
-- difference this migration makes is that INSERT and DELETE no longer ride on
-- it too.
--
-- V8.2.2 and V8.4.1 are NOT claimed by this migration and stay FAIL: the
-- cross-tenant read is the boundary they are about, and it is still open.
--
-- Every statement is idempotent.

ALTER TABLE public."deals" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deals_app_access ON public."deals";

-- Read: today's behaviour preserved exactly, now scoped to SELECT alone and
-- named for what it is. deals_select and deals_staff_projection already exist
-- alongside it; this is the permissive fallback they are still ORed with.
DROP POLICY IF EXISTS deals_uncontexted_read ON public."deals";
CREATE POLICY deals_uncontexted_read ON public."deals" FOR SELECT USING (TRUE);
COMMENT ON POLICY deals_uncontexted_read ON public."deals" IS
  'Deliberately permissive: preserves the pre-existing uncontexted read while the export and analytics readers still run outside an RLS context. Tracked in #4814 - not a closed boundary.';

-- Update: today's behaviour preserved exactly, scoped to UPDATE alone, so the
-- two system writers above keep working until they have a context or a trigger.
DROP POLICY IF EXISTS deals_uncontexted_update ON public."deals";
CREATE POLICY deals_uncontexted_update ON public."deals" FOR UPDATE USING (TRUE) WITH CHECK (TRUE);
COMMENT ON POLICY deals_uncontexted_update ON public."deals" IS
  'Deliberately permissive: DealAutoService.autoCancel and DealSagaService.persistSaga write without a user context. Tracked in #4814 - not a closed boundary.';

-- INSERT: no permissive fallback remains, so deals_insert from
-- 20260712195000_deal_insert_basis_only becomes the only INSERT authority.
-- DELETE: no policy at all. Deletion has no caller in non-test source; the
-- test teardowns that do delete run as the owning superuser, to which RLS
-- does not apply. Note the shape of the refusal: with no DELETE policy the
-- rows are simply invisible to DELETE, so it reports DELETE 0 rather than
-- raising. Fail-closed, but silent.
