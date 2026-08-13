-- Durable, replica-safe authority for Gekta's anonymous answer quota.
-- Runtime principals receive EXECUTE only; opaque browser identifiers never
-- enter these tables because the API supplies domain-separated HMAC digests.

CREATE TABLE IF NOT EXISTS security.gekta_anonymous_answer_tickets (
  ticket_hash  CHAR(64)    PRIMARY KEY,
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT gekta_anonymous_answer_ticket_hash_check
    CHECK (ticket_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT gekta_anonymous_answer_ticket_expiry_check
    CHECK (expires_at > consumed_at)
);

CREATE INDEX IF NOT EXISTS gekta_anonymous_answer_tickets_expiry_idx
  ON security.gekta_anonymous_answer_tickets (expires_at);

CREATE TABLE IF NOT EXISTS security.gekta_anonymous_answer_sessions (
  session_hash CHAR(64)    PRIMARY KEY,
  answer_count INTEGER     NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT gekta_anonymous_answer_session_hash_check
    CHECK (session_hash ~ '^[a-f0-9]{64}$'),
  CONSTRAINT gekta_anonymous_answer_count_check
    CHECK (answer_count >= 1),
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
  v_ticket_inserted INTEGER;
  v_answer_count INTEGER;
BEGIN
  IF p_ticket_hash !~ '^[a-f0-9]{64}$' OR p_session_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid Gekta anonymous admission hash';
  END IF;
  IF p_answer_limit < 1 OR p_answer_limit > 1000 THEN
    RAISE EXCEPTION 'invalid Gekta anonymous answer limit';
  END IF;

  -- Bounded opportunistic cleanup prevents unique ticket/session rows from
  -- accumulating while keeping the request transaction short.
  DELETE FROM security.gekta_anonymous_answer_tickets
  WHERE ticket_hash IN (
    SELECT ticket_hash
    FROM security.gekta_anonymous_answer_tickets
    WHERE expires_at <= v_now
    ORDER BY expires_at
    LIMIT 128
  );
  DELETE FROM security.gekta_anonymous_answer_sessions
  WHERE session_hash IN (
    SELECT session_hash
    FROM security.gekta_anonymous_answer_sessions
    WHERE expires_at <= v_now
    ORDER BY expires_at
    LIMIT 32
  );

  INSERT INTO security.gekta_anonymous_answer_tickets (ticket_hash, consumed_at, expires_at)
  VALUES (p_ticket_hash, v_now, v_now + interval '15 minutes')
  ON CONFLICT (ticket_hash) DO NOTHING;
  GET DIAGNOSTICS v_ticket_inserted = ROW_COUNT;

  -- A duplicate ticket cannot increment the session counter a second time.
  IF v_ticket_inserted <> 1 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO security.gekta_anonymous_answer_sessions AS session (
    session_hash,
    answer_count,
    started_at,
    expires_at,
    updated_at
  ) VALUES (
    p_session_hash,
    1,
    v_now,
    v_now + interval '180 days',
    v_now
  )
  ON CONFLICT (session_hash)
  DO UPDATE SET
    answer_count = CASE
      WHEN session.expires_at <= v_now THEN 1
      ELSE session.answer_count + 1
    END,
    started_at = CASE
      WHEN session.expires_at <= v_now THEN v_now
      ELSE session.started_at
    END,
    expires_at = CASE
      WHEN session.expires_at <= v_now THEN v_now + interval '180 days'
      ELSE session.expires_at
    END,
    updated_at = v_now
  RETURNING session.answer_count INTO v_answer_count;

  RETURN v_answer_count <= p_answer_limit;
END;
$$;

REVOKE ALL ON FUNCTION security.consume_gekta_anonymous_answer(TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON TABLE security.gekta_anonymous_answer_tickets FROM PUBLIC;
REVOKE ALL ON TABLE security.gekta_anonymous_answer_sessions FROM PUBLIC;

DO $gekta_anonymous_answer_execute_only$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON security.gekta_anonymous_answer_tickets FROM %I', role_name);
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
