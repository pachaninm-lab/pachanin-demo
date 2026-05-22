import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type OutboxStatus = 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'MANUAL_REVIEW';

export interface OutboxEntry {
  id: string;
  type: string;
  dealId?: string;
  payload: any;
  status: OutboxStatus;
  triggeredByUserId?: string;
  createdAt: string;
  sentAt?: string;
  confirmedAt?: string;
  retryCount: number;
  lastError?: string;
}

const MAX_AUTO_RETRIES = 3;

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
  }): OutboxEntry {
    const entry: OutboxEntry = {
      id: `OUTBOX-${String(++this.counter).padStart(4, '0')}`,
      type: params.type,
      dealId: params.dealId,
      payload: params.payload,
      status: 'PENDING',
      triggeredByUserId: params.triggeredByUserId,
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
    // After max retries, escalate to manual review rather than blocking
    entry.status = entry.retryCount >= MAX_AUTO_RETRIES ? 'MANUAL_REVIEW' : 'FAILED';
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
