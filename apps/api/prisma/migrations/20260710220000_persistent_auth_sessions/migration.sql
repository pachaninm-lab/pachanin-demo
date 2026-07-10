-- Persistent authentication state for horizontally scaled API instances.
-- Raw refresh tokens and MFA codes are never stored.

CREATE TABLE IF NOT EXISTS "auth_sessions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "refresh_token_hash" TEXT NOT NULL UNIQUE,
  "refresh_family_id" TEXT NOT NULL,
  "refresh_generation" INTEGER NOT NULL DEFAULT 0,
  "user_agent" TEXT,
  "ip_hash" TEXT,
  "mfa_verified_at" TIMESTAMPTZ,
  "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "revoke_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "auth_sessions_user_active_idx"
  ON "auth_sessions" ("user_id", "revoked_at", "expires_at");
CREATE INDEX IF NOT EXISTS "auth_sessions_family_idx"
  ON "auth_sessions" ("refresh_family_id");

CREATE TABLE IF NOT EXISTS "auth_login_attempts" (
  "account_key_hash" TEXT PRIMARY KEY,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "first_failure_at" TIMESTAMPTZ,
  "last_failure_at" TIMESTAMPTZ,
  "locked_until" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "auth_login_attempts_locked_idx"
  ON "auth_login_attempts" ("locked_until");

CREATE TABLE IF NOT EXISTS "auth_mfa_challenges" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT,
  "purpose" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "consumed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_mfa_challenges_user_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "auth_mfa_challenges_session_fk"
    FOREIGN KEY ("session_id") REFERENCES "auth_sessions"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "auth_mfa_challenges_user_idx"
  ON "auth_mfa_challenges" ("user_id", "purpose", "expires_at");

COMMENT ON TABLE "auth_sessions" IS 'Server-side session and refresh-token rotation ledger. Stores hashes only.';
COMMENT ON TABLE "auth_login_attempts" IS 'Cluster-safe per-account credential-stuffing lockout ledger.';
COMMENT ON TABLE "auth_mfa_challenges" IS 'Single-use hashed MFA challenge ledger.';
