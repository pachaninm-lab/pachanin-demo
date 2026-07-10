import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type OutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'RETRY'
  | 'SENT'
  | 'CONFIRMED'
  | 'MANUAL_REVIEW'
  | 'DEAD';

export type DurableOutboxEntry = Readonly<{
  id: string;
  type: string;
  dealId: string | null;
  payload: Prisma.JsonValue;
  status: OutboxStatus;
  idempotencyKey: string | null;
  maxRetries: number;
  retryCount: number;
  nextRetryAt: Date;
  lastError: string | null;
  correlationId: string | null;
  auditId: string | null;
  createdAt: Date;
  sentAt: Date | null;
  confirmedAt: Date | null;
  failedAt: Date | null;
}>;

export type ClaimedOutboxEntry = Readonly<{
  id: string;
  type: string;
  dealId: string | null;
  payload: Prisma.JsonValue;
  idempotencyKey: string | null;
  retryCount: number;
  maxRetries: number;
  claimToken: string;
  claimExpiresAt: Date;
}>;

export type EnqueueOutboxInput = Readonly<{
  type: string;
  dealId?: string;
  payload: Prisma.InputJsonValue;
  idempotencyKey: string;
  maxRetries?: number;
  correlationId?: string;
  auditId?: string;
}>;

export type OutboxFailureDecision = Readonly<{
  status: 'RETRY' | 'DEAD';
  retryCount: number;
  nextRetryAt: Date;
}>;

type PrismaExecutor = PrismaService | Prisma.TransactionClient | PrismaClient;

type ClaimRow = {
  id: string;
  type: string;
  deal_id: string | null;
  payload: Prisma.JsonValue;
  idempotency_key: string | null;
  retry_count: number;
  max_retries: number;
  claim_token: string;
  claim_expires_at: Date;
};

type FailureRow = {
  status: 'RETRY' | 'DEAD';
  retry_count: number;
  next_retry_at: Date;
};

type ReadinessRow = {
  claims_table: boolean;
  attempts_table: boolean;
  can_claim: boolean;
  can_complete: boolean;
  can_fail: boolean;
  can_requeue: boolean;
  claims_select: boolean;
  attempts_select: boolean;
};

@Injectable()
export class OutboxRepository implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (String(process.env.NODE_ENV ?? '').toLowerCase() !== 'production') return;
    const rows = await this.prisma.$queryRaw<ReadinessRow[]>(Prisma.sql`
      SELECT
        to_regclass('delivery.outbox_claims') IS NOT NULL AS claims_table,
        to_regclass('delivery.outbox_attempts') IS NOT NULL AS attempts_table,
        has_function_privilege(current_user, 'delivery.claim_outbox_batch(text,integer,integer)', 'EXECUTE') AS can_claim,
        has_function_privilege(current_user, 'delivery.complete_outbox_claim(text,text)', 'EXECUTE') AS can_complete,
        has_function_privilege(current_user, 'delivery.fail_outbox_claim(text,text,text,text)', 'EXECUTE') AS can_fail,
        has_function_privilege(current_user, 'delivery.manual_requeue_outbox(text,text,text)', 'EXECUTE') AS can_requeue,
        has_table_privilege(current_user, 'delivery.outbox_claims', 'SELECT') AS claims_select,
        has_table_privilege(current_user, 'delivery.outbox_attempts', 'SELECT') AS attempts_select
    `);
    const row = rows[0];
    if (
      !row
      || !row.claims_table
      || !row.attempts_table
      || !row.can_claim
      || !row.can_complete
      || !row.can_fail
      || !row.can_requeue
      || row.claims_select
      || row.attempts_select
    ) {
      throw new Error('Durable outbox delivery boundary is not ready for production enforcement.');
    }
  }

  async enqueue(input: EnqueueOutboxInput, executor: PrismaExecutor = this.prisma): Promise<DurableOutboxEntry> {
    const type = normalizeToken(input.type, 'outbox type', 128);
    const idempotencyKey = normalizeToken(input.idempotencyKey, 'outbox idempotency key', 240);
    const maxRetries = boundedInteger(input.maxRetries ?? 5, 1, 100);
    const payloadHash = hashJson(input.payload);
    const existing = await executor.outboxEntry.findUnique({ where: { idempotencyKey } });
    if (existing) {
      const storedHash = hashJson(existing.payload);
      if (existing.type !== type || existing.dealId !== (input.dealId ?? null) || storedHash !== payloadHash) {
        throw new Error('OUTBOX_IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      return existing as DurableOutboxEntry;
    }

    try {
      return await executor.outboxEntry.create({
        data: {
          type,
          dealId: input.dealId,
          payload: input.payload,
          status: 'PENDING',
          idempotencyKey,
          maxRetries,
          correlationId: input.correlationId,
          auditId: input.auditId,
        },
      }) as DurableOutboxEntry;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const replay = await executor.outboxEntry.findUnique({ where: { idempotencyKey } });
      if (!replay) throw error;
      const storedHash = hashJson(replay.payload);
      if (replay.type !== type || replay.dealId !== (input.dealId ?? null) || storedHash !== payloadHash) {
        throw new Error('OUTBOX_IDEMPOTENCY_PAYLOAD_MISMATCH');
      }
      return replay as DurableOutboxEntry;
    }
  }

  async findById(id: string): Promise<DurableOutboxEntry | null> {
    return this.prisma.outboxEntry.findUnique({ where: { id } }) as Promise<DurableOutboxEntry | null>;
  }

  async getByDeal(dealId: string): Promise<DurableOutboxEntry[]> {
    return this.prisma.outboxEntry.findMany({
      where: { dealId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }) as Promise<DurableOutboxEntry[]>;
  }

  async listByStatuses(statuses: OutboxStatus[], take = 200): Promise<DurableOutboxEntry[]> {
    return this.prisma.outboxEntry.findMany({
      where: { status: { in: statuses } },
      orderBy: [{ nextRetryAt: 'asc' }, { createdAt: 'asc' }],
      take: boundedInteger(take, 1, 500),
    }) as Promise<DurableOutboxEntry[]>;
  }

  async claimBatch(workerId: string, batchSize: number, leaseSeconds: number): Promise<ClaimedOutboxEntry[]> {
    const rows = await this.prisma.$queryRaw<ClaimRow[]>(Prisma.sql`
      SELECT *
      FROM delivery.claim_outbox_batch(
        ${normalizeToken(workerId, 'outbox worker id', 160)}::text,
        ${boundedInteger(batchSize, 1, 500)}::integer,
        ${boundedInteger(leaseSeconds, 5, 900)}::integer
      )
    `);
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      dealId: row.deal_id,
      payload: row.payload,
      idempotencyKey: row.idempotency_key,
      retryCount: Number(row.retry_count),
      maxRetries: Number(row.max_retries),
      claimToken: row.claim_token,
      claimExpiresAt: row.claim_expires_at,
    }));
  }

  async completeClaim(id: string, claimToken: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ completed: boolean }>>(Prisma.sql`
      SELECT delivery.complete_outbox_claim(
        ${normalizeToken(id, 'outbox id', 240)}::text,
        ${normalizeToken(claimToken, 'outbox claim token', 64)}::text
      ) AS completed
    `);
    return Boolean(rows[0]?.completed);
  }

  async failClaim(id: string, claimToken: string, errorCode: string, error: unknown): Promise<OutboxFailureDecision | null> {
    const errorHash = createHash('sha256').update(errorFingerprint(error)).digest('hex');
    const rows = await this.prisma.$queryRaw<FailureRow[]>(Prisma.sql`
      SELECT *
      FROM delivery.fail_outbox_claim(
        ${normalizeToken(id, 'outbox id', 240)}::text,
        ${normalizeToken(claimToken, 'outbox claim token', 64)}::text,
        ${normalizeToken(errorCode, 'outbox error code', 96)}::text,
        ${errorHash}::text
      )
    `);
    const row = rows[0];
    return row ? {
      status: row.status,
      retryCount: Number(row.retry_count),
      nextRetryAt: row.next_retry_at,
    } : null;
  }

  async confirmExternal(id: string): Promise<DurableOutboxEntry> {
    return this.prisma.outboxEntry.update({
      where: { id },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), lastError: null },
    }) as Promise<DurableOutboxEntry>;
  }

  async markExternalFailure(id: string, reasonCode: string): Promise<DurableOutboxEntry> {
    return this.prisma.outboxEntry.update({
      where: { id },
      data: {
        status: 'MANUAL_REVIEW',
        failedAt: new Date(),
        lastError: normalizeToken(reasonCode, 'external failure code', 96),
      },
    }) as Promise<DurableOutboxEntry>;
  }

  async manualRequeue(id: string, actorUserId: string, reason: string): Promise<boolean> {
    const reasonHash = createHash('sha256').update(String(reason ?? '')).digest('hex');
    const rows = await this.prisma.$queryRaw<Array<{ requeued: boolean }>>(Prisma.sql`
      SELECT delivery.manual_requeue_outbox(
        ${normalizeToken(id, 'outbox id', 240)}::text,
        ${normalizeToken(actorUserId, 'retry actor', 160)}::text,
        ${reasonHash}::text
      ) AS requeued
    `);
    return Boolean(rows[0]?.requeued);
  }

  async stats(): Promise<{ pending: number; processing: number; retry: number; dead: number; manualReview: number; oldestPendingAt: Date | null }> {
    const rows = await this.prisma.$queryRaw<Array<{
      pending: bigint;
      processing: bigint;
      retry: bigint;
      dead: bigint;
      manual_review: bigint;
      oldest_pending_at: Date | null;
    }>>(Prisma.sql`
      SELECT
        count(*) FILTER (WHERE status = 'PENDING')::bigint AS pending,
        count(*) FILTER (WHERE status = 'PROCESSING')::bigint AS processing,
        count(*) FILTER (WHERE status IN ('RETRY', 'FAILED'))::bigint AS retry,
        count(*) FILTER (WHERE status = 'DEAD')::bigint AS dead,
        count(*) FILTER (WHERE status = 'MANUAL_REVIEW')::bigint AS manual_review,
        min("createdAt") FILTER (WHERE status IN ('PENDING', 'PROCESSING', 'RETRY', 'FAILED')) AS oldest_pending_at
      FROM public.outbox_entries
      WHERE type <> 'deal.command.receipt'
    `);
    const row = rows[0];
    return {
      pending: Number(row?.pending ?? 0n),
      processing: Number(row?.processing ?? 0n),
      retry: Number(row?.retry ?? 0n),
      dead: Number(row?.dead ?? 0n),
      manualReview: Number(row?.manual_review ?? 0n),
      oldestPendingAt: row?.oldest_pending_at ?? null,
    };
  }
}

function normalizeToken(value: unknown, label: string, maxLength: number): string {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error(`Invalid ${label}.`);
  }
  return normalized;
}

function boundedInteger(value: number, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Integer must be between ${min} and ${max}.`);
  }
  return value;
}

function hashJson(value: Prisma.JsonValue | Prisma.InputJsonValue): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}

function errorFingerprint(error: unknown): string {
  if (error instanceof Error) return `${error.name}:${error.message}`.slice(0, 2048);
  return String(error ?? 'unknown').slice(0, 2048);
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'code' in error
    && (error as { code?: unknown }).code === 'P2002'
  );
}
