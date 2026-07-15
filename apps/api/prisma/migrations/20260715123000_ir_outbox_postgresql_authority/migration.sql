-- IR-OUTBOX: one PostgreSQL queue authority, tokenized leases and audited redrive.

ALTER TABLE "outbox_entries"
  ADD COLUMN IF NOT EXISTS "triggeredByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseToken" TEXT,
  ADD COLUMN IF NOT EXISTS "heartbeatAt" TIMESTAMP(3);

-- Normalize legacy process-memory statuses into the durable worker vocabulary.
UPDATE "outbox_entries"
SET "status" = 'PENDING',
    "nextRetryAt" = COALESCE("nextRetryAt", NOW())
WHERE "status" = 'FAILED';

UPDATE "outbox_entries"
SET "status" = 'DEAD_LETTER',
    "deadLetterAt" = COALESCE("deadLetterAt", "failedAt", NOW())
WHERE "status" = 'DEAD';

CREATE INDEX IF NOT EXISTS "outbox_entries_claim_idx"
  ON "outbox_entries" ("status", "nextRetryAt", "createdAt", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "outbox_entries_active_lease_token_key"
  ON "outbox_entries" ("leaseToken");

CREATE TABLE IF NOT EXISTS "outbox_redrive_events" (
  "id" TEXT NOT NULL,
  "outboxEntryId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "previousRetryCount" INTEGER NOT NULL,
  "prevHash" TEXT,
  "hash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "outbox_redrive_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "outbox_redrive_events_outboxEntryId_fkey"
    FOREIGN KEY ("outboxEntryId") REFERENCES "outbox_entries"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "outbox_redrive_events_idempotencyKey_key"
  ON "outbox_redrive_events" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "outbox_redrive_events_entry_created_idx"
  ON "outbox_redrive_events" ("outboxEntryId", "createdAt");
CREATE INDEX IF NOT EXISTS "outbox_redrive_events_created_idx"
  ON "outbox_redrive_events" ("createdAt");

CREATE OR REPLACE FUNCTION outbox_redrive_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'outbox_redrive_events is append-only: % is forbidden', TG_OP
    USING ERRCODE = 'raise_exception';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outbox_redrive_events_append_only_trigger ON "outbox_redrive_events";
CREATE TRIGGER outbox_redrive_events_append_only_trigger
  BEFORE UPDATE OR DELETE ON "outbox_redrive_events"
  FOR EACH ROW EXECUTE FUNCTION outbox_redrive_events_append_only();

CREATE OR REPLACE FUNCTION outbox_terminal_receipt_guard() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CONFIRMED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'confirmed outbox receipt % is immutable', OLD."id"
      USING ERRCODE = 'raise_exception';
  END IF;

  IF OLD."status" = 'SENT' AND NEW."status" NOT IN ('SENT', 'CONFIRMED') THEN
    RAISE EXCEPTION 'sent outbox receipt % cannot return to %', OLD."id", NEW."status"
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS outbox_terminal_receipt_guard_trigger ON "outbox_entries";
CREATE TRIGGER outbox_terminal_receipt_guard_trigger
  BEFORE UPDATE ON "outbox_entries"
  FOR EACH ROW EXECUTE FUNCTION outbox_terminal_receipt_guard();

-- The worker runs as the restricted application principal. Grant only the
-- queue columns needed for claiming, heartbeat, retry, acknowledgement and
-- operator redrive. No DELETE, ownership or RLS-bypass privilege is granted.
DO $outbox_app_role_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT SELECT, INSERT ON TABLE public."outbox_entries" TO app_deal;
    GRANT UPDATE (
      "status", "retryCount", "nextRetryAt", "lastError", "sentAt",
      "confirmedAt", "failedAt", "deadLetterAt", "leaseOwner", "leaseToken",
      "leaseExpiresAt", "heartbeatAt"
    ) ON TABLE public."outbox_entries" TO app_deal;

    GRANT SELECT, INSERT ON TABLE public."outbox_redrive_events" TO app_deal;
    REVOKE UPDATE, DELETE ON TABLE public."outbox_redrive_events" FROM app_deal;
    REVOKE DELETE ON TABLE public."outbox_entries" FROM app_deal;
  END IF;
END
$outbox_app_role_grants$;
