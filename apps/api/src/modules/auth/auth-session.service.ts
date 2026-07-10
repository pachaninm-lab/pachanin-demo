import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RequestUser, Role } from '../../common/types/request-user';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  MFA_ELEVATION_TTL_MS,
  REFRESH_FAMILY_TTL_MS,
  SESSION_IDLE_TTL_MS,
  SESSION_TTL_MS,
  createOpaqueRefreshToken,
  hashOpaqueToken,
  hmacFingerprint,
  issueAccessToken,
  verifyAccessTokenSignature,
} from './auth-crypto';

const LAST_SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000;

type SessionIdentity = {
  id: string;
  email: string;
  fullName: string;
  status: string;
  mfaEnabled: boolean;
};

type MembershipIdentity = {
  organizationId: string;
  role: string;
  organization: { tenantId: string; status: string };
};

export type IssuedAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: RequestUser & { mfaEnabled: boolean };
};

@Injectable()
export class AuthSessionService {
  constructor(private readonly prisma: PrismaService) {}

  async createSession(
    user: SessionIdentity,
    membership: MembershipIdentity,
    userAgent?: string,
    ip?: string,
  ): Promise<IssuedAuthSession> {
    const now = new Date();
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const rawRefreshToken = createOpaqueRefreshToken();
    const refreshTokenId = randomUUID();
    const sessionExpiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const refreshExpiresAt = new Date(now.getTime() + REFRESH_FAMILY_TTL_MS);

    await this.prisma.$transaction(
      async (tx) => {
        await tx.authSession.create({
          data: {
            id: sessionId,
            userId: user.id,
            organizationId: membership.organizationId,
            tenantId: membership.organization.tenantId,
            role: membership.role,
            status: 'ACTIVE',
            expiresAt: sessionExpiresAt,
            lastSeenAt: now,
            userAgentHash: hmacFingerprint(userAgent),
            ipHash: hmacFingerprint(ip),
          },
        });
        await tx.authRefreshFamily.create({
          data: {
            id: familyId,
            sessionId,
            userId: user.id,
            status: 'ACTIVE',
            expiresAt: refreshExpiresAt,
          },
        });
        await tx.authRefreshToken.create({
          data: {
            id: refreshTokenId,
            familyId,
            tokenHash: hashOpaqueToken(rawRefreshToken),
            status: 'ACTIVE',
            expiresAt: refreshExpiresAt,
          },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { lastLoginAt: now },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const requestUser = this.toRequestUser({
      sessionId,
      user,
      membership,
      mfaVerifiedAt: null,
    });
    return this.issueSessionResponse(requestUser, user.mfaEnabled, rawRefreshToken);
  }

  async rotateRefreshToken(
    rawRefreshToken: string,
    userAgent?: string,
    ip?: string,
  ): Promise<IssuedAuthSession> {
    const tokenHash = hashOpaqueToken(rawRefreshToken);
    const now = new Date();
    const idleCutoff = new Date(now.getTime() - SESSION_IDLE_TTL_MS);

    const result = await this.prisma.$transaction(
      async (tx) => {
        const token = await tx.authRefreshToken.findUnique({
          where: { tokenHash },
          include: {
            family: {
              include: {
                session: { include: { user: true } },
              },
            },
          },
        });

        if (!token) return { kind: 'invalid' as const };

        const family = token.family;
        const session = family.session;
        const expired =
          token.expiresAt <= now ||
          family.expiresAt <= now ||
          session.expiresAt <= now;
        const idleExpired = session.lastSeenAt <= idleCutoff;
        const replayed =
          token.status !== 'ACTIVE' ||
          Boolean(token.usedAt) ||
          Boolean(token.revokedAt);
        const inactive = family.status !== 'ACTIVE' || session.status !== 'ACTIVE';

        if (expired || idleExpired || replayed || inactive) {
          const reason = replayed
            ? 'refresh_token_replay'
            : idleExpired
              ? 'session_idle_timeout'
              : expired
                ? 'refresh_expired'
                : 'session_inactive';
          await this.revokeFamilyInTransaction(tx, family.id, session.id, reason, now, replayed);
          return { kind: 'revoked' as const, reason };
        }

        const claimed = await tx.authRefreshToken.updateMany({
          where: {
            id: token.id,
            status: 'ACTIVE',
            usedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: { status: 'ROTATED', usedAt: now },
        });
        if (claimed.count !== 1) {
          await this.revokeFamilyInTransaction(
            tx,
            family.id,
            session.id,
            'refresh_token_concurrent_replay',
            now,
            true,
          );
          return { kind: 'revoked' as const, reason: 'refresh_token_concurrent_replay' };
        }

        const membership = await tx.userOrg.findUnique({
          where: {
            userId_organizationId: {
              userId: session.userId,
              organizationId: session.organizationId,
            },
          },
          include: { organization: true },
        });

        if (
          !membership ||
          membership.role !== session.role ||
          membership.organization.tenantId !== session.tenantId ||
          membership.organization.status === 'BLOCKED' ||
          membership.organization.status === 'SUSPENDED' ||
          session.user.status !== 'ACTIVE' ||
          session.user.deletedAt
        ) {
          await this.revokeFamilyInTransaction(
            tx,
            family.id,
            session.id,
            'membership_or_account_changed',
            now,
            false,
          );
          return { kind: 'revoked' as const, reason: 'membership_or_account_changed' };
        }

        const nextRawToken = createOpaqueRefreshToken();
        const nextTokenId = randomUUID();
        await tx.authRefreshToken.create({
          data: {
            id: nextTokenId,
            familyId: family.id,
            tokenHash: hashOpaqueToken(nextRawToken),
            parentTokenId: token.id,
            status: 'ACTIVE',
            expiresAt: family.expiresAt,
          },
        });
        await tx.authRefreshToken.update({
          where: { id: token.id },
          data: { replacedByTokenId: nextTokenId },
        });
        await tx.authRefreshFamily.update({
          where: { id: family.id },
          data: { lastRotatedAt: now },
        });
        await tx.authSession.update({
          where: { id: session.id },
          data: {
            lastSeenAt: now,
            userAgentHash: hmacFingerprint(userAgent) ?? session.userAgentHash,
            ipHash: hmacFingerprint(ip) ?? session.ipHash,
          },
        });

        return {
          kind: 'rotated' as const,
          rawRefreshToken: nextRawToken,
          session: {
            id: session.id,
            mfaVerifiedAt: session.mfaVerifiedAt,
          },
          user: session.user,
          membership,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (result.kind !== 'rotated') {
      throw new UnauthorizedException('Invalid, expired or replayed refresh token');
    }

    const requestUser = this.toRequestUser({
      sessionId: result.session.id,
      user: result.user,
      membership: result.membership,
      mfaVerifiedAt: result.session.mfaVerifiedAt,
    });
    return this.issueSessionResponse(
      requestUser,
      result.user.mfaEnabled,
      result.rawRefreshToken,
    );
  }

  async verifyAccessToken(token: string): Promise<RequestUser> {
    let claims;
    try {
      claims = verifyAccessTokenSignature(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    const now = new Date();
    const idleCutoff = new Date(now.getTime() - SESSION_IDLE_TTL_MS);
    const session = await this.prisma.authSession.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.userId !== claims.sub ||
      session.status !== 'ACTIVE' ||
      session.expiresAt <= now ||
      session.lastSeenAt <= idleCutoff ||
      session.user.status !== 'ACTIVE' ||
      Boolean(session.user.deletedAt)
    ) {
      if (session?.status === 'ACTIVE') {
        await this.revokeSession(
          session.id,
          session.lastSeenAt <= idleCutoff ? 'session_idle_timeout' : 'session_expired',
        );
      }
      throw new UnauthorizedException('Session is inactive or expired');
    }

    const membership = await this.prisma.userOrg.findUnique({
      where: {
        userId_organizationId: {
          userId: session.userId,
          organizationId: session.organizationId,
        },
      },
      include: { organization: true },
    });
    if (
      !membership ||
      membership.role !== session.role ||
      membership.organization.tenantId !== session.tenantId ||
      membership.organization.status === 'BLOCKED' ||
      membership.organization.status === 'SUSPENDED'
    ) {
      await this.revokeSession(session.id, 'membership_or_scope_changed');
      throw new UnauthorizedException('Session membership is no longer valid');
    }

    if (session.lastSeenAt.getTime() < now.getTime() - LAST_SEEN_WRITE_INTERVAL_MS) {
      await this.prisma.authSession.updateMany({
        where: { id: session.id, status: 'ACTIVE', lastSeenAt: session.lastSeenAt },
        data: { lastSeenAt: now },
      });
    }

    return this.toRequestUser({
      sessionId: session.id,
      user: session.user,
      membership,
      mfaVerifiedAt: session.mfaVerifiedAt,
    });
  }

  async revokeSession(sessionId: string, reason = 'logout'): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const family = await tx.authRefreshFamily.findUnique({ where: { sessionId } });
      await tx.authSession.updateMany({
        where: { id: sessionId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: now, revokeReason: reason, mfaVerifiedAt: null },
      });
      if (family) {
        await this.revokeFamilyInTransaction(tx, family.id, sessionId, reason, now, false);
      }
    });
  }

  async revokeByRefreshToken(rawRefreshToken: string, reason = 'logout'): Promise<void> {
    const token = await this.prisma.authRefreshToken.findUnique({
      where: { tokenHash: hashOpaqueToken(rawRefreshToken) },
      include: { family: true },
    });
    if (token) await this.revokeSession(token.family.sessionId, reason);
  }

  async revokeAllUserSessions(userId: string, reason: string): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const sessions = await tx.authSession.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { id: true },
      });
      const sessionIds = sessions.map((item) => item.id);
      if (!sessionIds.length) return;
      const families = await tx.authRefreshFamily.findMany({
        where: { sessionId: { in: sessionIds } },
        select: { id: true },
      });
      const familyIds = families.map((item) => item.id);
      await tx.authSession.updateMany({
        where: { id: { in: sessionIds } },
        data: { status: 'REVOKED', revokedAt: now, revokeReason: reason, mfaVerifiedAt: null },
      });
      if (familyIds.length) {
        await tx.authRefreshFamily.updateMany({
          where: { id: { in: familyIds } },
          data: { status: 'REVOKED', revokedAt: now, revokeReason: reason },
        });
        await tx.authRefreshToken.updateMany({
          where: { familyId: { in: familyIds }, status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: now },
        });
      }
    });
  }

  async markMfaVerified(sessionId: string): Promise<Date> {
    const verifiedAt = new Date();
    const updated = await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        status: 'ACTIVE',
        expiresAt: { gt: verifiedAt },
        lastSeenAt: { gt: new Date(verifiedAt.getTime() - SESSION_IDLE_TTL_MS) },
      },
      data: { mfaVerifiedAt: verifiedAt, lastSeenAt: verifiedAt },
    });
    if (updated.count !== 1) throw new UnauthorizedException('Active session required for MFA elevation');
    return verifiedAt;
  }

  async clearMfaElevation(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId },
      data: { mfaVerifiedAt: null },
    });
  }

  private async revokeFamilyInTransaction(
    tx: Prisma.TransactionClient,
    familyId: string,
    sessionId: string,
    reason: string,
    now: Date,
    replayed: boolean,
  ): Promise<void> {
    await tx.authRefreshFamily.updateMany({
      where: { id: familyId },
      data: {
        status: replayed ? 'REPLAYED' : 'REVOKED',
        revokedAt: now,
        revokeReason: reason,
      },
    });
    await tx.authRefreshToken.updateMany({
      where: { familyId, status: 'ACTIVE' },
      data: replayed
        ? { status: 'REPLAYED', revokedAt: now, reuseDetectedAt: now }
        : { status: 'REVOKED', revokedAt: now },
    });
    await tx.authSession.updateMany({
      where: { id: sessionId },
      data: { status: 'REVOKED', revokedAt: now, revokeReason: reason, mfaVerifiedAt: null },
    });
  }

  private issueSessionResponse(
    requestUser: RequestUser,
    mfaEnabled: boolean,
    refreshToken: string,
  ): IssuedAuthSession {
    return {
      accessToken: issueAccessToken({
        sub: requestUser.id,
        sid: requestUser.sessionId!,
        email: requestUser.email,
        role: requestUser.role,
        orgId: requestUser.orgId,
        tenantId: requestUser.tenantId!,
        fullName: requestUser.fullName,
      }),
      refreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: { ...requestUser, mfaEnabled },
    };
  }

  private toRequestUser(input: {
    sessionId: string;
    user: SessionIdentity;
    membership: MembershipIdentity;
    mfaVerifiedAt: Date | null;
  }): RequestUser {
    const mfaVerified = Boolean(
      input.mfaVerifiedAt &&
        input.mfaVerifiedAt.getTime() >= Date.now() - MFA_ELEVATION_TTL_MS,
    );
    return {
      id: input.user.id,
      email: input.user.email,
      fullName: input.user.fullName,
      role: input.membership.role as Role,
      orgId: input.membership.organizationId,
      tenantId: input.membership.organization.tenantId,
      sessionId: input.sessionId,
      mfaVerified,
    };
  }
}
