CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.rate_limit_buckets (
  policy TEXT NOT NULL,
  key_hash CHAR(64) NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL,
  blocked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (policy, key_hash),
  CONSTRAINT rate_limit_request_count_positive CHECK (request_count > 0),
  CONSTRAINT rate_limit_window_valid CHECK (reset_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_updated_at_idx
  ON security.rate_limit_buckets (updated_at);

CREATE OR REPLACE FUNCTION security.consume_rate_limit(
  p_policy TEXT,
  p_key_hash TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER,
  p_block_seconds INTEGER DEFAULT 0
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  limit_count INTEGER,
  reset_at TIMESTAMPTZ,
  retry_after_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, security
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_row security.rate_limit_buckets%ROWTYPE;
  v_count INTEGER;
  v_blocked_until TIMESTAMPTZ;
BEGIN
  IF p_policy !~ '^[a-z0-9:_-]{1,96}$' THEN
    RAISE EXCEPTION 'invalid rate-limit policy';
  END IF;
  IF p_key_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid rate-limit key hash';
  END IF;
  IF p_limit < 1 OR p_limit > 100000 OR p_window_seconds < 1 OR p_window_seconds > 86400
     OR p_block_seconds < 0 OR p_block_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate-limit bounds';
  END IF;

  LOOP
    SELECT * INTO v_row
    FROM security.rate_limit_buckets
    WHERE policy = p_policy AND key_hash = p_key_hash
    FOR UPDATE;

    IF NOT FOUND THEN
      BEGIN
        INSERT INTO security.rate_limit_buckets (
          policy, key_hash, window_started_at, reset_at, request_count, blocked_until, updated_at
        ) VALUES (
          p_policy,
          p_key_hash,
          v_now,
          v_now + make_interval(secs => p_window_seconds),
          1,
          NULL,
          v_now
        )
        RETURNING * INTO v_row;

        RETURN QUERY SELECT TRUE, p_limit - 1, p_limit, v_row.reset_at, 0;
        RETURN;
      EXCEPTION WHEN unique_violation THEN
        CONTINUE;
      END;
    END IF;

    IF v_row.blocked_until IS NOT NULL AND v_row.blocked_until > v_now THEN
      UPDATE security.rate_limit_buckets
      SET updated_at = v_now
      WHERE policy = p_policy AND key_hash = p_key_hash;
      RETURN QUERY SELECT
        FALSE,
        0,
        p_limit,
        v_row.blocked_until,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_row.blocked_until - v_now)))::INTEGER);
      RETURN;
    END IF;

    IF v_row.reset_at <= v_now THEN
      UPDATE security.rate_limit_buckets
      SET window_started_at = v_now,
          reset_at = v_now + make_interval(secs => p_window_seconds),
          request_count = 1,
          blocked_until = NULL,
          updated_at = v_now
      WHERE policy = p_policy AND key_hash = p_key_hash
      RETURNING * INTO v_row;
      RETURN QUERY SELECT TRUE, p_limit - 1, p_limit, v_row.reset_at, 0;
      RETURN;
    END IF;

    v_count := v_row.request_count + 1;
    IF v_count > p_limit THEN
      v_blocked_until := CASE
        WHEN p_block_seconds > 0 THEN v_now + make_interval(secs => p_block_seconds)
        ELSE v_row.reset_at
      END;
      UPDATE security.rate_limit_buckets
      SET request_count = v_count,
          blocked_until = v_blocked_until,
          updated_at = v_now
      WHERE policy = p_policy AND key_hash = p_key_hash;
      RETURN QUERY SELECT
        FALSE,
        0,
        p_limit,
        v_blocked_until,
        GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_blocked_until - v_now)))::INTEGER);
      RETURN;
    END IF;

    UPDATE security.rate_limit_buckets
    SET request_count = v_count,
        blocked_until = NULL,
        updated_at = v_now
    WHERE policy = p_policy AND key_hash = p_key_hash;
    RETURN QUERY SELECT TRUE, p_limit - v_count, p_limit, v_row.reset_at, 0;
    RETURN;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION security.cleanup_rate_limit_buckets(p_retention_seconds INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, security
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_retention_seconds < 3600 OR p_retention_seconds > 2592000 THEN
    RAISE EXCEPTION 'invalid rate-limit retention';
  END IF;
  DELETE FROM security.rate_limit_buckets
  WHERE updated_at < clock_timestamp() - make_interval(secs => p_retention_seconds);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION security.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.cleanup_rate_limit_buckets(INTEGER) FROM PUBLIC;
REVOKE ALL ON TABLE security.rate_limit_buckets FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT USAGE ON SCHEMA security TO app_service;
    GRANT EXECUTE ON FUNCTION security.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO app_service;
    GRANT EXECUTE ON FUNCTION security.cleanup_rate_limit_buckets(INTEGER) TO app_service;
  END IF;
END
$$;
