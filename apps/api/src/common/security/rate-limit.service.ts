import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export type RateLimitConsumeInput = {
  policy: string;
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
  blockSeconds?: number;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  limit_count: number;
  reset_at: Date;
  retry_after_seconds: number;
};

type BackendBoundaryRow = {
  current_user: string;
  function_exists: boolean;
  table_exists: boolean;
  schema_usage: boolean;
  can_execute: boolean;
  can_select_table: boolean;
};

@Injectable()
export class RateLimitService implements OnModuleInit {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly pepper: string;
  private requestsSinceCleanup = 0;

  constructor(private readonly prisma: PrismaService) {
    const production = String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    const configuredPepper = String(process.env.RATE_LIMIT_KEY_PEPPER ?? '').trim();
    if (production && configuredPepper.length < 32) {
      throw new Error('RATE_LIMIT_KEY_PEPPER with at least 32 characters is required in production.');
    }
    this.pepper = configuredPepper || 'non-production-rate-limit-pepper';
  }

  async onModuleInit(): Promise<void> {
    const production = String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    const enforced = production
      || String(process.env.RATE_LIMIT_BACKEND_ENFORCED ?? '').toLowerCase() === 'true';
    if (enforced) await this.verifyBackendBoundary();
  }

  async verifyBackendBoundary(): Promise<BackendBoundaryRow> {
    let rows: BackendBoundaryRow[];
    try {
      rows = await this.prisma.$queryRaw<BackendBoundaryRow[]>(Prisma.sql`
        WITH target AS (
          SELECT
            to_regprocedure('security.consume_rate_limit(text,text,integer,integer,integer)') AS function_oid,
            to_regclass('security.rate_limit_buckets') AS table_oid
        )
        SELECT
          current_user,
          function_oid IS NOT NULL AS function_exists,
          table_oid IS NOT NULL AS table_exists,
          has_schema_privilege(current_user, 'security', 'USAGE') AS schema_usage,
          CASE
            WHEN function_oid IS NULL THEN FALSE
            ELSE has_function_privilege(current_user, function_oid, 'EXECUTE')
          END AS can_execute,
          CASE
            WHEN table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, table_oid, 'SELECT')
          END AS can_select_table
        FROM target
      `);
    } catch {
      throw new Error('Rate-limit PostgreSQL principal boundary is invalid or inaccessible.');
    }
    const row = rows[0];
    if (
      !row
      || !row.function_exists
      || !row.table_exists
      || !row.schema_usage
      || !row.can_execute
      || row.can_select_table
    ) {
      throw new Error(
        `Rate-limit PostgreSQL principal boundary is invalid: ${JSON.stringify(row ?? null)}`,
      );
    }
    this.logger.log(`Rate-limit backend verified for principal ${row.current_user}`);
    return row;
  }

  async consume(input: RateLimitConsumeInput): Promise<RateLimitDecision> {
    const policy = normalizePolicy(input.policy);
    const limit = boundedInteger(input.limit, 1, 100_000, 1);
    const windowSeconds = boundedInteger(input.windowSeconds, 1, 86_400, 60);
    const blockSeconds = boundedInteger(input.blockSeconds ?? 0, 0, 86_400, 0);
    const keyHash = createHmac('sha256', this.pepper)
      .update(`${policy}\0${input.scope}\0${input.subject}`)
      .digest('hex');

    let rows: RateLimitRow[];
    try {
      rows = await this.prisma.$queryRaw<RateLimitRow[]>(Prisma.sql`
        SELECT *
        FROM security.consume_rate_limit(
          ${policy},
          ${keyHash},
          ${limit}::integer,
          ${windowSeconds}::integer,
          ${blockSeconds}::integer
        )
      `);
    } catch (error) {
      this.logger.error('Distributed rate-limit backend is unavailable.', error instanceof Error ? error.stack : String(error));
      throw new ServiceUnavailableException({
        code: 'RATE_LIMIT_BACKEND_UNAVAILABLE',
        message: 'Request protection backend is unavailable.',
      });
    }

    const row = rows[0];
    if (!row) throw new ServiceUnavailableException({ code: 'RATE_LIMIT_EMPTY_DECISION' });
    this.scheduleCleanup();
    return {
      allowed: Boolean(row.allowed),
      remaining: Number(row.remaining),
      limit: Number(row.limit_count),
      resetAt: row.reset_at.getTime(),
      retryAfterSeconds: Number(row.retry_after_seconds),
    };
  }

  async cleanup(retentionSeconds = 172_800): Promise<number> {
    const retention = boundedInteger(retentionSeconds, 3_600, 2_592_000, 172_800);
    const rows = await this.prisma.$queryRaw<Array<{ deleted_count: number }>>(Prisma.sql`
      SELECT security.cleanup_rate_limit_buckets(${retention}::integer) AS deleted_count
    `);
    return Number(rows[0]?.deleted_count ?? 0);
  }

  private scheduleCleanup(): void {
    this.requestsSinceCleanup += 1;
    if (this.requestsSinceCleanup < 2_048) return;
    this.requestsSinceCleanup = 0;
    void this.cleanup().catch((error) => {
      this.logger.warn(`Rate-limit cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}

function normalizePolicy(value: string): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z0-9:_-]{1,96}$/.test(normalized)) throw new Error('Invalid rate-limit policy name.');
  return normalized;
}

function boundedInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
