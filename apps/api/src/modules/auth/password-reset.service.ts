import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AuthMailOutboxService } from '../auth-mail/auth-mail-outbox.service';
import {
  normalizeAuthMailLocale,
  passwordChangedMail,
  passwordResetMail,
} from '../auth-mail/auth-mail-templates';
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

  constructor(
    private readonly repository: PasswordResetRepository,
    private readonly mailOutbox: AuthMailOutboxService,
  ) {}

  async request(
    emailInput: string,
    ip?: string,
    correlationIdInput?: string,
    localeInput?: unknown,
  ) {
    const email = String(emailInput ?? '').trim().toLowerCase();
    const correlationId = String(correlationIdInput || randomUUID()).trim().slice(0, 128);
    const locale = normalizeAuthMailLocale(localeInput);
    const accountHash = hashAuthMaterial(`password-reset:${email}`);
    const ipHash = hashClientValue(ip);

    const user = await this.repository.findUserByEmail(this.repository.prisma, email);
    if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
      await this.repository.transaction(async (tx) => {
        await this.audit(tx, {
          action: 'auth.password_reset.request',
          outcome: 'SUCCESS',
          reason: 'UNIVERSAL_NON_ELIGIBLE',
          metadata: { accountHash, ipHash, correlationId },
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
          metadata: { ipHash, correlationId },
        });
      });
      return UNIVERSAL_RESPONSE;
    }

    const issued = issuePasswordResetToken();
    const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
    let created = false;

    try {
      created = await this.repository.transaction(async (tx) => {
        const concurrentRecent = await this.repository.findRecentPending(
          tx,
          user.id,
          new Date(now.getTime() - PASSWORD_RESET_COOLDOWN_MS),
          now,
        );
        if (concurrentRecent) return false;

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
          metadata: { ipHash, expiresAt: expiresAt.toISOString(), correlationId },
        });
        await this.mailOutbox.enqueue(tx, {
          kind: 'PASSWORD_RESET',
          idempotencyKey: `auth-mail:password-reset:${issued.id}`,
          correlationId,
          envelope: passwordResetMail({
            to: user.email,
            token: issued.token,
            locale,
          }),
          expiresAt,
        });
        return true;
      });
    } catch (error) {
      this.logger.error('Password reset challenge/outbox transaction failed', error instanceof Error ? error.stack : undefined);
      return UNIVERSAL_RESPONSE;
    }

    if (!created) return UNIVERSAL_RESPONSE;
    return UNIVERSAL_RESPONSE;
  }

  async confirm(
    tokenInput: string,
    newPassword: string,
    ip?: string,
    correlationIdInput?: string,
  ) {
    assertPasswordPolicy(newPassword);
    const parsed = parsePasswordResetToken(tokenInput);
    if (!parsed) throw this.invalidReset();

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const now = new Date();
    const ipHash = hashClientValue(ip);
    const correlationId = String(correlationIdInput || randomUUID()).trim().slice(0, 128);

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

        const notificationEmail = await this.repository.replacePassword(
          tx,
          challenge.id,
          challenge.user_id,
          passwordHash,
          now,
        );
        if (!notificationEmail) throw this.invalidReset();

        const consumed = await this.repository.consumeChallenge(tx, challenge.id, now);
        if (!consumed) throw this.invalidReset();

        await this.repository.revokeAllUserSessions(tx, challenge.user_id, 'PASSWORD_RESET');
        await this.repository.expirePending(tx, challenge.user_id, challenge.id);
        await this.audit(tx, {
          userId: challenge.user_id,
          action: 'auth.password_reset.confirm',
          outcome: 'SUCCESS',
          reason: 'PASSWORD_REPLACED_SESSIONS_REVOKED',
          metadata: { ipHash, challengeIdHash: hashAuthMaterial(challenge.id), correlationId },
        });
        await this.mailOutbox.enqueue(tx, {
          kind: 'PASSWORD_CHANGED',
          idempotencyKey: `auth-mail:password-changed:${challenge.id}`,
          correlationId,
          envelope: passwordChangedMail(notificationEmail),
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        });
        return {
          success: true,
          sessionsRevoked: true,
          securityNoticeQueued: true,
        };
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
    const { chainKey, prevHash, nextSequence } = await this.repository.latestAuditChainPosition(
      tx,
      input.userId,
    );
    const hash = sha256(stableJson({
      id, ...input, prevHash, chainKey, chainSequence: nextSequence.toString(),
    }));
    await this.repository.insertAudit(tx, {
      id,
      userId: input.userId,
      action: input.action,
      outcome: input.outcome,
      reason: input.reason,
      metadata: input.metadata,
      hash,
      prevHash,
      chainSequence: nextSequence,
    });
  }
}
