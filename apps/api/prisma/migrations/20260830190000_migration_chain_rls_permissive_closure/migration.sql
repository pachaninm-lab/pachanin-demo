-- Bring the audit_events and ledger_entries row policies into the forward-only
-- migration chain, so tenant scoping is a property of the database every
-- deploy produces rather than of a later deploy artifact.
--
-- 0001_postgresql_initial created permissive policies:
--
--   CREATE POLICY "audit_select_all"  ON "audit_events"   FOR SELECT USING (TRUE);
--   CREATE POLICY "ledger_select_all" ON "ledger_entries" FOR SELECT USING (TRUE);
--
-- On a migration-only database those are the only SELECT policies these two
-- tables have, so any role that may read them reads every tenant's rows. The
-- strict replacements existed solely in infra/sql/production-rls-policies.sql,
-- which no deploy path applies - only CI, the rehearsal script and the
-- production-like acceptance harness reference it.
--
-- This is the same defect 20260807006000 fixed for deal_participants, in the
-- opposite direction. There the missing policy made a migration-only database
-- fail closed; here the surviving permissive policy makes it fail open.
--
-- The permissive policy cannot simply be dropped: it is the only SELECT policy
-- present, so dropping it alone would deny every audit and ledger read. The
-- strict policies are therefore installed in the same statement block.
--
-- Scope note. public."deals" carries the same shape of defect - deals_app_access
-- USING (TRUE) survives in the chain and ORs away the strict deals_select - and
-- it is deliberately NOT fixed here. Closing it requires a deals_update policy,
-- which exists only in the artifact, and the artifact has drifted from the
-- chain in both directions: its deals_insert is broader than the narrowing
-- 20260712195000 installed, and its deals_select is missing the
-- app_deal_basis_deal_visible branch the chain has. Copying it would revert a
-- deliberate tightening. That table needs its own pass with the deal command
-- path exercised against it. Both are recorded in #4814.
--
-- Every statement is idempotent, so the database converges on the same state
-- whether or not the artifact was ever applied to it.

-- ── audit_events: append-only ─────────────────────────────────────────────────
ALTER TABLE public."audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_insert_only ON public."audit_events";
DROP POLICY IF EXISTS audit_select_all ON public."audit_events";
DROP POLICY IF EXISTS audit_events_select ON public."audit_events";
DROP POLICY IF EXISTS audit_events_insert ON public."audit_events";
CREATE POLICY audit_events_select ON public."audit_events" FOR SELECT USING (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR "orgId" = current_setting('app.current_org_id', true)
    OR ("dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId"))
  )
);
CREATE POLICY audit_events_insert ON public."audit_events" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND "actorRole" = current_setting('app.current_role', true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "orgId" = current_setting('app.current_org_id', true)
  AND ("dealId" IS NULL OR public.app_rls_deal_visible("dealId"))
);
-- No UPDATE/DELETE policies.

-- ── ledger_entries: immutable financial journal ───────────────────────────────
ALTER TABLE public."ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_entries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledger_insert_only ON public."ledger_entries";
DROP POLICY IF EXISTS ledger_select_all ON public."ledger_entries";
DROP POLICY IF EXISTS ledger_entries_select ON public."ledger_entries";
DROP POLICY IF EXISTS ledger_entries_insert ON public."ledger_entries";
CREATE POLICY ledger_entries_select ON public."ledger_entries" FOR SELECT USING (
  public.app_rls_context_ready() AND (
    "debitAccount" = current_setting('app.current_org_id', true)
    OR "creditAccount" = current_setting('app.current_org_id', true)
    OR ("dealId" IS NOT NULL AND public.app_rls_deal_visible("dealId"))
  )
);
CREATE POLICY ledger_entries_insert ON public."ledger_entries" FOR INSERT WITH CHECK (
  public.app_rls_context_ready()
  AND current_setting('app.current_role', true) IN ('ADMIN', 'ACCOUNTING', 'BANK_CALLBACK')
  AND "createdByUserId" = current_setting('app.current_user_id', true)
  AND ("dealId" IS NULL OR public.app_rls_deal_visible("dealId"))
);
-- No UPDATE/DELETE policies.
