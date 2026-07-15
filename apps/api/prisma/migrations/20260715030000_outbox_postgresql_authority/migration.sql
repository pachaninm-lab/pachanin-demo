-- Consolidate outbox_entries as the single durable queue authority.
-- Delivery ownership is fenced by a per-claim lease token. Administrative
-- re-drive facts are append-only and cannot rewrite delivery receipts.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public."outbox_entries"
  ADD COLUMN IF NOT EXISTS "triggeredByUserId" text,
  ADD COLUMN IF NOT EXISTS "requestFingerprint" text,
  ADD COLUMN IF NOT EXISTS "leaseToken" text,
  ADD COLUMN IF NOT EXISTS "redriveCount" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastRedriveAt" timestamptz,
  ADD COLUMN IF NOT EXISTS "lastRedriveBy" text,
  ADD COLUMN IF NOT EXISTS "lastRedriveReason" text;

UPDATE public."outbox_entries"
SET "status" = 'DEAD_LETTER'
WHERE "status" = 'DEAD';

ALTER TABLE public."outbox_entries"
  ADD CONSTRAINT outbox_entries_status_check CHECK (
    "status" IN (
      'PENDING','PROCESSING','SENT','CONFIRMED','FAILED','MANUAL_REVIEW','DEAD_LETTER'
    )
  ) NOT VALID;
ALTER TABLE public."outbox_entries" VALIDATE CONSTRAINT outbox_entries_status_check;

ALTER TABLE public."outbox_entries"
  ADD CONSTRAINT outbox_entries_retry_check CHECK (
    "retryCount" >= 0 AND "maxRetries" > 0 AND "redriveCount" >= 0
  ) NOT VALID;
ALTER TABLE public."outbox_entries" VALIDATE CONSTRAINT outbox_entries_retry_check;

ALTER TABLE public."outbox_entries"
  ADD CONSTRAINT outbox_entries_lease_shape_check CHECK (
    ("status" = 'PROCESSING' AND "leaseOwner" IS NOT NULL
      AND "leaseToken" IS NOT NULL AND "leaseExpiresAt" IS NOT NULL)
    OR
    ("status" <> 'PROCESSING' AND "leaseOwner" IS NULL
      AND "leaseToken" IS NULL AND "leaseExpiresAt" IS NULL)
  ) NOT VALID;
ALTER TABLE public."outbox_entries" VALIDATE CONSTRAINT outbox_entries_lease_shape_check;

CREATE INDEX IF NOT EXISTS outbox_entries_due_claim_idx
  ON public."outbox_entries" ("nextRetryAt", "createdAt", "id")
  WHERE "status" = 'PENDING';
CREATE INDEX IF NOT EXISTS outbox_entries_expired_lease_idx
  ON public."outbox_entries" ("leaseExpiresAt", "createdAt", "id")
  WHERE "status" = 'PROCESSING';
CREATE INDEX IF NOT EXISTS outbox_entries_dead_letter_idx
  ON public."outbox_entries" ("deadLetterAt" DESC, "id")
  WHERE "status" = 'DEAD_LETTER';
CREATE INDEX IF NOT EXISTS outbox_entries_triggered_by_idx
  ON public."outbox_entries" ("triggeredByUserId", "createdAt" DESC)
  WHERE "triggeredByUserId" IS NOT NULL;

CREATE TABLE IF NOT EXISTS public."outbox_redrive_events" (
  "id" text PRIMARY KEY,
  "entryId" text NOT NULL,
  "actorUserId" text NOT NULL,
  "actorRole" text NOT NULL,
  "reason" text NOT NULL,
  "idempotencyKey" text NOT NULL UNIQUE,
  "beforeStatus" text NOT NULL,
  "beforeRetryCount" integer NOT NULL,
  "afterStatus" text NOT NULL,
  "prevHash" text,
  "hash" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT outbox_redrive_entry_fkey FOREIGN KEY ("entryId")
    REFERENCES public."outbox_entries"("id") ON DELETE RESTRICT,
  CONSTRAINT outbox_redrive_before_status_check CHECK ("beforeStatus" = 'DEAD_LETTER'),
  CONSTRAINT outbox_redrive_after_status_check CHECK ("afterStatus" = 'PENDING'),
  CONSTRAINT outbox_redrive_before_retry_check CHECK ("beforeRetryCount" >= 0),
  CONSTRAINT outbox_redrive_prev_hash_check CHECK (
    "prevHash" IS NULL OR "prevHash" ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT outbox_redrive_hash_check CHECK ("hash" ~ '^[0-9a-f]{64}$')
);
CREATE INDEX IF NOT EXISTS outbox_redrive_entry_created_idx
  ON public."outbox_redrive_events" ("entryId", "createdAt", "id");

DROP TRIGGER IF EXISTS outbox_redrive_events_append_only ON public."outbox_redrive_events";
CREATE TRIGGER outbox_redrive_events_append_only
BEFORE UPDATE OR DELETE ON public."outbox_redrive_events"
FOR EACH ROW EXECUTE FUNCTION public.industrial_forbid_mutation();

DO $outbox_app_role_grants$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE public."outbox_entries" TO app_deal;
    REVOKE DELETE ON TABLE public."outbox_entries" FROM app_deal;
    GRANT SELECT, INSERT ON TABLE public."outbox_redrive_events" TO app_deal;
    REVOKE UPDATE, DELETE ON TABLE public."outbox_redrive_events" FROM app_deal;
  END IF;
END
$outbox_app_role_grants$;

COMMENT ON TABLE public."outbox_redrive_events" IS
  'Append-only operator re-drive evidence for the canonical PostgreSQL outbox.';
COMMENT ON COLUMN public."outbox_entries"."leaseToken" IS
  'Per-claim fencing token required for heartbeat, delivery acknowledgement and failure acknowledgement.';
