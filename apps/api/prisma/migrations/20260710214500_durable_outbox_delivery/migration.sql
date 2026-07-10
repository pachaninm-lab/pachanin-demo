-- Durable, multi-instance outbox delivery boundary.
-- public.outbox_entries remains the canonical business record. The delivery
-- schema stores only lease and attempt metadata and exposes narrow functions.

CREATE SCHEMA IF NOT EXISTS delivery;
REVOKE ALL ON SCHEMA delivery FROM PUBLIC;

CREATE TABLE IF NOT EXISTS delivery.outbox_claims (
  outbox_id         TEXT        PRIMARY KEY REFERENCES public.outbox_entries(id) ON DELETE RESTRICT,
  claim_token       TEXT        NOT NULL,
  claimed_by        TEXT        NOT NULL,
  claimed_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  claim_expires_at  TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT outbox_claims_token_check CHECK (claim_token ~ '^[a-f0-9]{64}$'),
  CONSTRAINT outbox_claims_worker_check CHECK (length(claimed_by) BETWEEN 1 AND 160),
  CONSTRAINT outbox_claims_expiry_check CHECK (claim_expires_at > claimed_at)
);

CREATE INDEX IF NOT EXISTS outbox_claims_expiry_idx
  ON delivery.outbox_claims (claim_expires_at);

CREATE TABLE IF NOT EXISTS delivery.outbox_attempts (
  id                BIGSERIAL   PRIMARY KEY,
  outbox_id         TEXT        NOT NULL REFERENCES public.outbox_entries(id) ON DELETE RESTRICT,
  attempt_no        INTEGER     NOT NULL,
  worker_id         TEXT        NOT NULL,
  claim_token_hash  TEXT        NOT NULL,
  outcome           TEXT        NOT NULL,
  error_code        TEXT,
  error_hash        TEXT,
  started_at        TIMESTAMPTZ NOT NULL,
  finished_at       TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  metadata          JSONB,
  CONSTRAINT outbox_attempt_no_check CHECK (attempt_no >= 1),
  CONSTRAINT outbox_attempt_outcome_check CHECK (outcome IN ('SENT', 'RETRY', 'DEAD', 'MANUAL_REQUEUE')),
  CONSTRAINT outbox_attempt_token_hash_check CHECK (claim_token_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT outbox_attempt_error_hash_check CHECK (error_hash IS NULL OR error_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS outbox_attempts_outbox_idx
  ON delivery.outbox_attempts (outbox_id, attempt_no);
CREATE INDEX IF NOT EXISTS outbox_attempts_outcome_idx
  ON delivery.outbox_attempts (outcome, finished_at);

CREATE OR REPLACE FUNCTION delivery.claim_outbox_batch(
  p_worker_id TEXT,
  p_batch_size INTEGER,
  p_lease_seconds INTEGER
)
RETURNS TABLE (
  id TEXT,
  type TEXT,
  deal_id TEXT,
  payload JSONB,
  idempotency_key TEXT,
  retry_count INTEGER,
  max_retries INTEGER,
  claim_token TEXT,
  claim_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, delivery
AS $claim_outbox$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF p_worker_id IS NULL OR length(trim(p_worker_id)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'invalid outbox worker id' USING ERRCODE = '22023';
  END IF;
  IF p_batch_size IS NULL OR p_batch_size < 1 OR p_batch_size > 500 THEN
    RAISE EXCEPTION 'invalid outbox batch size' USING ERRCODE = '22023';
  END IF;
  IF p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 900 THEN
    RAISE EXCEPTION 'invalid outbox lease' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT entry.id
    FROM public.outbox_entries AS entry
    LEFT JOIN delivery.outbox_claims AS claim ON claim.outbox_id = entry.id
    WHERE entry.type <> 'deal.command.receipt'
      AND (
        (entry.status IN ('PENDING', 'RETRY', 'FAILED') AND entry."nextRetryAt" <= v_now)
        OR (entry.status = 'PROCESSING' AND claim.claim_expires_at <= v_now)
      )
    ORDER BY entry."nextRetryAt" ASC, entry."createdAt" ASC, entry.id ASC
    FOR UPDATE OF entry SKIP LOCKED
    LIMIT p_batch_size
  ), claimed AS (
    UPDATE public.outbox_entries AS entry
    SET status = 'PROCESSING',
        "lastError" = NULL
    FROM candidates
    WHERE entry.id = candidates.id
    RETURNING entry.*
  ), leases AS (
    INSERT INTO delivery.outbox_claims (
      outbox_id,
      claim_token,
      claimed_by,
      claimed_at,
      claim_expires_at,
      updated_at
    )
    SELECT
      claimed.id,
      encode(digest(claimed.id || ':' || p_worker_id || ':' || v_now::text || ':' || random()::text, 'sha256'), 'hex'),
      trim(p_worker_id),
      v_now,
      v_now + make_interval(secs => p_lease_seconds),
      v_now
    FROM claimed
    ON CONFLICT (outbox_id)
    DO UPDATE SET
      claim_token = EXCLUDED.claim_token,
      claimed_by = EXCLUDED.claimed_by,
      claimed_at = EXCLUDED.claimed_at,
      claim_expires_at = EXCLUDED.claim_expires_at,
      updated_at = EXCLUDED.updated_at
    RETURNING outbox_id, claim_token, claim_expires_at
  )
  SELECT
    claimed.id,
    claimed.type,
    claimed."dealId",
    claimed.payload,
    claimed."idempotencyKey",
    claimed."retryCount",
    claimed."maxRetries",
    leases.claim_token,
    leases.claim_expires_at
  FROM claimed
  JOIN leases ON leases.outbox_id = claimed.id;
END
$claim_outbox$;

CREATE OR REPLACE FUNCTION delivery.complete_outbox_claim(
  p_outbox_id TEXT,
  p_claim_token TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, delivery
AS $complete_outbox$
DECLARE
  v_claim delivery.outbox_claims%ROWTYPE;
  v_retry_count INTEGER;
BEGIN
  SELECT * INTO v_claim
  FROM delivery.outbox_claims
  WHERE outbox_id = p_outbox_id
    AND claim_token = p_claim_token
    AND claim_expires_at > clock_timestamp()
  FOR UPDATE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  UPDATE public.outbox_entries
  SET status = 'SENT',
      "sentAt" = clock_timestamp(),
      "lastError" = NULL
  WHERE id = p_outbox_id
    AND status = 'PROCESSING'
  RETURNING "retryCount" INTO v_retry_count;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  INSERT INTO delivery.outbox_attempts (
    outbox_id, attempt_no, worker_id, claim_token_hash, outcome, started_at
  ) VALUES (
    p_outbox_id,
    v_retry_count + 1,
    v_claim.claimed_by,
    encode(digest(p_claim_token, 'sha256'), 'hex'),
    'SENT',
    v_claim.claimed_at
  );

  DELETE FROM delivery.outbox_claims WHERE outbox_id = p_outbox_id;
  RETURN TRUE;
END
$complete_outbox$;

CREATE OR REPLACE FUNCTION delivery.fail_outbox_claim(
  p_outbox_id TEXT,
  p_claim_token TEXT,
  p_error_code TEXT,
  p_error_hash TEXT
)
RETURNS TABLE (
  status TEXT,
  retry_count INTEGER,
  next_retry_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, delivery
AS $fail_outbox$
DECLARE
  v_claim delivery.outbox_claims%ROWTYPE;
  v_entry public.outbox_entries%ROWTYPE;
  v_retry_count INTEGER;
  v_next_status TEXT;
  v_next_retry TIMESTAMPTZ;
  v_backoff_seconds INTEGER;
  v_jitter_seconds INTEGER;
BEGIN
  IF p_error_code IS NULL OR length(p_error_code) NOT BETWEEN 1 AND 96 THEN
    RAISE EXCEPTION 'invalid outbox error code' USING ERRCODE = '22023';
  END IF;
  IF p_error_hash IS NULL OR p_error_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid outbox error hash' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_claim
  FROM delivery.outbox_claims
  WHERE outbox_id = p_outbox_id AND claim_token = p_claim_token
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT * INTO v_entry
  FROM public.outbox_entries
  WHERE id = p_outbox_id AND status = 'PROCESSING'
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  v_retry_count := v_entry."retryCount" + 1;
  IF v_retry_count >= v_entry."maxRetries" THEN
    v_next_status := 'DEAD';
    v_next_retry := clock_timestamp();
  ELSE
    v_next_status := 'RETRY';
    v_backoff_seconds := LEAST(3600, (2 ^ LEAST(v_retry_count, 12))::INTEGER);
    v_jitter_seconds := (
      ('x' || substr(encode(digest(v_entry.id || ':' || v_retry_count::text, 'sha256'), 'hex'), 1, 8))::bit(32)::bigint
      % GREATEST(1, LEAST(60, v_backoff_seconds / 4 + 1))
    )::INTEGER;
    v_next_retry := clock_timestamp() + make_interval(secs => v_backoff_seconds + v_jitter_seconds);
  END IF;

  UPDATE public.outbox_entries
  SET status = v_next_status,
      "retryCount" = v_retry_count,
      "nextRetryAt" = v_next_retry,
      "lastError" = left(p_error_code, 96),
      "failedAt" = clock_timestamp()
  WHERE id = p_outbox_id;

  INSERT INTO delivery.outbox_attempts (
    outbox_id, attempt_no, worker_id, claim_token_hash, outcome,
    error_code, error_hash, started_at
  ) VALUES (
    p_outbox_id,
    v_retry_count,
    v_claim.claimed_by,
    encode(digest(p_claim_token, 'sha256'), 'hex'),
    v_next_status,
    left(p_error_code, 96),
    p_error_hash,
    v_claim.claimed_at
  );

  DELETE FROM delivery.outbox_claims WHERE outbox_id = p_outbox_id;
  RETURN QUERY SELECT v_next_status, v_retry_count, v_next_retry;
END
$fail_outbox$;

CREATE OR REPLACE FUNCTION delivery.manual_requeue_outbox(
  p_outbox_id TEXT,
  p_actor_user_id TEXT,
  p_reason_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, delivery
AS $manual_requeue$
DECLARE
  v_retry_count INTEGER;
BEGIN
  IF p_actor_user_id IS NULL OR length(trim(p_actor_user_id)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'invalid retry actor' USING ERRCODE = '22023';
  END IF;
  IF p_reason_hash IS NULL OR p_reason_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid retry reason hash' USING ERRCODE = '22023';
  END IF;

  DELETE FROM delivery.outbox_claims WHERE outbox_id = p_outbox_id;
  UPDATE public.outbox_entries
  SET status = 'RETRY',
      "retryCount" = 0,
      "nextRetryAt" = clock_timestamp(),
      "lastError" = NULL,
      "failedAt" = NULL
  WHERE id = p_outbox_id AND status IN ('DEAD', 'MANUAL_REVIEW')
  RETURNING "retryCount" INTO v_retry_count;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  INSERT INTO delivery.outbox_attempts (
    outbox_id, attempt_no, worker_id, claim_token_hash, outcome,
    error_code, error_hash, started_at, metadata
  ) VALUES (
    p_outbox_id,
    1,
    'manual:' || trim(p_actor_user_id),
    encode(digest(p_outbox_id || ':' || p_actor_user_id || ':' || clock_timestamp()::text, 'sha256'), 'hex'),
    'MANUAL_REQUEUE',
    'manual_requeue',
    p_reason_hash,
    clock_timestamp(),
    jsonb_build_object('actorUserId', trim(p_actor_user_id))
  );
  RETURN TRUE;
END
$manual_requeue$;

REVOKE ALL ON ALL TABLES IN SCHEMA delivery FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA delivery FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA delivery FROM PUBLIC;

DO $delivery_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA delivery TO %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA delivery FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA delivery FROM %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION delivery.claim_outbox_batch(TEXT, INTEGER, INTEGER) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION delivery.complete_outbox_claim(TEXT, TEXT) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION delivery.fail_outbox_claim(TEXT, TEXT, TEXT, TEXT) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION delivery.manual_requeue_outbox(TEXT, TEXT, TEXT) TO %I', role_name);
    END IF;
  END LOOP;
END
$delivery_grants$;
