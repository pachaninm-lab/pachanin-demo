-- Durable, replica-safe authority for Gekta's anonymous answer quota.
-- Runtime principals receive EXECUTE only; opaque browser identifiers never
-- enter this table because the API supplies domain-separated HMAC digests.

CREATE TABLE IF NOT EXISTS security.gekta_anonymous_answer_sessions (
  session_hash           CHAR(64)    PRIMARY KEY,
  answer_count           INTEGER     NOT NULL,
  consumed_ticket_hashes TEXT[]      NOT NULL,
  started_at             TIMESTAMPTZ NOT NULL,
  expires_at             TIMESTAMPTZ NOT NULL,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT gekta_anonymous_answer_session_hash_check
    CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT gekta_anonymous_answer_count_check
    CHECK (answer_count BETWEEN 1 AND 1000),
  CONSTRAINT gekta_anonymous_answer_ticket_count_check
    CHECK (cardinality(consumed_ticket_hashes) = answer_count),
  CONSTRAINT gekta_anonymous_answer_session_expiry_check
    CHECK (expires_at > started_at)
);

CREATE INDEX IF NOT EXISTS gekta_anonymous_answer_sessions_expiry_idx
  ON security.gekta_anonymous_answer_sessions (expires_at);

CREATE OR REPLACE FUNCTION security.consume_gekta_anonymous_answer(
  p_ticket_hash TEXT,
  p_session_hash TEXT,
  p_answer_limit INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, security
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_answer_count INTEGER;
  v_ticket_hashes TEXT[];
  v_expires_at TIMESTAMPTZ;
BEGIN
  IF p_ticket_hash !~ '^[a-f0-9]{64}$' OR p_session_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid Gekta anonymous admission hash';
  END IF;
  IF p_answer_limit < 1 OR p_answer_limit > 1000 THEN
    RAISE EXCEPTION 'invalid Gekta anonymous answer limit';
  END IF;

  -- Serialize only one opaque browser session. Hash collisions merely serialize
  -- unrelated sessions; they cannot grant an answer or merge their counters.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_hash, 0));

  SELECT answer_count, consumed_ticket_hashes, expires_at
  INTO v_answer_count, v_ticket_hashes, v_expires_at
  FROM security.gekta_anonymous_answer_sessions
  WHERE session_hash = p_session_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO security.gekta_anonymous_answer_sessions (
      session_hash,
      answer_count,
      consumed_ticket_hashes,
      started_at,
      expires_at,
      updated_at
    ) VALUES (
      p_session_hash,
      1,
      ARRAY[p_ticket_hash],
      v_now,
      v_now + interval '180 days',
      v_now
    );
    RETURN TRUE;
  END IF;

  IF v_expires_at <= v_now THEN
    UPDATE security.gekta_anonymous_answer_sessions
    SET answer_count = 1,
        consumed_ticket_hashes = ARRAY[p_ticket_hash],
        started_at = v_now,
        expires_at = v_now + interval '180 days',
        updated_at = v_now
    WHERE session_hash = p_session_hash;
    RETURN TRUE;
  END IF;

  -- Replaying the same signed reservation never charges or admits it twice.
  IF p_ticket_hash = ANY(v_ticket_hashes) THEN
    RETURN FALSE;
  END IF;

  -- Once the session quota is exhausted, new tickets are rejected without
  -- growing the row. Replaying an old cookie therefore cannot create a bypass.
  IF v_answer_count >= p_answer_limit THEN
    RETURN FALSE;
  END IF;

  UPDATE security.gekta_anonymous_answer_sessions
  SET answer_count = answer_count + 1,
      consumed_ticket_hashes = array_append(consumed_ticket_hashes, p_ticket_hash),
      updated_at = v_now
  WHERE session_hash = p_session_hash;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION security.consume_gekta_anonymous_answer(TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON TABLE security.gekta_anonymous_answer_sessions FROM PUBLIC;

DO $gekta_anonymous_answer_execute_only$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON security.gekta_anonymous_answer_sessions FROM %I', role_name);
      EXECUTE format('GRANT USAGE ON SCHEMA security TO %I', role_name);
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION security.consume_gekta_anonymous_answer(TEXT, TEXT, INTEGER) TO %I',
        role_name
      );
    END IF;
  END LOOP;
END
$gekta_anonymous_answer_execute_only$;
