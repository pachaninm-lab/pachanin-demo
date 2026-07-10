-- platform-v7 PostgreSQL 16 Row Level Security policy set.
--
-- IMPORTANT:
-- - This file is a deployment artifact, not proof that production RLS is enabled.
-- - Apply only after the canonical Prisma schema exists.
-- - The API must set all five app.current_* values with set_config(..., true)
--   inside the same transaction that performs protected reads/writes.
-- - No session-level context setter is created here.

BEGIN;

-- Remove the legacy three-field, session-level helper. The API now sets the
-- complete context directly and transaction-locally through RlsTransactionService.
DROP FUNCTION IF EXISTS public.set_app_context(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.app_rls_context_ready()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT
    NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_org_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_tenant_id', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_role', true), '') IS NOT NULL
    AND NULLIF(current_setting('app.current_session_id', true), '') IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.app_rls_privileged()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT current_setting('app.current_role', true) IN (
    'ADMIN',
    'COMPLIANCE_OFFICER',
    'SUPPORT_MANAGER'
  )
$$;

COMMENT ON FUNCTION public.app_rls_context_ready() IS
  'True only when the complete trusted transaction-local RLS context is present.';
COMMENT ON FUNCTION public.app_rls_privileged() IS
  'True for platform roles allowed to perform explicitly defined cross-organization reads.';

-- ── deals ─────────────────────────────────────────────────────────────────────
ALTER TABLE public."deals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deals" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deals_select ON public."deals";
DROP POLICY IF EXISTS deals_insert ON public."deals";
DROP POLICY IF EXISTS deals_update ON public."deals";

CREATE POLICY deals_select ON public."deals"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      "tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        "sellerOrgId" = current_setting('app.current_org_id', true)
        OR "buyerOrgId" = current_setting('app.current_org_id', true)
      )
    )
    OR (
      current_setting('app.current_role', true) = 'ARBITRATOR'
      AND EXISTS (
        SELECT 1
        FROM public."disputes" d
        WHERE d."dealId" = "deals"."id"
          AND d."arbitratorId" = current_setting('app.current_user_id', true)
          AND d."status" IN ('OPEN', 'ARBITRATION')
      )
    )
  )
);

CREATE POLICY deals_insert ON public."deals"
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR "sellerOrgId" = current_setting('app.current_org_id', true)
    OR "buyerOrgId" = current_setting('app.current_org_id', true)
  )
);

CREATE POLICY deals_update ON public."deals"
FOR UPDATE
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      "tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        "sellerOrgId" = current_setting('app.current_org_id', true)
        OR "buyerOrgId" = current_setting('app.current_org_id', true)
      )
    )
  )
)
WITH CHECK (
  public.app_rls_context_ready()
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    public.app_rls_privileged()
    OR "sellerOrgId" = current_setting('app.current_org_id', true)
    OR "buyerOrgId" = current_setting('app.current_org_id', true)
  )
);

-- No DELETE policy: physical deal deletion is denied.

-- ── organizations ─────────────────────────────────────────────────────────────
ALTER TABLE public."organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."organizations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select ON public."organizations";
DROP POLICY IF EXISTS organizations_write_privileged ON public."organizations";

CREATE POLICY organizations_select ON public."organizations"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      "id" = current_setting('app.current_org_id', true)
      AND "tenantId" = current_setting('app.current_tenant_id', true)
    )
  )
);

CREATE POLICY organizations_write_privileged ON public."organizations"
FOR ALL
USING (public.app_rls_context_ready() AND public.app_rls_privileged())
WITH CHECK (public.app_rls_context_ready() AND public.app_rls_privileged());

-- ── audit_events: append-only ─────────────────────────────────────────────────
ALTER TABLE public."audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."audit_events" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_select ON public."audit_events";
DROP POLICY IF EXISTS audit_events_insert ON public."audit_events";

CREATE POLICY audit_events_select ON public."audit_events"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      "tenantId" = current_setting('app.current_tenant_id', true)
      AND "orgId" = current_setting('app.current_org_id', true)
    )
    OR (
      "dealId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."deals" d
        WHERE d."id" = "audit_events"."dealId"
          AND d."tenantId" = current_setting('app.current_tenant_id', true)
          AND (
            d."sellerOrgId" = current_setting('app.current_org_id', true)
            OR d."buyerOrgId" = current_setting('app.current_org_id', true)
          )
      )
    )
  )
);

CREATE POLICY audit_events_insert ON public."audit_events"
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND "actorRole" = current_setting('app.current_role', true)
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "orgId" = current_setting('app.current_org_id', true)
  AND (
    "dealId" IS NULL
    OR public.app_rls_privileged()
    OR EXISTS (
      SELECT 1
      FROM public."deals" d
      WHERE d."id" = "audit_events"."dealId"
        AND d."tenantId" = current_setting('app.current_tenant_id', true)
        AND (
          d."sellerOrgId" = current_setting('app.current_org_id', true)
          OR d."buyerOrgId" = current_setting('app.current_org_id', true)
        )
    )
  )
);

-- No UPDATE/DELETE policies: audit is append-only.

-- ── ledger_entries: immutable financial journal ───────────────────────────────
ALTER TABLE public."ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_entries_select ON public."ledger_entries";
DROP POLICY IF EXISTS ledger_entries_insert ON public."ledger_entries";

CREATE POLICY ledger_entries_select ON public."ledger_entries"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    current_setting('app.current_role', true) IN (
      'ADMIN', 'ACCOUNTING', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER'
    )
    OR "debitAccount" = current_setting('app.current_org_id', true)
    OR "creditAccount" = current_setting('app.current_org_id', true)
    OR (
      "dealId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."deals" d
        WHERE d."id" = "ledger_entries"."dealId"
          AND d."tenantId" = current_setting('app.current_tenant_id', true)
          AND (
            d."sellerOrgId" = current_setting('app.current_org_id', true)
            OR d."buyerOrgId" = current_setting('app.current_org_id', true)
          )
      )
    )
  )
);

CREATE POLICY ledger_entries_insert ON public."ledger_entries"
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND current_setting('app.current_role', true) IN ('ADMIN', 'ACCOUNTING')
  AND "createdByUserId" = current_setting('app.current_user_id', true)
  AND (
    "dealId" IS NULL
    OR public.app_rls_privileged()
    OR EXISTS (
      SELECT 1
      FROM public."deals" d
      WHERE d."id" = "ledger_entries"."dealId"
        AND d."tenantId" = current_setting('app.current_tenant_id', true)
        AND (
          d."sellerOrgId" = current_setting('app.current_org_id', true)
          OR d."buyerOrgId" = current_setting('app.current_org_id', true)
        )
    )
  )
);

-- No UPDATE/DELETE policies: ledger entries are immutable.

-- ── integration_events ────────────────────────────────────────────────────────
ALTER TABLE public."integration_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."integration_events" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_events_select ON public."integration_events";
DROP POLICY IF EXISTS integration_events_insert ON public."integration_events";

CREATE POLICY integration_events_select ON public."integration_events"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      "dealId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."deals" d
        WHERE d."id" = "integration_events"."dealId"
          AND d."tenantId" = current_setting('app.current_tenant_id', true)
          AND (
            d."sellerOrgId" = current_setting('app.current_org_id', true)
            OR d."buyerOrgId" = current_setting('app.current_org_id', true)
          )
      )
    )
  )
);

CREATE POLICY integration_events_insert ON public."integration_events"
FOR INSERT
WITH CHECK (
  current_user IN ('app_service', 'app_integration_worker')
  OR (public.app_rls_context_ready() AND public.app_rls_privileged())
);

-- ── outbox_entries ────────────────────────────────────────────────────────────
ALTER TABLE public."outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."outbox_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_entries_worker ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_select ON public."outbox_entries";
DROP POLICY IF EXISTS outbox_entries_insert ON public."outbox_entries";

CREATE POLICY outbox_entries_worker ON public."outbox_entries"
FOR ALL
USING (current_user IN ('app_service', 'app_outbox_worker'))
WITH CHECK (current_user IN ('app_service', 'app_outbox_worker'));

CREATE POLICY outbox_entries_select ON public."outbox_entries"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      "dealId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."deals" d
        WHERE d."id" = "outbox_entries"."dealId"
          AND d."tenantId" = current_setting('app.current_tenant_id', true)
          AND (
            d."sellerOrgId" = current_setting('app.current_org_id', true)
            OR d."buyerOrgId" = current_setting('app.current_org_id', true)
          )
      )
    )
  )
);

CREATE POLICY outbox_entries_insert ON public."outbox_entries"
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR (
      "dealId" IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public."deals" d
        WHERE d."id" = "outbox_entries"."dealId"
          AND d."tenantId" = current_setting('app.current_tenant_id', true)
          AND (
            d."sellerOrgId" = current_setting('app.current_org_id', true)
            OR d."buyerOrgId" = current_setting('app.current_org_id', true)
          )
      )
    )
  )
);

-- ── deal_workspace_runtime_snapshots ─────────────────────────────────────────
ALTER TABLE public."deal_workspace_runtime_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_workspace_runtime_snapshots" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_snapshots_select ON public."deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS runtime_snapshots_insert ON public."deal_workspace_runtime_snapshots";

CREATE POLICY runtime_snapshots_select ON public."deal_workspace_runtime_snapshots"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND (
    public.app_rls_privileged()
    OR EXISTS (
      SELECT 1
      FROM public."deals" d
      WHERE d."id" = "deal_workspace_runtime_snapshots"."dealId"
        AND d."tenantId" = current_setting('app.current_tenant_id', true)
        AND (
          d."sellerOrgId" = current_setting('app.current_org_id', true)
          OR d."buyerOrgId" = current_setting('app.current_org_id', true)
        )
    )
  )
);

CREATE POLICY runtime_snapshots_insert ON public."deal_workspace_runtime_snapshots"
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND "actorId" = current_setting('app.current_user_id', true)
  AND "actorRole" = current_setting('app.current_role', true)
  AND (
    public.app_rls_privileged()
    OR EXISTS (
      SELECT 1
      FROM public."deals" d
      WHERE d."id" = "deal_workspace_runtime_snapshots"."dealId"
        AND d."tenantId" = current_setting('app.current_tenant_id', true)
        AND (
          d."sellerOrgId" = current_setting('app.current_org_id', true)
          OR d."buyerOrgId" = current_setting('app.current_org_id', true)
        )
    )
  )
);

-- No UPDATE/DELETE policies: persisted runtime snapshots are immutable.

-- ── deal_workspace_runtime_transaction_attempts ───────────────────────────────
ALTER TABLE public."deal_workspace_runtime_transaction_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."deal_workspace_runtime_transaction_attempts" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_attempts_select ON public."deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_attempts_insert ON public."deal_workspace_runtime_transaction_attempts";

CREATE POLICY runtime_attempts_select ON public."deal_workspace_runtime_transaction_attempts"
FOR SELECT
USING (
  public.app_rls_context_ready()
  AND EXISTS (
    SELECT 1
    FROM public."deal_workspace_runtime_snapshots" s
    WHERE s."id" = "deal_workspace_runtime_transaction_attempts"."snapshotId"
  )
);

CREATE POLICY runtime_attempts_insert ON public."deal_workspace_runtime_transaction_attempts"
FOR INSERT
WITH CHECK (
  public.app_rls_context_ready()
  AND EXISTS (
    SELECT 1
    FROM public."deal_workspace_runtime_snapshots" s
    WHERE s."id" = "deal_workspace_runtime_transaction_attempts"."snapshotId"
      AND (
        public.app_rls_privileged()
        OR s."actorId" = current_setting('app.current_user_id', true)
      )
  )
);

-- No UPDATE/DELETE policies: transaction attempts are append-only.

COMMIT;
