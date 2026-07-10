import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ClaimedOutboxEntry,
  DurableOutboxEntry,
  EnqueueOutboxInput,
  OutboxFailureDecision,
  OutboxRepository,
  OutboxStatus,
} from './outbox.repository';

export { OutboxStatus } from './outbox.repository';

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
  retryCount: number;
  lastError?: string;
}

export type EnqueueParams = Readonly<{
  type: string;
  dealId?: string;
  payload: Prisma.InputJsonValue;
  triggeredByUserId?: string;
  idempotencyKey?: string;
  maxRetries?: number;
  correlationId?: string;
  auditId?: string;
}>;

@Injectable()
export class OutboxService {
  private readonly repository: OutboxRepository;

  constructor(
    @Inject(OutboxRepository) repositoryOrPrisma: OutboxRepository | PrismaService,
  ) {
    this.repository = isRepository(repositoryOrPrisma)
      ? repositoryOrPrisma
      : new OutboxRepository(repositoryOrPrisma);
  }

  async enqueue(params: EnqueueParams): Promise<OutboxEntry> {
    return this.toEntry(await this.repository.enqueue(this.enqueueInput(params)));
  }

  async enqueueInTransaction(
    tx: Prisma.TransactionClient,
    params: EnqueueParams,
  ): Promise<OutboxEntry> {
    return this.toEntry(await this.repository.enqueue(this.enqueueInput(params), tx));
  }

  async claimBatch(workerId: string, batchSize: number, leaseSeconds: number): Promise<ClaimedOutboxEntry[]> {
    return this.repository.claimBatch(workerId, batchSize, leaseSeconds);
  }

  async completeClaim(id: string, claimToken: string): Promise<boolean> {
    return this.repository.completeClaim(id, claimToken);
  }

  async failClaim(
    id: string,
    claimToken: string,
    errorCode: string,
    error: unknown,
  ): Promise<OutboxFailureDecision | null> {
    return this.repository.failClaim(id, claimToken, errorCode, error);
  }

  async confirm(id: string): Promise<OutboxEntry> {
    return this.toEntry(await this.repository.confirmExternal(id));
  }

  async markFailed(id: string, errorCode: string): Promise<OutboxEntry> {
    return this.toEntry(await this.repository.markExternalFailure(id, errorCode));
  }

  async listDead(): Promise<OutboxEntry[]> {
    return this.toEntries(await this.repository.listByStatuses(['DEAD']));
  }

  async requeue(id: string, actorUserId = 'system', reason = 'manual_retry'): Promise<OutboxEntry> {
    const requeued = await this.repository.manualRequeue(id, actorUserId, reason);
    if (!requeued) throw new Error(`Outbox entry ${id} is not eligible for manual retry.`);
    return this.findOrThrow(id);
  }

  async listPending(): Promise<OutboxEntry[]> {
    return this.toEntries(await this.repository.listByStatuses(['PENDING', 'PROCESSING', 'RETRY']));
  }

  async listManualReview(): Promise<OutboxEntry[]> {
    return this.toEntries(await this.repository.listByStatuses(['MANUAL_REVIEW']));
  }

  async list(): Promise<OutboxEntry[]> {
    return this.toEntries(await this.repository.listByStatuses([
      'PENDING',
      'PROCESSING',
      'RETRY',
      'SENT',
      'CONFIRMED',
      'MANUAL_REVIEW',
      'DEAD',
    ], 500));
  }

  async getByDeal(dealId: string): Promise<OutboxEntry[]> {
    return this.toEntries(await this.repository.getByDeal(dealId));
  }

  async stats() {
    return this.repository.stats();
  }

  private enqueueInput(params: EnqueueParams): EnqueueOutboxInput {
    const materialPayload: Prisma.InputJsonObject = {
      ...(params.payload as Prisma.InputJsonObject),
      ...(params.triggeredByUserId ? { triggeredByUserId: params.triggeredByUserId } : {}),
    };
    return {
      type: params.type,
      dealId: params.dealId,
      payload: materialPayload,
      idempotencyKey: params.idempotencyKey ?? this.derivedIdempotencyKey(params.type, params.dealId, materialPayload),
      maxRetries: params.maxRetries,
      correlationId: params.correlationId,
      auditId: params.auditId,
    };
  }

  private derivedIdempotencyKey(type: string, dealId: string | undefined, payload: Prisma.InputJsonValue): string {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(stable({ type, dealId: dealId ?? null, payload })))
      .digest('hex');
    return `outbox:${type}:${dealId ?? 'global'}:${fingerprint}`;
  }

  private async findOrThrow(id: string): Promise<OutboxEntry> {
    const entry = await this.repository.findById(id);
    if (!entry) throw new Error(`Outbox entry ${id} not found`);
    return this.toEntry(entry);
  }

  private toEntries(entries: DurableOutboxEntry[]): OutboxEntry[] {
    return entries.map((entry) => this.toEntry(entry));
  }

  private toEntry(entry: DurableOutboxEntry): OutboxEntry {
    const payload = entry.payload && typeof entry.payload === 'object' && !Array.isArray(entry.payload)
      ? entry.payload as Record<string, unknown>
      : entry.payload;
    const triggeredByUserId = payload && typeof payload === 'object' && 'triggeredByUserId' in payload
      ? String(payload.triggeredByUserId ?? '') || undefined
      : undefined;
    return {
      id: entry.id,
      type: entry.type,
      dealId: entry.dealId ?? undefined,
      payload,
      status: entry.status,
      triggeredByUserId,
      idempotencyKey: entry.idempotencyKey ?? undefined,
      maxRetries: entry.maxRetries,
      nextRetryAt: entry.nextRetryAt?.toISOString(),
      createdAt: entry.createdAt.toISOString(),
      sentAt: entry.sentAt?.toISOString(),
      confirmedAt: entry.confirmedAt?.toISOString(),
      failedAt: entry.failedAt?.toISOString(),
      retryCount: entry.retryCount,
      lastError: entry.lastError ?? undefined,
    };
  }
}

function isRepository(value: OutboxRepository | PrismaService): value is OutboxRepository {
  return typeof (value as OutboxRepository).claimBatch === 'function'
    && typeof (value as OutboxRepository).completeClaim === 'function';
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  }
  return value;
}
