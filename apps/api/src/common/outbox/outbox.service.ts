import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type OutboxStatus = 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'MANUAL_REVIEW' | 'DEAD';

export interface OutboxEntry {
  id: string;
  type: string;
  dealId?: string;
  payload: any;
  status: OutboxStatus;
  triggeredByUserId?: string;
  idempotencyKey?: string;
  maxRetries: number;
  nextRetryAt?: string;
  createdAt: string;
  sentAt?: string;
  confirmedAt?: string;
  retryCount: number;
  lastError?: string;
}

const DEFAULT_MAX_RETRIES = 5;

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);
  private readonly entries: OutboxEntry[] = [];
  private counter = 0;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  enqueue(params: {
    type: string;
    dealId?: string;
    payload: any;
    triggeredByUserId?: string;
    idempotencyKey?: string;
    maxRetries?: number;
  }): OutboxEntry {
    if (params.idempotencyKey) {
      const existing = this.entries.find((e) => e.idempotencyKey === params.idempotencyKey && e.status !== 'DEAD');
      if (existing) return existing;
    }
    const entry: OutboxEntry = {
      id: `OUTBOX-${String(++this.counter).padStart(4, '0')}`,
      type: params.type,
      dealId: params.dealId,
      payload: params.payload,
      status: 'PENDING',
      triggeredByUserId: params.triggeredByUserId,
      idempotencyKey: params.idempotencyKey,
      maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    this.entries.push(entry);
    this.prisma?.outboxEntry.create({
      data: {
        id: entry.id,
        type: entry.type,
        dealId: entry.dealId,
        payload: JSON.stringify(entry.payload),
        status: entry.status,
        idempotencyKey: entry.idempotencyKey,
        maxRetries: entry.maxRetries,
      },
    }).catch((e) => this.logger.debug(`Outbox DB write skipped: ${e.message}`));
    return entry;
  }

  markSent(id: string): OutboxEntry {
    const entry = this.findOrThrow(id);
    entry.status = 'SENT';
    entry.sentAt = new Date().toISOString();
    return entry;
  }

  confirm(id: string): OutboxEntry {
    const entry = this.findOrThrow(id);
    entry.status = 'CONFIRMED';
    entry.confirmedAt = new Date().toISOString();
    this.prisma?.outboxEntry.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } })
      .catch((e) => this.logger.debug(`Outbox confirm DB skipped: ${e.message}`));
    return entry;
  }

  markFailed(id: string, error: string): OutboxEntry {
    const entry = this.findOrThrow(id);
    entry.retryCount += 1;
    entry.lastError = error;
    if (entry.retryCount >= entry.maxRetries) {
      entry.status = 'DEAD';
      this.prisma?.outboxEntry.update({ where: { id }, data: { status: 'DEAD' } }).catch(() => {});
    } else {
      const backoffMs = Math.min(1000 * 2 ** entry.retryCount, 3_600_000);
      entry.nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
      entry.status = 'FAILED';
    }
    return entry;
  }

  listDead(): OutboxEntry[] {
    return this.entries.filter((e) => e.status === 'DEAD');
  }

  requeue(id: string): OutboxEntry {
    const entry = this.findOrThrow(id);
    entry.status = 'PENDING';
    entry.retryCount = 0;
    entry.nextRetryAt = undefined;
    entry.lastError = undefined;
    return entry;
  }

  listPending(): OutboxEntry[] {
    return this.entries.filter((e) => e.status === 'PENDING' || e.status === 'FAILED');
  }

  listManualReview(): OutboxEntry[] {
    return this.entries.filter((e) => e.status === 'MANUAL_REVIEW');
  }

  list(): OutboxEntry[] {
    return [...this.entries].reverse();
  }

  getByDeal(dealId: string): OutboxEntry[] {
    return this.entries.filter((e) => e.dealId === dealId);
  }

  private findOrThrow(id: string): OutboxEntry {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) throw new Error(`Outbox entry ${id} not found`);
    return entry;
  }
}
