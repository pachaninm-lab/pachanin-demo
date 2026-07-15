import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type OutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'CONFIRMED'
  | 'MANUAL_REVIEW'
  | 'DEAD_LETTER';

export interface OutboxEntry {
  id: string;
  type: string;
  dealId?: string;
  payload: unknown;
  status: OutboxStatus;
  triggeredByUserId?: string;
  idempotencyKey?: string;
  maxRetries: number;
  nextRetryAt?: string;
  createdAt: string;
  sentAt?: string;
  confirmedAt?: string;
  failedAt?: string;
  deadLetterAt?: string;
  retryCount: number;
  lastError?: string;
  correlationId?: string;
  leaseOwner?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  heartbeatAt?: string;
}

export interface OutboxQueueStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  confirmed: number;
  deadLetter: number;
  manualReview: number;
  oldestDueAt?: string;
}

export interface OutboxRedriveResult {
  entry: OutboxEntry;
  redriveEventId: string;
  replayed: boolean;
}

const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_LIST_LIMIT = 100;
const MAX_LIST_LIMIT = 500;

function asIso(value: Date | null | undefined): string | undefined {
  return value?.toISOString();
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(',')}}`;
}

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(params: {
    type: string;
    dealId?: string;
    payload: unknown;
    triggeredByUserId?: string;
    idempotencyKey?: string;
    correlationId?: string;
    maxRetries?: number;
  }): Promise<OutboxEntry> {
    if (params.idempotencyKey) {
      const existing = await this.prisma.outboxEntry.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) return this.toEntry(existing);
    }

    try {
      const created = await this.prisma.outboxEntry.create({
        data: {
          type: params.type,
          dealId: params.dealId,
          payload: params.payload as Prisma.InputJsonValue,
          status: 'PENDING',
          triggeredByUserId: params.triggeredByUserId,
          idempotencyKey: params.idempotencyKey,
          correlationId: params.correlationId,
          maxRetries: params.maxRetries ?? DEFAULT_MAX_RETRIES,
          nextRetryAt: new Date(),
        },
      });
      return this.toEntry(created);
    } catch (error) {
      if (params.idempotencyKey && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.outboxEntry.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (existing) return this.toEntry(existing);
      }
      throw error;
    }
  }

  async confirm(id: string): Promise<OutboxEntry> {
    const updated = await this.prisma.outboxEntry.updateMany({
      where: { id, status: 'SENT' },
      data: { status: 'CONFIRMED', confirmedAt: new Date() },
    });
    if (updated.count !== 1) {
      const current = await this.prisma.outboxEntry.findUnique({ where: { id } });
      if (!current) throw new Error(`Outbox entry ${id} not found`);
      if (current.status === 'CONFIRMED') return this.toEntry(current);
      throw new Error(`Outbox entry ${id} cannot be confirmed from status ${current.status}`);
    }
    return this.getRequired(id);
  }

  async list(limit = DEFAULT_LIST_LIMIT): Promise<OutboxEntry[]> {
    const rows = await this.prisma.outboxEntry.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(1, limit), MAX_LIST_LIMIT),
    });
    return rows.map((row) => this.toEntry(row));
  }

  async listPending(limit = DEFAULT_LIST_LIMIT): Promise<OutboxEntry[]> {
    const rows = await this.prisma.outboxEntry.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      orderBy: [{ nextRetryAt: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(Math.max(1, limit), MAX_LIST_LIMIT),
    });
    return rows.map((row) => this.toEntry(row));
  }

  async listDead(limit = DEFAULT_LIST_LIMIT): Promise<OutboxEntry[]> {
    const rows = await this.prisma.outboxEntry.findMany({
      where: { status: 'DEAD_LETTER' },
      orderBy: [{ deadLetterAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(1, limit), MAX_LIST_LIMIT),
    });
    return rows.map((row) => this.toEntry(row));
  }

  async listManualReview(limit = DEFAULT_LIST_LIMIT): Promise<OutboxEntry[]> {
    const rows = await this.prisma.outboxEntry.findMany({
      where: { status: 'MANUAL_REVIEW' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(Math.max(1, limit), MAX_LIST_LIMIT),
    });
    return rows.map((row) => this.toEntry(row));
  }

  async getByDeal(dealId: string, limit = DEFAULT_LIST_LIMIT): Promise<OutboxEntry[]> {
    const rows = await this.prisma.outboxEntry.findMany({
      where: { dealId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(1, limit), MAX_LIST_LIMIT),
    });
    return rows.map((row) => this.toEntry(row));
  }

  async queueStats(): Promise<OutboxQueueStats> {
    const rows = await this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT "status", COUNT(*)::bigint AS "count"
      FROM "outbox_entries"
      GROUP BY "status"
    `);
    const oldest = await this.prisma.$queryRaw<Array<{ oldest_due_at: Date | null }>>(Prisma.sql`
      SELECT MIN("nextRetryAt") AS "oldest_due_at"
      FROM "outbox_entries"
      WHERE "status" = 'PENDING' AND "nextRetryAt" <= NOW()
    `);
    const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    return {
      total,
      pending: counts.get('PENDING') ?? 0,
      processing: counts.get('PROCESSING') ?? 0,
      sent: counts.get('SENT') ?? 0,
      confirmed: counts.get('CONFIRMED') ?? 0,
      deadLetter: counts.get('DEAD_LETTER') ?? 0,
      manualReview: counts.get('MANUAL_REVIEW') ?? 0,
      oldestDueAt: asIso(oldest[0]?.oldest_due_at),
    };
  }

  async redrive(params: {
    entryId: string;
    actorUserId: string;
    reason: string;
    idempotencyKey: string;
  }): Promise<OutboxRedriveResult> {
    if (!params.idempotencyKey.trim()) throw new Error('Redrive idempotencyKey is required');
    if (!params.reason.trim()) throw new Error('Redrive reason is required');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const replay = await tx.outboxRedriveEvent.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (replay) {
          const entry = await tx.outboxEntry.findUnique({ where: { id: replay.outboxEntryId } });
          if (!entry) throw new Error(`Outbox entry ${replay.outboxEntryId} not found`);
          return { entry: this.toEntry(entry), redriveEventId: replay.id, replayed: true };
        }

        const locked = await tx.$queryRaw<Array<{ id: string; status: string; retryCount: number }>>(Prisma.sql`
          SELECT "id", "status", "retryCount"
          FROM "outbox_entries"
          WHERE "id" = ${params.entryId}
          FOR UPDATE
        `);
        const current = locked[0];
        if (!current) throw new Error(`Outbox entry ${params.entryId} not found`);
        if (current.status !== 'DEAD_LETTER') {
          throw new Error(`Outbox entry ${params.entryId} cannot be redriven from status ${current.status}`);
        }

        const previous = await tx.outboxRedriveEvent.findFirst({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { hash: true },
        });
        const eventMaterial = {
          outboxEntryId: params.entryId,
          idempotencyKey: params.idempotencyKey,
          actorUserId: params.actorUserId,
          reason: params.reason,
          previousStatus: current.status,
          previousRetryCount: current.retryCount,
          prevHash: previous?.hash ?? null,
        };
        const hash = createHash('sha256').update(stableJson(eventMaterial)).digest('hex');

        const event = await tx.outboxRedriveEvent.create({
          data: { ...eventMaterial, hash },
        });
        const changed = await tx.outboxEntry.updateMany({
          where: { id: params.entryId, status: 'DEAD_LETTER' },
          data: {
            status: 'PENDING',
            retryCount: 0,
            nextRetryAt: new Date(),
            lastError: null,
            failedAt: null,
            deadLetterAt: null,
            leaseOwner: null,
            leaseToken: null,
            leaseExpiresAt: null,
            heartbeatAt: null,
          },
        });
        if (changed.count !== 1) throw new Error(`Outbox entry ${params.entryId} redrive lost its lock`);
        const entry = await tx.outboxEntry.findUnique({ where: { id: params.entryId } });
        if (!entry) throw new Error(`Outbox entry ${params.entryId} not found after redrive`);
        return { entry: this.toEntry(entry), redriveEventId: event.id, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.outboxRedriveEvent.findUnique({
          where: { idempotencyKey: params.idempotencyKey },
        });
        if (replay) {
          const entry = await this.prisma.outboxEntry.findUnique({ where: { id: replay.outboxEntryId } });
          if (!entry) throw new Error(`Outbox entry ${replay.outboxEntryId} not found`);
          return { entry: this.toEntry(entry), redriveEventId: replay.id, replayed: true };
        }
      }
      throw error;
    }
  }

  private async getRequired(id: string): Promise<OutboxEntry> {
    const row = await this.prisma.outboxEntry.findUnique({ where: { id } });
    if (!row) throw new Error(`Outbox entry ${id} not found`);
    return this.toEntry(row);
  }

  private toEntry(row: {
    id: string;
    type: string;
    dealId: string | null;
    payload: Prisma.JsonValue;
    status: string;
    triggeredByUserId: string | null;
    idempotencyKey: string | null;
    maxRetries: number;
    retryCount: number;
    nextRetryAt: Date;
    lastError: string | null;
    correlationId: string | null;
    leaseOwner: string | null;
    leaseToken: string | null;
    leaseExpiresAt: Date | null;
    heartbeatAt: Date | null;
    deadLetterAt: Date | null;
    createdAt: Date;
    sentAt: Date | null;
    confirmedAt: Date | null;
    failedAt: Date | null;
  }): OutboxEntry {
    return {
      id: row.id,
      type: row.type,
      dealId: row.dealId ?? undefined,
      payload: row.payload,
      status: row.status as OutboxStatus,
      triggeredByUserId: row.triggeredByUserId ?? undefined,
      idempotencyKey: row.idempotencyKey ?? undefined,
      maxRetries: row.maxRetries,
      retryCount: row.retryCount,
      nextRetryAt: asIso(row.nextRetryAt),
      lastError: row.lastError ?? undefined,
      correlationId: row.correlationId ?? undefined,
      leaseOwner: row.leaseOwner ?? undefined,
      leaseToken: row.leaseToken ?? undefined,
      leaseExpiresAt: asIso(row.leaseExpiresAt),
      heartbeatAt: asIso(row.heartbeatAt),
      deadLetterAt: asIso(row.deadLetterAt),
      createdAt: row.createdAt.toISOString(),
      sentAt: asIso(row.sentAt),
      confirmedAt: asIso(row.confirmedAt),
      failedAt: asIso(row.failedAt),
    };
  }
}
