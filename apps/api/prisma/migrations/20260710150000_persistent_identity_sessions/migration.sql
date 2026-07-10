-- Persistent identity, session, refresh-family and MFA security layer.
-- Forward-only. This migration does not drop legacy mfaSecret/mfaBackup columns;
-- they remain deprecated until an explicit data migration proves safe removal.

ALTER TABLE public."users"
  ADD COLUMN IF NOT EXISTS "consentVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS public."auth_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mfaVerifiedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  "userAgentHash" TEXT,
  "ipHash" TEXT,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_user_fkey" FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "auth_sessions_user_status_idx" ON public."auth_sessions"("userId", "status");
CREATE INDEX IF NOT EXISTS "auth_sessions_tenant_org_idx" ON public."auth_sessions"("tenantId", "organizationId");
CREATE INDEX IF NOT EXISTS "auth_sessions_expires_idx" ON public."auth_sessions"("expiresAt");

CREATE TABLE IF NOT EXISTS public."auth_refresh_families" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastRotatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  CONSTRAINT "auth_refresh_families_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_refresh_families_session_fkey" FOREIGN KEY ("sessionId") REFERENCES public."auth_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "auth_refresh_families_user_fkey" FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_refresh_families_session_key" ON public."auth_refresh_families"("sessionId");
CREATE INDEX IF NOT EXISTS "auth_refresh_families_user_status_idx" ON public."auth_refresh_families"("userId", "status");
CREATE INDEX IF NOT EXISTS "auth_refresh_families_expires_idx" ON public."auth_refresh_families"("expiresAt");

CREATE TABLE IF NOT EXISTS public."auth_refresh_tokens" (
  "id" TEXT NOT NULL,
  "familyId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "parentTokenId" TEXT,
  "replacedByTokenId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "reuseDetectedAt" TIMESTAMP(3),
  CONSTRAINT "auth_refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_refresh_tokens_family_fkey" FOREIGN KEY ("familyId") REFERENCES public."auth_refresh_families"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "auth_refresh_tokens_hash_key" ON public."auth_refresh_tokens"("tokenHash");
CREATE INDEX IF NOT EXISTS "auth_refresh_tokens_family_status_idx" ON public."auth_refresh_tokens"("familyId", "status");
CREATE INDEX IF NOT EXISTS "auth_refresh_tokens_expires_idx" ON public."auth_refresh_tokens"("expiresAt");

CREATE TABLE IF NOT EXISTS public."auth_login_attempts" (
  "accountKeyHash" TEXT NOT NULL,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_login_attempts_pkey" PRIMARY KEY ("accountKeyHash")
);

CREATE INDEX IF NOT EXISTS "auth_login_attempts_locked_idx" ON public."auth_login_attempts"("lockedUntil");

CREATE TABLE IF NOT EXISTS public."mfa_factors" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'TOTP',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "secretCiphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mfa_factors_user_fkey" FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "mfa_factors_user_status_idx" ON public."mfa_factors"("userId", "status");

CREATE TABLE IF NOT EXISTS public."mfa_backup_codes" (
  "id" TEXT NOT NULL,
  "factorId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt" TIMESTAMP(3),
  CONSTRAINT "mfa_backup_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mfa_backup_codes_factor_fkey" FOREIGN KEY ("factorId") REFERENCES public."mfa_factors"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "mfa_backup_codes_hash_key" ON public."mfa_backup_codes"("codeHash");
CREATE INDEX IF NOT EXISTS "mfa_backup_codes_factor_used_idx" ON public."mfa_backup_codes"("factorId", "usedAt");

CREATE TABLE IF NOT EXISTS public."mfa_challenges" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "sessionId" TEXT,
  "factorId" TEXT,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mfa_challenges_user_fkey" FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mfa_challenges_session_fkey" FOREIGN KEY ("sessionId") REFERENCES public."auth_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "mfa_challenges_factor_fkey" FOREIGN KEY ("factorId") REFERENCES public."mfa_factors"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "mfa_challenges_user_purpose_status_idx" ON public."mfa_challenges"("userId", "purpose", "status");
CREATE INDEX IF NOT EXISTS "mfa_challenges_session_status_idx" ON public."mfa_challenges"("sessionId", "status");
CREATE INDEX IF NOT EXISTS "mfa_challenges_expires_idx" ON public."mfa_challenges"("expiresAt");
