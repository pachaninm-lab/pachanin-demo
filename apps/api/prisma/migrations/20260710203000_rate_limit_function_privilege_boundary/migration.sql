-- Harden the distributed rate-limit storage boundary.
-- Runtime principals may consume and clean buckets only through narrowly scoped
-- SECURITY DEFINER functions. Direct table access is revoked.

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
AS $consume_rate_limit$
DECLARE
  v_window_start TIMESTAMPTZ;
BEGIN
  IF p_route_name IS NULL OR p_route_name !~ '^[a-z0-9][a-z0-9:_-]{0,127}$' THEN
    RAISE EXCEPTION 'invalid rate-limit route name' USING ERRCODE = '22023';
  END IF;
  IF p_key_hash IS NULL OR p_key_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid rate-limit key hash' USING ERRCODE = '22023';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate-limit window' USING ERRCODE = '22023';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM clock_timestamp()) / p_window_seconds)
    * p_window_seconds
  );

  RETURN QUERY
  INSERT INTO security.api_rate_limit_buckets AS bucket (
    route_name,
    key_hash,
    window_start,
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
    clock_timestamp(),
    clock_timestamp()
  )
  ON CONFLICT (route_name, key_hash, window_start)
  DO UPDATE SET
    request_count = bucket.request_count + 1,
    updated_at = clock_timestamp()
  RETURNING bucket.request_count, bucket.expires_at;
END
$consume_rate_limit$;

CREATE OR REPLACE FUNCTION security.cleanup_api_rate_limit_buckets(
  p_limit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, security
AS $cleanup_rate_limit$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION 'invalid rate-limit cleanup limit' USING ERRCODE = '22023';
  END IF;

  WITH doomed AS (
    SELECT bucket.ctid
    FROM security.api_rate_limit_buckets AS bucket
    WHERE bucket.expires_at <= clock_timestamp()
    ORDER BY bucket.expires_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  DELETE FROM security.api_rate_limit_buckets AS bucket
  USING doomed
  WHERE bucket.ctid = doomed.ctid;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END
$cleanup_rate_limit$;

REVOKE ALL ON FUNCTION security.consume_api_rate_limit(TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION security.cleanup_api_rate_limit_buckets(INTEGER) FROM PUBLIC;

DO $rate_limit_function_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA security TO %I', role_name);
      EXECUTE format('REVOKE ALL ON TABLE security.api_rate_limit_buckets FROM %I', role_name);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION security.consume_api_rate_limit(TEXT, TEXT, INTEGER) TO %I',
        role_name
      );
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION security.cleanup_api_rate_limit_buckets(INTEGER) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$rate_limit_function_grants$;
