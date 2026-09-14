import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../common/types/request-user';
import { StaffAuthorityPrismaService } from '../staff-access/staff-authority-prisma.service';
import type { FounderControlMutationCommand, FounderControlRecordDto, FounderControlRecordType } from './founder-control.types';

type RecordRow = {
  id: string;
  record_type: string;
  record_key: string;
  payload: unknown;
  status: string;
  source: string;
  version: bigint;
  updated_at: Date;
};

type MutationRow = RecordRow & { mutation_kind: 'APPLIED' | 'REPLAY' };

export class FounderControlRepositoryError extends Error {
  constructor(readonly code: 'VERSION_CONFLICT' | 'IDEMPOTENCY_CONFLICT', message: string) {
    super(message);
    this.name = 'FounderControlRepositoryError';
  }
}

function databaseCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; meta?: unknown };
  if (candidate.meta && typeof candidate.meta === 'object') {
    const meta = candidate.meta as Record<string, unknown>;
    for (const key of ['code', 'database_error_code', 'dbErrorCode', 'sqlState']) {
      if (typeof meta[key] === 'string') return meta[key] as string;
    }
  }
  return typeof candidate.code === 'string' ? candidate.code : null;
}

type EventRow = {
  id: string;
  record_type: string;
  record_key: string;
  action: string;
  result_status: string;
  reason: string;
  actor_user_id: string;
  correlation_id: string;
  aggregate_version: bigint;
  created_at: Date;
  hash: string;
  prev_hash: string | null;
};

function sessionId(user: RequestUser): string {
  if (!user.sessionId?.trim()) throw new Error('Authenticated session is required for founder control.');
  return user.sessionId;
}

function toDto(row: RecordRow): FounderControlRecordDto {
  return Object.freeze({
    id: row.id,
    recordType: row.record_type as FounderControlRecordType,
    recordKey: row.record_key,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    status: row.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
    source: row.source,
    version: row.version.toString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

@Injectable()
export class FounderControlRepository {
  constructor(private readonly prisma: StaffAuthorityPrismaService) {}

  async list(user: RequestUser, recordType?: FounderControlRecordType): Promise<FounderControlRecordDto[]> {
    const rows = await this.prisma.$queryRaw<RecordRow[]>(Prisma.sql`
      SELECT * FROM auth.founder_control_list(${user.id}, ${sessionId(user)}, ${recordType ?? null})
    `);
    return rows.map(toDto);
  }

  async events(user: RequestUser, limit: number) {
    const rows = await this.prisma.$queryRaw<EventRow[]>(Prisma.sql`
      SELECT * FROM auth.founder_control_event_list(${user.id}, ${sessionId(user)}, ${limit})
    `);
    return rows.map((row) => Object.freeze({
      id: row.id,
      recordType: row.record_type,
      recordKey: row.record_key,
      action: row.action,
      resultStatus: row.result_status,
      reason: row.reason,
      actorUserId: row.actor_user_id,
      correlationId: row.correlation_id,
      aggregateVersion: row.aggregate_version.toString(),
      createdAt: row.created_at.toISOString(),
      hash: row.hash,
      prevHash: row.prev_hash,
    }));
  }

  async upsert(user: RequestUser, command: FounderControlMutationCommand) {
    try {
      const rows = await this.prisma.$queryRaw<MutationRow[]>(Prisma.sql`
        SELECT * FROM auth.founder_control_upsert(
          ${user.id}, ${sessionId(user)}, ${command.recordType}, ${command.recordKey},
          CAST(${JSON.stringify(command.payload)} AS jsonb), ${command.status}, ${command.source},
          ${command.reason}, ${BigInt(command.expectedVersion)}, ${command.idempotencyKey}, ${command.correlationId}
        )
      `);
      const row = rows[0];
      if (!row) throw new Error('Founder control mutation returned no row.');
      return Object.freeze({ kind: row.mutation_kind, record: toDto(row) });
    } catch (error) {
      const code = databaseCode(error);
      if (code === '40001') throw new FounderControlRepositoryError('VERSION_CONFLICT', 'Founder control record changed; refresh and retry.');
      if (code === '23505') throw new FounderControlRepositoryError('IDEMPOTENCY_CONFLICT', 'Idempotency key was already used for a different command.');
      throw error;
    }
  }
}
