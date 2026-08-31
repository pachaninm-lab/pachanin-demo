import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type AuthSqlClient = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

export type LoginCredentialRow = {
  user_id: string;
  email: string;
  password_hash: string;
};

export type IdentityRow = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  user_status: string;
  membership_id: string;
  role: string;
  is_org_admin: boolean;
  membership_status: string;
  organization_id: string;
  organization_status: string;
  tenant_id: string;
};

export type MembershipIdentityRow = IdentityRow & { organization_name: string };

export type MembershipSelectionChallengeRow = {
  id: string;
  user_id: string;
  token_hash: string;
  status: string;
  credential_version: number;
  current_credential_version: number;
  attempts: number;
  max_attempts: number;
  expires_at: Date;
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

export type AccountAuthorityContext = {
  sessionId: string;
  userId: string;
  membershipId: string;
  organizationId: string;
  tenantId: string;
};

export type AccountMembershipExport = {
  membershipId: string;
  role: string;
  status: string;
  organizationId: string;
  organizationName: string;
  tenantId: string;
  organizationStatus: string;
};

export type AccountDataExportRow = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  created_at: Date;
  consent_version: string | null;
  consent_at: Date | null;
  mfa_enabled: boolean;
  credential_version: number;
  membership_data: AccountMembershipExport[];
};

export type AccountAnonymizationRow = {
  applied: boolean;
  anonymized_at: Date | null;
};

// Session resolution deliberately excludes credential material. Password data
// is available only to the bounded login flow before a session exists.
export type SessionContextRow = IdentityRow & {
  session_id: string;
  session_status: string;
  refresh_family_id: string;
  session_credential_version: number;
  mfa_level: string;
  mfa_verified_at: Date | null;
  session_expires_at: Date;
  /**
   * When this session was last used, throttled to one write a minute by
   * touchSession. The column has been stored since the sessions table was
   * created; nothing read it, so an idle session stayed valid for its full
   * absolute lifetime. It is selected here so the inactivity limit can be
   * decided from it.
   */
  session_last_seen_at: Date;
  revoked_at: Date | null;
  revocation_reason: string | null;
  current_credential_version: number;
  current_mfa_enabled: boolean;
};

/**
 * Сессия продукта Гекта. У неё нет ни членства, ни организации, ни тенанта,
 * поэтому auth.resolve_session_identity_v2 её не разрешает вовсе — эта функция
 * внутренне соединяется с user_orgs и organizations. Личность приходит из
 * такой же ограниченной SECURITY DEFINER функции
 * auth.resolve_product_session_identity_v1: public."users" закрыт row-level
 * security, и рантайм не читает эту таблицу напрямую ни здесь, ни где-либо ещё.
 *
 * Отдельный тип строки — не дубликат: он физически не содержит полей
 * organization_id, tenant_id, membership_id и role, поэтому продуктовая сессия
 * не может быть по ошибке передана туда, где ожидается платформенная.
 */
export type ProductSessionContextRow = {
  user_id: string;
  email: string;
  full_name: string;
  user_status: string;
  session_id: string;
  session_scope: string;
  session_status: string;
  refresh_family_id: string;
  session_credential_version: number;
  mfa_level: string;
  mfa_verified_at: Date | null;
  session_expires_at: Date;
  session_last_seen_at: Date;
  revoked_at: Date | null;
  revocation_reason: string | null;
  current_credential_version: number;
  current_mfa_enabled: boolean;
};

export type ProductMfaChallengeRow = ProductSessionContextRow & {
  challenge_id: string;
  challenge_token_hash: string;
  challenge_type: string;
  challenge_status: string;
  challenge_attempts: number;
  challenge_max_attempts: number;
  challenge_expires_at: Date;
};

export type GektaRegistrationOutcomeRow = {
  outcome: string;
  user_id: string | null;
};

export type GektaEmailChallengeRow = {
  id: string;
  user_id: string;
  token_hash: string;
  status: string;
  expires_at: Date;
  consumed_at: Date | null;
};

export type GektaEmailChallengeSummaryRow = {
  id: string;
  created_at: Date;
};

export type ProductRefreshContextRow = ProductSessionContextRow & {
  refresh_token_id: string;
  refresh_token_hash: string;
  refresh_token_status: string;
  refresh_token_expires_at: Date;
  refresh_token_consumed_at: Date | null;
  refresh_token_family_id: string;
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
  /** Position in the chain, resolved under the chain's advisory lock. */
  chainSequence: bigint;
};

/**
 * A hash chain cannot be appended to concurrently without conflict, and under
 * SERIALIZABLE the conflict is unavoidable by design: the transaction's
 * snapshot is taken before it can acquire the chain's advisory lock, so a
 * writer that waited for the lock still cannot see the row the previous holder
 * committed. It computes the same next position, and PostgreSQL rejects the
 * duplicate. That rejection is the integrity guarantee working, so the answer
 * is to retry the whole transaction against a fresh snapshot rather than to
 * weaken the constraint.
 *
 * The budget is sized for genuine contention on a single chain: each retry
 * round lets one waiting writer through, so a burst of N writers needs up to
 * N attempts from the unluckiest one.
 */
const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 64;

/**
 * Unique violations that mean "another writer reached this chain position
 * first". Prisma reports the offending key columns rather than the index name,
 * so both spellings are matched. Any other duplicate is a real defect and must
 * surface rather than be retried.
 */
const AUTH_CHAIN_CONTENTION_SIGNATURES = [
  'auth_audit_events_chain_position_key',
  'auth_audit_events_prev_hash_key',
  'chain_key, chain_sequence',
  'chain_key,chain_sequence',
  '(prev_hash)',
];

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
    if (candidate?.code === 'P2034'
      || candidate?.meta?.code === '40001'
      || String(candidate?.meta?.database_error ?? '').includes('40001')
      || /could not serialize access|write conflict|deadlock detected/i.test(String(candidate?.message ?? ''))) {
      return true;
    }
    // A unique violation on a chain index is contention, not corruption: the
    // position was claimed by a writer this transaction's snapshot predates.
    const description = `${String(candidate?.message ?? '')} ${String(candidate?.meta?.database_error ?? '')}`;
    const uniqueViolation = candidate?.code === 'P2002'
      || candidate?.meta?.code === '23505'
      || description.includes('23505');
    return uniqueViolation
      && AUTH_CHAIN_CONTENTION_SIGNATURES.some((signature) => description.includes(signature));
  }

  // This is the complete pre-password authority: one user id, normalized
  // email and bcrypt hash. It cannot disclose membership, organization,
  // tenant, role or MFA state.
  async findLoginCredentialByEmail(
    client: AuthSqlClient,
    email: string,
  ): Promise<LoginCredentialRow | null> {
    const rows = await client.$queryRaw<LoginCredentialRow[]>(Prisma.sql`
      SELECT user_id, email, password_hash
      FROM auth.resolve_login_credential(${email})
    `);
    return rows[0] ?? null;
  }

  /**
   * Rewrites a stored password hash into the current format, or reports that it
   * did not.
   *
   * Conditional on the exact previous value, so a concurrent password change or
   * a parallel login that already upgraded wins and this call changes nothing.
   * The narrow definer function is the write path because public."users" is
   * under FORCE row level security; the runtime role cannot write that table
   * directly and does not need to.
   *
   * This is not an authentication step. The caller has already verified the
   * password against the previous hash.
   */
  async upgradePasswordHashFormat(
    client: AuthSqlClient,
    userId: string,
    nextHash: string,
    expectedHash: string,
  ): Promise<boolean> {
    const rows = await client.$queryRaw<Array<{ upgraded: boolean }>>(Prisma.sql`
      SELECT auth.upgrade_password_hash_format(${userId}, ${nextHash}, ${expectedHash}) AS upgraded
    `);
    return rows[0]?.upgraded === true;
  }

  async findIdentitiesByUser(
    client: AuthSqlClient,
    userId: string,
  ): Promise<MembershipIdentityRow[]> {
    return client.$queryRaw<MembershipIdentityRow[]>(Prisma.sql`
      SELECT
        context.user_id,
        context.email,
        context.full_name,
        context.phone,
        context.user_status,
        context.membership_id,
        context.role,
        context.is_org_admin,
        context.membership_status,
        context.organization_id,
        context.organization_name,
        context.organization_status,
        context.tenant_id
      FROM auth.resolve_post_password_membership_ids(${userId}) membership
      JOIN LATERAL auth.resolve_post_password_membership_context(
        ${userId}, membership.membership_id
      ) context ON TRUE
    `);
  }

  async findIdentityByUserAndMembership(
    client: AuthSqlClient,
    userId: string,
    membershipId: string,
  ): Promise<IdentityRow | null> {
    const rows = await client.$queryRaw<IdentityRow[]>(Prisma.sql`
      SELECT
        user_id,
        email,
        full_name,
        phone,
        user_status,
        membership_id,
        role,
        is_org_admin,
        membership_status,
        organization_id,
        organization_status,
        tenant_id
      FROM auth.resolve_post_password_membership_context(${userId}, ${membershipId})
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
      ON CONFLICT (user_id) DO UPDATE
      SET consent_version = CASE
            WHEN EXCLUDED.consent_version IS NULL THEN auth.credential_states.consent_version
            ELSE EXCLUDED.consent_version
          END,
          consent_at = CASE
            WHEN EXCLUDED.consent_version IS NULL THEN auth.credential_states.consent_at
            ELSE EXCLUDED.consent_at
          END,
          updated_at = CASE
            WHEN EXCLUDED.consent_version IS NULL THEN auth.credential_states.updated_at
            ELSE NOW()
          END
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

  async accountDataExport(
    client: AuthSqlClient,
    context: AccountAuthorityContext,
  ): Promise<AccountDataExportRow | null> {
    const rows = await client.$queryRaw<AccountDataExportRow[]>(Prisma.sql`
      SELECT
        user_id,
        email,
        full_name,
        phone,
        created_at,
        consent_version,
        consent_at,
        mfa_enabled,
        credential_version,
        membership_data
      FROM auth.account_data_export(
        ${context.sessionId},
        ${context.userId},
        ${context.membershipId},
        ${context.organizationId},
        ${context.tenantId}
      )
    `);
    return rows[0] ?? null;
  }

  async anonymizeAccountIdentity(
    client: AuthSqlClient,
    context: AccountAuthorityContext,
  ): Promise<AccountAnonymizationRow | null> {
    const rows = await client.$queryRaw<AccountAnonymizationRow[]>(Prisma.sql`
      SELECT applied, anonymized_at
      FROM auth.anonymize_account_identity(
        ${context.sessionId},
        ${context.userId},
        ${context.membershipId},
        ${context.organizationId},
        ${context.tenantId}
      )
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

  /**
   * Consumes a TOTP time-step counter, or refuses because it is not new.
   *
   * The whole control is the predicate. A read-then-write would leave a window
   * where two processes both see the old value and both accept the same code;
   * a single conditional UPDATE cannot, because PostgreSQL serialises the row
   * and the second statement re-evaluates against the value the first wrote.
   * The API and the workers are separate processes, so that is the race that
   * matters here rather than a theoretical one.
   *
   * Strictly greater, not greater-or-equal: RFC 6238 section 5.2 requires that
   * a counter already accepted never be accepted again, and the same rule also
   * refuses an older counter still inside the acceptance window, which is the
   * shape a replay actually takes.
   *
   * Returns false when no row changed - replayed counter, stale counter, or no
   * such credential row - and every one of those is a refusal.
   */
  async consumeTotpCounter(
    client: AuthSqlClient,
    userId: string,
    counter: number,
  ): Promise<boolean> {
    const updated = await client.$executeRaw(Prisma.sql`
      UPDATE auth.credential_states
      SET mfa_last_totp_counter = ${counter},
          updated_at = NOW()
      WHERE user_id = ${userId}
        AND (mfa_last_totp_counter IS NULL OR mfa_last_totp_counter < ${counter})
    `);
    return updated === 1;
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

  /**
   * Сессия продукта создаётся без членства, организации и тенанта. Три колонки
   * не просто опускаются — они явно записываются как NULL, чтобы ограничение
   * auth_sessions_scope_identity_check отвергло любую попытку выдать
   * продуктовой сессии организационную принадлежность.
   */
  async createProductSession(
    client: AuthSqlClient,
    input: {
      id: string;
      userId: string;
      scope: 'GEKTA';
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
        scope,
        status,
        refresh_family_id,
        credential_version,
        user_agent_hash,
        ip_hash,
        expires_at
      ) VALUES (
        ${input.id},
        ${input.userId},
        NULL,
        NULL,
        NULL,
        ${input.scope},
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
      type: 'TOTP_ENROLL' | 'TOTP_VERIFY' | 'STEP_UP';
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

  async expirePendingMfaChallenges(
    client: AuthSqlClient,
    sessionId: string,
    type: 'STEP_UP',
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.mfa_challenges
      SET status = 'EXPIRED'
      WHERE session_id = ${sessionId}
        AND type = ${type}
        AND status = 'PENDING'
    `);
  }

  async createMembershipSelectionChallenge(
    client: AuthSqlClient,
    input: {
      id: string;
      userId: string;
      tokenHash: string;
      credentialVersion: number;
      expiresAt: Date;
    },
  ) {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.membership_selection_challenges
      SET status = 'REVOKED', updated_at = NOW()
      WHERE user_id = ${input.userId} AND status = 'PENDING'
    `);
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.membership_selection_challenges (
        id, user_id, token_hash, credential_version, expires_at
      ) VALUES (
        ${input.id}, ${input.userId}, ${input.tokenHash}, ${input.credentialVersion}, ${input.expiresAt}
      )
    `);
  }

  async getMembershipSelectionChallengeForUpdate(
    client: AuthSqlClient,
    challengeId: string,
  ): Promise<MembershipSelectionChallengeRow | null> {
    const rows = await client.$queryRaw<MembershipSelectionChallengeRow[]>(Prisma.sql`
      SELECT
        challenge.id,
        challenge.user_id,
        challenge.token_hash,
        challenge.status,
        challenge.credential_version,
        credential.credential_version AS current_credential_version,
        challenge.attempts,
        challenge.max_attempts,
        challenge.expires_at
      FROM auth.membership_selection_challenges challenge
      JOIN auth.credential_states credential ON credential.user_id = challenge.user_id
      WHERE challenge.id = ${challengeId}
      FOR UPDATE OF challenge, credential
    `);
    return rows[0] ?? null;
  }

  async recordMembershipSelectionFailure(
    client: AuthSqlClient,
    challengeId: string,
    terminal: boolean,
  ) {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.membership_selection_challenges
      SET attempts = LEAST(attempts + 1, max_attempts),
          status = CASE WHEN ${terminal} THEN 'REVOKED' ELSE status END,
          updated_at = NOW()
      WHERE id = ${challengeId} AND status = 'PENDING'
    `);
  }

  async consumeMembershipSelectionChallenge(client: AuthSqlClient, challengeId: string) {
    const updated = await client.$executeRaw(Prisma.sql`
      UPDATE auth.membership_selection_challenges
      SET status = 'CONSUMED', consumed_at = NOW(), updated_at = NOW()
      WHERE id = ${challengeId} AND status = 'PENDING'
    `);
    if (updated !== 1) throw new Error('Membership selection challenge conflict');
  }

  /**
   * Чтение продуктовой сессии. Условие scope = 'GEKTA' стоит в самом запросе:
   * платформенная сессия не может быть прочитана как продуктовая, даже если
   * её идентификатор подставят в продуктовый маршрут.
   */
  async getProductSessionContext(
    client: AuthSqlClient,
    sessionId: string,
    userId?: string,
  ): Promise<ProductSessionContextRow | null> {
    const userFilter = userId ? Prisma.sql` AND s.user_id = ${userId}` : Prisma.empty;
    const rows = await client.$queryRaw<ProductSessionContextRow[]>(Prisma.sql`
      SELECT
        subject.user_id AS user_id,
        subject.email AS email,
        subject.full_name AS full_name,
        subject.user_status AS user_status,
        s.id AS session_id,
        s.scope AS session_scope,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.last_seen_at AS session_last_seen_at,
        s.revoked_at,
        s.revocation_reason,
        cs.credential_version AS current_credential_version,
        cs.mfa_enabled AS current_mfa_enabled
      FROM auth.sessions s
      JOIN LATERAL auth.resolve_product_session_identity_v1(s.user_id) subject ON TRUE
      JOIN auth.credential_states cs ON cs.user_id = s.user_id
      WHERE s.id = ${sessionId}
        AND s.scope = 'GEKTA'${userFilter}
    `);
    return rows[0] ?? null;
  }

  async getProductRefreshContextForUpdate(
    client: AuthSqlClient,
    refreshTokenId: string,
  ): Promise<ProductRefreshContextRow | null> {
    const rows = await client.$queryRaw<ProductRefreshContextRow[]>(Prisma.sql`
      SELECT
        subject.user_id AS user_id,
        subject.email AS email,
        subject.full_name AS full_name,
        subject.user_status AS user_status,
        s.id AS session_id,
        s.scope AS session_scope,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.last_seen_at AS session_last_seen_at,
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
      JOIN LATERAL auth.resolve_product_session_identity_v1(s.user_id) subject ON TRUE
      JOIN auth.credential_states cs ON cs.user_id = s.user_id
      WHERE rt.id = ${refreshTokenId}
        AND s.scope = 'GEKTA'
      FOR UPDATE OF rt, s
    `);
    return rows[0] ?? null;
  }

  /**
   * Продуктовый MFA-challenge. Та же таблица auth.mfa_challenges и та же
   * блокировка, что у платформы; отличается только разрешение личности и
   * ограничение по области действия сессии.
   */
  async getProductMfaChallengeForUpdate(
    client: AuthSqlClient,
    challengeId: string,
  ): Promise<ProductMfaChallengeRow | null> {
    const rows = await client.$queryRaw<ProductMfaChallengeRow[]>(Prisma.sql`
      SELECT
        subject.user_id AS user_id,
        subject.email AS email,
        subject.full_name AS full_name,
        subject.user_status AS user_status,
        s.id AS session_id,
        s.scope AS session_scope,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.last_seen_at AS session_last_seen_at,
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
      JOIN LATERAL auth.resolve_product_session_identity_v1(s.user_id) subject ON TRUE
      JOIN auth.credential_states cs ON cs.user_id = s.user_id
      WHERE c.id = ${challengeId}
        AND s.scope = 'GEKTA'
      FOR UPDATE OF c, s, cs
    `);
    return rows[0] ?? null;
  }

  /**
   * Заведение личности пользователя Гекты. Ни организации, ни тенанта, ни
   * роли в сигнатуре нет — их нельзя передать даже по ошибке.
   */
  async prepareGektaRegistrationIdentity(
    client: AuthSqlClient,
    input: { userId: string; email: string; phone: string | null; passwordHash: string; fullName: string },
  ): Promise<GektaRegistrationOutcomeRow | null> {
    const rows = await client.$queryRaw<GektaRegistrationOutcomeRow[]>(Prisma.sql`
      SELECT outcome, user_id
      FROM auth.prepare_gekta_registration_identity(
        ${input.userId}, ${input.email}, ${input.phone}, ${input.passwordHash}, ${input.fullName}
      )
    `);
    return rows[0] ?? null;
  }

  async createGektaEmailChallenge(
    client: AuthSqlClient,
    input: { id: string; userId: string; tokenHash: string; expiresAt: Date },
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.registration_email_challenges (
        id, application_id, user_id, token_hash, scope, expires_at
      ) VALUES (
        ${input.id}, NULL, ${input.userId}, ${input.tokenHash}, 'GEKTA', ${input.expiresAt}
      )
    `);
  }

  /** Serializes initial registration and resend for one normalized email. */
  async lockGektaRegistrationEmail(client: AuthSqlClient, email: string): Promise<void> {
    await client.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`registration-email:${email}`}, 0)
      )
    `);
  }

  async getLatestGektaEmailChallengeForUpdate(
    client: AuthSqlClient,
    userId: string,
  ): Promise<GektaEmailChallengeSummaryRow | null> {
    const rows = await client.$queryRaw<GektaEmailChallengeSummaryRow[]>(Prisma.sql`
      SELECT id, created_at
      FROM auth.registration_email_challenges
      WHERE user_id = ${userId}
        AND scope = 'GEKTA'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  async revokePendingGektaEmailChallenges(
    client: AuthSqlClient,
    userId: string,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.registration_email_challenges
      SET status = 'REVOKED', updated_at = NOW()
      WHERE user_id = ${userId}
        AND scope = 'GEKTA'
        AND status = 'PENDING'
    `);
  }

  async getGektaEmailChallengeForUpdate(
    client: AuthSqlClient,
    challengeId: string,
  ): Promise<GektaEmailChallengeRow | null> {
    const rows = await client.$queryRaw<GektaEmailChallengeRow[]>(Prisma.sql`
      SELECT id, user_id, token_hash, status, expires_at, consumed_at
      FROM auth.registration_email_challenges
      WHERE id = ${challengeId}
        AND scope = 'GEKTA'
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  /** Потребление одноразовое: повторный вызов не изменит ни одной строки. */
  async consumeGektaEmailChallenge(client: AuthSqlClient, challengeId: string, now: Date): Promise<number> {
    return client.$executeRaw(Prisma.sql`
      UPDATE auth.registration_email_challenges
      SET status = 'CONSUMED', consumed_at = ${now}, updated_at = NOW()
      WHERE id = ${challengeId} AND scope = 'GEKTA' AND status = 'PENDING'
    `);
  }

  async markGektaEmailVerified(client: AuthSqlClient, challengeId: string, userId: string): Promise<boolean> {
    const rows = await client.$queryRaw<Array<{ updated: boolean }>>(Prisma.sql`
      SELECT updated FROM auth.mark_gekta_email_verified(${challengeId}, ${userId})
    `);
    return rows[0]?.updated === true;
  }

  /** Личность субъекта Гекты по идентификатору, через ту же ограниченную функцию. */
  async getProductRegistrationSubject(
    client: AuthSqlClient,
    userId: string,
  ): Promise<{ user_id: string; email: string; full_name: string; phone: string | null; user_status: string } | null> {
    const rows = await client.$queryRaw<Array<{ user_id: string; email: string; full_name: string; phone: string | null; user_status: string }>>(Prisma.sql`
      SELECT user_id, email, full_name, phone, user_status
      FROM auth.resolve_gekta_registration_subject_v1(${userId})
    `);
    return rows[0] ?? null;
  }

  /**
   * До-парольный контур входа в Гекту: идентификатор, email, bcrypt-хеш и
   * состояние субъекта. Пользователь платформы этой функцией не разрешается.
   */
  async findGektaLoginCredential(
    client: AuthSqlClient,
    email: string,
  ): Promise<{ user_id: string; email: string; password_hash: string; user_status: string } | null> {
    const rows = await client.$queryRaw<Array<{ user_id: string; email: string; password_hash: string; user_status: string }>>(Prisma.sql`
      SELECT user_id, email, password_hash, user_status
      FROM auth.resolve_gekta_login_credential(${email})
    `);
    return rows[0] ?? null;
  }

  /** Область действия сессии по её идентификатору: нужна для выбора ветки проверки токена. */
  async getSessionScope(client: AuthSqlClient, sessionId: string): Promise<string | null> {
    const rows = await client.$queryRaw<{ scope: string }[]>(Prisma.sql`
      SELECT s.scope FROM auth.sessions s WHERE s.id = ${sessionId}
    `);
    return rows[0]?.scope ?? null;
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
        identity.user_id,
        identity.email,
        identity.full_name,
        identity.phone,
        identity.user_status,
        identity.membership_id,
        identity.role,
        identity.is_org_admin,
        identity.membership_status,
        identity.organization_id,
        identity.organization_status,
        identity.tenant_id,
        s.id AS session_id,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.last_seen_at AS session_last_seen_at,
        s.revoked_at,
        s.revocation_reason,
        cs.credential_version AS current_credential_version,
        cs.mfa_enabled AS current_mfa_enabled
      FROM auth.sessions s
      JOIN LATERAL auth.resolve_session_identity_v2(
        s.user_id, s.membership_id, s.organization_id, s.tenant_id
      ) identity ON TRUE
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
        identity.user_id,
        identity.email,
        identity.full_name,
        identity.phone,
        identity.user_status,
        identity.membership_id,
        identity.role,
        identity.is_org_admin,
        identity.membership_status,
        identity.organization_id,
        identity.organization_status,
        identity.tenant_id,
        s.id AS session_id,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.last_seen_at AS session_last_seen_at,
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
      JOIN LATERAL auth.resolve_session_identity_v2(
        s.user_id, s.membership_id, s.organization_id, s.tenant_id
      ) identity ON TRUE
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
        identity.user_id,
        identity.email,
        identity.full_name,
        identity.phone,
        identity.user_status,
        identity.membership_id,
        identity.role,
        identity.is_org_admin,
        identity.membership_status,
        identity.organization_id,
        identity.organization_status,
        identity.tenant_id,
        s.id AS session_id,
        s.status AS session_status,
        s.refresh_family_id,
        s.credential_version AS session_credential_version,
        s.mfa_level,
        s.mfa_verified_at,
        s.expires_at AS session_expires_at,
        s.last_seen_at AS session_last_seen_at,
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
      JOIN LATERAL auth.resolve_session_identity_v2(
        s.user_id, s.membership_id, s.organization_id, s.tenant_id
      ) identity ON TRUE
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
    const challengeUpdated = await client.$executeRaw(Prisma.sql`
      UPDATE auth.mfa_challenges
      SET status = 'VERIFIED', verified_at = NOW()
      WHERE id = ${input.challengeId}
        AND session_id = ${input.sessionId}
        AND user_id = ${input.userId}
        AND status = 'PENDING'
        AND type IN ('TOTP_ENROLL', 'TOTP_VERIFY')
    `);
    if (challengeUpdated !== 1) throw new Error('MFA login challenge conflict');

    const sessionUpdated = await client.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET status = 'ACTIVE',
          mfa_level = ${input.method},
          mfa_verified_at = NOW(),
          mfa_verified_method = ${input.method},
          last_seen_at = NOW(),
          updated_at = NOW()
      WHERE id = ${input.sessionId}
        AND user_id = ${input.userId}
        AND status = 'MFA_PENDING'
    `);
    if (sessionUpdated !== 1) throw new Error('MFA login session conflict');

    const credentialUpdated = await client.$executeRaw(Prisma.sql`
      UPDATE auth.credential_states
      SET mfa_enabled = CASE WHEN ${input.enableMfa} THEN TRUE ELSE mfa_enabled END,
          mfa_key_version = CASE
            WHEN ${input.method === 'TOTP'}
              AND mfa_secret_ciphertext
                ~ '^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$'
              THEN 'v1'
            ELSE mfa_key_version
          END,
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
    if (credentialUpdated !== 1) throw new Error('MFA credential state conflict');
    // A fresh TOTP proves possession of the authoritative authenticator for
    // both enrollment and ordinary verification. Re-run the bounded legacy
    // flag finalizer on either TOTP path, but never on a backup-code login.
    if (input.method === 'TOTP') {
      const finalized = await client.$queryRaw<Array<{ updated: boolean }>>(Prisma.sql`
        SELECT updated
        FROM auth.finalize_authenticated_user_mfa(
          ${input.userId}, ${input.sessionId}, ${input.challengeId}
        )
      `);
      if (finalized[0]?.updated !== true) throw new Error('MFA user state conflict');
    }
  }

  async activateMfaStepUp(
    client: AuthSqlClient,
    input: {
      challengeId: string;
      sessionId: string;
      userId: string;
      method: 'TOTP' | 'BACKUP';
      backupHashes?: string[];
    },
  ): Promise<Date> {
    const verifiedAt = new Date();
    const challengeUpdated = await client.$executeRaw(Prisma.sql`
      UPDATE auth.mfa_challenges
      SET status = 'VERIFIED', verified_at = ${verifiedAt}
      WHERE id = ${input.challengeId}
        AND status = 'PENDING'
        AND type = 'STEP_UP'
    `);
    if (challengeUpdated !== 1) throw new Error('MFA step-up challenge conflict');

    const sessionUpdated = await client.$executeRaw(Prisma.sql`
      UPDATE auth.sessions
      SET mfa_level = ${input.method},
          mfa_verified_at = ${verifiedAt},
          mfa_verified_method = ${input.method},
          last_seen_at = ${verifiedAt},
          updated_at = ${verifiedAt}
      WHERE id = ${input.sessionId}
        AND user_id = ${input.userId}
        AND status = 'ACTIVE'
    `);
    if (sessionUpdated !== 1) throw new Error('MFA step-up session conflict');

    if (input.backupHashes) {
      await client.$executeRaw(Prisma.sql`
        UPDATE auth.credential_states
        SET mfa_backup_hashes = ${JSON.stringify(input.backupHashes)}::jsonb,
            updated_at = ${verifiedAt}
        WHERE user_id = ${input.userId}
      `);
    }
    return verifiedAt;
  }

  async recordMfaFailure(
    client: AuthSqlClient,
    challengeId: string,
    terminal: boolean,
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.mfa_challenges
      SET attempts = LEAST(attempts + 1, max_attempts),
          status = CASE WHEN ${terminal} THEN 'FAILED' ELSE status END,
          updated_at = NOW()
      WHERE id = ${challengeId}
        AND status = 'PENDING'
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

  /**
   * The chain an event belongs to. Kept identical to the generated chain_key
   * column so the writer, the reader and the verifier cannot disagree.
   */
  static auditChainKey(userId?: string | null, sessionId?: string | null): string {
    return sessionId ?? userId ?? 'auth-global';
  }

  /**
   * Resolves the tail of a chain under its advisory lock, and the position the
   * next event must occupy.
   *
   * Ordering is by chain_sequence, never by created_at: created_at defaults to
   * NOW(), which is the transaction timestamp, so every event written inside
   * one transaction shares it and the previous tie-break — a random TEXT id —
   * could resolve "the previous event" to the wrong one.
   */
  async latestAuditChainPosition(
    client: AuthSqlClient,
    userId?: string | null,
    sessionId?: string | null,
  ): Promise<{ chainKey: string; prevHash: string | null; nextSequence: bigint }> {
    const chainKey = PersistentAuthRepository.auditChainKey(userId, sessionId);
    await client.$queryRaw<Array<{ acquired: number }>>(Prisma.sql`
      SELECT 1::int AS acquired
      FROM (
        SELECT pg_advisory_xact_lock(hashtextextended(${chainKey}, 0))
      ) AS auth_audit_lock
    `);
    const rows = await client.$queryRaw<Array<{ hash: string; chain_sequence: bigint }>>(Prisma.sql`
      SELECT hash, chain_sequence
      FROM auth.audit_events
      WHERE chain_key = ${chainKey}
      ORDER BY chain_sequence DESC
      LIMIT 1
    `);
    const tail = rows[0];
    return {
      chainKey,
      prevHash: tail?.hash ?? null,
      nextSequence: tail ? BigInt(tail.chain_sequence) + 1n : 1n,
    };
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
        prev_hash,
        chain_sequence
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
        ${input.prevHash ?? null},
        ${input.chainSequence}
      )
    `);
  }
}
