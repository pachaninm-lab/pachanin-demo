import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type AuthSqlClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

export type IdentityRow = {
  user_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  user_status: string;
  membership_id: string;
  role: string;
  organization_id: string;
  organization_status: string;
  tenant_id: string;
};

export type CredentialStateRow = {
  user_id: string;
  credential_version: number;
  failed_login_count: number;
  locked_until: Date | null;
  password_changed_at: Date | null;
  last_login_at: Date | null;
  mfa_enabled: boolean;
  mfa_secret_ciphertext: string | null;
  mfa_key_version: string | null;
  mfa_backup_hashes: unknown;
  consent_version: string | null;
  consent_at: Date | null;
};

export type SessionContextRow = IdentityRow & {
  session_id: string;
  session_status: string;
  refresh_family_id: string;
  session_credential_version: number;
  mfa_level: string;
  mfa_verified_at: Date | null;
  session_expires_at: Date;
  revoked_at: Date | null;
  revocation_reason: string | null;
  current_credential_version: number;
  current_mfa_enabled: boolean;
};

export type RefreshContextRow = SessionContextRow & {
  refresh_token_id: string;
  refresh_token_hash: string;
  refresh_token_status: string;
  refresh_token_expires_at: Date;
  refresh_token_consumed_at: Date | null;
  refresh_token_family_id: string;
};

export type MfaChallengeRow = SessionContextRow & {
  challenge_id: string;
  challenge_token_hash: string;
  challenge_type: string;
  challenge_status: string;
  challenge_attempts: number;
  challenge_max_attempts: number;
  challenge_expires_at: Date;
};

export type AuthAuditInput = {
  id: string;
  userId?: string | null;
  sessionId?: string | null;
  membershipId?: string | null;
  organizationId?: string | null;
  tenantId?: string | null;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  hash: string;
  prevHash?: string | null;
};

const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class PersistentAuthRepository {
  constructor(readonly prisma: PrismaService) {}

  async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    isolationLevel = Prisma.TransactionIsolationLevel.Serializable,
  ): Promise<T> {
    for (let attempt = 1; attempt <= MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, { isolationLevel, timeout: 15_000, maxWait: 5_000 });
      } catch (error) {
        if (attempt >= MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS || !this.isSerializationFailure(error)) {
          throw error;
        }
      }
    }
    throw new Error('Auth transaction retry budget exhausted');
  }

  private isSerializationFailure(error: unknown): boolean {
    const candidate = error as {
      code?: unknown;
      message?: unknown;
      meta?: { code?: unknown; database_error?: unknown };
    };
    return candidate?.code === 'P2034'
      || candidate?.meta?.code === '40001'
      || String(candidate?.meta?.database_error ?? '').includes('40001')
      || /could not serialize access|write conflict|deadlock detected/i.test(String(candidate?.message ?? ''));
  }

  async findIdentityByEmail(client: AuthSqlClient, email: string): Promise<IdentityRow | null> {
    const rows = await client.$queryRaw<IdentityRow[]>(Prisma.sql`
      SELECT
        u.id AS user_id,
        u.email,
        u."passwordHash" AS password_hash,
        u."fullName" AS full_name,
        u.phone,
        u.status AS user_status,
        uo.id AS membership_id,
        uo.role,
        o.id AS organization_id,
        o.status AS organization_status,
        o."tenantId" AS tenant_id
      FROM public.users u
      JOIN public.user_orgs uo ON uo."userId" = u.id
      JOIN public.organizations o ON o.id = uo."organizationId"
      WHERE LOWER(u.email) = LOWER(${email})
      ORDER BY uo."isDefault" DESC, uo."joinedAt" ASC, uo.id ASC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findIdentityByUserAndMembership(
    client: AuthSqlClient,
    userId: string,
    membershipId: string,
  ): Promise<IdentityRow | null> {
    const rows = await client.$queryRaw<IdentityRow[]>(Prisma.sql`
      SELECT
        u.id AS user_id,
        u.email,
        u."passwordHash" AS password_hash,
        u."fullName" AS full_name,
        u.phone,
        u.status AS user_status,
        uo.id AS membership_id,
        uo.role,
        o.id AS organization_id,
        o.status AS organization_status,
        o."tenantId" AS tenant_id
      FROM public.users u
      JOIN public.user_orgs uo ON uo."userId" = u.id
      JOIN public.organizations o ON o.id = uo."organizationId"
      WHERE u.id = ${userId}
        AND uo.id = ${membershipId}
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async ensureCredentialState(
    client: AuthSqlClient,
    userId: string,
    consentVersion?: string | null,
    consentAt?: Date | null,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.credential_states (
        user_id,
        consent_version,
        consent_at
      ) VALUES (
        ${userId},
        ${consentVersion ?? null},
        ${consentAt ?? null}
      )
      ON CONFLICT (user_id) DO NOTHING
    `);
  }

  async getCredentialState(
    client: AuthSqlClient,
    userId: string,
    forUpdate = false,
  ): Promise<CredentialStateRow | null> {
    const lock = forUpdate ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<CredentialStateRow[]>(Prisma.sql`
      SELECT
        user_id,
        credential_version,
        failed_login_count,
        locked_until,
        password_changed_at,
        last_login_at,
        mfa_enabled,
        mfa_secret_ciphertext,
        mfa_key_version,
        mfa_backup_hashes,
        consent_version,
        consent_at
      FROM auth.credential_states
      WHERE user_id = ${userId}${lock}
    `);
    return rows[0] ?? null;
  }

  async getLoginThrottle(
    client: AuthSqlClient,
    accountHash: string,
    forUpdate = false,
  ): Promise<{ failures: number; locked_until: Date | null } | null> {
    const lock = forUpdate ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await client.$queryRaw<Array<{ failures: number; locked_until: Date | null }>>(Prisma.sql`
      SELECT failures, locked_until
      FROM auth.login_throttles
      WHERE account_hash = ${accountHash}${lock}
    `);
    return rows[0] ?? null;
  }

  async ensureLoginThrottle(client: AuthSqlClient, accountHash: string): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.login_throttles (account_hash)
      VALUES (${accountHash})
      ON CONFLICT (account_hash) DO NOTHING
    `);
  }

  async setLoginThrottle(
    client: AuthSqlClient,
    accountHash: string,
    failures: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.login_throttles
      SET failures = ${failures},
          locked_until = ${lockedUntil},
          updated_at = NOW()
      WHERE account_hash = ${accountHash}
    `);
  }

  async clearLoginThrottle(client: AuthSqlClient, accountHash: string): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.login_throttles
      SET failures = 0,
          locked_until = NULL,
          updated_at = NOW()
      WHERE account_hash = ${accountHash}
    `);
  }

  async createSession(
    client: AuthSqlClient,
    input: {
      id: string;
      userId: string;
      membershipId: string;
      organizationId: string;
      tenantId: string;
      status: 'MFA_PENDING' | 'ACTIVE';
      refreshFamilyId: string;
      credentialVersion: number;
      userAgentHash?: string | null;
      ipHash?: string | null;
      expiresAt: Date;
    },
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.sessions (
        id,
        user_id,
        membership_id,
        organization_id,
        tenant_id,
        status,
        refresh_family_id,
        credential_version,
        user_agent_hash,
        ip_hash,
        expires_at
      ) VALUES (
        ${input.id},
        ${input.userId},
        ${input.membershipId},
        ${input.organizationId},
        ${input.tenantId},
        ${input.status},
        ${input.refreshFamilyId},
        ${input.credentialVersion},
        ${input.userAgentHash ?? null},
        ${input.ipHash ?? null},
        ${input.expiresAt}
      )
    `);
  }

  async createRefreshToken(
    client: AuthSqlClient,
    input: {
      id: string;
      sessionId: string;
      familyId: string;
      tokenHash: string;
      parentTokenId?: string | null;
      expiresAt: Date;
      userAgentHash?: string | null;
      ipHash?: string | null;
    },
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.refresh_tokens (
        id,
        session_id,
        family_id,
        token_hash,
        parent_token_id,
        expires_at,
        user_agent_hash,
        ip_hash
      ) VALUES (
        ${input.id},
        ${input.sessionId},
        ${input.familyId},
        ${input.tokenHash},
        ${input.parentTokenId ?? null},
        ${input.expiresAt},
        ${input.userAgentHash ?? null},
        ${input.ipHash ?? null}
      )
    `);
  }

  async createMfaChallenge(
    client: AuthSqlClient,
    input: {
      id: string;
      sessionId: string;
      userId: string;
      challengeTokenHash: string;
      type: 'TOTP_ENROLL' | 'TOTP_VERIFY';
      expiresAt: Date;
    },
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.mfa_challenges (
        id,
        session_id,
        user_id,
        challenge_token_hash,
        type,
        expires_at
      ) VALUES (
        ${input.id},
        ${input.sessionId},
        ${input.userId},
        ${input.challengeTokenHash},
        ${input.type},
        ${input.expiresAt}
      )
    `);
  }

  async getSessionContext(
    client: AuthSqlClient,
    sessionId: string,
    userId?: string,
    forUpdate = false,
  ): Promise<SessionContextRow | null> {
    const lock = forUpdate ? Prisma.sql` FOR UPDATE OF s` : Prisma.empty;
    const userFilter = userId ? Prisma.sql` AND s.user_id = ${userId}` : Prisma.empty;
    const rows = await client.$queryRaw<SessionContextRow[]>(Prisma.sql`
      SELECT
        u.id AS user_id,
        u.email,
        u."passwordHash" AS password_hash,
        u."fullName" AS full_name,
        u.phone,
        u.status AS user_status,
        uo.id AS membership_id,
        uo.role,
        o.id AS organization_id,
        o.status AS organization_status,
        o."tenantId" AS tenant_id,
        s.id AS session_id,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.revoked_at,
        s.revocation_reason,
        cs.credential_version AS current_credential_version,
        cs.mfa_enabled AS current_mfa_enabled
      FROM auth.sessions s
      JOIN public.users u ON u.id = s.user_id
      JOIN public.user_orgs uo ON uo.id = s.membership_id
        AND uo."userId" = s.user_id
        AND uo."organizationId" = s.organization_id
      JOIN public.organizations o ON o.id = s.organization_id
        AND o."tenantId" = s.tenant_id
      JOIN auth.credential_states cs ON cs.user_id = s.user_id
      WHERE s.id = ${sessionId}${userFilter}${lock}
    `);
    return rows[0] ?? null;
  }

  async getRefreshContextForUpdate(
    client: AuthSqlClient,
    refreshTokenId: string,
  ): Promise<RefreshContextRow | null> {
    const rows = await client.$queryRaw<RefreshContextRow[]>(Prisma.sql`
      SELECT
        u.id AS user_id,
        u.email,
        u."passwordHash" AS password_hash,
        u."fullName" AS full_name,
        u.phone,
        u.status AS user_status,
        uo.id AS membership_id,
        uo.role,
        o.id AS organization_id,
        o.status AS organization_status,
        o."tenantId" AS tenant_id,
        s.id AS session_id,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.revoked_at,
        s.revocation_reason,
        cs.credential_version AS current_credential_version,
        cs.mfa_enabled AS current_mfa_enabled,
        rt.id AS refresh_token_id,
        rt.token_hash AS refresh_token_hash,
        rt.status AS refresh_token_status,
        rt.expires_at AS refresh_token_expires_at,
        rt.consumed_at AS refresh_token_consumed_at,
        rt.family_id AS refresh_token_family_id
      FROM auth.refresh_tokens rt
      JOIN auth.sessions s ON s.id = rt.session_id
      JOIN public.users u ON u.id = s.user_id
      JOIN public.user_orgs uo ON uo.id = s.membership_id
        AND uo."userId" = s.user_id
        AND uo."organizationId" = s.organization_id
      JOIN public.organizations o ON o.id = s.organization_id
        AND o."tenantId" = s.tenant_id
      JOIN auth.credential_states cs ON cs.user_id = s.user_id
      WHERE rt.id = ${refreshTokenId}
      FOR UPDATE OF rt, s
    `);
    return rows[0] ?? null;
  }

  async getMfaChallengeForUpdate(
    client: AuthSqlClient,
    challengeId: string,
  ): Promise<MfaChallengeRow | null> {
    const rows = await client.$queryRaw<MfaChallengeRow[]>(Prisma.sql`
      SELECT
        u.id AS user_id,
        u.email,
        u."passwordHash" AS password_hash,
        u."fullName" AS full_name,
        u.phone,
        u.status AS user_status,
        uo.id AS membership_id,
        uo.role,
        o.id AS organization_id,
        o.status AS organization_status,
        o."tenantId" AS tenant_id,
        s.id AS session_id,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.revoked_at,
        s.revocation_reason,
        cs.credential_version AS current_credential_version,
        cs.mfa_enabled AS current_mfa_enabled,
        c.id AS challenge_id,
        c.challenge_token_hash,
        c.type AS challenge_type,
        c.status AS challenge_status,
        c.attempts AS challenge_attempts,
        c.max_attempts AS challenge_max_attempts,
        c.expires_at AS challenge_expires_at
      FROM auth.mfa_challenges c
      JOIN auth.sessions s ON s.id = c.session_id
      JOIN public.users u ON u.id = s.user_id
      JOIN public.user_orgs uo ON uo.id = s.membership_id
        AND uo."userId" = s.user_id
        AND uo."organizationId" = s.organization_id
      JOIN public.organizations o ON o.id = s.organization_id
        AND o."tenantId" = s.tenant_id
      JOIN auth.credential_states cs ON cs.user_id = s.user_id
      WHERE c.id = ${challengeId}
      FOR UPDATE OF c, s, cs
    `);
    return rows[0] ?? null;
  }

  async rotateRefreshToken(
    client: AuthSqlClient,
    input: {
      currentTokenId: string;
      replacementTokenId: string;
      replacementTokenHash: string;
      sessionId: string;
      familyId: string;
      replacementExpiresAt: Date;
      userAgentHash?: string | null;
      ipHash?: string | null;
    },
  ): Promise<void> {
    await this.createRefreshToken(client, {
      id: input.replacementTokenId,
      sessionId: input.sessionId,
      familyId: input.familyId,
      tokenHash: input.replacementTokenHash,
      parentTokenId: input.currentTokenId,
      expiresAt: input.replacementExpiresAt,
      userAgentHash: input.userAgentHash,
      ipHash: input.ipHash,
    });
    const rotated = await client.$executeRaw(Prisma.sql`
      UPDATE auth.refresh_tokens
      SET status = 'ROTATED',
          consumed_at = NOW(),
          replaced_by_token_id = ${input.replacementTokenId}
      WHERE id = ${input.currentTokenId}
        AND status = 'ACTIVE'
    `);
    if (rotated !== 1) {
      throw new Error('Refresh token rotation conflict');
    }
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET last_seen_at = NOW(), updated_at = NOW()
      WHERE id = ${input.sessionId}
    `);
  }

  async revokeFamily(
    client: AuthSqlClient,
    familyId: string,
    reason: string,
    reusedTokenId?: string | null,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.refresh_tokens
      SET status = CASE WHEN id = ${reusedTokenId ?? null} THEN 'REUSED' ELSE 'REVOKED' END,
          revoked_at = NOW(),
          revocation_reason = ${reason}
      WHERE family_id = ${familyId}
        AND status IN ('ACTIVE', 'ROTATED')
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET status = 'REVOKED',
          revoked_at = NOW(),
          revocation_reason = ${reason},
          updated_at = NOW()
      WHERE refresh_family_id = ${familyId}
        AND status IN ('ACTIVE', 'MFA_PENDING')
    `);
  }

  async revokeSession(
    client: AuthSqlClient,
    sessionId: string,
    reason: string,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET status = 'REVOKED',
          revoked_at = NOW(),
          revocation_reason = ${reason},
          updated_at = NOW()
      WHERE id = ${sessionId}
        AND status IN ('ACTIVE', 'MFA_PENDING')
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.refresh_tokens
      SET status = 'REVOKED',
          revoked_at = NOW(),
          revocation_reason = ${reason}
      WHERE session_id = ${sessionId}
        AND status IN ('ACTIVE', 'ROTATED')
    `);
  }

  async revokeAllUserSessions(
    client: AuthSqlClient,
    userId: string,
    reason: string,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET status = 'REVOKED',
          revoked_at = NOW(),
          revocation_reason = ${reason},
          updated_at = NOW()
      WHERE user_id = ${userId}
        AND status IN ('ACTIVE', 'MFA_PENDING')
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.refresh_tokens rt
      SET status = 'REVOKED',
          revoked_at = NOW(),
          revocation_reason = ${reason}
      FROM auth.sessions s
      WHERE s.id = rt.session_id
        AND s.user_id = ${userId}
        AND rt.status IN ('ACTIVE', 'ROTATED')
    `);
  }

  async activateMfaSession(
    client: AuthSqlClient,
    input: {
      challengeId: string;
      sessionId: string;
      userId: string;
      method: 'TOTP' | 'BACKUP';
      enableMfa: boolean;
      backupHashes?: string[] | null;
    },
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.mfa_challenges
      SET status = 'VERIFIED', verified_at = NOW()
      WHERE id = ${input.challengeId}
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET status = 'ACTIVE',
          mfa_level = ${input.method},
          mfa_verified_at = NOW(),
          mfa_verified_method = ${input.method},
          last_seen_at = NOW(),
          updated_at = NOW()
      WHERE id = ${input.sessionId}
        AND status = 'MFA_PENDING'
    `);
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.credential_states
      SET mfa_enabled = CASE WHEN ${input.enableMfa} THEN TRUE ELSE mfa_enabled END,
          mfa_backup_hashes = CASE
            WHEN ${JSON.stringify(input.backupHashes ?? null)}::jsonb IS NULL THEN mfa_backup_hashes
            ELSE ${JSON.stringify(input.backupHashes ?? null)}::jsonb
          END,
          last_login_at = NOW(),
          failed_login_count = 0,
          locked_until = NULL,
          updated_at = NOW()
      WHERE user_id = ${input.userId}
    `);
    if (input.enableMfa) {
      await client.$executeRaw(Prisma.sql`
        UPDATE public.users SET "mfaEnabled" = TRUE WHERE id = ${input.userId}
      `);
    }
  }

  async recordMfaFailure(
    client: AuthSqlClient,
    challengeId: string,
    terminal: boolean,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.mfa_challenges
      SET attempts = attempts + 1,
          status = CASE WHEN ${terminal} THEN 'FAILED' ELSE status END
      WHERE id = ${challengeId}
    `);
  }

  async setMfaSecret(
    client: AuthSqlClient,
    userId: string,
    ciphertext: string,
    keyVersion: string,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.credential_states
      SET mfa_secret_ciphertext = ${ciphertext},
          mfa_key_version = ${keyVersion},
          updated_at = NOW()
      WHERE user_id = ${userId}
    `);
  }

  async markLoginSuccess(client: AuthSqlClient, userId: string): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.credential_states
      SET failed_login_count = 0,
          locked_until = NULL,
          last_login_at = NOW(),
          updated_at = NOW()
      WHERE user_id = ${userId}
    `);
  }

  async touchSession(client: AuthSqlClient, sessionId: string): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET last_seen_at = NOW(), updated_at = NOW()
      WHERE id = ${sessionId}
        AND last_seen_at < NOW() - INTERVAL '60 seconds'
    `);
  }

  async latestAuditHash(
    client: AuthSqlClient,
    userId?: string | null,
    sessionId?: string | null,
  ): Promise<string | null> {
    const chainKey = sessionId ?? userId ?? 'auth-global';
    await client.$queryRaw<Array<{ acquired: number }>>(Prisma.sql`
      SELECT 1::int AS acquired
      FROM (
        SELECT pg_advisory_xact_lock(hashtextextended(${chainKey}, 0))
      ) AS auth_audit_lock
    `);
    const rows = await client.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
      SELECT hash
      FROM auth.audit_events
      WHERE (${sessionId ?? null}::text IS NOT NULL AND session_id = ${sessionId ?? null})
         OR (${sessionId ?? null}::text IS NULL AND ${userId ?? null}::text IS NOT NULL AND user_id = ${userId ?? null})
         OR (${sessionId ?? null}::text IS NULL AND ${userId ?? null}::text IS NULL AND user_id IS NULL AND session_id IS NULL)
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
    return rows[0]?.hash ?? null;
  }

  async insertAudit(client: AuthSqlClient, input: AuthAuditInput): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.audit_events (
        id,
        user_id,
        session_id,
        membership_id,
        organization_id,
        tenant_id,
        action,
        outcome,
        reason,
        metadata,
        hash,
        prev_hash
      ) VALUES (
        ${input.id},
        ${input.userId ?? null},
        ${input.sessionId ?? null},
        ${input.membershipId ?? null},
        ${input.organizationId ?? null},
        ${input.tenantId ?? null},
        ${input.action},
        ${input.outcome},
        ${input.reason ?? null},
        ${JSON.stringify(input.metadata ?? {})}::jsonb,
        ${input.hash},
        ${input.prevHash ?? null}
      )
    `);
  }
}
