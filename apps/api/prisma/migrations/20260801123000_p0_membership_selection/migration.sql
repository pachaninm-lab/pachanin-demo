-- Password-verified, single-use challenge for safe multi-membership selection.
-- No session or role is granted until the selected membership is reloaded from PostgreSQL.

CREATE TABLE auth.membership_selection_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  credential_version INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT membership_selection_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT membership_selection_status_check
    CHECK (status IN ('PENDING', 'CONSUMED', 'REVOKED', 'EXPIRED')),
  CONSTRAINT membership_selection_attempts_check
    CHECK (attempts >= 0 AND max_attempts BETWEEN 1 AND 10 AND attempts <= max_attempts),
  CONSTRAINT membership_selection_expiry_check
    CHECK (expires_at > created_at)
);

CREATE INDEX membership_selection_user_status_idx
  ON auth.membership_selection_challenges(user_id, status, created_at DESC);
CREATE INDEX membership_selection_expiry_idx
  ON auth.membership_selection_challenges(status, expires_at);

REVOKE ALL ON auth.membership_selection_challenges FROM PUBLIC;

DO $grant_membership_selection$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['app_service', 'auth_service', 'app_auth']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE ON auth.membership_selection_challenges TO %I', role_name);
    END IF;
  END LOOP;
END
$grant_membership_selection$;
