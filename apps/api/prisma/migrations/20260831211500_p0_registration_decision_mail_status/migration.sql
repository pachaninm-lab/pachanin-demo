-- P0 registration decision notification status authority.
-- The registration state transition and encrypted mail intent are committed in one
-- transaction. API callers may observe only bounded delivery state, never payloads.

CREATE OR REPLACE FUNCTION auth.registration_decision_mail_delivery_status(
  p_idempotency_key text
)
RETURNS TABLE (
  delivery_status text,
  attempt_count integer,
  max_attempts integer,
  last_error_code text,
  sent_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, pg_temp
SET row_security = on
AS $function$
BEGIN
  IF p_idempotency_key IS NULL
     OR p_idempotency_key !~ '^auth-mail:registration-decision:[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Registration-decision mail idempotency key is invalid'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  SELECT
    candidate.status,
    candidate.attempt_count,
    candidate.max_attempts,
    candidate.last_error_code,
    candidate.sent_at
  FROM auth.mail_outbox candidate
  WHERE candidate.idempotency_key = p_idempotency_key
    AND candidate.message_kind = 'REGISTRATION_DECISION'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'MISSING'::text, 0::integer, 0::integer, NULL::text, NULL::timestamptz;
  END IF;
END
$function$;

ALTER FUNCTION auth.registration_decision_mail_delivery_status(text)
  OWNER TO pc_auth_mail_enqueue_authority;
REVOKE ALL ON FUNCTION auth.registration_decision_mail_delivery_status(text) FROM PUBLIC;

DO $registration_decision_status_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.registration_decision_mail_delivery_status(text) TO %I',
      runtime_role
    );
  END LOOP;
END
$registration_decision_status_grants$;
