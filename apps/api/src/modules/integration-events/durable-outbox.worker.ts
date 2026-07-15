import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Single claim/delivery state owner for the canonical public.outbox_entries
 * queue. Every claim receives a fresh fencing token. Heartbeat and all terminal
 * acknowledgements require worker id + fencing token + a live lease.
 */

export interface ClaimedOutboxEntry {
  id: string;
  type: string;
  dealId: string | null;
  payload: unknown;
  retryCount: number;
  maxRetries: number;
  correlationId: string | null;
  idempotencyKey: string | null;
  leaseToken: string;
  leaseExpiresAt: Date;
}

export type OutboxHandler = (entry: ClaimedOutboxEntry) => Promise<void>;

export interface OutboxDrainReport {
  workerId: string;
  claimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
  leaseLost: number;
}

export type OutboxFailureOutcome = 'RETRY' | 'DEAD_LETTER' | 'LEASE_LOST';

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;
const DEFAULT_LEASE_SECONDS = 60;
const BASE_BACKOFF_SECONDS = 5;
const MAX_BACKOFF_SECONDS = 3600;
const MAX_ERROR_LENGTH = 4000;

@Injectable()
export class DurableOutboxWorker {
  private readonly handlers = new Map<string, OutboxHandler>();
  private defaultHandler: OutboxHandler | null = null;

  constructor(private readonly prisma: PrismaService) {}

  registerHandler(typeInput: string, handler: OutboxHandler): void {
    const type = requiredText(typeInput, 'type', 1, 200);
    this.handlers.set(type, handler);
  }

  unregisterHandler(typeInput: string): void {
    this.handlers.delete(requiredText(typeInput, 'type', 1, 200));
  }

  registerDefaultHandler(handler: OutboxHandler): void {
    this.defaultHandler = handler;
  }

  clearDefaultHandler(): void {
    this.defaultHandler = null;
  }

  async claimBatch(
    workerIdInput: string,
    limitInput = 25,
    leaseSecondsInput = DEFAULT_LEASE_SECONDS,
  ): Promise<ClaimedOutboxEntry[]> {
    const workerId = safeId(workerIdInput, 'workerId');
    const limit = boundedInteger(limitInput, 1, 500, 25, 'limit');
    const leaseSeconds = boundedInteger(
      leaseSecondsInput,
      1,
      3600,
      DEFAULT_LEASE_SECONDS,
      'leaseSeconds',
    );

    return this.prisma.$queryRaw<ClaimedOutboxEntry[]>(Prisma.sql`
      WITH candidate AS (
        SELECT "id"
        FROM public."outbox_entries"
        WHERE (
          ("status" = 'PENDING' AND "nextRetryAt" <= transaction_timestamp())
          OR
          ("status" = 'PROCESSING' AND "leaseExpiresAt" < transaction_timestamp())
        )
        ORDER BY
          CASE WHEN "status" = 'PROCESSING' THEN 0 ELSE 1 END,
          COALESCE("leaseExpiresAt", "nextRetryAt"),
          "createdAt",
          "id"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE public."outbox_entries" entry
      SET "status" = 'PROCESSING',
          "leaseOwner" = ${workerId},
          "leaseToken" = gen_random_uuid()::text,
          "leaseExpiresAt" = transaction_timestamp() + make_interval(secs => ${leaseSeconds})
      FROM candidate
      WHERE entry."id" = candidate."id"
      RETURNING entry."id", entry."type", entry."dealId", entry."payload",
                entry."retryCount", entry."maxRetries", entry."correlationId",
                entry."idempotencyKey", entry."leaseToken", entry."leaseExpiresAt"
    `);
  }

  async heartbeat(
    workerIdInput: string,
    entryIdInput: string,
    leaseTokenInput: string,
    leaseSecondsInput = DEFAULT_LEASE_SECONDS,
  ): Promise<boolean> {
    const workerId = safeId(workerIdInput, 'workerId');
    const entryId = safeId(entryIdInput, 'entryId');
    const leaseToken = safeId(leaseTokenInput, 'leaseToken');
    const leaseSeconds = boundedInteger(
      leaseSecondsInput,
      1,
      3600,
      DEFAULT_LEASE_SECONDS,
      'leaseSeconds',
    );
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public."outbox_entries"
      SET "leaseExpiresAt" = transaction_timestamp() + make_interval(secs => ${leaseSeconds})
      WHERE "id" = ${entryId}
        AND "leaseOwner" = ${workerId}
        AND "leaseToken" = ${leaseToken}
        AND "status" = 'PROCESSING'
        AND "leaseExpiresAt" > transaction_timestamp()
    `);
    return count === 1;
  }

  async drainOnce(
    workerIdInput: string,
    limitInput = 25,
    leaseSecondsInput = DEFAULT_LEASE_SECONDS,
  ): Promise<OutboxDrainReport> {
    const workerId = safeId(workerIdInput, 'workerId');
    const limit = boundedInteger(limitInput, 1, 500, 25, 'limit');
    const leaseSeconds = boundedInteger(
      leaseSecondsInput,
      1,
      3600,
      DEFAULT_LEASE_SECONDS,
      'leaseSeconds',
    );
    const claimed = await this.claimBatch(workerId, limit, leaseSeconds);
    const report: OutboxDrainReport = {
      workerId,
      claimed: claimed.length,
      delivered: 0,
      retried: 0,
      deadLettered: 0,
      leaseLost: 0,
    };

    for (const entry of claimed) {
      const handler = this.handlers.get(entry.type) ?? this.defaultHandler;
      if (!handler) {
        const outcome = await this.markFailed(
          workerId,
          entry,
          `OUTBOX_TRANSPORT_UNAVAILABLE: no handler registered for type ${entry.type}`,
        );
        incrementFailure(report, outcome);
        continue;
      }

      try {
        await this.deliverWithHeartbeat(workerId, entry, leaseSeconds, handler);
        const acknowledged = await this.markDelivered(workerId, entry.id, entry.leaseToken);
        if (acknowledged) report.delivered += 1;
        else report.leaseLost += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const outcome = await this.markFailed(workerId, entry, message);
        incrementFailure(report, outcome);
      }
    }
    return report;
  }

  async markDelivered(
    workerIdInput: string,
    entryIdInput: string,
    leaseTokenInput: string,
  ): Promise<boolean> {
    const workerId = safeId(workerIdInput, 'workerId');
    const entryId = safeId(entryIdInput, 'entryId');
    const leaseToken = safeId(leaseTokenInput, 'leaseToken');
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public."outbox_entries"
      SET "status" = 'SENT',
          "sentAt" = transaction_timestamp(),
          "leaseOwner" = NULL,
          "leaseToken" = NULL,
          "leaseExpiresAt" = NULL,
          "lastError" = NULL
      WHERE "id" = ${entryId}
        AND "leaseOwner" = ${workerId}
        AND "leaseToken" = ${leaseToken}
        AND "status" = 'PROCESSING'
        AND "leaseExpiresAt" > transaction_timestamp()
    `);
    return count === 1;
  }

  async markFailed(
    workerIdInput: string,
    entry: Pick<ClaimedOutboxEntry, 'id' | 'retryCount' | 'maxRetries' | 'leaseToken'>,
    errorInput: string,
  ): Promise<OutboxFailureOutcome> {
    const workerId = safeId(workerIdInput, 'workerId');
    const entryId = safeId(entry.id, 'entryId');
    const leaseToken = safeId(entry.leaseToken, 'leaseToken');
    const error = requiredText(errorInput, 'error', 1, MAX_ERROR_LENGTH);
    const nextRetryCount = entry.retryCount + 1;

    if (nextRetryCount >= entry.maxRetries) {
      const count = await this.prisma.$executeRaw(Prisma.sql`
        UPDATE public."outbox_entries"
        SET "status" = 'DEAD_LETTER',
            "retryCount" = ${nextRetryCount},
            "lastError" = ${error},
            "failedAt" = transaction_timestamp(),
            "deadLetterAt" = transaction_timestamp(),
            "leaseOwner" = NULL,
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL
        WHERE "id" = ${entryId}
          AND "leaseOwner" = ${workerId}
          AND "leaseToken" = ${leaseToken}
          AND "status" = 'PROCESSING'
          AND "leaseExpiresAt" > transaction_timestamp()
      `);
      return count === 1 ? 'DEAD_LETTER' : 'LEASE_LOST';
    }

    const backoffSeconds = Math.min(
      MAX_BACKOFF_SECONDS,
      BASE_BACKOFF_SECONDS * 2 ** entry.retryCount,
    );
    const delaySeconds = Math.max(1, Math.round(Math.random() * backoffSeconds));
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE public."outbox_entries"
      SET "status" = 'PENDING',
          "retryCount" = ${nextRetryCount},
          "lastError" = ${error},
          "nextRetryAt" = transaction_timestamp() + make_interval(secs => ${delaySeconds}),
          "leaseOwner" = NULL,
          "leaseToken" = NULL,
          "leaseExpiresAt" = NULL
      WHERE "id" = ${entryId}
        AND "leaseOwner" = ${workerId}
        AND "leaseToken" = ${leaseToken}
        AND "status" = 'PROCESSING'
        AND "leaseExpiresAt" > transaction_timestamp()
    `);
    return count === 1 ? 'RETRY' : 'LEASE_LOST';
  }

  async queueStats(): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT "status", COUNT(*)::bigint AS count
      FROM public."outbox_entries"
      GROUP BY "status"
    `);
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }

  private async deliverWithHeartbeat(
    workerId: string,
    entry: ClaimedOutboxEntry,
    leaseSeconds: number,
    handler: OutboxHandler,
  ): Promise<void> {
    const heartbeatMs = Math.max(250, Math.floor((leaseSeconds * 1000) / 3));
    let stopped = false;
    let leaseLost = false;
    let heartbeatRunning = false;

    const timer = setInterval(() => {
      if (stopped || heartbeatRunning || leaseLost) return;
      heartbeatRunning = true;
      this.heartbeat(workerId, entry.id, entry.leaseToken, leaseSeconds)
        .then((renewed) => { if (!renewed) leaseLost = true; })
        .catch(() => { leaseLost = true; })
        .finally(() => { heartbeatRunning = false; });
    }, heartbeatMs);
    timer.unref?.();

    try {
      await handler(entry);
      if (leaseLost) throw new Error('OUTBOX_LEASE_LOST_DURING_DELIVERY');
    } finally {
      stopped = true;
      clearInterval(timer);
    }
  }
}

function incrementFailure(report: OutboxDrainReport, outcome: OutboxFailureOutcome): void {
  if (outcome === 'RETRY') report.retried += 1;
  else if (outcome === 'DEAD_LETTER') report.deadLettered += 1;
  else report.leaseLost += 1;
}

function safeId(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_ID.test(normalized)) throw inputError(field);
  return normalized;
}

function requiredText(value: unknown, field: string, min: number, max: number): string {
  const normalized = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  if (
    normalized.length < min
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) throw inputError(field);
  return normalized;
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  field: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw inputError(field);
  }
  return Number(value);
}

function inputError(field: string): BadRequestException {
  return new BadRequestException({ code: 'OUTBOX_INPUT_INVALID', field });
}
