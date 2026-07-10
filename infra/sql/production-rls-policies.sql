-- Прозрачная Цена — PostgreSQL RLS policies for the canonical persistence layer.
-- Apply only after Prisma migrations and only through the controlled release runbook.
-- The API establishes transaction-local context directly through RlsTransactionService.
-- This file never creates a session-level context helper.

BEGIN;

-- Remove obsolete helpers that used session-level set_config(..., false).
DROP FUNCTION IF EXISTS set_app_context(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS set_app_context(TEXT, TEXT, TEXT, TEXT, TEXT);

-- Every policy below requires a non-empty trusted tenant context.
-- The production application database role is expected to be app_service.

-- ── Deals ─────────────────────────────────────────────────────────────────────
ALTER TABLE "deals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deals" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deals_select ON "deals";
DROP POLICY IF EXISTS deals_insert ON "deals";
DROP POLICY IF EXISTS deals_update ON "deals";
DROP POLICY IF EXISTS deals_delete_denied ON "deals";

CREATE POLICY deals_select ON "deals" FOR SELECT
USING (
  current_setting('app.current_tenant_id', true) <> ''
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER', 'EXECUTIVE')
    OR "sellerOrgId" = current_setting('app.current_org_id', true)
    OR "buyerOrgId" = current_setting('app.current_org_id', true)
    OR (
      current_setting('app.current_role', true) = 'ARBITRATOR'
      AND EXISTS (
        SELECT 1
        FROM "disputes" d
        WHERE d."dealId" = "deals"."id"
          AND d."arbitratorId" = current_setting('app.current_user_id', true)
          AND d."status" IN ('OPEN', 'ARBITRATION')
      )
    )
  )
);

CREATE POLICY deals_insert ON "deals" FOR INSERT
WITH CHECK (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
    OR "sellerOrgId" = current_setting('app.current_org_id', true)
    OR "buyerOrgId" = current_setting('app.current_org_id', true)
  )
);

CREATE POLICY deals_update ON "deals" FOR UPDATE
USING (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
    OR "sellerOrgId" = current_setting('app.current_org_id', true)
    OR "buyerOrgId" = current_setting('app.current_org_id', true)
  )
)
WITH CHECK (
  "tenantId" = current_setting('app.current_tenant_id', true)
);

CREATE POLICY deals_delete_denied ON "deals" FOR DELETE USING (false);

-- ── Organizations ─────────────────────────────────────────────────────────────
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select ON "organizations";
DROP POLICY IF EXISTS organizations_insert ON "organizations";
DROP POLICY IF EXISTS organizations_update ON "organizations";
DROP POLICY IF EXISTS organizations_delete_denied ON "organizations";

CREATE POLICY organizations_select ON "organizations" FOR SELECT
USING (
  current_setting('app.current_tenant_id', true) <> ''
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    "id" = current_setting('app.current_org_id', true)
    OR current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
  )
);

CREATE POLICY organizations_insert ON "organizations" FOR INSERT
WITH CHECK (
  current_user = 'app_service'
  AND current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER')
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "tenantId" = current_setting('app.current_tenant_id', true)
);

CREATE POLICY organizations_update ON "organizations" FOR UPDATE
USING (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    "id" = current_setting('app.current_org_id', true)
    OR current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER')
  )
)
WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

CREATE POLICY organizations_delete_denied ON "organizations" FOR DELETE USING (false);

-- ── Audit events: append-only evidence ────────────────────────────────────────
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_events_select ON "audit_events";
DROP POLICY IF EXISTS audit_events_insert ON "audit_events";
DROP POLICY IF EXISTS audit_events_update_denied ON "audit_events";
DROP POLICY IF EXISTS audit_events_delete_denied ON "audit_events";

CREATE POLICY audit_events_select ON "audit_events" FOR SELECT
USING (
  current_setting('app.current_tenant_id', true) <> ''
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND (
    current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER', 'EXECUTIVE')
    OR (
      "dealId" IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM "deals" d
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

CREATE POLICY audit_events_insert ON "audit_events" FOR INSERT
WITH CHECK (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "tenantId" = current_setting('app.current_tenant_id', true)
  AND "actorUserId" = current_setting('app.current_user_id', true)
  AND "actorRole" = current_setting('app.current_role', true)
  AND (
    "dealId" IS NULL
    OR EXISTS (
      SELECT 1 FROM "deals" d
      WHERE d."id" = "audit_events"."dealId"
        AND d."tenantId" = current_setting('app.current_tenant_id', true)
    )
  )
);

CREATE POLICY audit_events_update_denied ON "audit_events" FOR UPDATE USING (false);
CREATE POLICY audit_events_delete_denied ON "audit_events" FOR DELETE USING (false);

-- ── Ledger entries: immutable money evidence ──────────────────────────────────
ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ledger_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_entries_select ON "ledger_entries";
DROP POLICY IF EXISTS ledger_entries_insert ON "ledger_entries";
DROP POLICY IF EXISTS ledger_entries_update_denied ON "ledger_entries";
DROP POLICY IF EXISTS ledger_entries_delete_denied ON "ledger_entries";

CREATE POLICY ledger_entries_select ON "ledger_entries" FOR SELECT
USING (
  current_setting('app.current_tenant_id', true) <> ''
  AND "dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "ledger_entries"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        d."sellerOrgId" = current_setting('app.current_org_id', true)
        OR d."buyerOrgId" = current_setting('app.current_org_id', true)
        OR current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER', 'EXECUTIVE')
      )
  )
);

CREATE POLICY ledger_entries_insert ON "ledger_entries" FOR INSERT
WITH CHECK (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "ledger_entries"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
);

CREATE POLICY ledger_entries_update_denied ON "ledger_entries" FOR UPDATE USING (false);
CREATE POLICY ledger_entries_delete_denied ON "ledger_entries" FOR DELETE USING (false);

-- ── Integration events ────────────────────────────────────────────────────────
ALTER TABLE "integration_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integration_events" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_events_select ON "integration_events";
DROP POLICY IF EXISTS integration_events_insert ON "integration_events";
DROP POLICY IF EXISTS integration_events_update_denied ON "integration_events";
DROP POLICY IF EXISTS integration_events_delete_denied ON "integration_events";

CREATE POLICY integration_events_select ON "integration_events" FOR SELECT
USING (
  current_setting('app.current_tenant_id', true) <> ''
  AND "dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "integration_events"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        d."sellerOrgId" = current_setting('app.current_org_id', true)
        OR d."buyerOrgId" = current_setting('app.current_org_id', true)
        OR current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER')
      )
  )
);

CREATE POLICY integration_events_insert ON "integration_events" FOR INSERT
WITH CHECK (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "integration_events"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
);

CREATE POLICY integration_events_update_denied ON "integration_events" FOR UPDATE USING (false);
CREATE POLICY integration_events_delete_denied ON "integration_events" FOR DELETE USING (false);

-- ── Outbox entries: service-only delivery queue ───────────────────────────────
ALTER TABLE "outbox_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbox_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbox_entries_service_select ON "outbox_entries";
DROP POLICY IF EXISTS outbox_entries_service_insert ON "outbox_entries";
DROP POLICY IF EXISTS outbox_entries_service_update ON "outbox_entries";
DROP POLICY IF EXISTS outbox_entries_delete_denied ON "outbox_entries";

CREATE POLICY outbox_entries_service_select ON "outbox_entries" FOR SELECT
USING (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "outbox_entries"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
);

CREATE POLICY outbox_entries_service_insert ON "outbox_entries" FOR INSERT
WITH CHECK (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "outbox_entries"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
);

CREATE POLICY outbox_entries_service_update ON "outbox_entries" FOR UPDATE
USING (
  current_user = 'app_service'
  AND current_setting('app.current_tenant_id', true) <> ''
  AND "dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "outbox_entries"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
)
WITH CHECK (
  "dealId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "outbox_entries"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
);

CREATE POLICY outbox_entries_delete_denied ON "outbox_entries" FOR DELETE USING (false);

-- ── Runtime persistence snapshots ─────────────────────────────────────────────
ALTER TABLE "deal_workspace_runtime_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_workspace_runtime_snapshots" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_snapshots_select ON "deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS runtime_snapshots_insert ON "deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS runtime_snapshots_update ON "deal_workspace_runtime_snapshots";
DROP POLICY IF EXISTS runtime_snapshots_delete_denied ON "deal_workspace_runtime_snapshots";

CREATE POLICY runtime_snapshots_select ON "deal_workspace_runtime_snapshots" FOR SELECT
USING (
  current_setting('app.current_tenant_id', true) <> ''
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "deal_workspace_runtime_snapshots"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        d."sellerOrgId" = current_setting('app.current_org_id', true)
        OR d."buyerOrgId" = current_setting('app.current_org_id', true)
        OR current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER', 'EXECUTIVE')
      )
  )
);

CREATE POLICY runtime_snapshots_insert ON "deal_workspace_runtime_snapshots" FOR INSERT
WITH CHECK (
  current_user = 'app_service'
  AND "actorId" = current_setting('app.current_user_id', true)
  AND "actorRole" = current_setting('app.current_role', true)
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "deal_workspace_runtime_snapshots"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
);

CREATE POLICY runtime_snapshots_update ON "deal_workspace_runtime_snapshots" FOR UPDATE
USING (
  current_user = 'app_service'
  AND EXISTS (
    SELECT 1 FROM "deals" d
    WHERE d."id" = "deal_workspace_runtime_snapshots"."dealId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
)
WITH CHECK (
  "actorId" = current_setting('app.current_user_id', true)
  AND "actorRole" = current_setting('app.current_role', true)
);

CREATE POLICY runtime_snapshots_delete_denied ON "deal_workspace_runtime_snapshots" FOR DELETE USING (false);

-- ── Runtime transaction attempts: append-only operational evidence ────────────
ALTER TABLE "deal_workspace_runtime_transaction_attempts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "deal_workspace_runtime_transaction_attempts" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS runtime_attempts_select ON "deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_attempts_insert ON "deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_attempts_update_denied ON "deal_workspace_runtime_transaction_attempts";
DROP POLICY IF EXISTS runtime_attempts_delete_denied ON "deal_workspace_runtime_transaction_attempts";

CREATE POLICY runtime_attempts_select ON "deal_workspace_runtime_transaction_attempts" FOR SELECT
USING (
  current_setting('app.current_tenant_id', true) <> ''
  AND EXISTS (
    SELECT 1
    FROM "deal_workspace_runtime_snapshots" s
    JOIN "deals" d ON d."id" = s."dealId"
    WHERE s."id" = "deal_workspace_runtime_transaction_attempts"."snapshotId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
      AND (
        d."sellerOrgId" = current_setting('app.current_org_id', true)
        OR d."buyerOrgId" = current_setting('app.current_org_id', true)
        OR current_setting('app.current_role', true) IN ('ADMIN', 'COMPLIANCE_OFFICER', 'SUPPORT_MANAGER', 'EXECUTIVE')
      )
  )
);

CREATE POLICY runtime_attempts_insert ON "deal_workspace_runtime_transaction_attempts" FOR INSERT
WITH CHECK (
  current_user = 'app_service'
  AND EXISTS (
    SELECT 1
    FROM "deal_workspace_runtime_snapshots" s
    JOIN "deals" d ON d."id" = s."dealId"
    WHERE s."id" = "deal_workspace_runtime_transaction_attempts"."snapshotId"
      AND d."tenantId" = current_setting('app.current_tenant_id', true)
  )
);

CREATE POLICY runtime_attempts_update_denied ON "deal_workspace_runtime_transaction_attempts" FOR UPDATE USING (false);
CREATE POLICY runtime_attempts_delete_denied ON "deal_workspace_runtime_transaction_attempts" FOR DELETE USING (false);

COMMIT;
