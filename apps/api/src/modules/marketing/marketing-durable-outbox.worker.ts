import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  type ClaimedOutboxEntry,
  DurableOutboxWorker,
} from '../integration-events/durable-outbox.worker';
import { MARKETING_SOCIAL_PUBLISH_EVENT_TYPE } from './marketing-outbox.contract';

const DEFAULT_LEASE_SECONDS = 60;

/**
 * Dedicated social-delivery worker.
 *
 * The platform-wide durable worker claims every outbox type, so reusing it in a
 * second process would allow a marketing process to lease FGIS/bank/domain work.
 * This subclass narrows the SQL claim itself to the single versioned marketing
 * event type. Inherited retry/DLQ/lease state transitions remain unchanged.
 */
@Injectable()
export class MarketingDurableOutboxWorker extends DurableOutboxWorker {
  constructor(private readonly marketingPrisma: PrismaService) {
    super(marketingPrisma);
  }

  override async claimBatch(
    workerId: string,
    limit = 25,
    leaseSeconds = DEFAULT_LEASE_SECONDS,
  ): Promise<ClaimedOutboxEntry[]> {
    if (!workerId.trim()) throw new Error('workerId is required');
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new Error('limit must be between 1 and 500');
    }
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) {
      throw new Error('leaseSeconds must be between 1 and 3600');
    }

    return this.marketingPrisma.$queryRaw<ClaimedOutboxEntry[]>(Prisma.sql`
      UPDATE "outbox_entries"
      SET "status" = 'PROCESSING',
          "leaseOwner" = ${workerId},
          "leaseToken" = md5(random()::text || clock_timestamp()::text || "id" || ${workerId}),
          "leaseExpiresAt" = NOW() + make_interval(secs => ${leaseSeconds}),
          "heartbeatAt" = NOW()
      WHERE "id" IN (
        SELECT "id"
        FROM "outbox_entries"
        WHERE "type" = ${MARKETING_SOCIAL_PUBLISH_EVENT_TYPE}
          AND (
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
}
