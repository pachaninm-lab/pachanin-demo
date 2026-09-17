-- IR-20: canonical PostgreSQL outbox ownership and durable failure taxonomy.
-- Ambiguous post-send outcomes are parked for governed reconciliation and are
-- never eligible for an automatic retry.

ALTER TABLE public."outbox_entries"
  ADD COLUMN IF NOT EXISTS "lastErrorCode" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "lastErrorCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "manualReviewAt" TIMESTAMP(3);

ALTER TABLE public."outbox_redrive_events"
  ADD COLUMN IF NOT EXISTS "requestFingerprint" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "previousErrorCode" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "previousErrorCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "previousLastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "previousManualReviewAt" TIMESTAMP(3);

ALTER TABLE public."outbox_redrive_events"
  DROP CONSTRAINT IF EXISTS outbox_redrive_events_request_fingerprint_check;

ALTER TABLE public."outbox_redrive_events"
  ADD CONSTRAINT outbox_redrive_events_request_fingerprint_check
  CHECK (
    "requestFingerprint" IS NULL
    OR "requestFingerprint" ~ '^[0-9a-f]{64}$'
  ) NOT VALID;

ALTER TABLE public."outbox_redrive_events"
  VALIDATE CONSTRAINT outbox_redrive_events_request_fingerprint_check;

-- A legacy PROCESSING lease predates durable attempt-start evidence. Its
-- external outcome is unknowable, so migration must never make it retryable.
UPDATE public."outbox_entries"
SET "status" = 'MANUAL_REVIEW',
    "retryCount" = "retryCount" + 1,
    "lastError" = 'In-flight row predates durable attempt tracking; delivery outcome is unknown',
    "lastErrorCode" = 'MIGRATION_IN_FLIGHT_OUTCOME_UNKNOWN',
    "lastErrorCategory" = 'AMBIGUOUS',
    "manualReviewAt" = statement_timestamp(),
    "failedAt" = statement_timestamp(),
    "leaseOwner" = NULL,
    "leaseToken" = NULL,
    "leaseExpiresAt" = NULL,
    "heartbeatAt" = NULL
WHERE "status" = 'PROCESSING';

ALTER TABLE public."outbox_entries"
  DROP CONSTRAINT IF EXISTS outbox_entries_last_error_category_check;

ALTER TABLE public."outbox_entries"
  ADD CONSTRAINT outbox_entries_last_error_category_check
  CHECK (
    "lastErrorCategory" IS NULL
    OR "lastErrorCategory" IN ('TRANSIENT', 'PERMANENT')
    OR (
      "lastErrorCategory" = 'AMBIGUOUS'
      AND "status" = 'MANUAL_REVIEW'
      AND "manualReviewAt" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE public."outbox_entries"
  VALIDATE CONSTRAINT outbox_entries_last_error_category_check;

CREATE OR REPLACE FUNCTION public.outbox_expired_attempt_reclaim_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $guard$
BEGIN
  -- The migration runs before the rolling worker update. Reject claim writes
  -- from an old application binary, which does not set the transaction-local
  -- protocol marker, so it cannot create a post-migration ambiguous lease.
  IF (
       (OLD."status" <> 'PROCESSING' AND NEW."status" = 'PROCESSING')
       OR (
         OLD."status" = 'PROCESSING'
         AND NEW."status" = 'PROCESSING'
         AND NEW."leaseToken" IS DISTINCT FROM OLD."leaseToken"
       )
     )
     AND current_user = ANY (ARRAY[
       'app_outbox', 'app_outbox_worker', 'app_deal', 'app_runtime',
       'app_service', 'one_deal_app'
     ])
     -- Marketing delivery remains owned by its dedicated worker during this
     -- rollout. The current shared worker normalizes even a configured custom
     -- marketing identity to marketing-social-*, while the legacy canonical
     -- deployment uses the outbox-worker pod name. Bind the compatibility
     -- bypass to both that identity and its sole event type; a legacy canonical
     -- claimant therefore cannot pass merely by selecting a marketing row.
     AND NOT (
       current_user = 'app_outbox'
       AND OLD."type" = 'MARKETING_SOCIAL_PUBLISH_V1'
       AND NEW."leaseOwner" LIKE 'marketing-social-%'
       AND (OLD."status" <> 'PROCESSING' OR OLD."lastAttemptAt" IS NULL)
     )
     AND current_setting('pc_crop.outbox_claim_protocol', true) IS DISTINCT FROM '2' THEN
    RAISE EXCEPTION 'legacy outbox claim protocol is fenced'
      USING ERRCODE = '42501';
  END IF;

  -- The pre-v2 dedicated marketing worker does not record attempt start before
  -- invoking its external handler. Its narrowly identified compatibility
  -- claim must therefore record that evidence atomically with the lease. If it
  -- crashes before acknowledgement, expiry is ambiguous and is quarantined by
  -- the guard below instead of being published again automatically.
  IF (
       (OLD."status" <> 'PROCESSING' AND NEW."status" = 'PROCESSING')
       OR (
         OLD."status" = 'PROCESSING'
         AND NEW."status" = 'PROCESSING'
         AND NEW."leaseToken" IS DISTINCT FROM OLD."leaseToken"
       )
     )
     AND current_user = 'app_outbox'
     AND OLD."type" = 'MARKETING_SOCIAL_PUBLISH_V1'
     AND NEW."leaseOwner" LIKE 'marketing-social-%'
     AND current_setting('pc_crop.outbox_claim_protocol', true) IS DISTINCT FROM '2' THEN
    NEW."lastAttemptAt" := statement_timestamp();
  END IF;

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
    OR "previousErrorCategory" IN ('TRANSIENT', 'PERMANENT')
    OR (
      "previousErrorCategory" = 'AMBIGUOUS'
      AND "previousStatus" = 'MANUAL_REVIEW'
      AND "previousManualReviewAt" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE public."outbox_redrive_events"
  VALIDATE CONSTRAINT outbox_redrive_events_previous_error_category_check;

-- Extend the new failure-evidence columns only to principals that already have
-- UPDATE authority on this table (table-level or column-level). This preserves
-- the pre-existing least-privilege boundary while preventing redrive/runtime
-- principals from failing when they clear or record the new evidence fields.
DO $outbox_failure_columns$
DECLARE
  grant_role text;
BEGIN
  FOREACH grant_role IN ARRAY ARRAY[
    'app_deal', 'app_outbox', 'app_outbox_worker', 'app_runtime',
    'app_service', 'one_deal_app', 'pc_deal_runtime', 'pc_outbox_runtime',
    'app_deal_api'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = grant_role)
       AND (
         has_table_privilege(grant_role, 'public.outbox_entries', 'UPDATE')
         OR has_any_column_privilege(grant_role, 'public.outbox_entries', 'UPDATE')
       ) THEN
      EXECUTE format(
        'GRANT UPDATE ("lastErrorCode", "lastErrorCategory", "lastAttemptAt", "manualReviewAt") ON TABLE public."outbox_entries" TO %I',
        grant_role
      );
    END IF;
  END LOOP;
END
$outbox_failure_columns$;
