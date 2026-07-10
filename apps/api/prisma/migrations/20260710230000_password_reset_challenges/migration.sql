-- Durable, single-use password reset state for the persistent auth boundary.
-- Tokens are stored only as keyed hashes; raw reset tokens never enter PostgreSQL.

CREATE TABLE auth.password_reset_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  requested_ip_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_password_reset_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE RESTRICT,
  CONSTRAINT auth_password_reset_status_check
    CHECK (status IN ('PENDING', 'CONSUMED', 'EXPIRED'))
);

CREATE INDEX auth_password_reset_user_status_created_idx
  ON auth.password_reset_challenges(user_id, status, created_at DESC);
CREATE INDEX auth_password_reset_expires_idx
  ON auth.password_reset_challenges(expires_at);

REVOKE ALL ON auth.password_reset_challenges FROM PUBLIC;

DO $grant_password_reset$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    GRANT SELECT, INSERT, UPDATE ON auth.password_reset_challenges TO app_service;
  END IF;
END
$grant_password_reset$;
