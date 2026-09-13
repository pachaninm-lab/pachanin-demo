-- IR-20: durable failure taxonomy for the canonical PostgreSQL outbox.
-- Ambiguous post-send outcomes are parked for governed reconciliation and are
-- never eligible for an automatic retry.

ALTER TABLE public."outbox_entries"
  ADD COLUMN IF NOT EXISTS "lastErrorCode" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "lastErrorCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manualReviewAt" TIMESTAMP(3);

ALTER TABLE public."outbox_redrive_events"
  ADD COLUMN IF NOT EXISTS "previousErrorCode" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "previousErrorCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "previousLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "previousManualReviewAt" TIMESTAMP(3);

ALTER TABLE public."outbox_entries"
  DROP CONSTRAINT IF EXISTS outbox_entries_last_error_category_check;

ALTER TABLE public."outbox_entries"
  ADD CONSTRAINT outbox_entries_last_error_category_check
  CHECK (
    "lastErrorCategory" IS NULL
    OR "lastErrorCategory" IN ('TRANSIENT', 'PERMANENT', 'AMBIGUOUS')
  );

CREATE OR REPLACE FUNCTION public.outbox_expired_attempt_reclaim_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $guard$
BEGIN
  IF OLD."status" = 'PROCESSING'
     AND OLD."leaseExpiresAt" < statement_timestamp()
     AND OLD."lastAttemptAt" IS NOT NULL
     AND NEW."status" = 'PROCESSING'
     AND NEW."leaseToken" IS DISTINCT FROM OLD."leaseToken" THEN
    NEW."status" := 'MANUAL_REVIEW';
    NEW."retryCount" := OLD."retryCount" + 1;
    NEW."lastError" := 'Worker lease expired after an external delivery attempt started';
    NEW."lastErrorCode" := 'WORKER_CRASH_OUTCOME_UNKNOWN';
    NEW."lastErrorCategory" := 'AMBIGUOUS';
    NEW."manualReviewAt" := statement_timestamp();
    NEW."failedAt" := statement_timestamp();
    NEW."leaseOwner" := NULL;
    NEW."leaseToken" := NULL;
    NEW."leaseExpiresAt" := NULL;
    NEW."heartbeatAt" := NULL;
  END IF;
  RETURN NEW;
END
$guard$;

DROP TRIGGER IF EXISTS outbox_expired_attempt_reclaim_guard_trigger
  ON public."outbox_entries";
CREATE TRIGGER outbox_expired_attempt_reclaim_guard_trigger
  BEFORE UPDATE ON public."outbox_entries"
  FOR EACH ROW
  EXECUTE FUNCTION public.outbox_expired_attempt_reclaim_guard();

ALTER TABLE public."outbox_redrive_events"
  DROP CONSTRAINT IF EXISTS outbox_redrive_events_previous_error_category_check;

ALTER TABLE public."outbox_redrive_events"
  ADD CONSTRAINT outbox_redrive_events_previous_error_category_check
  CHECK (
    "previousErrorCategory" IS NULL
    OR "previousErrorCategory" IN ('TRANSIENT', 'PERMANENT', 'AMBIGUOUS')
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
