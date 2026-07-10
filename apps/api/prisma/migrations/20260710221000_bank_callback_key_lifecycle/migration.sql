CREATE SCHEMA IF NOT EXISTS finance_security;
REVOKE ALL ON SCHEMA finance_security FROM PUBLIC;

CREATE TABLE IF NOT EXISTS finance_security.bank_callback_keys (
  partner_id             TEXT        NOT NULL,
  key_id                 TEXT        NOT NULL,
  secret_ref             TEXT        NOT NULL,
  valid_from             TIMESTAMPTZ NOT NULL,
  valid_until            TIMESTAMPTZ,
  revoked_at             TIMESTAMPTZ,
  revocation_reason_hash TEXT,
  created_by             TEXT        NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (partner_id, key_id),
  CONSTRAINT bank_callback_partner_check CHECK (partner_id ~ '^[A-Za-z0-9:_-]{1,96}$'),
  CONSTRAINT bank_callback_key_check CHECK (key_id ~ '^[A-Za-z0-9:_-]{1,96}$'),
  CONSTRAINT bank_callback_secret_ref_check CHECK (secret_ref ~ '^BANK_[A-Z0-9_]{1,120}$'),
  CONSTRAINT bank_callback_validity_check CHECK (valid_until IS NULL OR valid_until > valid_from),
  CONSTRAINT bank_callback_revocation_hash_check CHECK (
    revocation_reason_hash IS NULL OR revocation_reason_hash ~ '^[a-f0-9]{64}$'
  ),
  CONSTRAINT bank_callback_created_by_check CHECK (length(created_by) BETWEEN 1 AND 160)
);

CREATE INDEX IF NOT EXISTS bank_callback_keys_active_idx
  ON finance_security.bank_callback_keys (partner_id, valid_from, valid_until)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS finance_security.bank_callback_key_audit (
  id                 BIGSERIAL   PRIMARY KEY,
  partner_id         TEXT        NOT NULL,
  key_id             TEXT        NOT NULL,
  action             TEXT        NOT NULL,
  actor_user_id      TEXT        NOT NULL,
  reason_hash        TEXT,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  metadata           JSONB,
  CONSTRAINT bank_callback_audit_action_check CHECK (action IN ('REGISTERED', 'REVOKED')),
  CONSTRAINT bank_callback_audit_actor_check CHECK (length(actor_user_id) BETWEEN 1 AND 160),
  CONSTRAINT bank_callback_audit_reason_hash_check CHECK (reason_hash IS NULL OR reason_hash ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS bank_callback_key_audit_lookup_idx
  ON finance_security.bank_callback_key_audit (partner_id, key_id, occurred_at DESC, id DESC);

CREATE OR REPLACE FUNCTION finance_security.register_bank_callback_key(
  p_partner_id TEXT,
  p_key_id TEXT,
  p_secret_ref TEXT,
  p_valid_from TIMESTAMPTZ,
  p_valid_until TIMESTAMPTZ,
  p_actor_user_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, finance_security
AS $register_key$
DECLARE
  v_role TEXT := current_setting('app.current_role', true);
  v_user_id TEXT := current_setting('app.current_user_id', true);
BEGIN
  IF v_role <> 'ADMIN' OR v_user_id IS NULL OR v_user_id <> trim(p_actor_user_id) THEN
    RAISE EXCEPTION 'admin trusted context required' USING ERRCODE = '42501';
  END IF;
  IF trim(p_partner_id) !~ '^[A-Za-z0-9:_-]{1,96}$'
    OR trim(p_key_id) !~ '^[A-Za-z0-9:_-]{1,96}$'
    OR trim(p_secret_ref) !~ '^BANK_[A-Z0-9_]{1,120}$'
    OR p_valid_from IS NULL
    OR (p_valid_until IS NOT NULL AND p_valid_until <= p_valid_from)
  THEN
    RAISE EXCEPTION 'invalid bank callback key metadata' USING ERRCODE = '22023';
  END IF;

  INSERT INTO finance_security.bank_callback_keys (
    partner_id, key_id, secret_ref, valid_from, valid_until, created_by
  ) VALUES (
    trim(p_partner_id), trim(p_key_id), trim(p_secret_ref), p_valid_from, p_valid_until, trim(p_actor_user_id)
  );

  INSERT INTO finance_security.bank_callback_key_audit (
    partner_id, key_id, action, actor_user_id,
    metadata
  ) VALUES (
    trim(p_partner_id), trim(p_key_id), 'REGISTERED', trim(p_actor_user_id),
    jsonb_build_object('secretRef', trim(p_secret_ref), 'validFrom', p_valid_from, 'validUntil', p_valid_until)
  );
  RETURN TRUE;
END
$register_key$;

CREATE OR REPLACE FUNCTION finance_security.revoke_bank_callback_key(
  p_partner_id TEXT,
  p_key_id TEXT,
  p_actor_user_id TEXT,
  p_reason_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, finance_security
AS $revoke_key$
DECLARE
  v_role TEXT := current_setting('app.current_role', true);
  v_user_id TEXT := current_setting('app.current_user_id', true);
BEGIN
  IF v_role <> 'ADMIN' OR v_user_id IS NULL OR v_user_id <> trim(p_actor_user_id) THEN
    RAISE EXCEPTION 'admin trusted context required' USING ERRCODE = '42501';
  END IF;
  IF p_reason_hash IS NULL OR p_reason_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid revocation reason hash' USING ERRCODE = '22023';
  END IF;

  UPDATE finance_security.bank_callback_keys
  SET revoked_at = clock_timestamp(),
      revocation_reason_hash = p_reason_hash
  WHERE partner_id = trim(p_partner_id)
    AND key_id = trim(p_key_id)
    AND revoked_at IS NULL;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  INSERT INTO finance_security.bank_callback_key_audit (
    partner_id, key_id, action, actor_user_id, reason_hash
  ) VALUES (
    trim(p_partner_id), trim(p_key_id), 'REVOKED', trim(p_actor_user_id), p_reason_hash
  );
  RETURN TRUE;
END
$revoke_key$;

CREATE OR REPLACE FUNCTION finance_security.resolve_bank_callback_key(
  p_partner_id TEXT,
  p_key_id TEXT,
  p_at TIMESTAMPTZ
)
RETURNS TABLE (
  lifecycle_status TEXT,
  secret_ref TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, finance_security
AS $resolve_key$
DECLARE
  v_key finance_security.bank_callback_keys%ROWTYPE;
BEGIN
  SELECT * INTO v_key
  FROM finance_security.bank_callback_keys
  WHERE partner_id = trim(p_partner_id) AND key_id = trim(p_key_id);

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'UNKNOWN'::text, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_key.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT 'REVOKED'::text, NULL::text, v_key.valid_from, v_key.valid_until, v_key.revoked_at;
    RETURN;
  END IF;
  IF p_at < v_key.valid_from THEN
    RETURN QUERY SELECT 'NOT_YET_VALID'::text, NULL::text, v_key.valid_from, v_key.valid_until, NULL::timestamptz;
    RETURN;
  END IF;
  IF v_key.valid_until IS NOT NULL AND p_at >= v_key.valid_until THEN
    RETURN QUERY SELECT 'EXPIRED'::text, NULL::text, v_key.valid_from, v_key.valid_until, NULL::timestamptz;
    RETURN;
  END IF;
  RETURN QUERY SELECT 'ACTIVE'::text, v_key.secret_ref, v_key.valid_from, v_key.valid_until, NULL::timestamptz;
END
$resolve_key$;

CREATE OR REPLACE FUNCTION finance_security.list_bank_callback_keys(p_partner_id TEXT)
RETURNS TABLE (
  partner_id TEXT,
  key_id TEXT,
  secret_ref TEXT,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, finance_security
AS $list_keys$
  SELECT partner_id, key_id, secret_ref, valid_from, valid_until, revoked_at, created_by, created_at
  FROM finance_security.bank_callback_keys
  WHERE partner_id = trim(p_partner_id)
  ORDER BY valid_from DESC, key_id DESC
$list_keys$;

REVOKE ALL ON ALL TABLES IN SCHEMA finance_security FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA finance_security FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA finance_security FROM PUBLIC;

DO $bank_key_grants$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'app_api'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT USAGE ON SCHEMA finance_security TO %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA finance_security FROM %I', role_name);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA finance_security FROM %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION finance_security.register_bank_callback_key(TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TEXT) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION finance_security.revoke_bank_callback_key(TEXT,TEXT,TEXT,TEXT) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION finance_security.resolve_bank_callback_key(TEXT,TEXT,TIMESTAMPTZ) TO %I', role_name);
      EXECUTE format('GRANT EXECUTE ON FUNCTION finance_security.list_bank_callback_keys(TEXT) TO %I', role_name);
    END IF;
  END LOOP;
END
$bank_key_grants$;
