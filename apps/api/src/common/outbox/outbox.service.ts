import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

export type OutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'CONFIRMED'
  | 'FAILED'
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
  nextRetryAt: string;
  createdAt: string;
  sentAt?: string;
  confirmedAt?: string;
  failedAt?: string;
  deadLetterAt?: string;
  retryCount: number;
  lastError?: string;
  correlationId?: string;
  auditId?: string;
  leaseOwner?: string;
  leaseToken?: string;
  leaseExpiresAt?: string;
  redriveCount: number;
  lastRedriveAt?: string;
  lastRedriveBy?: string;
  lastRedriveReason?: string;
  requestFingerprint?: string;
}

export interface OutboxStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  confirmed: number;
  failed: number;
  manualReview: number;
  deadLetter: number;
}

export interface EnqueueOutboxInput {
  type: string;
  dealId?: string;
  payload: unknown;
  triggeredByUserId?: string;
  idempotencyKey?: string;
  maxRetries?: number;
  correlationId?: string;
  auditId?: string;
}

export interface RedriveOutboxInput {
  entryId: string;
  actorUserId: string;
  actorRole: string;
  reason: string;
  idempotencyKey: string;
}

export type RedriveOutboxResult = OutboxEntry & {
  duplicate: boolean;
  redriveAuditId: string;
};

type OutboxRow = Readonly<{
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
  auditId: string | null;
  leaseOwner: string | null;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  redriveCount: number;
  lastRedriveAt: Date | null;
  lastRedriveBy: string | null;
  lastRedriveReason: string | null;
  requestFingerprint: string | null;
  createdAt: Date;
  sentAt: Date | null;
  confirmedAt: Date | null;
  failedAt: Date | null;
  deadLetterAt: Date | null;
}>;

type RedriveAuditRow = Readonly<{
  id: string;
  entryId: string;
  idempotencyKey: string;
}>;

const SAFE_ID = /^[A-Za-z0-9:_.-]{1,240}$/;
const DEFAULT_MAX_RETRIES = 5;
const MAX_LIST_LIMIT = 500;

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: EnqueueOutboxInput): Promise<OutboxEntry> {
    const normalized = {
      type: requiredText(input.type, 'type', 1, 200),
      dealId: optionalId(input.dealId, 'dealId'),
      payload: jsonPayload(input.payload),
      triggeredByUserId: optionalId(input.triggeredByUserId, 'triggeredByUserId'),
      idempotencyKey: optionalId(input.idempotencyKey, 'idempotencyKey'),
      maxRetries: boundedInteger(input.maxRetries, 1, 100, DEFAULT_MAX_RETRIES, 'maxRetries'),
      correlationId: optionalId(input.correlationId, 'correlationId'),
      auditId: optionalId(input.auditId, 'auditId'),
    };
    const requestFingerprint = fingerprint({
      type: normalized.type,
      dealId: normalized.dealId,
      payload: normalized.payload,
      triggeredByUserId: normalized.triggeredByUserId,
      maxRetries: normalized.maxRetries,
      correlationId: normalized.correlationId,
      auditId: normalized.auditId,
    });

    return this.prisma.$transaction(async (tx) => {
      if (normalized.idempotencyKey) {
        await tx.$queryRaw(Prisma.sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${`outbox:enqueue:${normalized.idempotencyKey}`}, 0)
          )
        `);
        const existing = await this.findByIdempotencyKey(tx, normalized.idempotencyKey, true);
        if (existing) {
          this.assertReplay(existing, requestFingerprint);
          return toEntry(existing);
        }
      }

      const id = `outbox:${randomUUID()}`;
      const rows = await tx.$queryRaw<OutboxRow[]>(Prisma.sql`
        INSERT INTO public."outbox_entries" (
          "id", "type", "dealId", "payload", "status", "triggeredByUserId",
          "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt",
          "correlationId", "auditId", "requestFingerprint", "createdAt"
        ) VALUES (
          ${id}, ${normalized.type}, ${normalized.dealId},
          ${JSON.stringify(normalized.payload)}::jsonb, 'PENDING',
          ${normalized.triggeredByUserId}, ${normalized.idempotencyKey},
          ${normalized.maxRetries}, 0, transaction_timestamp(),
          ${normalized.correlationId}, ${normalized.auditId}, ${requestFingerprint},
          transaction_timestamp()
        )
        RETURNING ${outboxColumns()}
      `);
      return toEntry(requireRow(rows[0], 'OUTBOX_ENQUEUE_RESULT_MISSING'));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  }

  async getById(idInput: string): Promise<OutboxEntry> {
    const id = safeId(idInput, 'id');
    const rows = await this.prisma.$queryRaw<OutboxRow[]>(Prisma.sql`
      SELECT ${outboxColumns()}
      FROM public."outbox_entries"
      WHERE "id" = ${id}
    `);
    if (!rows[0]) throw new NotFoundException({ code: 'OUTBOX_ENTRY_NOT_FOUND', id });
    return toEntry(rows[0]);
  }

  async list(limitInput = 100): Promise<OutboxEntry[]> {
    const limit = boundedInteger(limitInput, 1, MAX_LIST_LIMIT, 100, 'limit');
    const rows = await this.prisma.$queryRaw<OutboxRow[]>(Prisma.sql`
      SELECT ${outboxColumns()}
      FROM public."outbox_entries"
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${limit}
    `);
    return rows.map(toEntry);
  }

  async listPending(limitInput = 100): Promise<OutboxEntry[]> {
    return this.listByStatuses(['PENDING', 'PROCESSING'], limitInput);
  }

  async listDead(limitInput = 100): Promise<OutboxEntry[]> {
    return this.listByStatuses(['DEAD_LETTER'], limitInput);
  }

  async listManualReview(limitInput = 100): Promise<OutboxEntry[]> {
    return this.listByStatuses(['MANUAL_REVIEW'], limitInput);
  }

  async getByDeal(dealIdInput: string, limitInput = 100): Promise<OutboxEntry[]> {
    const dealId = safeId(dealIdInput, 'dealId');
    const limit = boundedInteger(limitInput, 1, MAX_LIST_LIMIT, 100, 'limit');
    const rows = await this.prisma.$queryRaw<OutboxRow[]>(Prisma.sql`
      SELECT ${outboxColumns()}
      FROM public."outbox_entries"
      WHERE "dealId" = ${dealId}
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${limit}
    `);
    return rows.map(toEntry);
  }

  async stats(): Promise<OutboxStats> {
    const rows = await this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>(Prisma.sql`
      SELECT "status", COUNT(*)::bigint AS count
      FROM public."outbox_entries"
      GROUP BY "status"
    `);
    const counts = Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
    return {
      total: rows.reduce((sum, row) => sum + Number(row.count), 0),
      pending: counts.PENDING ?? 0,
      processing: counts.PROCESSING ?? 0,
      sent: counts.SENT ?? 0,
      confirmed: counts.CONFIRMED ?? 0,
      failed: counts.FAILED ?? 0,
      manualReview: counts.MANUAL_REVIEW ?? 0,
      deadLetter: counts.DEAD_LETTER ?? 0,
    };
  }

  async redrive(input: RedriveOutboxInput): Promise<RedriveOutboxResult> {
    const normalized = {
      entryId: safeId(input.entryId, 'entryId'),
      actorUserId: safeId(input.actorUserId, 'actorUserId'),
      actorRole: requiredText(input.actorRole, 'actorRole', 2, 100),
      reason: requiredText(input.reason, 'reason', 5, 500),
      idempotencyKey: safeId(input.idempotencyKey, 'idempotencyKey'),
    };

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`outbox:redrive:${normalized.idempotencyKey}`}, 0)
        )
      `);
      const replay = await tx.$queryRaw<RedriveAuditRow[]>(Prisma.sql`
        SELECT "id", "entryId", "idempotencyKey"
        FROM public."outbox_redrive_events"
        WHERE "idempotencyKey" = ${normalized.idempotencyKey}
      `);
      if (replay[0]) {
        if (replay[0].entryId !== normalized.entryId) {
          throw new ConflictException({ code: 'OUTBOX_REDRIVE_IDEMPOTENCY_MISMATCH' });
        }
        const row = await this.lockEntry(tx, normalized.entryId);
        return {
          ...toEntry(row),
          duplicate: true,
          redriveAuditId: replay[0].id,
        };
      }

      const before = await this.lockEntry(tx, normalized.entryId);
      if (before.status === 'SENT' || before.status === 'CONFIRMED') {
        throw new ConflictException({ code: 'OUTBOX_DELIVERY_RECEIPT_IMMUTABLE' });
      }
      if (before.status !== 'DEAD_LETTER') {
        throw new ConflictException({
          code: 'OUTBOX_REDRIVE_STATE_INVALID',
          status: before.status,
        });
      }

      const previous = await tx.$queryRaw<Array<{ hash: string }>>(Prisma.sql`
        SELECT "hash"
        FROM public."outbox_redrive_events"
        WHERE "entryId" = ${normalized.entryId}
        ORDER BY "createdAt" DESC, "id" DESC
        LIMIT 1
      `);
      const prevHash = previous[0]?.hash ?? null;
      const auditId = `outbox-redrive:${randomUUID()}`;
      const auditHash = fingerprint({
        id: auditId,
        entryId: normalized.entryId,
        actorUserId: normalized.actorUserId,
        actorRole: normalized.actorRole,
        reason: normalized.reason,
        idempotencyKey: normalized.idempotencyKey,
        beforeStatus: before.status,
        beforeRetryCount: before.retryCount,
        afterStatus: 'PENDING',
        prevHash,
      });

      const updated = await tx.$queryRaw<OutboxRow[]>(Prisma.sql`
        UPDATE public."outbox_entries"
        SET "status" = 'PENDING',
            "retryCount" = 0,
            "nextRetryAt" = transaction_timestamp(),
            "lastError" = NULL,
            "failedAt" = NULL,
            "deadLetterAt" = NULL,
            "leaseOwner" = NULL,
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "redriveCount" = "redriveCount" + 1,
            "lastRedriveAt" = transaction_timestamp(),
            "lastRedriveBy" = ${normalized.actorUserId},
            "lastRedriveReason" = ${normalized.reason}
        WHERE "id" = ${normalized.entryId}
          AND "status" = 'DEAD_LETTER'
        RETURNING ${outboxColumns()}
      `);
      const row = requireRow(updated[0], 'OUTBOX_REDRIVE_CAS_FAILED');

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO public."outbox_redrive_events" (
          "id", "entryId", "actorUserId", "actorRole", "reason",
          "idempotencyKey", "beforeStatus", "beforeRetryCount",
          "afterStatus", "prevHash", "hash", "createdAt"
        ) VALUES (
          ${auditId}, ${normalized.entryId}, ${normalized.actorUserId},
          ${normalized.actorRole}, ${normalized.reason}, ${normalized.idempotencyKey},
          'DEAD_LETTER', ${before.retryCount}, 'PENDING', ${prevHash},
          ${auditHash}, transaction_timestamp()
        )
      `);
      return { ...toEntry(row), duplicate: false, redriveAuditId: auditId };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
  }

  private async listByStatuses(statuses: OutboxStatus[], limitInput: number): Promise<OutboxEntry[]> {
    const limit = boundedInteger(limitInput, 1, MAX_LIST_LIMIT, 100, 'limit');
    const rows = await this.prisma.$queryRaw<OutboxRow[]>(Prisma.sql`
      SELECT ${outboxColumns()}
      FROM public."outbox_entries"
      WHERE "status" IN (${Prisma.join(statuses)})
      ORDER BY "createdAt" DESC, "id" DESC
      LIMIT ${limit}
    `);
    return rows.map(toEntry);
  }

  private async findByIdempotencyKey(
    tx: Prisma.TransactionClient,
    key: string,
    lock: boolean,
  ): Promise<OutboxRow | null> {
    const suffix = lock ? Prisma.sql` FOR UPDATE` : Prisma.empty;
    const rows = await tx.$queryRaw<OutboxRow[]>(Prisma.sql`
      SELECT ${outboxColumns()}
      FROM public."outbox_entries"
      WHERE "idempotencyKey" = ${key}${suffix}
    `);
    return rows[0] ?? null;
  }

  private async lockEntry(tx: Prisma.TransactionClient, id: string): Promise<OutboxRow> {
    const rows = await tx.$queryRaw<OutboxRow[]>(Prisma.sql`
      SELECT ${outboxColumns()}
      FROM public."outbox_entries"
      WHERE "id" = ${id}
      FOR UPDATE
    `);
    if (!rows[0]) throw new NotFoundException({ code: 'OUTBOX_ENTRY_NOT_FOUND', id });
    return rows[0];
  }

  private assertReplay(existing: OutboxRow, requestFingerprint: string): void {
    if (existing.requestFingerprint && existing.requestFingerprint !== requestFingerprint) {
      throw new ConflictException({ code: 'OUTBOX_IDEMPOTENCY_PAYLOAD_MISMATCH' });
    }
  }
}

function outboxColumns(): Prisma.Sql {
  return Prisma.sql`
    "id", "type", "dealId", "payload", "status", "triggeredByUserId",
    "idempotencyKey", "maxRetries", "retryCount", "nextRetryAt", "lastError",
    "correlationId", "auditId", "leaseOwner", "leaseToken", "leaseExpiresAt",
    "redriveCount", "lastRedriveAt", "lastRedriveBy", "lastRedriveReason",
    "requestFingerprint", "createdAt", "sentAt", "confirmedAt", "failedAt",
    "deadLetterAt"
  `;
}

function toEntry(row: OutboxRow): OutboxEntry {
  const result: OutboxEntry = {
    id: row.id,
    type: row.type,
    payload: row.payload,
    status: statusValue(row.status),
    maxRetries: row.maxRetries,
    retryCount: row.retryCount,
    nextRetryAt: row.nextRetryAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    redriveCount: row.redriveCount,
  };
  assign(result, 'dealId', row.dealId);
  assign(result, 'triggeredByUserId', row.triggeredByUserId);
  assign(result, 'idempotencyKey', row.idempotencyKey);
  assign(result, 'lastError', row.lastError);
  assign(result, 'correlationId', row.correlationId);
  assign(result, 'auditId', row.auditId);
  assign(result, 'leaseOwner', row.leaseOwner);
  assign(result, 'leaseToken', row.leaseToken);
  assign(result, 'lastRedriveBy', row.lastRedriveBy);
  assign(result, 'lastRedriveReason', row.lastRedriveReason);
  assign(result, 'requestFingerprint', row.requestFingerprint);
  assignDate(result, 'leaseExpiresAt', row.leaseExpiresAt);
  assignDate(result, 'sentAt', row.sentAt);
  assignDate(result, 'confirmedAt', row.confirmedAt);
  assignDate(result, 'failedAt', row.failedAt);
  assignDate(result, 'deadLetterAt', row.deadLetterAt);
  assignDate(result, 'lastRedriveAt', row.lastRedriveAt);
  return Object.freeze(result);
}

function statusValue(value: string): OutboxStatus {
  if (
    value === 'PENDING'
    || value === 'PROCESSING'
    || value === 'SENT'
    || value === 'CONFIRMED'
    || value === 'FAILED'
    || value === 'MANUAL_REVIEW'
    || value === 'DEAD_LETTER'
  ) return value;
  throw new Error(`Unsupported outbox status: ${value}`);
}

function jsonPayload(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) throw inputError('payload');
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined || encoded.length > 1_000_000) throw new Error('invalid');
    return JSON.parse(encoded) as Prisma.InputJsonValue;
  } catch {
    throw inputError('payload');
  }
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

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function safeId(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!SAFE_ID.test(normalized)) throw inputError(field);
  return normalized;
}

function optionalId(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  return safeId(value, field);
}

function requiredText(value: unknown, field: string, min: number, max: number): string {
  const normalized = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  if (
    normalized.length < min
    || normalized.length > max
    || /[\u0000-\u001f\u007f]/.test(normalized)
  ) throw inputError(field);
  return normalized;
}

function boundedInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  field: string,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw inputError(field);
  }
  return Number(value);
}

function inputError(field: string): BadRequestException {
  return new BadRequestException({ code: 'OUTBOX_INPUT_INVALID', field });
}

function requireRow(row: OutboxRow | undefined, code: string): OutboxRow {
  if (!row) throw new ConflictException({ code });
  return row;
}

function assign<K extends keyof OutboxEntry>(target: OutboxEntry, key: K, value: string | null): void {
  if (value !== null) (target as Record<string, unknown>)[key] = value;
}

function assignDate<K extends keyof OutboxEntry>(target: OutboxEntry, key: K, value: Date | null): void {
  if (value !== null) (target as Record<string, unknown>)[key] = value.toISOString();
}
