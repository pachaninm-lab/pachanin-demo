import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { AuthSqlClient } from '../auth/persistent-auth.repository';
import {
  type AuthMailEnvelope,
  authMailReplayDigest,
  encryptAuthMailEnvelope,
} from './auth-mail-crypto';

export const AUTH_MAIL_KINDS = [
  'REGISTRATION_EMAIL_VERIFICATION',
  'REGISTRATION_JOIN_REVIEW',
  'REGISTRATION_DECISION',
  'PASSWORD_RESET',
  'PASSWORD_CHANGED',
  'ORGANIZATION_INVITATION',
  'MFA_RECOVERY',
  'ACCOUNT_SECURITY_NOTICE',
  'PUBLIC_INQUIRY',
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

type EnqueueResult = { outbox_id: string; replayed: boolean };

export type RegistrationDecisionMailDelivery = {
  status: 'MISSING' | 'PENDING' | 'PROCESSING' | 'SENT' | 'DEAD_LETTER';
  attemptCount: number;
  maxAttempts: number;
  lastErrorCode: string | null;
  sentAt: Date | null;
};

@Injectable()
export class AuthMailOutboxService {
  async enqueue(
    tx: AuthSqlClient,
    input: EnqueueAuthMailInput,
  ): Promise<{ queued: true; replayed: boolean; envelopeDigest: string }> {
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

    // The replay digest is deterministic and keyed. It lets PostgreSQL prove
    // same-key/same-payload replays without retaining plaintext and without
    // comparing randomized AES-GCM ciphertext.
    const digest = authMailReplayDigest(input.envelope, { kind, idempotencyKey });
    const encrypted = encryptAuthMailEnvelope(input.envelope, { kind, idempotencyKey, correlationId });

    // Bind every placeholder to the reviewed regprocedure signature. PostgreSQL
    // function lookup is type-exact for parameterized values; in particular,
    // an inferred int8 parameter does not resolve the two intentional int4
    // positions and fails with SQLSTATE 42883 before the function can execute.
    const rows = await tx.$queryRaw<EnqueueResult[]>(Prisma.sql`
      SELECT outbox_id, replayed
      FROM auth.enqueue_mail_outbox(
        ${`auth_mail_${randomUUID()}`}::text,
        ${kind}::text,
        ${encrypted.ciphertext}::text,
        ${encrypted.iv}::text,
        ${encrypted.tag}::text,
        ${encrypted.keyVersion}::integer,
        ${digest}::text,
        ${idempotencyKey}::text,
        ${correlationId}::text,
        ${maxAttempts}::integer,
        ${availableAt}::timestamptz,
        ${input.expiresAt}::timestamptz
      )
    `);
    if (rows.length !== 1 || !rows[0]?.outbox_id) {
      throw new Error('Auth-mail enqueue authority returned an invalid result');
    }

    return { queued: true, replayed: Boolean(rows[0].replayed), envelopeDigest: digest };
  }

  async registrationDecisionStatus(
    client: AuthSqlClient,
    idempotencyKeyInput: string,
  ): Promise<RegistrationDecisionMailDelivery> {
    const idempotencyKey = String(idempotencyKeyInput || '').trim();
    if (!/^auth-mail:registration-decision:[a-f0-9]{64}$/.test(idempotencyKey)) {
      throw new Error('Registration-decision mail idempotency key is invalid');
    }
    const rows = await client.$queryRaw<Array<{
      delivery_status: RegistrationDecisionMailDelivery['status'];
      attempt_count: number;
      max_attempts: number;
      last_error_code: string | null;
      sent_at: Date | null;
    }>>(Prisma.sql`
      SELECT delivery_status, attempt_count, max_attempts, last_error_code, sent_at
      FROM auth.registration_decision_mail_delivery_status(${idempotencyKey}::text)
    `);
    const row = rows[0];
    if (!row || !['MISSING', 'PENDING', 'PROCESSING', 'SENT', 'DEAD_LETTER'].includes(row.delivery_status)) {
      throw new Error('Registration-decision mail status authority returned an invalid result');
    }
    return {
      status: row.delivery_status,
      attemptCount: Number(row.attempt_count || 0),
      maxAttempts: Number(row.max_attempts || 0),
      lastErrorCode: row.last_error_code || null,
      sentAt: row.sent_at || null,
    };
  }

  async waitForRegistrationDecisionDelivery(
    client: AuthSqlClient,
    idempotencyKey: string,
    options: { timeoutMs?: number; pollMs?: number } = {},
  ): Promise<RegistrationDecisionMailDelivery> {
    const timeoutMs = options.timeoutMs ?? 50_000;
    const pollMs = options.pollMs ?? 250;
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
      throw new Error('Registration-decision delivery timeout is invalid');
    }
    if (!Number.isInteger(pollMs) || pollMs < 100 || pollMs > 2_000) {
      throw new Error('Registration-decision delivery poll interval is invalid');
    }
    const deadline = Date.now() + timeoutMs;
    let latest = await this.registrationDecisionStatus(client, idempotencyKey);
    while (!['SENT', 'DEAD_LETTER'].includes(latest.status) && Date.now() < deadline) {
      await delay(Math.min(pollMs, Math.max(1, deadline - Date.now())));
      latest = await this.registrationDecisionStatus(client, idempotencyKey);
    }
    return latest;
  }

}
