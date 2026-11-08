-- P0 permanent protected-mail transport authority.
--
-- Security-sensitive mail is isolated from public.outbox_entries because the
-- generic durable outbox has a Kafka fallback handler. A dedicated table keeps
-- bearer-bearing messages out of the domain-event transport and gives the SMTP
-- dispatcher its own least-privilege PostgreSQL principal.
--
-- Recipient, subject, body and bearer credentials are encrypted before INSERT.
-- payload_digest is a keyed deterministic digest produced by the API and is
-- retained after ciphertext redaction so idempotency conflicts remain provable
-- without retaining plaintext or decryptable payload forever.

DO $auth_mail_roles$
DECLARE
  role_name text;
  login_flag boolean;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pc_auth_mail_runtime',
    'pc_auth_mail_enqueue_authority',
    'pc_auth_mail_retention_authority'
  ]
  LOOP
    login_flag := role_name = 'pc_auth_mail_runtime';
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'CREATE ROLE %I %s NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
        role_name,
        CASE WHEN login_flag THEN 'LOGIN' ELSE 'NOLOGIN' END
      );
    END IF;
    EXECUTE format(
      'ALTER ROLE %I %s NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
      role_name,
      CASE WHEN login_flag THEN 'LOGIN' ELSE 'NOLOGIN' END
    );

    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_auth_members membership
      JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
      JOIN pg_catalog.pg_roles member_role ON member_role.oid = membership.member
      WHERE granted.rolname = role_name OR member_role.rolname = role_name
    ) THEN
      RAISE EXCEPTION '% must have no role memberships in either direction', role_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END
$auth_mail_roles$;

CREATE TABLE IF NOT EXISTS auth.mail_outbox (
  id text PRIMARY KEY,
  message_kind text NOT NULL,
  payload_ciphertext text,
  payload_iv text,
  payload_tag text,
  payload_key_version integer NOT NULL,
  payload_digest text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  idempotency_key text NOT NULL UNIQUE,
  correlation_id text NOT NULL,
  max_attempts integer NOT NULL DEFAULT 12,
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  lease_owner text,
  lease_token text UNIQUE,
  lease_expires_at timestamptz,
  last_error_code text,
  expires_at timestamptz NOT NULL,
  sent_at timestamptz,
  redacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT auth_mail_outbox_kind_check CHECK (
    message_kind IN (
      'REGISTRATION_EMAIL_VERIFICATION',
      'REGISTRATION_JOIN_REVIEW',
      'REGISTRATION_DECISION',
      'PASSWORD_RESET',
      'PASSWORD_CHANGED',
      'ORGANIZATION_INVITATION',
      'MFA_RECOVERY',
      'ACCOUNT_SECURITY_NOTICE',
      'PUBLIC_INQUIRY'
    )
  ),
  CONSTRAINT auth_mail_outbox_status_check CHECK (
    status IN ('PENDING', 'PROCESSING', 'SENT', 'DEAD_LETTER')
  ),
  CONSTRAINT auth_mail_outbox_crypto_check CHECK (
    payload_key_version BETWEEN 1 AND 999
    AND payload_digest ~ '^[a-f0-9]{64}$'
    AND (
      (
        redacted_at IS NULL
        AND payload_ciphertext IS NOT NULL
        AND payload_iv IS NOT NULL
        AND payload_tag IS NOT NULL
        AND length(payload_ciphertext) BETWEEN 16 AND 65536
        AND length(payload_iv) BETWEEN 16 AND 64
        AND length(payload_tag) BETWEEN 16 AND 64
      )
      OR (
        redacted_at IS NOT NULL
        AND status IN ('SENT', 'DEAD_LETTER')
        AND payload_ciphertext IS NULL
        AND payload_iv IS NULL
        AND payload_tag IS NULL
      )
    )
  ),
  CONSTRAINT auth_mail_outbox_attempt_check CHECK (
    max_attempts BETWEEN 1 AND 50
    AND attempt_count BETWEEN 0 AND max_attempts
  ),
  CONSTRAINT auth_mail_outbox_idempotency_check CHECK (
    length(idempotency_key) BETWEEN 16 AND 256
    AND idempotency_key LIKE 'auth-mail:%'
  ),
  CONSTRAINT auth_mail_outbox_correlation_check CHECK (
    length(correlation_id) BETWEEN 1 AND 128
  ),
  CONSTRAINT auth_mail_outbox_lease_check CHECK (
    (status = 'PROCESSING' AND lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'PROCESSING' AND lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
  ),
  CONSTRAINT auth_mail_outbox_sent_check CHECK (
    (status = 'SENT' AND sent_at IS NOT NULL)
    OR (status <> 'SENT' AND sent_at IS NULL)
  ),
  CONSTRAINT auth_mail_outbox_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS auth_mail_outbox_claim_idx
  ON auth.mail_outbox (status, next_attempt_at, lease_expires_at, created_at, id);
CREATE INDEX IF NOT EXISTS auth_mail_outbox_correlation_idx
  ON auth.mail_outbox (correlation_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS auth_mail_outbox_expiry_idx
  ON auth.mail_outbox (status, expires_at);
CREATE INDEX IF NOT EXISTS auth_mail_outbox_key_version_idx
  ON auth.mail_outbox (payload_key_version, status, created_at);
CREATE INDEX IF NOT EXISTS auth_mail_outbox_redaction_idx
  ON auth.mail_outbox (status, redacted_at, sent_at, updated_at);

ALTER TABLE auth.mail_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mail_outbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_mail_outbox_producer_insert ON auth.mail_outbox;
DROP POLICY IF EXISTS auth_mail_outbox_enqueue_select ON auth.mail_outbox;
DROP POLICY IF EXISTS auth_mail_outbox_enqueue_insert ON auth.mail_outbox;
DROP POLICY IF EXISTS auth_mail_outbox_worker_select ON auth.mail_outbox;
DROP POLICY IF EXISTS auth_mail_outbox_worker_update ON auth.mail_outbox;
DROP POLICY IF EXISTS auth_mail_outbox_retention_select ON auth.mail_outbox;
DROP POLICY IF EXISTS auth_mail_outbox_retention_update ON auth.mail_outbox;

CREATE POLICY auth_mail_outbox_enqueue_select
ON auth.mail_outbox
FOR SELECT TO pc_auth_mail_enqueue_authority
USING (current_user = 'pc_auth_mail_enqueue_authority');

CREATE POLICY auth_mail_outbox_enqueue_insert
ON auth.mail_outbox
FOR INSERT TO pc_auth_mail_enqueue_authority
WITH CHECK (
  current_user = 'pc_auth_mail_enqueue_authority'
  AND status = 'PENDING'
  AND attempt_count = 0
  AND lease_owner IS NULL
  AND lease_token IS NULL
  AND lease_expires_at IS NULL
  AND sent_at IS NULL
  AND redacted_at IS NULL
  AND idempotency_key LIKE 'auth-mail:%'
);

CREATE POLICY auth_mail_outbox_worker_select
ON auth.mail_outbox
FOR SELECT TO pc_auth_mail_runtime
USING (current_user = 'pc_auth_mail_runtime');

CREATE POLICY auth_mail_outbox_worker_update
ON auth.mail_outbox
FOR UPDATE TO pc_auth_mail_runtime
USING (current_user = 'pc_auth_mail_runtime')
WITH CHECK (current_user = 'pc_auth_mail_runtime');

CREATE POLICY auth_mail_outbox_retention_select
ON auth.mail_outbox
FOR SELECT TO pc_auth_mail_retention_authority
USING (
  current_user = 'pc_auth_mail_retention_authority'
  AND status IN ('SENT', 'DEAD_LETTER')
);

CREATE POLICY auth_mail_outbox_retention_update
ON auth.mail_outbox
FOR UPDATE TO pc_auth_mail_retention_authority
USING (
  current_user = 'pc_auth_mail_retention_authority'
  AND status IN ('SENT', 'DEAD_LETTER')
)
WITH CHECK (
  current_user = 'pc_auth_mail_retention_authority'
  AND status IN ('SENT', 'DEAD_LETTER')
);

CREATE OR REPLACE FUNCTION auth.enforce_mail_outbox_immutable_payload()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  retention_redaction boolean;
BEGIN
  retention_redaction :=
    current_user = 'pc_auth_mail_retention_authority'
    AND OLD.redacted_at IS NULL
    AND NEW.redacted_at IS NOT NULL
    AND NEW.payload_ciphertext IS NULL
    AND NEW.payload_iv IS NULL
    AND NEW.payload_tag IS NULL;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.message_kind IS DISTINCT FROM OLD.message_kind
     OR NEW.payload_key_version IS DISTINCT FROM OLD.payload_key_version
     OR NEW.payload_digest IS DISTINCT FROM OLD.payload_digest
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.max_attempts IS DISTINCT FROM OLD.max_attempts
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (
       NOT retention_redaction
       AND (
         NEW.payload_ciphertext IS DISTINCT FROM OLD.payload_ciphertext
         OR NEW.payload_iv IS DISTINCT FROM OLD.payload_iv
         OR NEW.payload_tag IS DISTINCT FROM OLD.payload_tag
         OR NEW.redacted_at IS DISTINCT FROM OLD.redacted_at
       )
     ) THEN
    RAISE EXCEPTION 'auth.mail_outbox immutable payload cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS auth_mail_outbox_immutable_payload ON auth.mail_outbox;
CREATE TRIGGER auth_mail_outbox_immutable_payload
BEFORE UPDATE ON auth.mail_outbox
FOR EACH ROW EXECUTE FUNCTION auth.enforce_mail_outbox_immutable_payload();

CREATE OR REPLACE FUNCTION auth.reject_mail_outbox_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  RAISE EXCEPTION 'auth.mail_outbox rows are retention-managed and cannot be deleted directly'
    USING ERRCODE = '42501';
END
$function$;

DROP TRIGGER IF EXISTS auth_mail_outbox_no_delete ON auth.mail_outbox;
CREATE TRIGGER auth_mail_outbox_no_delete
BEFORE DELETE ON auth.mail_outbox
FOR EACH ROW EXECUTE FUNCTION auth.reject_mail_outbox_delete();

DROP TRIGGER IF EXISTS auth_mail_outbox_no_truncate ON auth.mail_outbox;
CREATE TRIGGER auth_mail_outbox_no_truncate
BEFORE TRUNCATE ON auth.mail_outbox
FOR EACH STATEMENT EXECUTE FUNCTION auth.reject_mail_outbox_delete();

CREATE OR REPLACE FUNCTION auth.enqueue_mail_outbox(
  p_id text,
  p_message_kind text,
  p_payload_ciphertext text,
  p_payload_iv text,
  p_payload_tag text,
  p_payload_key_version integer,
  p_payload_digest text,
  p_idempotency_key text,
  p_correlation_id text,
  p_max_attempts integer,
  p_next_attempt_at timestamptz,
  p_expires_at timestamptz
)
RETURNS TABLE (outbox_id text, replayed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  inserted_count integer;
  existing auth.mail_outbox%ROWTYPE;
BEGIN
  INSERT INTO auth.mail_outbox (
    id, message_kind,
    payload_ciphertext, payload_iv, payload_tag, payload_key_version, payload_digest,
    status, idempotency_key, correlation_id,
    max_attempts, attempt_count, next_attempt_at, expires_at
  ) VALUES (
    p_id, p_message_kind,
    p_payload_ciphertext, p_payload_iv, p_payload_tag, p_payload_key_version, p_payload_digest,
    'PENDING', p_idempotency_key, p_correlation_id,
    p_max_attempts, 0, p_next_attempt_at, p_expires_at
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  SELECT candidate.*
  INTO existing
  FROM auth.mail_outbox candidate
  WHERE candidate.idempotency_key = p_idempotency_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auth-mail idempotency row disappeared'
      USING ERRCODE = '40001';
  END IF;

  IF existing.message_kind IS DISTINCT FROM p_message_kind
     OR existing.payload_digest IS DISTINCT FROM p_payload_digest THEN
    RAISE EXCEPTION 'Auth-mail idempotency key reused with different payload'
      USING ERRCODE = '23505';
  END IF;

  RETURN QUERY SELECT existing.id, inserted_count = 0;
END
$function$;

ALTER FUNCTION auth.enqueue_mail_outbox(
  text, text, text, text, text, integer, text, text, text, integer, timestamptz, timestamptz
) OWNER TO pc_auth_mail_enqueue_authority;
REVOKE ALL ON FUNCTION auth.enqueue_mail_outbox(
  text, text, text, text, text, integer, text, text, text, integer, timestamptz, timestamptz
) FROM PUBLIC;

CREATE OR REPLACE FUNCTION auth.redact_terminal_mail_outbox(p_before timestamptz)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth, pg_temp
SET row_security = on
AS $function$
DECLARE
  affected integer;
BEGIN
  IF p_before IS NULL OR p_before >= clock_timestamp() THEN
    RAISE EXCEPTION 'Auth-mail retention cutoff must be in the past'
      USING ERRCODE = '22023';
  END IF;

  UPDATE auth.mail_outbox
  SET payload_ciphertext = NULL,
      payload_iv = NULL,
      payload_tag = NULL,
      redacted_at = clock_timestamp()
  WHERE redacted_at IS NULL
    AND status IN ('SENT', 'DEAD_LETTER')
    AND COALESCE(sent_at, updated_at) < p_before;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END
$function$;

ALTER FUNCTION auth.redact_terminal_mail_outbox(timestamptz)
  OWNER TO pc_auth_mail_retention_authority;
REVOKE ALL ON FUNCTION auth.redact_terminal_mail_outbox(timestamptz) FROM PUBLIC;

REVOKE ALL ON TABLE auth.mail_outbox FROM PUBLIC;
REVOKE ALL ON TABLE auth.mail_outbox FROM pc_auth_mail_runtime;
REVOKE ALL ON TABLE auth.mail_outbox FROM pc_auth_mail_enqueue_authority;
REVOKE ALL ON TABLE auth.mail_outbox FROM pc_auth_mail_retention_authority;

GRANT USAGE ON SCHEMA auth TO pc_auth_mail_runtime;
GRANT SELECT ON auth.mail_outbox TO pc_auth_mail_runtime;
GRANT UPDATE (
  status,
  attempt_count,
  next_attempt_at,
  lease_owner,
  lease_token,
  lease_expires_at,
  last_error_code,
  sent_at,
  updated_at
) ON auth.mail_outbox TO pc_auth_mail_runtime;

GRANT USAGE ON SCHEMA auth TO pc_auth_mail_enqueue_authority;
GRANT SELECT, INSERT ON auth.mail_outbox TO pc_auth_mail_enqueue_authority;
GRANT USAGE ON SCHEMA auth TO pc_auth_mail_retention_authority;
GRANT SELECT ON auth.mail_outbox TO pc_auth_mail_retention_authority;
GRANT UPDATE (payload_ciphertext, payload_iv, payload_tag, redacted_at, updated_at)
  ON auth.mail_outbox TO pc_auth_mail_retention_authority;

DO $auth_mail_producer_grants$
DECLARE
  runtime_role text;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_catalog.pg_roles
    WHERE rolname IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', runtime_role);
    EXECUTE format('REVOKE ALL ON auth.mail_outbox FROM %I', runtime_role);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION auth.enqueue_mail_outbox(text,text,text,text,text,integer,text,text,text,integer,timestamptz,timestamptz) TO %I',
      runtime_role
    );
  END LOOP;
END
$auth_mail_producer_grants$;

GRANT EXECUTE ON FUNCTION auth.redact_terminal_mail_outbox(timestamptz)
  TO pc_auth_mail_runtime;

DO $auth_mail_boundary_proof$
DECLARE
  role_name text;
  snapshot record;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'pc_auth_mail_runtime',
    'pc_auth_mail_enqueue_authority',
    'pc_auth_mail_retention_authority'
  ]
  LOOP
    SELECT rolsuper, rolbypassrls, rolinherit
    INTO snapshot
    FROM pg_catalog.pg_roles
    WHERE rolname = role_name;
    IF snapshot.rolsuper OR snapshot.rolbypassrls OR snapshot.rolinherit THEN
      RAISE EXCEPTION '% violates least-privilege role flags', role_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class relation
    JOIN pg_catalog.pg_namespace schema ON schema.oid = relation.relnamespace
    WHERE schema.nspname = 'auth'
      AND relation.relname = 'mail_outbox'
      AND relation.relrowsecurity
      AND relation.relforcerowsecurity
  ) THEN
    RAISE EXCEPTION 'auth.mail_outbox must remain ENABLE + FORCE RLS'
      USING ERRCODE = '42501';
  END IF;

  IF has_table_privilege('pc_auth_mail_runtime', 'auth.mail_outbox', 'INSERT')
     OR has_table_privilege('pc_auth_mail_runtime', 'auth.mail_outbox', 'DELETE')
     OR has_table_privilege('pc_auth_mail_enqueue_authority', 'auth.mail_outbox', 'UPDATE')
     OR has_table_privilege('pc_auth_mail_enqueue_authority', 'auth.mail_outbox', 'DELETE')
     OR has_table_privilege('pc_auth_mail_retention_authority', 'auth.mail_outbox', 'INSERT')
     OR has_table_privilege('pc_auth_mail_retention_authority', 'auth.mail_outbox', 'DELETE')
  THEN
    RAISE EXCEPTION 'Auth-mail database authorities are broader than their bounded duties'
      USING ERRCODE = '42501';
  END IF;
END
$auth_mail_boundary_proof$;
