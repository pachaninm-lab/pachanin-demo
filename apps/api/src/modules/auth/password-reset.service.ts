import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID, timingSafeEqual } from 'crypto';
import { hashAuthMaterial, hashClientValue, sha256, stableJson } from './auth-crypto';
import type { AuthSqlClient } from './persistent-auth.repository';
import { PasswordResetRepository } from './password-reset.repository';
import {
  issuePasswordResetToken,
  parsePasswordResetToken,
  PASSWORD_RESET_COOLDOWN_MS,
  PASSWORD_RESET_TTL_MS,
  passwordResetHashMatches,
} from './password-reset-token';

const UNIVERSAL_RESPONSE = {
  accepted: true,
  message: 'If the account exists, password reset instructions will be sent.',
} as const;

function safeEqual(leftValue: string, rightValue: string): boolean {
  const left = Buffer.from(leftValue, 'utf8');
  const right = Buffer.from(rightValue, 'utf8');
  return left.length === right.length && timingSafeEqual(left, right);
}

function deliveryAuthorized(provided?: string): boolean {
  const expected = String(process.env.PASSWORD_RESET_DELIVERY_KEY ?? '').trim();
  const candidate = String(provided ?? '').trim();
  return expected.length >= 32 && candidate.length >= 32 && safeEqual(candidate, expected);
}

function assertPasswordPolicy(password: string): void {
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

  constructor(private readonly repository: PasswordResetRepository) {}

  async request(emailInput: string, ip?: string, deliveryKey?: string) {
    const email = String(emailInput ?? '').trim().toLowerCase();
    const accountHash = hashAuthMaterial(`password-reset:${email}`);
    const ipHash = hashClientValue(ip);

    if (!deliveryAuthorized(deliveryKey)) {
      await this.repository.transaction(async (tx) => {
        await this.audit(tx, {
          action: 'auth.password_reset.request',
          outcome: 'DENIED',
          reason: 'DELIVERY_BOUNDARY_REJECTED',
          metadata: { accountHash, ipHash },
        });
      });
      return UNIVERSAL_RESPONSE;
    }

    const user = await this.repository.findUserByEmail(this.repository.prisma, email);
    if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
      await this.repository.transaction(async (tx) => {
        await this.audit(tx, {
          action: 'auth.password_reset.request',
          outcome: 'SUCCESS',
          reason: 'UNIVERSAL_NON_ELIGIBLE',
          metadata: { accountHash, ipHash },
        });
      });
      return UNIVERSAL_RESPONSE;
    }

    const now = new Date();
    const recent = await this.repository.findRecentPending(
      this.repository.prisma,
      user.id,
      new Date(now.getTime() - PASSWORD_RESET_COOLDOWN_MS),
      now,
    );
    if (recent) {
      await this.repository.transaction(async (tx) => {
        await this.audit(tx, {
          userId: user.id,
          action: 'auth.password_reset.request',
          outcome: 'SUCCESS',
          reason: 'COOLDOWN_ACTIVE',
          metadata: { ipHash },
        });
      });
      return UNIVERSAL_RESPONSE;
    }

    const issued = issuePasswordResetToken();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);

    try {
      await this.repository.transaction(async (tx) => {
        const concurrentRecent = await this.repository.findRecentPending(
          tx,
          user.id,
          new Date(now.getTime() - PASSWORD_RESET_COOLDOWN_MS),
          now,
        );
        if (concurrentRecent) return;

        await this.repository.expirePending(tx, user.id);
        await this.repository.createChallenge(tx, {
          id: issued.id,
          userId: user.id,
          tokenHash: issued.hash,
          requestedIpHash: ipHash,
          expiresAt,
        });
        await this.audit(tx, {
          userId: user.id,
          action: 'auth.password_reset.request',
          outcome: 'SUCCESS',
          reason: 'CHALLENGE_ISSUED',
          metadata: { ipHash, expiresAt: expiresAt.toISOString() },
        });
      });
    } catch (error) {
      this.logger.error('Password reset challenge creation failed', error instanceof Error ? error.stack : undefined);
      return UNIVERSAL_RESPONSE;
    }

    return {
      ...UNIVERSAL_RESPONSE,
      delivery: {
        email: user.email,
        token: issued.token,
        expiresInSeconds: Math.floor(PASSWORD_RESET_TTL_MS / 1000),
      },
    };
  }

  async confirm(tokenInput: string, newPassword: string, ip?: string) {
    assertPasswordPolicy(newPassword);
    const parsed = parsePasswordResetToken(tokenInput);
    if (!parsed) throw this.invalidReset();

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();
    const ipHash = hashClientValue(ip);

    try {
      return await this.repository.transaction(async (tx) => {
        const challenge = await this.repository.getChallengeForUpdate(tx, parsed.id);
        if (
          !challenge
          || challenge.status !== 'PENDING'
          || challenge.expires_at <= now
          || !passwordResetHashMatches(challenge.token_hash, parsed.hash)
        ) {
          throw this.invalidReset();
        }

        const passwordUpdated = await this.repository.replacePassword(tx, challenge.user_id, passwordHash, now);
        if (!passwordUpdated) throw this.invalidReset();

        const consumed = await this.repository.consumeChallenge(tx, challenge.id, now);
        if (!consumed) throw this.invalidReset();

        await this.repository.revokeAllUserSessions(tx, challenge.user_id, 'PASSWORD_RESET');
        await this.repository.expirePending(tx, challenge.user_id, challenge.id);
        await this.audit(tx, {
          userId: challenge.user_id,
          action: 'auth.password_reset.confirm',
          outcome: 'SUCCESS',
          reason: 'PASSWORD_REPLACED_SESSIONS_REVOKED',
          metadata: { ipHash, challengeIdHash: hashAuthMaterial(challenge.id) },
        });
        return { success: true, sessionsRevoked: true };
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Password reset confirmation failed', error instanceof Error ? error.stack : undefined);
      throw this.invalidReset();
    }
  }

  private invalidReset(): BadRequestException {
    return new BadRequestException({
      code: 'PASSWORD_RESET_INVALID',
      message: 'The reset link is invalid, expired or already used.',
    });
  }

  private async audit(
    tx: AuthSqlClient,
    input: {
      userId?: string | null;
      action: string;
      outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
      reason?: string | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    const id = `auth_evt_${randomUUID()}`;
    const prevHash = await this.repository.latestAuditHash(tx, input.userId);
    const hash = sha256(stableJson({ id, ...input, prevHash }));
    await this.repository.insertAudit(tx, {
      id,
      userId: input.userId,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason,
      metadata: input.metadata,
      hash,
      prevHash,
    });
  }
}
