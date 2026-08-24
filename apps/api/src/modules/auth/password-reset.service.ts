import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { hashPassword } from './password-hashing';
import { randomUUID, timingSafeEqual } from 'crypto';
import { AuthMailOutboxService } from '../auth-mail/auth-mail-outbox.service';
import { normalizeAuthMailLocale, passwordChangedMail, passwordResetMail } from '../auth-mail/auth-mail-templates';
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

/**
 * Delivery window for the password-changed security notice.
 *
 * Unlike the reset mail, this notice carries no token, so its lifetime is not
 * bounded by a credential. A day is long enough for the outbox to retry
 * through a transient mail-transport outage, and short enough that a notice
 * about a change nobody remembers is never delivered.
 */
const PASSWORD_CHANGED_NOTICE_TTL_MS = 24 * 60 * 60 * 1000;

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

  constructor(
    private readonly repository: PasswordResetRepository,
    private readonly mailOutbox: AuthMailOutboxService,
  ) {}

  async request(
    emailInput: string,
    ip?: string,
    deliveryKey?: string,
    correlationIdInput?: string,
    localeInput?: unknown,
  ) {
    const email = String(emailInput ?? '').trim().toLowerCase();
    const accountHash = hashAuthMaterial(`password-reset:${email}`);
    const ipHash = hashClientValue(ip);
    const correlationId = String(correlationIdInput || randomUUID()).trim().slice(0, 128);
    const locale = normalizeAuthMailLocale(localeInput);

    if (!deliveryAuthorized(deliveryKey)) {
      await this.repository.transaction(async (tx) => {
        await this.audit(tx, {
          action: 'auth.password_reset.request',
          outcome: 'DENIED',
          reason: 'DELIVERY_BOUNDARY_REJECTED',
          metadata: { accountHash, ipHash, correlationId },
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
          reason: 'CHALLENGE_ISSUED_MAIL_QUEUED',
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
    deliveryKey?: string,
    correlationIdInput?: string,
  ) {
    assertPasswordPolicy(newPassword);
    // The password-changed notice now goes through the same durable outbox as
    // the reset mail, so delivery no longer depends on the caller acting on the
    // response body. The server-to-server boundary below is deliberately left
    // in place: it governs who may complete a reset at all, which is a separate
    // question from how the resulting notice is delivered.
    if (!deliveryAuthorized(deliveryKey)) throw this.invalidReset();
    const parsed = parsePasswordResetToken(tokenInput);
    if (!parsed) throw this.invalidReset();

    const passwordHash = await hashPassword(newPassword);
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
          metadata: { ipHash, challengeIdHash: hashAuthMaterial(challenge.id) },
        });
        // Queued in the same transaction as the password replacement: a
        // committed reset can never leave the account holder unnotified, and a
        // rolled-back one never queues a notice about a change that did not
        // happen. The challenge id keys the idempotency, so a retried
        // confirmation reuses the queued notice instead of sending a second.
        await this.mailOutbox.enqueue(tx, {
          kind: 'PASSWORD_CHANGED',
          idempotencyKey: `auth-mail:password-changed:${challenge.id}`,
          correlationId,
          envelope: passwordChangedMail(notificationEmail),
          expiresAt: new Date(now.getTime() + PASSWORD_CHANGED_NOTICE_TTL_MS),
        });
        return {
          success: true,
          sessionsRevoked: true,
          notificationDelivery: { email: notificationEmail },
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
