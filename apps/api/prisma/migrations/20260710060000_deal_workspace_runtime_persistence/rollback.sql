-- VP-3.33 operational rollback
-- Run only under an approved maintenance procedure after verifying that no runtime
-- snapshot data must be retained. This file is not executed automatically by Prisma.

DROP TABLE IF EXISTS "deal_workspace_runtime_transaction_attempts";
DROP TABLE IF EXISTS "deal_workspace_runtime_snapshots";

DROP INDEX IF EXISTS "outbox_entries_runtime_snapshot_idx";
DROP INDEX IF EXISTS "outbox_entries_runtime_correlation_idx";
DROP INDEX IF EXISTS "audit_events_runtime_snapshot_idx";
DROP INDEX IF EXISTS "audit_events_runtime_correlation_idx";

ALTER TABLE "outbox_entries"
  DROP COLUMN IF EXISTS "runtimeIdempotencyKey",
  DROP COLUMN IF EXISTS "runtimeSnapshotId",
  DROP COLUMN IF EXISTS "auditId",
  DROP COLUMN IF EXISTS "correlationId";

ALTER TABLE "audit_events"
  DROP COLUMN IF EXISTS "runtimeIdempotencyKey",
  DROP COLUMN IF EXISTS "runtimeSnapshotId",
  DROP COLUMN IF EXISTS "correlationId";
