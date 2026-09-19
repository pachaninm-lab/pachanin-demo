import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OutboxService } from '../../common/outbox/outbox.service';

// Statuses eligible for auto-cancellation if no activity for STALE_DAYS
const STALEABLE_STATUSES = ['DRAFT', 'PUBLISHED', 'NEGOTIATING', 'PAYMENT_AWAITING'];
const STALE_DAYS = Number(process.env.DEAL_AUTO_CANCEL_DAYS ?? 14);
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

@Injectable()
export class DealAutoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DealAutoService.name);
  private handle?: ReturnType<typeof setInterval>;

  constructor(
    @Optional() private readonly prisma?: PrismaService,
    @Optional() private readonly audit?: AuditService,
    @Optional() private readonly outbox?: OutboxService,
  ) {}

  onModuleInit() {
    this.handle = setInterval(() => this.autoCancel().catch(e => this.logger.warn(`Auto-cancel error: ${e.message}`)), CHECK_INTERVAL_MS);
    this.logger.log(`DealAutoService started (stale threshold: ${STALE_DAYS} days)`);
  }

  onModuleDestroy() {
    if (this.handle) clearInterval(this.handle);
  }

  async autoCancel(): Promise<{ cancelled: number }> {
    if (!this.prisma) return { cancelled: 0 };

    const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 3600_000);

    const staleDeals = await this.prisma.deal.findMany({
      where: {
        status: { in: STALEABLE_STATUSES },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, dealNumber: true, status: true, sellerOrgId: true, buyerOrgId: true },
      take: 100,
    }).catch(() => []);

    let cancelled = 0;

    for (const deal of staleDeals) {
      try {
        await this.prisma.deal.update({
          where: { id: deal.id },
          data: {
            status: 'CANCELLED',
            updatedAt: new Date(),
          },
        });

        try {
          this.audit?.log({
            action: 'deal:auto_cancelled',
            actorUserId: 'SYSTEM',
            actorRole: 'ADMIN',
            objectType: 'Deal',
            objectId: deal.id,
            outcome: 'SUCCESS',
            meta: { reason: `No activity for ${STALE_DAYS} days`, previousStatus: deal.status },
          });
        } catch {}

        this.outbox?.enqueue({
          type: 'DEAL_AUTO_CANCELLED',
          dealId: deal.id,
          payload: { dealId: deal.id, dealNumber: deal.dealNumber, previousStatus: deal.status, reason: 'stale' },
          idempotencyKey: `deal.auto_cancel.${deal.id}`,
        });

        cancelled++;
        this.logger.log(`Auto-cancelled stale deal ${deal.dealNumber ?? deal.id} (was ${deal.status})`);
      } catch (err) {
        this.logger.warn(`Failed to auto-cancel deal ${deal.id}: ${(err as Error).message}`);
      }
    }

    if (cancelled > 0) {
      this.logger.log(`Auto-cancel run: ${cancelled} deals cancelled`);
    }

    return { cancelled };
  }
}
