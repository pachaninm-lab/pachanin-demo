import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { RequestUser } from '../../common/types/request-user';
import { stableJson } from '../auth/auth-crypto';
import { StaffAccessRepository } from './staff-access.repository';
import { StaffAccessService } from './staff-access.service';
import { StaffPermission } from './staff-access.types';

const SENSITIVE_KEY = /(secret|password|token|authorization|cookie|otp|totp|backup.?code|private.?key|database.?url)/i;

export type StaffAuditQuery = {
  actorUserId?: string;
  accessSessionId?: string;
  organizationId?: string;
  correlationId?: string;
  action?: string;
  outcome?: string;
  from?: string;
  to?: string;
  limit?: string | number;
  cursor?: string;
};

type StaffAuditRow = {
  id: string;
  actor_user_id: string;
  staff_role: string;
  access_session_id: string | null;
  grant_id: string | null;
  effective_tenant_id: string | null;
  effective_organization_id: string | null;
  effective_user_id: string | null;
  effective_role: string | null;
  access_mode: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  outcome: string;
  reason: string | null;
  ticket_id: string | null;
  correlation_id: string;
  metadata: unknown;
  prev_hash: string | null;
  hash: string;
  created_at: Date;
};

@Injectable()
export class StaffAuditService {
  constructor(
    private readonly repository: StaffAccessRepository,
    private readonly access: StaffAccessService,
  ) {}

  async search(user: RequestUser, query: StaffAuditQuery) {
    await this.access.requirePermission(user, StaffPermission.AUDIT_READ);
    const limit = this.limit(query.limit);
    const from = this.date(query.from, 'from');
    const to = this.date(query.to, 'to');
    if (from && to && from >= to) throw new BadRequestException('from must be earlier than to');
    const cursor = this.decodeCursor(query.cursor);

    const actorFilter = query.actorUserId ? Prisma.sql` AND actor_user_id = ${query.actorUserId}` : Prisma.empty;
    const sessionFilter = query.accessSessionId ? Prisma.sql` AND access_session_id = ${query.accessSessionId}` : Prisma.empty;
    const organizationFilter = query.organizationId ? Prisma.sql` AND effective_organization_id = ${query.organizationId}` : Prisma.empty;
    const correlationFilter = query.correlationId ? Prisma.sql` AND correlation_id = ${query.correlationId}` : Prisma.empty;
    const actionFilter = query.action ? Prisma.sql` AND action = ${query.action}` : Prisma.empty;
    const outcomeFilter = query.outcome ? Prisma.sql` AND outcome = ${query.outcome}` : Prisma.empty;
    const fromFilter = from ? Prisma.sql` AND created_at >= ${from}` : Prisma.empty;
    const toFilter = to ? Prisma.sql` AND created_at < ${to}` : Prisma.empty;
    const cursorFilter = cursor
      ? Prisma.sql` AND (created_at, id) < (${cursor.createdAt}, ${cursor.id})`
      : Prisma.empty;

    const rows = await this.repository.prisma.$queryRaw<StaffAuditRow[]>(Prisma.sql`
      SELECT
        id,
        actor_user_id,
        staff_role,
        access_session_id,
        grant_id,
        effective_tenant_id,
        effective_organization_id,
        effective_user_id,
        effective_role,
        access_mode,
        action,
        resource_type,
        resource_id,
        outcome,
        reason,
        ticket_id,
        correlation_id,
        metadata,
        prev_hash,
        hash,
        created_at
      FROM auth.staff_access_events
      WHERE TRUE${actorFilter}${sessionFilter}${organizationFilter}${correlationFilter}
        ${actionFilter}${outcomeFilter}${fromFilter}${toFilter}${cursorFilter}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `);

    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit).map((row) => ({
      ...row,
      metadata: this.redact(row.metadata),
    }));
    const last = page.at(-1);
    return {
      items: page,
      nextCursor: hasMore && last
        ? this.encodeCursor({ createdAt: last.created_at, id: last.id })
        : null,
    };
  }

  async verifyActorChain(user: RequestUser, actorUserId: string, maxEventsInput?: string | number) {
    await this.access.requirePermission(user, StaffPermission.AUDIT_READ);
    const maxEvents = Math.min(Math.max(Number(maxEventsInput || 1_000), 1), 10_000);
    const rows = await this.repository.prisma.$queryRaw<StaffAuditRow[]>(Prisma.sql`
      SELECT *
      FROM auth.staff_access_events
      WHERE actor_user_id = ${actorUserId}
      ORDER BY created_at ASC, id ASC
      LIMIT ${maxEvents}
    `);

    let previousHash: string | null = null;
    for (const row of rows) {
      if (row.prev_hash !== previousHash) {
        return { valid: false, checked: rows.length, failedEventId: row.id, reason: 'PREVIOUS_HASH_MISMATCH' };
      }
      const payload = {
        id: row.id,
        actorUserId: row.actor_user_id,
        staffRole: row.staff_role,
        accessSessionId: row.access_session_id,
        grantId: row.grant_id,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        outcome: row.outcome,
        reason: row.reason,
        ticketId: row.ticket_id,
        correlationId: row.correlation_id,
        metadata: row.metadata ?? {},
        prevHash: row.prev_hash,
      };
      const computed = createHash('sha256').update(stableJson(payload), 'utf8').digest('hex');
      if (computed !== row.hash) {
        return { valid: false, checked: rows.length, failedEventId: row.id, reason: 'HASH_MISMATCH' };
      }
      previousHash = row.hash;
    }
    return { valid: true, checked: rows.length, lastHash: previousHash };
  }

  private limit(value: string | number | undefined) {
    const number = Number(value ?? 50);
    if (!Number.isInteger(number) || number < 1 || number > 100) {
      throw new BadRequestException('limit must be an integer between 1 and 100');
    }
    return number;
  }

  private date(value: string | undefined, field: string) {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new BadRequestException(`${field} must be an ISO date`);
    return date;
  }

  private encodeCursor(input: { createdAt: Date; id: string }) {
    return Buffer.from(JSON.stringify({ createdAt: input.createdAt.toISOString(), id: input.id }), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
    if (!cursor) return null;
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { createdAt?: string; id?: string };
      const createdAt = new Date(String(parsed.createdAt ?? ''));
      const id = String(parsed.id ?? '');
      if (!Number.isFinite(createdAt.getTime()) || !id) throw new Error('invalid');
      return { createdAt, id };
    } catch {
      throw new BadRequestException('Invalid audit cursor');
    }
  }

  private redact(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.redact(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, nested]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[REDACTED]' : this.redact(nested),
    ]));
  }
}
