import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

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
}

export type OutboxHandler = (entry: ClaimedOutboxEntry) => Promise<void>;

export type OutboxFailureCategory = 'TRANSIENT' | 'PERMANENT' | 'AMBIGUOUS';

export interface OutboxDeliveryFailure {
  category: OutboxFailureCategory;
  code: string;
  message: string;
}

export class OutboxDeliveryError extends Error {
  constructor(
    readonly category: OutboxFailureCategory,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OutboxDeliveryError';
  }
}

export interface OutboxDrainReport {
  workerId: string;
  claimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
  manualReview: number;
  leaseLost: number;
}

export class OutboxLeaseLostError extends Error {
  constructor(entryId: string, workerId: string) {
    super(`Outbox lease lost: entry=${entryId} worker=${workerId}`);
    this.name = 'OutboxLeaseLostError';
  }
}

const DEFAULT_LEASE_SECONDS = 60;
const BASE_BACKOFF_SECONDS = 5;
const MAX_BACKOFF_SECONDS = 3600;
const MAX_FAILURE_MESSAGE_LENGTH = 4_000;
const FAILURE_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_.:-]{0,63}$/u;

function boundedFailureCode(value: unknown, fallback = 'PROVIDER_FAILURE'): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toUpperCase();
  return FAILURE_CODE_PATTERN.test(normalized) ? normalized : fallback;
}

function boundedFailureMessage(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value);
  return message.slice(0, MAX_FAILURE_MESSAGE_LENGTH);
}

function numericStatus(error: Record<string, unknown>): number | undefined {
  const value = error.statusCode ?? error.status;
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

export function classifyOutboxDeliveryFailure(error: unknown): OutboxDeliveryFailure {
  if (error instanceof OutboxDeliveryError) {
    return {
      category: error.category,
      code: boundedFailureCode(error.code),
      message: boundedFailureMessage(error),
    };
  }
  const record = typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : {};
  const message = boundedFailureMessage(error);
  const code = boundedFailureCode(record.code, '');
  const status = numericStatus(record);

  if (record.deliveryAmbiguous === true || code === 'PROVIDER_DELIVERY_AMBIGUOUS') {
    return { category: 'AMBIGUOUS', code: 'PROVIDER_DELIVERY_AMBIGUOUS', message };
  }
  if (record.retryable === true) {
    return { category: 'TRANSIENT', code: code || 'PROVIDER_RETRYABLE_FAILURE', message };
  }
  if (record.retryable === false) {
    return { category: 'PERMANENT', code: code || 'PROVIDER_PERMANENT_FAILURE', message };
  }
  if (status === 429) return { category: 'TRANSIENT', code: 'PROVIDER_RATE_LIMITED', message };
  if (status !== undefined && status >= 400 && status < 500) {
    return { category: 'PERMANENT', code: `PROVIDER_HTTP_${status}`, message };
  }
  if (status !== undefined && status >= 500 && status < 600) {
    return { category: 'TRANSIENT', code: `PROVIDER_HTTP_${status}`, message };
  }
  if (
    ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code) ||
    record.name === 'AbortError'
  ) {
    return { category: 'TRANSIENT', code: 'PROVIDER_TIMEOUT', message };
  }
  // An untyped exception does not prove whether external delivery happened.
  // Providers must opt into retry with an explicit retryable/status/timeout
  // contract; unknown phase failures are quarantined to prevent duplicates.
  return { category: 'AMBIGUOUS', code: code || 'PROVIDER_DELIVERY_AMBIGUOUS', message };
}

@Injectable()
export class DurableOutboxWorker {
  private readonly handlers = new Map<string, OutboxHandler>();
  private fallbackHandler?: OutboxHandler;

  constructor(private readonly prisma: PrismaService) {}

  registerHandler(type: string, handler: OutboxHandler): void {
    this.handlers.set(type, handler);
  }

  registerFallbackHandler(handler: OutboxHandler): void {
    this.fallbackHandler = handler;
  }

  async claimBatch(
    workerId: string,
    limit = 25,
    leaseSeconds = DEFAULT_LEASE_SECONDS,
  ): Promise<ClaimedOutboxEntry[]> {
    if (!workerId.trim()) throw new Error('workerId is required');
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('limit must be between 1 and 500');
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) {
      throw new Error('leaseSeconds must be between 1 and 3600');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        SET LOCAL pc_crop.outbox_claim_protocol = '2'
      `);

      await tx.$executeRaw(Prisma.sql`
        UPDATE "outbox_entries"
        SET "status" = 'MANUAL_REVIEW',
            "retryCount" = "retryCount" + 1,
            "lastError" = 'Worker lease expired after an external delivery attempt started',
            "lastErrorCode" = 'WORKER_CRASH_OUTCOME_UNKNOWN',
            "lastErrorCategory" = 'AMBIGUOUS',
            "manualReviewAt" = NOW(),
            "failedAt" = NOW(),
            "leaseOwner" = NULL,
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "heartbeatAt" = NULL
        WHERE "status" = 'PROCESSING'
          AND "leaseExpiresAt" < NOW()
          AND "lastAttemptAt" IS NOT NULL
      `);

      return tx.$queryRaw<ClaimedOutboxEntry[]>(Prisma.sql`
        UPDATE "outbox_entries"
        SET "status" = 'PROCESSING',
            "leaseOwner" = ${workerId},
            "leaseToken" = md5(random()::text || clock_timestamp()::text || "id" || ${workerId}),
            "leaseExpiresAt" = NOW() + make_interval(secs => ${leaseSeconds}),
            "heartbeatAt" = NOW(),
            "lastAttemptAt" = NULL
        WHERE "id" IN (
          SELECT "id"
          FROM "outbox_entries"
          WHERE "type" <> 'MARKETING_SOCIAL_PUBLISH_V1'
            AND (
              ("status" = 'PENDING' AND "nextRetryAt" <= NOW())
              OR (
                "status" = 'PROCESSING'
                AND "leaseExpiresAt" < NOW()
                AND "lastAttemptAt" IS NULL
              )
            )
          ORDER BY "createdAt", "id"
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING "id", "type", "dealId", "payload", "retryCount", "maxRetries",
                  "correlationId", "idempotencyKey", "leaseToken"
      `);
    });
  }

  async heartbeat(
    workerId: string,
    entryId: string,
    leaseToken: string,
    leaseSeconds = DEFAULT_LEASE_SECONDS,
  ): Promise<boolean> {
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_entries"
      SET "leaseExpiresAt" = NOW() + make_interval(secs => ${leaseSeconds}),
          "heartbeatAt" = NOW()
      WHERE "id" = ${entryId}
        AND "leaseOwner" = ${workerId}
        AND "leaseToken" = ${leaseToken}
        AND "status" = 'PROCESSING'
        AND "leaseExpiresAt" >= NOW()
    `);
    return count === 1;
  }

  async drainOnce(workerId: string, limit = 25): Promise<OutboxDrainReport> {
    const claimed = await this.claimBatch(workerId, limit);
    const report: OutboxDrainReport = {
      workerId,
      claimed: claimed.length,
      delivered: 0,
      retried: 0,
      deadLettered: 0,
      manualReview: 0,
      leaseLost: 0,
    };

    for (const entry of claimed) {
      const handler = this.handlers.get(entry.type) ?? this.fallbackHandler;
      if (!handler) {
        try {
          const outcome = await this.markFailed(
            workerId,
            entry,
            {
              category: 'PERMANENT',
              code: 'TRANSPORT_HANDLER_MISSING',
              message: `no transport handler registered for type ${entry.type}`,
            },
          );
          this.recordFailureOutcome(report, outcome);
        } catch (error) {
          if (error instanceof OutboxLeaseLostError) report.leaseLost++;
          else throw error;
        }
        continue;
      }

      let handlerCompleted = false;
      try {
        await this.markAttemptStarted(workerId, entry.id, entry.leaseToken);
        await handler(entry);
        handlerCompleted = true;
        await this.markDelivered(workerId, entry.id, entry.leaseToken);
        report.delivered++;
      } catch (error) {
        if (error instanceof OutboxLeaseLostError) {
          report.leaseLost++;
          continue;
        }
        try {
          const failure = handlerCompleted
            ? {
              category: 'AMBIGUOUS' as const,
              code: 'POST_DELIVERY_PERSISTENCE_FAILED',
              message: `External delivery completed but acknowledgement persistence failed: ${boundedFailureMessage(error)}`,
            }
            : classifyOutboxDeliveryFailure(error);
          const outcome = await this.markFailed(workerId, entry, failure);
          this.recordFailureOutcome(report, outcome);
        } catch (markError) {
          if (markError instanceof OutboxLeaseLostError) report.leaseLost++;
          else throw markError;
        }
      }
    }
    return report;
  }

  async markDelivered(workerId: string, entryId: string, leaseToken: string): Promise<void> {
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_entries"
      SET "status" = 'SENT',
          "sentAt" = NOW(),
          "leaseOwner" = NULL,
          "leaseToken" = NULL,
          "leaseExpiresAt" = NULL,
          "heartbeatAt" = NULL,
          "lastError" = NULL,
          "lastErrorCode" = NULL,
          "lastErrorCategory" = NULL,
          "lastAttemptAt" = NOW()
      WHERE "id" = ${entryId}
        AND "leaseOwner" = ${workerId}
        AND "leaseToken" = ${leaseToken}
        AND "status" = 'PROCESSING'
        AND "leaseExpiresAt" >= NOW()
    `);
    if (count !== 1) throw new OutboxLeaseLostError(entryId, workerId);
  }

  async markAttemptStarted(workerId: string, entryId: string, leaseToken: string): Promise<void> {
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_entries"
      SET "lastAttemptAt" = NOW()
      WHERE "id" = ${entryId}
        AND "leaseOwner" = ${workerId}
        AND "leaseToken" = ${leaseToken}
        AND "status" = 'PROCESSING'
        AND "leaseExpiresAt" >= NOW()
    `);
    if (count !== 1) throw new OutboxLeaseLostError(entryId, workerId);
  }

  async markFailed(
    workerId: string,
    entry: Pick<ClaimedOutboxEntry, 'id' | 'retryCount' | 'maxRetries' | 'leaseToken'>,
    failure: OutboxDeliveryFailure,
  ): Promise<'RETRY' | 'DEAD_LETTER' | 'MANUAL_REVIEW'> {
    failure = {
      category: failure.category,
      code: boundedFailureCode(failure.code),
      message: boundedFailureMessage(failure.message),
    };
    const nextRetryCount = entry.retryCount + 1;
    if (failure.category === 'AMBIGUOUS') {
      const count = await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "outbox_entries"
        SET "status" = 'MANUAL_REVIEW',
            "retryCount" = ${nextRetryCount},
            "lastError" = ${failure.message},
            "lastErrorCode" = ${failure.code},
            "lastErrorCategory" = ${failure.category},
            "lastAttemptAt" = NOW(),
            "manualReviewAt" = NOW(),
            "failedAt" = NOW(),
            "leaseOwner" = NULL,
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "heartbeatAt" = NULL
        WHERE "id" = ${entry.id}
          AND "leaseOwner" = ${workerId}
          AND "leaseToken" = ${entry.leaseToken}
          AND "status" = 'PROCESSING'
          AND "leaseExpiresAt" >= NOW()
      `);
      if (count !== 1) throw new OutboxLeaseLostError(entry.id, workerId);
      return 'MANUAL_REVIEW';
    }

    if (failure.category === 'PERMANENT' || nextRetryCount >= entry.maxRetries) {
      const count = await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "outbox_entries"
        SET "status" = 'DEAD_LETTER',
            "retryCount" = ${nextRetryCount},
            "lastError" = ${failure.message},
            "lastErrorCode" = ${failure.code},
            "lastErrorCategory" = ${failure.category},
            "lastAttemptAt" = NOW(),
            "failedAt" = NOW(),
            "deadLetterAt" = NOW(),
            "leaseOwner" = NULL,
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "heartbeatAt" = NULL
        WHERE "id" = ${entry.id}
          AND "leaseOwner" = ${workerId}
          AND "leaseToken" = ${entry.leaseToken}
          AND "status" = 'PROCESSING'
          AND "leaseExpiresAt" >= NOW()
      `);
      if (count !== 1) throw new OutboxLeaseLostError(entry.id, workerId);
      return 'DEAD_LETTER';
    }

    const backoffSeconds = Math.min(
      MAX_BACKOFF_SECONDS,
      BASE_BACKOFF_SECONDS * 2 ** entry.retryCount,
    );
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_entries"
      SET "status" = 'PENDING',
          "retryCount" = ${nextRetryCount},
          "lastError" = ${failure.message},
          "lastErrorCode" = ${failure.code},
          "lastErrorCategory" = ${failure.category},
          "lastAttemptAt" = NOW(),
          "failedAt" = NOW(),
          "nextRetryAt" = NOW() + make_interval(secs => ${backoffSeconds}),
          "leaseOwner" = NULL,
          "leaseToken" = NULL,
          "leaseExpiresAt" = NULL,
          "heartbeatAt" = NULL
      WHERE "id" = ${entry.id}
        AND "leaseOwner" = ${workerId}
        AND "leaseToken" = ${entry.leaseToken}
        AND "status" = 'PROCESSING'
        AND "leaseExpiresAt" >= NOW()
    `);
    if (count !== 1) throw new OutboxLeaseLostError(entry.id, workerId);
    return 'RETRY';
  }

  private recordFailureOutcome(
    report: OutboxDrainReport,
    outcome: 'RETRY' | 'DEAD_LETTER' | 'MANUAL_REVIEW',
  ): void {
    if (outcome === 'RETRY') report.retried++;
    else if (outcome === 'DEAD_LETTER') report.deadLettered++;
    else report.manualReview++;
  }
}
