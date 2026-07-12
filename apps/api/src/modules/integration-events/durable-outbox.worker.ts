import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Durable transactional-outbox worker over the canonical `outbox_entries` table.
 *
 * Claim protocol: a bounded batch is leased with
 * `SELECT … FOR UPDATE SKIP LOCKED`, so any number of workers on any number of
 * instances can run concurrently without double-delivery. A crashed worker
 * releases its work automatically when its lease expires — no janitor needed.
 *
 * Retry protocol: exponential backoff with jitter up to `maxRetries`, then the
 * entry parks in DEAD_LETTER for operator re-drive. Receipts (rows created with
 * status CONFIRMED inside command transactions) are never claimed.
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
}

export type OutboxHandler = (entry: ClaimedOutboxEntry) => Promise<void>;

export interface OutboxDrainReport {
  workerId: string;
  claimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
}

const DEFAULT_LEASE_SECONDS = 60;
const BASE_BACKOFF_SECONDS = 5;
const MAX_BACKOFF_SECONDS = 3600;

@Injectable()
export class DurableOutboxWorker {
  private readonly logger = new Logger(DurableOutboxWorker.name);
  private readonly handlers = new Map<string, OutboxHandler>();

  constructor(private readonly prisma: PrismaService) {}

  registerHandler(type: string, handler: OutboxHandler): void {
    this.handlers.set(type, handler);
  }

  /**
   * Atomically lease a batch of due entries. Entries already leased by a live
   * worker are skipped; entries whose lease expired are reclaimed.
   */
  async claimBatch(
    workerId: string,
    limit = 25,
    leaseSeconds = DEFAULT_LEASE_SECONDS,
  ): Promise<ClaimedOutboxEntry[]> {
    const rows = await this.prisma.$queryRaw<ClaimedOutboxEntry[]>(Prisma.sql`
      UPDATE "outbox_entries"
      SET "status" = 'PROCESSING',
          "leaseOwner" = ${workerId},
          "leaseExpiresAt" = NOW() + make_interval(secs => ${leaseSeconds})
      WHERE "id" IN (
        SELECT "id"
        FROM "outbox_entries"
        WHERE (
            ("status" = 'PENDING' AND "nextRetryAt" <= NOW())
            OR ("status" = 'PROCESSING' AND "leaseExpiresAt" < NOW())
          )
        ORDER BY "createdAt"
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "type", "dealId", "payload", "retryCount", "maxRetries",
                "correlationId", "idempotencyKey"
    `);
    return rows;
  }

  /** Lease renewal for long-running deliveries. */
  async heartbeat(workerId: string, entryId: string, leaseSeconds = DEFAULT_LEASE_SECONDS): Promise<boolean> {
    const result = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_entries"
      SET "leaseExpiresAt" = NOW() + make_interval(secs => ${leaseSeconds})
      WHERE "id" = ${entryId} AND "leaseOwner" = ${workerId} AND "status" = 'PROCESSING'
    `);
    return result === 1;
  }

  /** Claim due work and dispatch it to registered handlers. */
  async drainOnce(workerId: string, limit = 25): Promise<OutboxDrainReport> {
    const claimed = await this.claimBatch(workerId, limit);
    const report: OutboxDrainReport = {
      workerId,
      claimed: claimed.length,
      delivered: 0,
      retried: 0,
      deadLettered: 0,
    };

    for (const entry of claimed) {
      const handler = this.handlers.get(entry.type);
      if (!handler) {
        // No configured transport for this type: fail closed with retry, never
        // pretend delivery happened.
        const outcome = await this.markFailed(workerId, entry, `no handler registered for type ${entry.type}`);
        outcome === 'DEAD_LETTER' ? report.deadLettered++ : report.retried++;
        continue;
      }
      try {
        await handler(entry);
        await this.markDelivered(workerId, entry.id);
        report.delivered++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const outcome = await this.markFailed(workerId, entry, message);
        outcome === 'DEAD_LETTER' ? report.deadLettered++ : report.retried++;
      }
    }
    return report;
  }

  async markDelivered(workerId: string, entryId: string): Promise<void> {
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_entries"
      SET "status" = 'SENT', "sentAt" = NOW(), "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "lastError" = NULL
      WHERE "id" = ${entryId} AND "leaseOwner" = ${workerId} AND "status" = 'PROCESSING'
    `);
    if (count !== 1) {
      this.logger.warn(`Outbox delivery ack lost lease: entry=${entryId} worker=${workerId}`);
    }
  }

  async markFailed(
    workerId: string,
    entry: Pick<ClaimedOutboxEntry, 'id' | 'retryCount' | 'maxRetries'>,
    error: string,
  ): Promise<'RETRY' | 'DEAD_LETTER'> {
    const nextRetryCount = entry.retryCount + 1;
    if (nextRetryCount >= entry.maxRetries) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE "outbox_entries"
        SET "status" = 'DEAD_LETTER',
            "retryCount" = ${nextRetryCount},
            "lastError" = ${error},
            "failedAt" = NOW(),
            "deadLetterAt" = NOW(),
            "leaseOwner" = NULL,
            "leaseExpiresAt" = NULL
        WHERE "id" = ${entry.id} AND "leaseOwner" = ${workerId}
      `);
      return 'DEAD_LETTER';
    }

    const backoffSeconds = Math.min(
      MAX_BACKOFF_SECONDS,
      BASE_BACKOFF_SECONDS * 2 ** entry.retryCount,
    );
    // Full jitter keeps concurrent retries from thundering the provider.
    const delaySeconds = Math.max(1, Math.round(Math.random() * backoffSeconds));
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_entries"
      SET "status" = 'PENDING',
          "retryCount" = ${nextRetryCount},
          "lastError" = ${error},
          "nextRetryAt" = NOW() + make_interval(secs => ${delaySeconds}),
          "leaseOwner" = NULL,
          "leaseExpiresAt" = NULL
      WHERE "id" = ${entry.id} AND "leaseOwner" = ${workerId}
    `);
    return 'RETRY';
  }

  /** Operator re-drive of a dead-lettered entry back into the queue. */
  async redrive(entryId: string): Promise<boolean> {
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "outbox_entries"
      SET "status" = 'PENDING',
          "retryCount" = 0,
          "nextRetryAt" = NOW(),
          "deadLetterAt" = NULL,
          "failedAt" = NULL,
          "lastError" = NULL
      WHERE "id" = ${entryId} AND "status" = 'DEAD_LETTER'
    `);
    return count === 1;
  }

  /** Queue depth by status for dashboards and alerts. */
  async queueStats(): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT "status", COUNT(*)::bigint AS count
      FROM "outbox_entries"
      GROUP BY "status"
    `);
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }
}
