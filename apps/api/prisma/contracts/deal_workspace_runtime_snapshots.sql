-- VP-3.33 Deal Workspace Runtime Persistence DB Contract
-- Status: canonical contract aligned with the additive migration.
-- Important: presence in the repository does not mean the production migration is applied.

-- Existing canonical evidence tables are extended; no parallel outbox or audit tables are created.
ALTER TABLE "outbox_entries"
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "auditId" TEXT,
  ADD COLUMN IF NOT EXISTS "runtimeSnapshotId" TEXT,
  ADD COLUMN IF NOT EXISTS "runtimeIdempotencyKey" TEXT;

ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "runtimeSnapshotId" TEXT,
  ADD COLUMN IF NOT EXISTS "runtimeIdempotencyKey" TEXT;

CREATE TABLE IF NOT EXISTS "deal_workspace_runtime_snapshots" (
  "id" TEXT PRIMARY KEY,
  "runtimeSnapshotId" TEXT NOT NULL UNIQUE,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "dealId" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "state" TEXT NOT NULL CHECK (
    "state" IN ('ready_to_persist', 'outbox_required', 'audit_required', 'fully_linked')
  ),
  "snapshotState" TEXT NOT NULL CHECK (
    "snapshotState" IN ('updated', 'blocked', 'duplicate', 'failed')
  ),
  "statusLabel" TEXT NOT NULL,
  "runtimeStoreRecordId" TEXT NOT NULL,
  "runtimeStoreVersion" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "contractHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "outboxEntryId" TEXT UNIQUE,
  "auditEventId" TEXT UNIQUE,
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dw_runtime_snapshots_linkage_check" CHECK (
    ("state" IN ('ready_to_persist', 'outbox_required') AND "outboxEntryId" IS NULL AND "auditEventId" IS NULL)
    OR ("state" = 'audit_required' AND "outboxEntryId" IS NOT NULL AND "auditEventId" IS NULL)
    OR ("state" = 'fully_linked' AND "outboxEntryId" IS NOT NULL AND "auditEventId" IS NOT NULL)
  ),
  CONSTRAINT "dw_runtime_snapshots_deal_fkey"
    FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "dw_runtime_snapshots_outbox_fkey"
    FOREIGN KEY ("outboxEntryId") REFERENCES "outbox_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "dw_runtime_snapshots_audit_fkey"
    FOREIGN KEY ("auditEventId") REFERENCES "audit_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "deal_workspace_runtime_transaction_attempts" (
  "id" TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL UNIQUE,
  "snapshotId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "stage" TEXT NOT NULL CHECK (
    "stage" IN ('created', 'prepared', 'committed', 'rolled_back', 'failed')
  ),
  "outcome" TEXT,
  "failureCode" TEXT,
  "failureReason" TEXT,
  "isReplay" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "dw_runtime_attempts_snapshot_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "deal_workspace_runtime_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "dw_runtime_snapshots_deal_created_idx"
  ON "deal_workspace_runtime_snapshots" ("dealId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "dw_runtime_snapshots_intent_state_idx"
  ON "deal_workspace_runtime_snapshots" ("intentId", "state");
CREATE INDEX IF NOT EXISTS "dw_runtime_snapshots_correlation_idx"
  ON "deal_workspace_runtime_snapshots" ("correlationId");
CREATE INDEX IF NOT EXISTS "dw_runtime_attempts_snapshot_started_idx"
  ON "deal_workspace_runtime_transaction_attempts" ("snapshotId", "startedAt" DESC);
CREATE INDEX IF NOT EXISTS "dw_runtime_attempts_stage_started_idx"
  ON "deal_workspace_runtime_transaction_attempts" ("stage", "startedAt");

-- Linkage contract:
-- 1. Persist one canonical runtime snapshot row using runtimeSnapshotId and idempotencyKey.
-- 2. Create the canonical outbox_entries row and link it before state becomes audit_required.
-- 3. Create the canonical audit_events row and link it before state becomes fully_linked.
-- 4. A row cannot regress or replace accepted evidence identifiers at the repository layer.
-- 5. Transaction attempts are append-only operational evidence for prepare/commit/rollback/failure/replay.
