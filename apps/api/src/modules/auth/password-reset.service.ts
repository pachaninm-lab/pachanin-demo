import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { accountKeyHash, hmacFingerprint } from './auth-crypto';
import {
  issuePasswordResetToken,
  PASSWORD_RESET_TTL_SECONDS,
  verifyPasswordResetToken,
} from './password-reset-token';

const PURPOSE = 'PASSWORD_RESET';
const COOLDOWN_MS = 60 * 1000;
const UNIVERSAL_RESPONSE = {
  accepted: true,
  message: 'If the account exists, password reset instructions will be sent.',
} as const;

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function deliveryAuthorized(provided: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const expected = String(env.PASSWORD_RESET_DELIVERY_KEY || '').trim();
  return expected.length >= 32 && safeEqual(String(provided || '').trim(), expected);
}

function assertPasswordPolicy(password: string) {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
  if (password.length < 12 || password.length > 128 || classes < 3) {
    throw new BadRequestException({
      code: 'PASSWORD_POLICY_FAILED',
      message: 'The password must be 12-128 characters and include at least three character classes.',
    });
  }
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async request(emailInput: string, ip?: string, deliveryKey?: string) {
    const email = String(emailInput || '').trim().toLowerCase();
    const accountHash = accountKeyHash(email);
    const ipHash = hmacFingerprint(ip);

    // Only the trusted web BFF may obtain a delivery token. Direct calls remain
    // universal and do not create undeliverable challenges that could lock out a user.
    if (!deliveryAuthorized(deliveryKey)) {
      this.audit.log({
        action: 'AUTH_PASSWORD_RESET_REQUEST_REJECTED_DELIVERY_BOUNDARY',
        actorRole: 'PUBLIC',
        objectType: 'ACCOUNT_HASH',
        objectId: accountHash,
        outcome: 'ACCEPTED_WITHOUT_ISSUANCE',
        meta: { ipHash },
      });
      return UNIVERSAL_RESPONSE;
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, status: true, deletedAt: true },
    });

    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      this.audit.log({
        action: 'AUTH_PASSWORD_RESET_REQUEST_ACCEPTED',
        actorRole: 'PUBLIC',
        objectType: 'ACCOUNT_HASH',
        objectId: accountHash,
        outcome: 'ACCEPTED',
        meta: { eligible: false, ipHash },
      });
      return UNIVERSAL_RESPONSE;
    }

    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MS);
    const recent = await this.prisma.mfaChallenge.findFirst({
      where: {
        userId: user.id,
        purpose: PURPOSE,
        status: 'PENDING',
        createdAt: { gt: cooldownCutoff },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, expiresAt: true },
    });

    if (recent) {
      this.audit.log({
        action: 'AUTH_PASSWORD_RESET_REQUEST_COOLDOWN',
        actorUserId: user.id,
        actorRole: 'PUBLIC',
        objectType: 'MFA_CHALLENGE',
        objectId: recent.id,
        outcome: 'ACCEPTED_WITHOUT_ISSUANCE',
        meta: { ipHash },
      });
      return UNIVERSAL_RESPONSE;
    }

    let challenge: { id: string; expiresAt: Date };
    try {
      challenge = await this.prisma.$transaction(
        async (tx) => {
          await tx.mfaChallenge.updateMany({
            where: { userId: user.id, purpose: PURPOSE, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });
          return tx.mfaChallenge.create({
            data: {
              userId: user.id,
              purpose: PURPOSE,
              status: 'PENDING',
              expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_SECONDS * 1000),
            },
            select: { id: true, expiresAt: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      this.logger.error('Failed to create password reset challenge', error instanceof Error ? error.stack : undefined);
      this.audit.log({
        action: 'AUTH_PASSWORD_RESET_REQUEST_FAILED',
        actorUserId: user.id,
        actorRole: 'SYSTEM',
        objectType: 'USER',
        objectId: user.id,
        outcome: 'FAILURE',
        reason: 'challenge_creation_failed',
        meta: { ipHash },
      });
      return UNIVERSAL_RESPONSE;
    }

    let token: string;
    try {
      token = issuePasswordResetToken(challenge.id, user.id);
    } catch (error) {
      await this.prisma.mfaChallenge.updateMany({
        where: { id: challenge.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      this.logger.error('Password reset token secret is not configured', error instanceof Error ? error.stack : undefined);
      this.audit.log({
        action: 'AUTH_PASSWORD_RESET_REQUEST_FAILED',
        actorUserId: user.id,
        actorRole: 'SYSTEM',
        objectType: 'MFA_CHALLENGE',
        objectId: challenge.id,
        outcome: 'FAILURE',
        reason: 'token_secret_unavailable',
        meta: { ipHash },
      });
      return UNIVERSAL_RESPONSE;
    }

    this.audit.log({
      action: 'AUTH_PASSWORD_RESET_REQUEST_ISSUED',
      actorUserId: user.id,
      actorRole: 'PUBLIC',
      objectType: 'MFA_CHALLENGE',
      objectId: challenge.id,
      outcome: 'SUCCESS',
      meta: { ipHash, expiresAt: challenge.expiresAt.toISOString() },
    });

    return {
      ...UNIVERSAL_RESPONSE,
      delivery: {
        email: user.email,
        token,
        expiresInSeconds: PASSWORD_RESET_TTL_SECONDS,
      },
    };
  }

  async confirm(token: string, newPassword: string, ip?: string) {
    assertPasswordPolicy(newPassword);
    const payload = verifyPasswordResetToken(token);
    if (!payload) {
      throw new BadRequestException({ code: 'PASSWORD_RESET_INVALID', message: 'The reset link is invalid or expired.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();
    const ipHash = hmacFingerprint(ip);

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.mfaChallenge.updateMany({
            where: {
              id: payload.cid,
              userId: payload.sub,
              purpose: PURPOSE,
              status: 'PENDING',
              expiresAt: { gt: now },
            },
            data: { status: 'CONSUMED', consumedAt: now, verifiedAt: now },
          });
          if (claimed.count !== 1) {
            throw new BadRequestException({ code: 'PASSWORD_RESET_INVALID', message: 'The reset link is invalid or expired.' });
          }

          const updated = await tx.user.updateMany({
            where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
            data: { passwordHash },
          });
          if (updated.count !== 1) {
            throw new BadRequestException({ code: 'PASSWORD_RESET_INVALID', message: 'The reset link is invalid or expired.' });
          }

          await tx.authSession.updateMany({
            where: { userId: payload.sub, status: 'ACTIVE' },
            data: { status: 'REVOKED', revokedAt: now, revokeReason: 'password_reset' },
          });
          await tx.authRefreshFamily.updateMany({
            where: { userId: payload.sub, status: 'ACTIVE' },
            data: { status: 'REVOKED', revokedAt: now, revokeReason: 'password_reset' },
          });
          await tx.mfaChallenge.updateMany({
            where: {
              userId: payload.sub,
              purpose: PURPOSE,
              status: 'PENDING',
              id: { not: payload.cid },
            },
            data: { status: 'EXPIRED' },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Password reset confirmation failed', error instanceof Error ? error.stack : undefined);
      throw new BadRequestException({ code: 'PASSWORD_RESET_INVALID', message: 'The reset link is invalid or expired.' });
    }

    this.audit.log({
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      actorUserId: payload.sub,
      actorRole: 'PUBLIC',
      objectType: 'MFA_CHALLENGE',
      objectId: payload.cid,
      outcome: 'SUCCESS',
      meta: { ipHash, sessionsRevoked: true },
    });

    return { success: true, sessionsRevoked: true };
  }
}
