import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { RlsTransactionService } from '../../common/prisma/rls-transaction.service';
import type { RequestUser } from '../../common/types/request-user';
import type { DealRegistryQueryDto } from './dto/deal-registry-query.dto';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SIGNED_BIGINT = 9_223_372_036_854_775_807n;
const STATUS_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const CURSOR_ID_PATTERN = /^[^\u0000-\u001F\u007F]{1,200}$/;

type RegistryFilters = Readonly<{
  statuses: readonly string[];
  actionable: boolean | undefined;
  culture: string | null;
  region: string | null;
  role: string | null;
  deadlineBefore: Date | null;
  minMoneyKopecks: bigint | null;
}>;

type RegistryCursor = Readonly<{
  priorityRank: number;
  slaAt: Date | null;
  moneyKopecks: bigint;
  updatedAt: Date;
  id: string;
}>;

type CursorPayload = Readonly<{
  v: 1;
  f: string;
  p: number;
  s: string | null;
  m: string;
  u: string;
  i: string;
}>;

type RegistryRow = Readonly<{
  deal_id: string;
  deal_number: string | null;
  deal_status: string;
  culture: string | null;
  crop_class: string | null;
  region: string | null;
  volume_tons: number | null;
  total_kopecks: bigint | null;
  currency: string;
  deal_version: bigint;
  updated_at: Date;
  next_action: string | null;
  sla_at: Date | null;
  my_role: string;
  my_access_level: string;
  priority_reason: string;
  priority_rank: number;
}>;

@Injectable()
export class DealRegistryQueryService {
  constructor(private readonly rls: RlsTransactionService) {}

  async listAccessible(query: DealRegistryQueryDto, user: RequestUser) {
    const limit = Math.min(Math.max(Math.trunc(query.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
    const filters = normalizeFilters(query);
    const filterFingerprint = fingerprintFilters(filters);
    const cursor = query.cursor ? decodeCursor(query.cursor, filterFingerprint) : null;

    const rows = await this.rls.withTrustedContext(user, async (tx) => {
      const statusesSql = filters.statuses.length > 0
        ? Prisma.sql`ARRAY[${Prisma.join([...filters.statuses])}]::text[]`
        : Prisma.sql`NULL::text[]`;
      const actionableSql = filters.actionable === undefined
        ? Prisma.sql`NULL::boolean`
        : Prisma.sql`${filters.actionable}::boolean`;
      const cultureSql = filters.culture === null
        ? Prisma.sql`NULL::text`
        : Prisma.sql`${filters.culture}::text`;
      const regionSql = filters.region === null
        ? Prisma.sql`NULL::text`
        : Prisma.sql`${filters.region}::text`;
      const roleSql = filters.role === null
        ? Prisma.sql`NULL::text`
        : Prisma.sql`${filters.role}::text`;
      const deadlineSql = filters.deadlineBefore === null
        ? Prisma.sql`NULL::timestamptz`
        : Prisma.sql`${filters.deadlineBefore}::timestamptz`;
      const minimumMoneySql = filters.minMoneyKopecks === null
        ? Prisma.sql`NULL::bigint`
        : Prisma.sql`${filters.minMoneyKopecks}::bigint`;
      const cursorPrioritySql = cursor === null
        ? Prisma.sql`NULL::integer`
        : Prisma.sql`${cursor.priorityRank}::integer`;
      const cursorSlaIsNullSql = cursor === null
        ? Prisma.sql`NULL::boolean`
        : Prisma.sql`${cursor.slaAt === null}::boolean`;
      const cursorSlaSql = cursor?.slaAt
        ? Prisma.sql`${cursor.slaAt}::timestamptz`
        : Prisma.sql`NULL::timestamptz`;
      const cursorMoneySql = cursor === null
        ? Prisma.sql`NULL::bigint`
        : Prisma.sql`${cursor.moneyKopecks}::bigint`;
      const cursorUpdatedSql = cursor
        ? Prisma.sql`${cursor.updatedAt}::timestamptz`
        : Prisma.sql`NULL::timestamptz`;
      const cursorIdSql = cursor
        ? Prisma.sql`${cursor.id}::text`
        : Prisma.sql`NULL::text`;

      return tx.$queryRaw<RegistryRow[]>(Prisma.sql`
        SELECT *
        FROM public.app_deal_registry_page(
          ${limit + 1}::integer,
          ${statusesSql},
          ${actionableSql},
          ${cultureSql},
          ${regionSql},
          ${roleSql},
          ${deadlineSql},
          ${minimumMoneySql},
          ${cursorPrioritySql},
          ${cursorSlaIsNullSql},
          ${cursorSlaSql},
          ${cursorMoneySql},
          ${cursorUpdatedSql},
          ${cursorIdSql}
        )
      `);
    });

    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const items = pageRows.map(toRegistryItem);
    const last = pageRows.at(-1);
    const nextCursor = hasMore && last
      ? encodeCursor({
          priorityRank: last.priority_rank,
          slaAt: last.sla_at,
          moneyKopecks: last.total_kopecks ?? -1n,
          updatedAt: last.updated_at,
          id: last.deal_id,
        }, filterFingerprint)
      : null;

    return {
      count: items.length,
      items,
      hasMore,
      nextCursor,
      pageInfo: {
        limit,
        returned: items.length,
        hasMore,
        nextCursor,
        order: [
          'priorityRank:asc',
          'deadlineAt:asc:nulls-last',
          'moneyImpactKopecks:desc:nulls-last',
          'updatedAt:desc',
          'id:asc',
        ],
      },
      appliedFilters: {
        status: filters.statuses,
        actionable: filters.actionable ?? null,
        culture: filters.culture,
        region: filters.region,
        role: filters.role,
        deadlineBefore: filters.deadlineBefore?.toISOString() ?? null,
        minMoneyKopecks: filters.minMoneyKopecks?.toString() ?? null,
      },
    };
  }
}

function normalizeFilters(query: DealRegistryQueryDto): RegistryFilters {
  const statuses = [...new Set(
    (query.status ?? '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  )];
  if (statuses.length > 20 || statuses.some((status) => !STATUS_PATTERN.test(status))) {
    throw new BadRequestException({
      code: 'INVALID_DEAL_REGISTRY_STATUS_FILTER',
      message: 'Status filter must contain at most 20 canonical status identifiers.',
    });
  }

  const deadlineBefore = query.deadlineBefore ? new Date(query.deadlineBefore) : null;
  if (deadlineBefore && Number.isNaN(deadlineBefore.getTime())) {
    throw new BadRequestException({ code: 'INVALID_DEAL_REGISTRY_DEADLINE' });
  }

  const minMoneyKopecks = query.minMoneyKopecks === undefined
    ? null
    : BigInt(query.minMoneyKopecks);
  if (minMoneyKopecks !== null && minMoneyKopecks > MAX_SIGNED_BIGINT) {
    throw new BadRequestException({ code: 'INVALID_DEAL_REGISTRY_MIN_MONEY' });
  }

  return Object.freeze({
    statuses: Object.freeze(statuses.sort()),
    actionable: query.actionable,
    culture: normalizeTextFilter(query.culture, 'culture'),
    region: normalizeTextFilter(query.region, 'region'),
    role: query.role?.trim() || null,
    deadlineBefore,
    minMoneyKopecks,
  });
}

function normalizeTextFilter(value: string | undefined, field: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (/\p{Cc}/u.test(normalized)) {
    throw new BadRequestException({ code: 'INVALID_DEAL_REGISTRY_TEXT_FILTER', field });
  }
  return normalized;
}

function fingerprintFilters(filters: RegistryFilters): string {
  return createHash('sha256').update(JSON.stringify({
    statuses: filters.statuses,
    actionable: filters.actionable ?? null,
    culture: filters.culture,
    region: filters.region,
    role: filters.role,
    deadlineBefore: filters.deadlineBefore?.toISOString() ?? null,
    minMoneyKopecks: filters.minMoneyKopecks?.toString() ?? null,
  })).digest('hex');
}

function cursorSecret(): string {
  const secret = process.env.DEAL_REGISTRY_CURSOR_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new InternalServerErrorException({ code: 'DEAL_REGISTRY_CURSOR_SECRET_REQUIRED' });
  }
  return secret;
}

function signCursor(encoded: string): string {
  return createHmac('sha256', cursorSecret()).update(encoded).digest('base64url');
}

function encodeCursor(cursor: RegistryCursor, filterFingerprint: string): string {
  const payload: CursorPayload = {
    v: 1,
    f: filterFingerprint,
    p: cursor.priorityRank,
    s: cursor.slaAt?.toISOString() ?? null,
    m: cursor.moneyKopecks.toString(),
    u: cursor.updatedAt.toISOString(),
    i: cursor.id,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${signCursor(encoded)}`;
}

function decodeCursor(value: string, expectedFilterFingerprint: string): RegistryCursor {
  try {
    const [encoded, signature, extra] = value.split('.');
    if (!encoded || !signature || extra || value.length > 4096) throw new Error('invalid encoding');
    const actual = Buffer.from(signature, 'base64url');
    const expected = Buffer.from(signCursor(encoded), 'base64url');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error('invalid signature');
    }

    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as Partial<CursorPayload>;
    if (
      payload.v !== 1
      || typeof payload.f !== 'string'
      || payload.f !== expectedFilterFingerprint
      || !Number.isInteger(payload.p)
      || typeof payload.m !== 'string'
      || !/^-?\d+$/.test(payload.m)
      || typeof payload.u !== 'string'
      || typeof payload.i !== 'string'
      || !CURSOR_ID_PATTERN.test(payload.i)
      || (payload.s !== null && typeof payload.s !== 'string')
    ) {
      if (payload.f && payload.f !== expectedFilterFingerprint) {
        throw new BadRequestException({ code: 'DEAL_REGISTRY_CURSOR_FILTER_MISMATCH' });
      }
      throw new Error('invalid cursor payload');
    }
    const updatedAt = new Date(payload.u);
    const slaAt = payload.s === null ? null : new Date(payload.s);
    const moneyKopecks = BigInt(payload.m);
    if (Number.isNaN(updatedAt.getTime()) || (slaAt && Number.isNaN(slaAt.getTime()))) {
      throw new Error('invalid cursor timestamp');
    }
    return Object.freeze({
      priorityRank: payload.p as number,
      slaAt,
      moneyKopecks,
      updatedAt,
      id: payload.i,
    });
  } catch (error) {
    if (error instanceof BadRequestException) throw error;
    throw new BadRequestException({
      code: 'INVALID_DEAL_REGISTRY_CURSOR',
      message: 'Registry cursor is malformed, unsigned or unsupported.',
    });
  }
}

function toRegistryItem(row: RegistryRow) {
  const exactMoney = row.total_kopecks?.toString() ?? null;
  const legacyMoney = row.total_kopecks !== null && row.total_kopecks <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(row.total_kopecks)
    : null;
  const legacyVersion = row.deal_version <= BigInt(Number.MAX_SAFE_INTEGER)
    ? Number(row.deal_version)
    : null;

  return {
    id: row.deal_id,
    dealNumber: row.deal_number,
    status: row.deal_status,
    culture: row.culture,
    cropClass: row.crop_class,
    region: row.region,
    volumeTons: row.volume_tons === null ? null : String(row.volume_tons),
    totalKopecks: legacyMoney,
    moneyImpactKopecks: exactMoney,
    currency: row.currency,
    version: legacyVersion,
    updatedAt: row.updated_at.toISOString(),
    nextAction: row.next_action,
    deadlineAt: row.sla_at?.toISOString() ?? null,
    priorityReason: row.priority_reason,
    priorityRank: row.priority_rank,
    myRole: row.my_role,
    myAccessLevel: row.my_access_level,
  };
}
