-- Persistent identity/session/MFA substrate for platform-v7.
-- Forward-only migration. Production execution is a separate operational gate.

CREATE SCHEMA IF NOT EXISTS auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC;

CREATE TABLE auth.login_throttles (
  account_hash TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_login_throttles_failures_nonnegative CHECK (failures >= 0)
);

CREATE TABLE auth.credential_states (
  user_id TEXT PRIMARY KEY,
  credential_version INTEGER NOT NULL DEFAULT 1,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_ciphertext TEXT,
  mfa_key_version TEXT,
  mfa_backup_hashes JSONB,
  consent_version TEXT,
  consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_credential_states_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_credential_version_positive CHECK (credential_version > 0),
  CONSTRAINT auth_failed_login_count_nonnegative CHECK (failed_login_count >= 0)
);

CREATE TABLE auth.sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  refresh_family_id TEXT NOT NULL,
  credential_version INTEGER NOT NULL,
  mfa_level TEXT NOT NULL DEFAULT 'NONE',
  mfa_verified_at TIMESTAMPTZ,
  mfa_verified_method TEXT,
  user_agent_hash TEXT,
  ip_hash TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_sessions_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_sessions_membership_fkey
    FOREIGN KEY (membership_id) REFERENCES public.user_orgs(id) ON DELETE RESTRICT,
  CONSTRAINT auth_sessions_organization_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT,
  CONSTRAINT auth_sessions_status_check
    CHECK (status IN ('MFA_PENDING', 'ACTIVE', 'REVOKED', 'EXPIRED')),
  CONSTRAINT auth_sessions_mfa_level_check
    CHECK (mfa_level IN ('NONE', 'TOTP', 'BACKUP'))
);

CREATE TABLE auth.refresh_tokens (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  family_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  parent_token_id TEXT,
  replaced_by_token_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  user_agent_hash TEXT,
  ip_hash TEXT,
  CONSTRAINT auth_refresh_tokens_session_fkey
    FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE RESTRICT,
  CONSTRAINT auth_refresh_tokens_parent_fkey
    FOREIGN KEY (parent_token_id) REFERENCES auth.refresh_tokens(id) ON DELETE RESTRICT,
  CONSTRAINT auth_refresh_tokens_replacement_fkey
    FOREIGN KEY (replaced_by_token_id) REFERENCES auth.refresh_tokens(id) ON DELETE RESTRICT,
  CONSTRAINT auth_refresh_tokens_status_check
    CHECK (status IN ('ACTIVE', 'ROTATED', 'REVOKED', 'REUSED', 'EXPIRED'))
);

CREATE TABLE auth.mfa_challenges (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  challenge_token_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_mfa_challenges_session_fkey
    FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE RESTRICT,
  CONSTRAINT auth_mfa_challenges_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_mfa_challenges_type_check
    CHECK (type IN ('TOTP_ENROLL', 'TOTP_VERIFY', 'BACKUP_VERIFY')),
  CONSTRAINT auth_mfa_challenges_status_check
    CHECK (status IN ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED')),
  CONSTRAINT auth_mfa_challenges_attempts_check
    CHECK (attempts >= 0 AND max_attempts > 0)
);

CREATE TABLE auth.audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  session_id TEXT,
  membership_id TEXT,
  organization_id TEXT,
  tenant_id TEXT,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL,
  reason TEXT,
  metadata JSONB,
  hash TEXT NOT NULL,
  prev_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_audit_events_outcome_check
    CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED'))
);

CREATE OR REPLACE FUNCTION auth.reject_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'auth.audit_events is append-only';
END;
$$;

CREATE TRIGGER auth_audit_events_append_only
BEFORE UPDATE OR DELETE ON auth.audit_events
FOR EACH ROW EXECUTE FUNCTION auth.reject_audit_mutation();

CREATE TRIGGER auth_audit_events_no_truncate
BEFORE TRUNCATE ON auth.audit_events
FOR EACH STATEMENT EXECUTE FUNCTION auth.reject_audit_mutation();

CREATE OR REPLACE FUNCTION auth.revoke_sessions_for_membership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE auth.sessions
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = 'MEMBERSHIP_CHANGED',
      updated_at = NOW()
  WHERE membership_id = OLD.id
    AND status IN ('ACTIVE', 'MFA_PENDING');

  UPDATE auth.refresh_tokens rt
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = 'MEMBERSHIP_CHANGED'
  FROM auth.sessions s
  WHERE s.id = rt.session_id
    AND s.membership_id = OLD.id
    AND rt.status IN ('ACTIVE', 'ROTATED');
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_revoke_on_membership_change
AFTER UPDATE OF "userId", "organizationId", role ON public.user_orgs
FOR EACH ROW
WHEN (
  OLD."userId" IS DISTINCT FROM NEW."userId"
  OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
  OR OLD.role IS DISTINCT FROM NEW.role
)
EXECUTE FUNCTION auth.revoke_sessions_for_membership_change();

CREATE OR REPLACE FUNCTION auth.revoke_sessions_for_organization_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE auth.sessions
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = 'ORGANIZATION_NOT_VERIFIED',
      updated_at = NOW()
  WHERE organization_id = NEW.id
    AND status IN ('ACTIVE', 'MFA_PENDING');

  UPDATE auth.refresh_tokens rt
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = 'ORGANIZATION_NOT_VERIFIED'
  FROM auth.sessions s
  WHERE s.id = rt.session_id
    AND s.organization_id = NEW.id
    AND rt.status IN ('ACTIVE', 'ROTATED');
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_revoke_on_organization_block
AFTER UPDATE OF status ON public.organizations
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'VERIFIED')
EXECUTE FUNCTION auth.revoke_sessions_for_organization_block();

CREATE OR REPLACE FUNCTION auth.revoke_sessions_for_user_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  UPDATE auth.sessions
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = 'USER_NOT_ACTIVE',
      updated_at = NOW()
  WHERE user_id = NEW.id
    AND status IN ('ACTIVE', 'MFA_PENDING');

  UPDATE auth.refresh_tokens rt
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = 'USER_NOT_ACTIVE'
  FROM auth.sessions s
  WHERE s.id = rt.session_id
    AND s.user_id = NEW.id
    AND rt.status IN ('ACTIVE', 'ROTATED');
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_revoke_on_user_block
AFTER UPDATE OF status ON public.users
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'ACTIVE')
EXECUTE FUNCTION auth.revoke_sessions_for_user_block();

CREATE INDEX auth_login_throttles_locked_idx
  ON auth.login_throttles(locked_until);
CREATE INDEX auth_sessions_user_status_idx
  ON auth.sessions(user_id, status);
CREATE INDEX auth_sessions_family_status_idx
  ON auth.sessions(refresh_family_id, status);
CREATE INDEX auth_sessions_membership_status_idx
  ON auth.sessions(membership_id, status);
CREATE INDEX auth_sessions_expires_idx
  ON auth.sessions(expires_at);
CREATE INDEX auth_refresh_tokens_session_status_idx
  ON auth.refresh_tokens(session_id, status);
CREATE INDEX auth_refresh_tokens_family_status_idx
  ON auth.refresh_tokens(family_id, status);
CREATE INDEX auth_refresh_tokens_expires_idx
  ON auth.refresh_tokens(expires_at);
CREATE INDEX auth_mfa_challenges_session_status_idx
  ON auth.mfa_challenges(session_id, status);
CREATE INDEX auth_mfa_challenges_expires_idx
  ON auth.mfa_challenges(expires_at);
CREATE INDEX auth_audit_events_user_created_idx
  ON auth.audit_events(user_id, created_at);
CREATE INDEX auth_audit_events_session_created_idx
  ON auth.audit_events(session_id, created_at);
CREATE INDEX auth_audit_events_action_created_idx
  ON auth.audit_events(action, created_at);
CREATE INDEX auth_audit_events_tenant_created_idx
  ON auth.audit_events(tenant_id, created_at);

REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA auth FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.reject_audit_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.revoke_sessions_for_membership_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.revoke_sessions_for_organization_block() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.revoke_sessions_for_user_block() FROM PUBLIC;

DO $grant_auth_schema$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT USAGE ON SCHEMA auth TO app_service;
    GRANT SELECT, INSERT, UPDATE ON auth.login_throttles TO app_service;
    GRANT SELECT, INSERT, UPDATE ON auth.credential_states TO app_service;
    GRANT SELECT, INSERT, UPDATE ON auth.sessions TO app_service;
    GRANT SELECT, INSERT, UPDATE ON auth.refresh_tokens TO app_service;
    GRANT SELECT, INSERT, UPDATE ON auth.mfa_challenges TO app_service;
    GRANT SELECT, INSERT ON auth.audit_events TO app_service;
    REVOKE UPDATE, DELETE ON auth.audit_events FROM app_service;
  END IF;
END
$grant_auth_schema$;
