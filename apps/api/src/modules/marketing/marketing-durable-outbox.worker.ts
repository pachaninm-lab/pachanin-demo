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
 * The canonical worker deliberately excludes the marketing event type. This
 * subclass is the sole marketing claimant: inherited drainOnce() dispatches to
 * this override, which claims only the versioned marketing event type under the
 * same protocol-v2 lease contract as the canonical worker.
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

    return this.marketingPrisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`
        SET LOCAL pc_crop.outbox_claim_protocol = '2'
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
          WHERE "type" = ${MARKETING_SOCIAL_PUBLISH_EVENT_TYPE}
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
}
