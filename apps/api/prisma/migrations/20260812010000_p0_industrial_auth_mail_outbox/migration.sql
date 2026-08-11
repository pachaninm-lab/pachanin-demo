-- P0 permanent auth-mail transport authority.
--
-- Auth mail is intentionally isolated from public.outbox_entries. The generic
-- durable outbox worker has a Kafka fallback handler and claims every PENDING
-- public outbox row; placing verification/reset/invitation mail there would
-- allow a mail intent to be claimed by the domain-event transport. This table
-- is therefore a dedicated transactional outbox with its own least-privilege
-- runtime principal and FORCE RLS boundary.
--
-- The table never stores a plaintext recipient, subject, body or bearer token.
-- API producers encrypt the complete mail envelope before INSERT with a
-- dedicated auth-mail outbox key. The mail worker is the only runtime that can
-- SELECT ciphertext and advance delivery state. Immutable payload fields are
-- protected by a trigger after insertion.

DO $auth_mail_runtime_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'pc_auth_mail_runtime'
  ) THEN
    CREATE ROLE pc_auth_mail_runtime
      LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;

  ALTER ROLE pc_auth_mail_runtime
    LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members membership
    JOIN pg_catalog.pg_roles granted ON granted.oid = membership.roleid
    WHERE granted.rolname = 'pc_auth_mail_runtime'
  ) THEN
    RAISE EXCEPTION 'pc_auth_mail_runtime must have no role memberships'
      USING ERRCODE = '42501';
  END IF;
END
$auth_mail_runtime_role$;

CREATE TABLE IF NOT EXISTS auth.mail_outbox (
  id text PRIMARY KEY,
  message_kind text NOT NULL,
  payload_ciphertext text NOT NULL,
  payload_iv text NOT NULL,
  payload_tag text NOT NULL,
  payload_key_version integer NOT NULL DEFAULT 1,
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
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT auth_mail_outbox_kind_check CHECK (
    message_kind IN (
      'REGISTRATION_EMAIL_VERIFICATION',
      'REGISTRATION_JOIN_REVIEW',
      'PASSWORD_RESET',
      'PASSWORD_CHANGED',
      'ORGANIZATION_INVITATION',
      'MFA_RECOVERY',
      'ACCOUNT_SECURITY_NOTICE'
    )
  ),
  CONSTRAINT auth_mail_outbox_status_check CHECK (
    status IN ('PENDING', 'PROCESSING', 'SENT', 'DEAD_LETTER')
  ),
  CONSTRAINT auth_mail_outbox_crypto_check CHECK (
    payload_key_version = 1
    AND length(payload_ciphertext) BETWEEN 16 AND 65536
    AND length(payload_iv) BETWEEN 16 AND 64
    AND length(payload_tag) BETWEEN 16 AND 64
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

ALTER TABLE auth.mail_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.mail_outbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_mail_outbox_producer_insert ON auth.mail_outbox;
CREATE POLICY auth_mail_outbox_producer_insert
ON auth.mail_outbox
FOR INSERT TO PUBLIC
WITH CHECK (
  current_user IN ('pc_auth_runtime', 'one_deal_auth', 'app_auth', 'app_service')
  AND status = 'PENDING'
  AND attempt_count = 0
  AND lease_owner IS NULL
  AND lease_token IS NULL
  AND lease_expires_at IS NULL
  AND sent_at IS NULL
  AND idempotency_key LIKE 'auth-mail:%'
);

DROP POLICY IF EXISTS auth_mail_outbox_worker_select ON auth.mail_outbox;
CREATE POLICY auth_mail_outbox_worker_select
ON auth.mail_outbox
FOR SELECT TO pc_auth_mail_runtime
USING (current_user = 'pc_auth_mail_runtime');

DROP POLICY IF EXISTS auth_mail_outbox_worker_update ON auth.mail_outbox;
CREATE POLICY auth_mail_outbox_worker_update
ON auth.mail_outbox
FOR UPDATE TO pc_auth_mail_runtime
USING (current_user = 'pc_auth_mail_runtime')
WITH CHECK (current_user = 'pc_auth_mail_runtime');

CREATE OR REPLACE FUNCTION auth.enforce_mail_outbox_immutable_payload()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.message_kind IS DISTINCT FROM OLD.message_kind
     OR NEW.payload_ciphertext IS DISTINCT FROM OLD.payload_ciphertext
     OR NEW.payload_iv IS DISTINCT FROM OLD.payload_iv
     OR NEW.payload_tag IS DISTINCT FROM OLD.payload_tag
     OR NEW.payload_key_version IS DISTINCT FROM OLD.payload_key_version
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.max_attempts IS DISTINCT FROM OLD.max_attempts
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
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

REVOKE ALL ON TABLE auth.mail_outbox FROM PUBLIC;
REVOKE ALL ON TABLE auth.mail_outbox FROM pc_auth_mail_runtime;
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
    EXECUTE format('GRANT INSERT ON auth.mail_outbox TO %I', runtime_role);
  END LOOP;
END
$auth_mail_producer_grants$;

DO $auth_mail_boundary_proof$
DECLARE
  worker_super boolean;
  worker_bypass boolean;
  worker_inherit boolean;
BEGIN
  SELECT rolsuper, rolbypassrls, rolinherit
  INTO worker_super, worker_bypass, worker_inherit
  FROM pg_catalog.pg_roles
  WHERE rolname = 'pc_auth_mail_runtime';

  IF worker_super OR worker_bypass OR worker_inherit THEN
    RAISE EXCEPTION 'pc_auth_mail_runtime violates least-privilege role flags'
      USING ERRCODE = '42501';
  END IF;

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
  THEN
    RAISE EXCEPTION 'pc_auth_mail_runtime must not INSERT or DELETE mail outbox rows'
      USING ERRCODE = '42501';
  END IF;
END
$auth_mail_boundary_proof$;
