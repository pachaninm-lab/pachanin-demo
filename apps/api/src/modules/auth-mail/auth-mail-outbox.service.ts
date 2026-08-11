import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthSqlClient } from '../auth/persistent-auth.repository';
import {
  type AuthMailEnvelope,
  authMailEnvelopeDigest,
  encryptAuthMailEnvelope,
} from './auth-mail-crypto';

export const AUTH_MAIL_KINDS = [
  'REGISTRATION_EMAIL_VERIFICATION',
  'REGISTRATION_JOIN_REVIEW',
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'ORGANIZATION_INVITATION',
  'MFA_RECOVERY',
  'ACCOUNT_SECURITY_NOTICE',
] as const;

export type AuthMailKind = typeof AUTH_MAIL_KINDS[number];

const KIND_SET = new Set<string>(AUTH_MAIL_KINDS);

export type EnqueueAuthMailInput = {
  kind: AuthMailKind;
  idempotencyKey: string;
  correlationId: string;
  envelope: AuthMailEnvelope;
  expiresAt: Date;
  availableAt?: Date;
  maxAttempts?: number;
};

@Injectable()
export class AuthMailOutboxService {
  async enqueue(tx: AuthSqlClient, input: EnqueueAuthMailInput): Promise<{ queued: true; envelopeDigest: string }> {
    const kind = String(input.kind ?? '').trim();
    const idempotencyKey = String(input.idempotencyKey ?? '').trim();
    const correlationId = String(input.correlationId ?? '').trim();
    const now = new Date();
    const availableAt = input.availableAt ?? now;
    const maxAttempts = input.maxAttempts ?? 12;

    if (!KIND_SET.has(kind)) throw new Error(`Unsupported auth-mail kind: ${kind}`);
    if (!idempotencyKey.startsWith('auth-mail:') || idempotencyKey.length < 16 || idempotencyKey.length > 256) {
      throw new Error('Auth-mail idempotency key is invalid');
    }
    if (!correlationId || correlationId.length > 128 || /[\r\n\0]/.test(correlationId)) {
      throw new Error('Auth-mail correlation id is invalid');
    }
    if (!(input.expiresAt instanceof Date) || !Number.isFinite(input.expiresAt.getTime()) || input.expiresAt <= now) {
      throw new Error('Auth-mail expiry must be in the future');
    }
    if (!(availableAt instanceof Date) || !Number.isFinite(availableAt.getTime()) || availableAt > input.expiresAt) {
      throw new Error('Auth-mail availability is invalid');
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 50) {
      throw new Error('Auth-mail maxAttempts must be between 1 and 50');
    }

    const encrypted = encryptAuthMailEnvelope(input.envelope, { kind, idempotencyKey, correlationId });
    const digest = authMailEnvelopeDigest(encrypted);

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO auth.mail_outbox (
        id, message_kind,
        payload_ciphertext, payload_iv, payload_tag, payload_key_version,
        status, idempotency_key, correlation_id,
        max_attempts, attempt_count, next_attempt_at, expires_at
      ) VALUES (
        ${`auth_mail_${randomUUID()}`}, ${kind},
        ${encrypted.ciphertext}, ${encrypted.iv}, ${encrypted.tag}, ${encrypted.keyVersion},
        'PENDING', ${idempotencyKey}, ${correlationId},
        ${maxAttempts}, 0, ${availableAt}, ${input.expiresAt}
      )
      ON CONFLICT (idempotency_key) DO NOTHING
    `);

    return { queued: true, envelopeDigest: digest };
  }
}
