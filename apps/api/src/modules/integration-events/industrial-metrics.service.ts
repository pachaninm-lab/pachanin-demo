import { Injectable, Logger } from '@nestjs/common';
import { Gauge, register } from 'prom-client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Prometheus metrics of the industrial money contour.
 *
 * Every gauge queries PostgreSQL at scrape time (prom-client async collect),
 * so multiple API instances all report the same shared truth and a dead
 * worker or growing DLQ is visible on any instance's /metrics endpoint.
 *
 * Exposed series:
 *  - pc_outbox_entries{status}            queue depth by status (incl. DEAD_LETTER)
 *  - pc_outbox_oldest_pending_seconds     age of the oldest due PENDING entry
 *  - pc_reconciliation_open_mismatches    statement rows awaiting manual review
 *  - pc_bank_key_revocations_total        permanently revoked signing keys
 *  - pc_bank_callback_key_rejections_24h  fail-closed key rejections, last 24h
 */

const OUTBOX_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'CONFIRMED', 'FAILED', 'DEAD_LETTER'] as const;

@Injectable()
export class IndustrialMetricsService {
  private readonly logger = new Logger(IndustrialMetricsService.name);

  constructor(private readonly prisma: PrismaService) {
    const prismaRef = this.prisma;
    const logger = this.logger;

    const maybeRegister = (name: string, build: () => void) => {
      if (!register.getSingleMetric(name)) build();
    };

    maybeRegister('pc_outbox_entries', () => {
      new Gauge({
        name: 'pc_outbox_entries',
        help: 'Transactional outbox depth by status',
        labelNames: ['status'],
        async collect() {
          try {
            const rows = await prismaRef.$queryRaw<Array<{ status: string; count: bigint }>>(
              Prisma.sql`SELECT "status", COUNT(*)::bigint AS count FROM "outbox_entries" GROUP BY "status"`,
            );
            const byStatus = new Map(rows.map((row) => [row.status, Number(row.count)]));
            for (const status of OUTBOX_STATUSES) {
              this.set({ status }, byStatus.get(status) ?? 0);
            }
          } catch (error) {
            logger.warn(`outbox metrics scrape failed: ${(error as Error).message}`);
          }
        },
      });
    });

    maybeRegister('pc_outbox_oldest_pending_seconds', () => {
      new Gauge({
        name: 'pc_outbox_oldest_pending_seconds',
        help: 'Age in seconds of the oldest due PENDING outbox entry (0 when queue is empty)',
        async collect() {
          try {
            const rows = await prismaRef.$queryRaw<Array<{ age: number | null }>>(Prisma.sql`
              SELECT EXTRACT(EPOCH FROM (NOW() - MIN("createdAt")))::float AS age
              FROM "outbox_entries"
              WHERE "status" = 'PENDING' AND "nextRetryAt" <= NOW()
            `);
            this.set(rows[0]?.age ?? 0);
          } catch (error) {
            logger.warn(`outbox age scrape failed: ${(error as Error).message}`);
          }
        },
      });
    });

    maybeRegister('pc_reconciliation_open_mismatches', () => {
      new Gauge({
        name: 'pc_reconciliation_open_mismatches',
        help: 'Bank statement rows in MISMATCH awaiting manual review',
        async collect() {
          try {
            const count = await prismaRef.bankStatementEntry.count({ where: { matchStatus: 'MISMATCH' } });
            this.set(count);
          } catch (error) {
            logger.warn(`reconciliation metrics scrape failed: ${(error as Error).message}`);
          }
        },
      });
    });

    maybeRegister('pc_bank_key_revocations_total', () => {
      new Gauge({
        name: 'pc_bank_key_revocations_total',
        help: 'Permanently revoked bank callback signing keys',
        async collect() {
          try {
            this.set(await prismaRef.bankKeyRevocation.count());
          } catch (error) {
            logger.warn(`key revocation metrics scrape failed: ${(error as Error).message}`);
          }
        },
      });
    });

    maybeRegister('pc_bank_callback_key_rejections_24h', () => {
      new Gauge({
        name: 'pc_bank_callback_key_rejections_24h',
        help: 'Fail-closed bank callback key rejections in the last 24 hours',
        async collect() {
          try {
            const count = await prismaRef.integrationEvent.count({
              where: {
                adapterName: 'bank-callback',
                eventType: { startsWith: 'KEY_REJECTED' },
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
              },
            });
            this.set(count);
          } catch (error) {
            logger.warn(`key rejection metrics scrape failed: ${(error as Error).message}`);
          }
        },
      });
    });
  }
}
