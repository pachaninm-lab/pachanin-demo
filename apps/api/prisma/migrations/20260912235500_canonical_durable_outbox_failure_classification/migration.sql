-- IR-20: durable failure taxonomy for the canonical PostgreSQL outbox.
-- Ambiguous post-send outcomes are parked for governed reconciliation and are
-- never eligible for an automatic retry.

ALTER TABLE public."outbox_entries"
  ADD COLUMN IF NOT EXISTS "lastErrorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "lastErrorCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manualReviewAt" TIMESTAMP(3);

ALTER TABLE public."outbox_entries"
  DROP CONSTRAINT IF EXISTS outbox_entries_last_error_category_check;

ALTER TABLE public."outbox_entries"
  ADD CONSTRAINT outbox_entries_last_error_category_check
  CHECK (
    "lastErrorCategory" IS NULL
    OR "lastErrorCategory" IN ('TRANSIENT', 'PERMANENT', 'AMBIGUOUS')
  );

DO $outbox_failure_columns$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_deal') THEN
    GRANT UPDATE (
      "lastErrorCode", "lastErrorCategory", "lastAttemptAt", "manualReviewAt"
    ) ON TABLE public."outbox_entries" TO app_deal;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_outbox') THEN
    GRANT UPDATE (
      "lastErrorCode", "lastErrorCategory", "lastAttemptAt", "manualReviewAt"
    ) ON TABLE public."outbox_entries" TO app_outbox;
  END IF;
END
$outbox_failure_columns$;
