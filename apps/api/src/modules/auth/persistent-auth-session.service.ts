import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface SessionRow {
  id: string;
  user_id: string;
  refresh_token_hash: string;
  refresh_family_id: string;
  refresh_generation: number;
  expires_at: Date;
  revoked_at: Date | null;
}

export interface IssuedPersistentSession {
  sessionId: string;
  refreshToken: string;
  familyId: string;
  generation: number;
  expiresAt: Date;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hashIp(ip?: string): string | null {
  return ip ? sha256(ip.trim().toLowerCase()) : null;
}

@Injectable()
export class PersistentAuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string, userAgent?: string, ip?: string): Promise<IssuedPersistentSession> {
    const sessionId = randomUUID();
    const refreshToken = `${randomUUID()}${randomUUID()}`;
    const familyId = randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    await this.prisma.$executeRaw`
      INSERT INTO "auth_sessions" (
        "id", "user_id", "refresh_token_hash", "refresh_family_id",
        "refresh_generation", "user_agent", "ip_hash", "expires_at"
      ) VALUES (
        ${sessionId}, ${userId}, ${sha256(refreshToken)}, ${familyId},
        0, ${userAgent ?? null}, ${hashIp(ip)}, ${expiresAt}
      )
    `;

    return { sessionId, refreshToken, familyId, generation: 0, expiresAt };
  }

  async rotate(refreshToken: string, userAgent?: string, ip?: string): Promise<IssuedPersistentSession & { userId: string }> {
    const tokenHash = sha256(refreshToken);
    const replacementToken = `${randomUUID()}${randomUUID()}`;
    const replacementHash = sha256(replacementToken);
    const now = new Date();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<SessionRow[]>`
        SELECT "id", "user_id", "refresh_token_hash", "refresh_family_id",
               "refresh_generation", "expires_at", "revoked_at"
        FROM "auth_sessions"
        WHERE "refresh_token_hash" = ${tokenHash}
        FOR UPDATE
      `;
      const current = rows[0];
      if (!current) throw new UnauthorizedException('Invalid refresh token');

      if (current.revoked_at) {
        await tx.$executeRaw`
          UPDATE "auth_sessions"
          SET "revoked_at" = COALESCE("revoked_at", ${now}),
              "revoke_reason" = COALESCE("revoke_reason", 'refresh_token_reuse')
          WHERE "refresh_family_id" = ${current.refresh_family_id}
        `;
        throw new UnauthorizedException('Refresh token reuse detected');
      }

      if (new Date(current.expires_at).getTime() <= now.getTime()) {
        await tx.$executeRaw`
          UPDATE "auth_sessions"
          SET "revoked_at" = ${now}, "revoke_reason" = 'expired'
          WHERE "id" = ${current.id} AND "revoked_at" IS NULL
        `;
        throw new UnauthorizedException('Refresh token expired');
      }

      const nextGeneration = current.refresh_generation + 1;
      const replacementSessionId = randomUUID();

      await tx.$executeRaw`
        UPDATE "auth_sessions"
        SET "revoked_at" = ${now}, "revoke_reason" = 'rotated', "last_seen_at" = ${now}
        WHERE "id" = ${current.id} AND "revoked_at" IS NULL
      `;

      await tx.$executeRaw`
        INSERT INTO "auth_sessions" (
          "id", "user_id", "refresh_token_hash", "refresh_family_id",
          "refresh_generation", "user_agent", "ip_hash", "expires_at"
        ) VALUES (
          ${replacementSessionId}, ${current.user_id}, ${replacementHash}, ${current.refresh_family_id},
          ${nextGeneration}, ${userAgent ?? null}, ${hashIp(ip)}, ${expiresAt}
        )
      `;

      return {
        userId: current.user_id,
        sessionId: replacementSessionId,
        refreshToken: replacementToken,
        familyId: current.refresh_family_id,
        generation: nextGeneration,
        expiresAt,
      };
    }, { isolationLevel: 'Serializable' });
  }

  async assertActive(sessionId: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ active: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM "auth_sessions"
        WHERE "id" = ${sessionId}
          AND "revoked_at" IS NULL
          AND "expires_at" > CURRENT_TIMESTAMP
      ) AS "active"
    `;
    if (!rows[0]?.active) throw new UnauthorizedException('Session has been revoked or expired');

    await this.prisma.$executeRaw`
      UPDATE "auth_sessions" SET "last_seen_at" = CURRENT_TIMESTAMP WHERE "id" = ${sessionId}
    `;
  }

  async revoke(sessionId: string, reason = 'logout'): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "auth_sessions"
      SET "revoked_at" = COALESCE("revoked_at", CURRENT_TIMESTAMP),
          "revoke_reason" = COALESCE("revoke_reason", ${reason})
      WHERE "id" = ${sessionId}
    `;
  }

  async revokeAllForUser(userId: string, reason = 'logout_all'): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "auth_sessions"
      SET "revoked_at" = CURRENT_TIMESTAMP, "revoke_reason" = ${reason}
      WHERE "user_id" = ${userId} AND "revoked_at" IS NULL
    `;
  }
}
