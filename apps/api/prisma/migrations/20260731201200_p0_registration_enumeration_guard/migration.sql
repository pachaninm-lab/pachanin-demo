-- P0 registration anti-enumeration and membership-session authority.

CREATE TABLE auth.registration_public_attempts (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  request_hash TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  application_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT registration_public_attempts_outcome_check
    CHECK (outcome IN ('APPLICATION_CREATED', 'SUPPRESSED_EXISTING_ACCOUNT')),
  CONSTRAINT registration_public_attempts_application_fkey
    FOREIGN KEY (application_id) REFERENCES auth.registration_applications(id) ON DELETE RESTRICT,
  CONSTRAINT registration_public_attempts_application_binding_check
    CHECK (
      (outcome = 'APPLICATION_CREATED' AND application_id IS NOT NULL)
      OR (outcome = 'SUPPRESSED_EXISTING_ACCOUNT' AND application_id IS NULL)
    )
);

CREATE INDEX registration_public_attempts_request_hash_idx
  ON auth.registration_public_attempts(request_hash);
CREATE INDEX registration_public_attempts_created_idx
  ON auth.registration_public_attempts(created_at);

CREATE OR REPLACE FUNCTION auth.reject_registration_public_attempt_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  -- PostgreSQL includes empty referencing tables in `TRUNCATE ... CASCADE`.
  -- Permit that no-op so isolated acceptance suites can reset unrelated
  -- aggregates, but never permit durable registration attempt evidence to be
  -- truncated once a row exists.
  IF TG_OP = 'TRUNCATE'
     AND NOT EXISTS (SELECT 1 FROM auth.registration_public_attempts) THEN
    RETURN NULL;
  END IF;
  RAISE EXCEPTION 'auth.registration_public_attempts is append-only';
END;
$$;

CREATE TRIGGER registration_public_attempts_append_only
BEFORE UPDATE OR DELETE ON auth.registration_public_attempts
FOR EACH ROW EXECUTE FUNCTION auth.reject_registration_public_attempt_mutation();

DROP TRIGGER IF EXISTS auth_revoke_on_membership_change ON public.user_orgs;

CREATE OR REPLACE FUNCTION auth.revoke_sessions_for_membership_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  revocation_code TEXT;
BEGIN
  revocation_code := CASE
    WHEN OLD.status IS DISTINCT FROM NEW.status AND NEW.status <> 'ACTIVE'
      THEN 'MEMBERSHIP_NOT_ACTIVE'
    ELSE 'MEMBERSHIP_CHANGED'
  END;

  UPDATE auth.sessions
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = revocation_code,
      updated_at = NOW()
  WHERE membership_id = OLD.id
    AND status IN ('ACTIVE', 'MFA_PENDING');

  UPDATE auth.refresh_tokens rt
  SET status = 'REVOKED',
      revoked_at = NOW(),
      revocation_reason = revocation_code
  FROM auth.sessions s
  WHERE s.id = rt.session_id
    AND s.membership_id = OLD.id
    AND rt.status IN ('ACTIVE', 'ROTATED');
  RETURN NEW;
END;
$$;

CREATE TRIGGER auth_revoke_on_membership_change
AFTER UPDATE OF "userId", "organizationId", role, status ON public.user_orgs
FOR EACH ROW
WHEN (
  OLD."userId" IS DISTINCT FROM NEW."userId"
  OR OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
  OR OLD.role IS DISTINCT FROM NEW.role
  OR OLD.status IS DISTINCT FROM NEW.status
)
EXECUTE FUNCTION auth.revoke_sessions_for_membership_change();

REVOKE ALL ON auth.registration_public_attempts FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.reject_registration_public_attempt_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION auth.revoke_sessions_for_membership_change() FROM PUBLIC;

DO $grant_registration_attempts$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'auth_service', 'app_auth']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT, INSERT ON auth.registration_public_attempts TO %I', role_name);
      EXECUTE format('REVOKE UPDATE, DELETE ON auth.registration_public_attempts FROM %I', role_name);
    END IF;
  END LOOP;
END
$grant_registration_attempts$;
