-- Narrow distributed rate-limit persistence to EXECUTE-only runtime access.
-- A bounded state table keeps one row per route/key and atomically resets expired windows.
-- The prior append-per-window table remains untouched for forward-only rollback safety.

CREATE TABLE IF NOT EXISTS security.api_rate_limit_state (
  route_name         TEXT        NOT NULL,
  key_hash           CHAR(64)    NOT NULL,
  window_started_at  TIMESTAMPTZ NOT NULL,
  window_seconds     INTEGER     NOT NULL,
  request_count      INTEGER     NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (route_name, key_hash),
  CONSTRAINT api_rate_limit_state_route_name_check
    CHECK (route_name ~ '^[a-z0-9][a-z0-9:_-]{0,127}$'),
  CONSTRAINT api_rate_limit_state_key_hash_check
    CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT api_rate_limit_state_window_seconds_check
    CHECK (window_seconds BETWEEN 1 AND 86400),
  CONSTRAINT api_rate_limit_state_request_count_check
    CHECK (request_count >= 1),
  CONSTRAINT api_rate_limit_state_expiry_check
    CHECK (expires_at > window_started_at)
);

CREATE INDEX IF NOT EXISTS api_rate_limit_state_expiry_idx
  ON security.api_rate_limit_state (expires_at);

CREATE OR REPLACE FUNCTION security.consume_api_rate_limit(
  p_route_name TEXT,
  p_key_hash TEXT,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  request_count INTEGER,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, security
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_window_start TIMESTAMPTZ;
BEGIN
  IF p_route_name !~ '^[a-z0-9][a-z0-9:_-]{0,127}$' THEN
    RAISE EXCEPTION 'invalid rate-limit route';
  END IF;
  IF p_key_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid rate-limit key hash';
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate-limit window';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds)
    * p_window_seconds
  );

  RETURN QUERY
  INSERT INTO security.api_rate_limit_state AS state (
    route_name,
    key_hash,
    window_started_at,
    window_seconds,
    request_count,
    expires_at,
    created_at,
    updated_at
  ) VALUES (
    p_route_name,
    p_key_hash,
    v_window_start,
    p_window_seconds,
    1,
    v_window_start + make_interval(secs => p_window_seconds),
    v_now,
    v_now
  )
  ON CONFLICT (route_name, key_hash)
  DO UPDATE SET
    window_started_at = CASE
      WHEN state.expires_at <= v_now THEN v_window_start
      ELSE state.window_started_at
    END,
    window_seconds = CASE
      WHEN state.expires_at <= v_now THEN p_window_seconds
      ELSE state.window_seconds
    END,
    request_count = CASE
      WHEN state.expires_at <= v_now THEN 1
      ELSE state.request_count + 1
    END,
    expires_at = CASE
      WHEN state.expires_at <= v_now
        THEN v_window_start + make_interval(secs => p_window_seconds)
      ELSE state.expires_at
    END,
    updated_at = v_now
  RETURNING state.request_count, state.expires_at;
END;
$$;

REVOKE ALL ON FUNCTION security.consume_api_rate_limit(TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON TABLE security.api_rate_limit_state FROM PUBLIC;
REVOKE ALL ON TABLE security.api_rate_limit_buckets FROM PUBLIC;

DO $rate_limit_execute_only$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON security.api_rate_limit_state FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON security.api_rate_limit_buckets FROM %I', role_name);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA security REVOKE ALL ON TABLES FROM %I',
        role_name
      );
      EXECUTE format('GRANT USAGE ON SCHEMA security TO %I', role_name);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION security.consume_api_rate_limit(TEXT, TEXT, INTEGER) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$rate_limit_execute_only$;
