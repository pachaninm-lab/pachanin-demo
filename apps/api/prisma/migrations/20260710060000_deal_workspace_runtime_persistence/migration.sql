-- VP-3.33 Deal Workspace Runtime Persistence
-- Additive PostgreSQL migration. Merging this file does not apply it to production.

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
  "id" TEXT NOT NULL,
  "runtimeSnapshotId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "intentId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "snapshotState" TEXT NOT NULL,
  "statusLabel" TEXT NOT NULL,
  "runtimeStoreRecordId" TEXT NOT NULL,
  "runtimeStoreVersion" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "contractHash" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "outboxEntryId" TEXT,
  "auditEventId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "deal_workspace_runtime_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "deal_workspace_runtime_transaction_attempts" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "snapshotId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "auditId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "outcome" TEXT,
  "failureCode" TEXT,
  "failureReason" TEXT,
  "isReplay" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  CONSTRAINT "deal_workspace_runtime_transaction_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "dw_runtime_snapshots_runtime_snapshot_id_key"
  ON "deal_workspace_runtime_snapshots" ("runtimeSnapshotId");
CREATE UNIQUE INDEX IF NOT EXISTS "dw_runtime_snapshots_idempotency_key_key"
  ON "deal_workspace_runtime_snapshots" ("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "dw_runtime_snapshots_outbox_entry_id_key"
  ON "deal_workspace_runtime_snapshots" ("outboxEntryId");
CREATE UNIQUE INDEX IF NOT EXISTS "dw_runtime_snapshots_audit_event_id_key"
  ON "deal_workspace_runtime_snapshots" ("auditEventId");
CREATE INDEX IF NOT EXISTS "dw_runtime_snapshots_deal_created_idx"
  ON "deal_workspace_runtime_snapshots" ("dealId", "createdAt");
CREATE INDEX IF NOT EXISTS "dw_runtime_snapshots_intent_state_idx"
  ON "deal_workspace_runtime_snapshots" ("intentId", "state");
CREATE INDEX IF NOT EXISTS "dw_runtime_snapshots_correlation_idx"
  ON "deal_workspace_runtime_snapshots" ("correlationId");
CREATE INDEX IF NOT EXISTS "dw_runtime_snapshots_state_updated_idx"
  ON "deal_workspace_runtime_snapshots" ("state", "updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "dw_runtime_attempts_transaction_id_key"
  ON "deal_workspace_runtime_transaction_attempts" ("transactionId");
CREATE INDEX IF NOT EXISTS "dw_runtime_attempts_snapshot_started_idx"
  ON "deal_workspace_runtime_transaction_attempts" ("snapshotId", "startedAt");
CREATE INDEX IF NOT EXISTS "dw_runtime_attempts_stage_started_idx"
  ON "deal_workspace_runtime_transaction_attempts" ("stage", "startedAt");
CREATE INDEX IF NOT EXISTS "dw_runtime_attempts_idempotency_idx"
  ON "deal_workspace_runtime_transaction_attempts" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "dw_runtime_attempts_correlation_idx"
  ON "deal_workspace_runtime_transaction_attempts" ("correlationId");

CREATE INDEX IF NOT EXISTS "outbox_entries_runtime_snapshot_idx"
  ON "outbox_entries" ("runtimeSnapshotId");
CREATE INDEX IF NOT EXISTS "outbox_entries_runtime_correlation_idx"
  ON "outbox_entries" ("correlationId");
CREATE INDEX IF NOT EXISTS "audit_events_runtime_snapshot_idx"
  ON "audit_events" ("runtimeSnapshotId");
CREATE INDEX IF NOT EXISTS "audit_events_runtime_correlation_idx"
  ON "audit_events" ("correlationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_snapshots_state_check'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_snapshots"
      ADD CONSTRAINT "dw_runtime_snapshots_state_check"
      CHECK ("state" IN ('ready_to_persist', 'outbox_required', 'audit_required', 'fully_linked'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_snapshots_snapshot_state_check'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_snapshots"
      ADD CONSTRAINT "dw_runtime_snapshots_snapshot_state_check"
      CHECK ("snapshotState" IN ('updated', 'blocked', 'duplicate', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_snapshots_version_check'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_snapshots"
      ADD CONSTRAINT "dw_runtime_snapshots_version_check"
      CHECK ("version" > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_snapshots_linkage_check'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_snapshots"
      ADD CONSTRAINT "dw_runtime_snapshots_linkage_check"
      CHECK (
        ("state" IN ('ready_to_persist', 'outbox_required') AND "outboxEntryId" IS NULL AND "auditEventId" IS NULL)
        OR ("state" = 'audit_required' AND "outboxEntryId" IS NOT NULL AND "auditEventId" IS NULL)
        OR ("state" = 'fully_linked' AND "outboxEntryId" IS NOT NULL AND "auditEventId" IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_attempts_stage_check'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_transaction_attempts"
      ADD CONSTRAINT "dw_runtime_attempts_stage_check"
      CHECK ("stage" IN ('created', 'prepared', 'committed', 'rolled_back', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_snapshots_deal_fkey'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_snapshots"
      ADD CONSTRAINT "dw_runtime_snapshots_deal_fkey"
      FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_snapshots_outbox_fkey'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_snapshots"
      ADD CONSTRAINT "dw_runtime_snapshots_outbox_fkey"
      FOREIGN KEY ("outboxEntryId") REFERENCES "outbox_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_snapshots_audit_fkey'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_snapshots"
      ADD CONSTRAINT "dw_runtime_snapshots_audit_fkey"
      FOREIGN KEY ("auditEventId") REFERENCES "audit_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dw_runtime_attempts_snapshot_fkey'
  ) THEN
    ALTER TABLE "deal_workspace_runtime_transaction_attempts"
      ADD CONSTRAINT "dw_runtime_attempts_snapshot_fkey"
      FOREIGN KEY ("snapshotId") REFERENCES "deal_workspace_runtime_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
