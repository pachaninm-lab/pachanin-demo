import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthSqlClient } from './persistent-auth.repository';
import { PersistentAuthRepository } from './persistent-auth.repository';

export type PasswordResetUserRow = {
  id: string;
  email: string;
  status: string;
  deleted_at: Date | null;
};

export type PasswordResetChallengeRow = {
  id: string;
  user_id: string;
  token_hash: string;
  status: string;
  requested_ip_hash: string | null;
  expires_at: Date;
  consumed_at: Date | null;
  created_at: Date;
};

@Injectable()
export class PasswordResetRepository {
  constructor(private readonly auth: PersistentAuthRepository) {}

  get prisma() {
    return this.auth.prisma;
  }

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.auth.transaction(work);
  }

  async findUserByEmail(client: AuthSqlClient, email: string): Promise<PasswordResetUserRow | null> {
    const rows = await client.$queryRaw<PasswordResetUserRow[]>(Prisma.sql`
      SELECT
        id,
        email,
        status,
        "deletedAt" AS deleted_at
      FROM public.users
      WHERE LOWER(email) = LOWER(${email})
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async findRecentPending(
    client: AuthSqlClient,
    userId: string,
    createdAfter: Date,
    now: Date,
  ): Promise<{ id: string; expires_at: Date } | null> {
    const rows = await client.$queryRaw<Array<{ id: string; expires_at: Date }>>(Prisma.sql`
      SELECT id, expires_at
      FROM auth.password_reset_challenges
      WHERE user_id = ${userId}
        AND status = 'PENDING'
        AND created_at > ${createdAfter}
        AND expires_at > ${now}
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  async expirePending(client: AuthSqlClient, userId: string, exceptId?: string): Promise<void> {
    const except = exceptId ? Prisma.sql` AND id <> ${exceptId}` : Prisma.empty;
    await client.$executeRaw(Prisma.sql`
      UPDATE auth.password_reset_challenges
      SET status = 'EXPIRED', updated_at = NOW()
      WHERE user_id = ${userId}
        AND status = 'PENDING'${except}
    `);
  }

  async createChallenge(
    client: AuthSqlClient,
    input: {
      id: string;
      userId: string;
      tokenHash: string;
      requestedIpHash?: string | null;
      expiresAt: Date;
    },
  ): Promise<void> {
    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.password_reset_challenges (
        id,
        user_id,
        token_hash,
        requested_ip_hash,
        expires_at
      ) VALUES (
        ${input.id},
        ${input.userId},
        ${input.tokenHash},
        ${input.requestedIpHash ?? null},
        ${input.expiresAt}
      )
    `);
  }

  async getChallengeForUpdate(
    client: AuthSqlClient,
    challengeId: string,
  ): Promise<PasswordResetChallengeRow | null> {
    const rows = await client.$queryRaw<PasswordResetChallengeRow[]>(Prisma.sql`
      SELECT
        id,
        user_id,
        token_hash,
        status,
        requested_ip_hash,
        expires_at,
        consumed_at,
        created_at
      FROM auth.password_reset_challenges
      WHERE id = ${challengeId}
      FOR UPDATE
    `);
    return rows[0] ?? null;
  }

  async consumeChallenge(client: AuthSqlClient, challengeId: string, now: Date): Promise<boolean> {
    const changed = await client.$executeRaw(Prisma.sql`
      UPDATE auth.password_reset_challenges
      SET status = 'CONSUMED', consumed_at = ${now}, updated_at = NOW()
      WHERE id = ${challengeId}
        AND status = 'PENDING'
        AND expires_at > ${now}
    `);
    return changed === 1;
  }

  async replacePassword(
    client: AuthSqlClient,
    userId: string,
    passwordHash: string,
    now: Date,
  ): Promise<boolean> {
    const updated = await client.$executeRaw(Prisma.sql`
      UPDATE public.users
      SET "passwordHash" = ${passwordHash}, "updatedAt" = ${now}
      WHERE id = ${userId}
        AND status = 'ACTIVE'
        AND "deletedAt" IS NULL
    `);
    if (updated !== 1) return false;

    await client.$executeRaw(Prisma.sql`
      INSERT INTO auth.credential_states (user_id, password_changed_at)
      VALUES (${userId}, ${now})
      ON CONFLICT (user_id) DO UPDATE
      SET credential_version = auth.credential_states.credential_version + 1,
          password_changed_at = EXCLUDED.password_changed_at,
          failed_login_count = 0,
          locked_until = NULL,
          updated_at = NOW()
    `);
    return true;
  }

  revokeAllUserSessions(client: AuthSqlClient, userId: string, reason: string): Promise<void> {
    return this.auth.revokeAllUserSessions(client, userId, reason);
  }

  latestAuditHash(client: AuthSqlClient, userId?: string | null): Promise<string | null> {
    return this.auth.latestAuditHash(client, userId, null);
  }

  insertAudit(client: AuthSqlClient, input: Parameters<PersistentAuthRepository['insertAudit']>[1]): Promise<void> {
    return this.auth.insertAudit(client, input);
  }
}
