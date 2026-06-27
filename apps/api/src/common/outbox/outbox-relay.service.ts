import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from './outbox.service';

const RELAY_INTERVAL_MS = 5_000;
const BATCH_SIZE = 100;

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private intervalHandle?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly outbox: OutboxService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  onModuleInit() {
    this.intervalHandle = setInterval(() => this.relay().catch((e) => this.logger.debug(`Relay error: ${e.message}`)), RELAY_INTERVAL_MS);
    this.logger.log('OutboxRelayService started');
  }

  onModuleDestroy() {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  async relay(): Promise<{ processed: number; dead: number }> {
    if (this.running) return { processed: 0, dead: 0 };
    this.running = true;
    let processed = 0;
    let dead = 0;

    try {
      const pending = this.outbox.listPending().slice(0, BATCH_SIZE);

      for (const entry of pending) {
        if (entry.nextRetryAt && new Date(entry.nextRetryAt) > new Date()) continue;
        try {
          this.outbox.markSent(entry.id);
          // In production: await kafka.produce(entry.type, entry.payload, { key: entry.idempotencyKey })
          // For now: simulate delivery for non-bank events
          if (!entry.type.startsWith('BANK_')) {
            this.outbox.confirm(entry.id);
            if (this.prisma) {
              await this.prisma.outboxEntry.update({ where: { id: entry.id }, data: { status: 'SENT', sentAt: new Date() } }).catch(() => {});
            }
          }
          processed++;
        } catch (err) {
          const updated = this.outbox.markFailed(entry.id, (err as Error).message);
          if (updated.status === 'DEAD') dead++;
          if (this.prisma) {
            await this.prisma.outboxEntry.update({
              where: { id: entry.id },
              data: { status: updated.status, lastError: (err as Error).message },
            }).catch(() => {});
          }
        }
      }
    } finally {
      this.running = false;
    }

    if (processed > 0 || dead > 0) {
      this.logger.log(`Outbox relay: processed=${processed} dead=${dead}`);
    }
    return { processed, dead };
  }

  getStats(): { pending: number; dead: number; manualReview: number } {
    return {
      pending: this.outbox.listPending().length,
      dead: this.outbox.listDead().length,
      manualReview: this.outbox.listManualReview().length,
    };
  }
}
