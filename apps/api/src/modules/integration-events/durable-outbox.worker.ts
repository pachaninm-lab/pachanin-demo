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

export interface OutboxDrainReport {
  workerId: string;
  claimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
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

    return this.prisma.$queryRaw<ClaimedOutboxEntry[]>(Prisma.sql`
      UPDATE "outbox_entries"
      SET "status" = 'PROCESSING',
          "leaseOwner" = ${workerId},
          "leaseToken" = md5(random()::text || clock_timestamp()::text || "id" || ${workerId}),
          "leaseExpiresAt" = NOW() + make_interval(secs => ${leaseSeconds}),
          "heartbeatAt" = NOW()
      WHERE "id" IN (
        SELECT "id"
        FROM "outbox_entries"
        WHERE (
            ("status" = 'PENDING' AND "nextRetryAt" <= NOW())
            OR ("status" = 'PROCESSING' AND "leaseExpiresAt" < NOW())
          )
        ORDER BY "createdAt", "id"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "type", "dealId", "payload", "retryCount", "maxRetries",
                "correlationId", "idempotencyKey", "leaseToken"
    `);
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
      leaseLost: 0,
    };

    for (const entry of claimed) {
      const handler = this.handlers.get(entry.type) ?? this.fallbackHandler;
      if (!handler) {
        try {
          const outcome = await this.markFailed(
            workerId,
            entry,
            `no transport handler registered for type ${entry.type}`,
          );
          outcome === 'DEAD_LETTER' ? report.deadLettered++ : report.retried++;
        } catch (error) {
          if (error instanceof OutboxLeaseLostError) report.leaseLost++;
          else throw error;
        }
        continue;
      }

      try {
        await handler(entry);
        await this.markDelivered(workerId, entry.id, entry.leaseToken);
        report.delivered++;
      } catch (error) {
        if (error instanceof OutboxLeaseLostError) {
          report.leaseLost++;
          continue;
        }
        const message = error instanceof Error ? error.message : String(error);
        try {
          const outcome = await this.markFailed(workerId, entry, message);
          outcome === 'DEAD_LETTER' ? report.deadLettered++ : report.retried++;
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
          "lastError" = NULL
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
    error: string,
  ): Promise<'RETRY' | 'DEAD_LETTER'> {
    const nextRetryCount = entry.retryCount + 1;
    if (nextRetryCount >= entry.maxRetries) {
      const count = await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "outbox_entries"
        SET "status" = 'DEAD_LETTER',
            "retryCount" = ${nextRetryCount},
            "lastError" = ${error},
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
          "lastError" = ${error},
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
    `);
    if (count !== 1) throw new OutboxLeaseLostError(entry.id, workerId);
    return 'RETRY';
  }
}
