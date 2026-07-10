import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ConsumeRateLimitInput = Readonly<{
  routeName: string;
  keyHash: string;
  windowSeconds: number;
}>;

export type RateLimitBucketResult = Readonly<{
  count: number;
  resetAt: Date;
}>;

type BucketRow = {
  request_count: number;
  expires_at: Date;
};

type StoreReadinessRow = {
  current_user: string;
  table_ready: boolean;
  consume_ready: boolean;
  cleanup_ready: boolean;
  schema_usage: boolean;
  can_execute_consume: boolean;
  can_execute_cleanup: boolean;
  can_select: boolean;
  can_insert: boolean;
  can_update: boolean;
  can_delete: boolean;
};

@Injectable()
export class RateLimitRepository implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const production = String(process.env.NODE_ENV ?? '').toLowerCase() === 'production';
    const enforced = production
      || String(process.env.RATE_LIMIT_BACKEND_ENFORCED ?? '').toLowerCase() === 'true';
    if (enforced) await this.verifyReadiness();
  }

  async verifyReadiness(): Promise<StoreReadinessRow> {
    let rows: StoreReadinessRow[];
    try {
      rows = await this.prisma.$queryRaw<StoreReadinessRow[]>(Prisma.sql`
        WITH target AS (
          SELECT
            to_regclass('security.api_rate_limit_buckets') AS table_oid,
            to_regprocedure('security.consume_api_rate_limit(text,text,integer)') AS consume_oid,
            to_regprocedure('security.cleanup_api_rate_limit_buckets(integer)') AS cleanup_oid
        )
        SELECT
          current_user,
          table_oid IS NOT NULL AS table_ready,
          consume_oid IS NOT NULL AS consume_ready,
          cleanup_oid IS NOT NULL AS cleanup_ready,
          has_schema_privilege(current_user, 'security', 'USAGE') AS schema_usage,
          CASE WHEN consume_oid IS NULL THEN FALSE
            ELSE has_function_privilege(current_user, consume_oid, 'EXECUTE') END AS can_execute_consume,
          CASE WHEN cleanup_oid IS NULL THEN FALSE
            ELSE has_function_privilege(current_user, cleanup_oid, 'EXECUTE') END AS can_execute_cleanup,
          CASE WHEN table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, table_oid, 'SELECT') END AS can_select,
          CASE WHEN table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, table_oid, 'INSERT') END AS can_insert,
          CASE WHEN table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, table_oid, 'UPDATE') END AS can_update,
          CASE WHEN table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, table_oid, 'DELETE') END AS can_delete
        FROM target
      `);
    } catch {
      throw new Error('Distributed rate-limit execution boundary is unavailable.');
    }

    const readiness = rows[0];
    if (
      !readiness
      || !readiness.table_ready
      || !readiness.consume_ready
      || !readiness.cleanup_ready
      || !readiness.schema_usage
      || !readiness.can_execute_consume
      || !readiness.can_execute_cleanup
      || readiness.can_select
      || readiness.can_insert
      || readiness.can_update
      || readiness.can_delete
    ) {
      throw new Error(`Distributed rate-limit execution boundary is invalid: ${JSON.stringify(readiness ?? null)}`);
    }
    return readiness;
  }

  async consume(input: ConsumeRateLimitInput): Promise<RateLimitBucketResult> {
    const rows = await this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT request_count, expires_at
      FROM security.consume_api_rate_limit(
        ${input.routeName},
        ${input.keyHash},
        ${input.windowSeconds}::integer
      )
    `);

    const row = rows[0];
    if (!row) throw new Error('Rate-limit bucket consume returned no row.');
    return { count: Number(row.request_count), resetAt: row.expires_at };
  }

  async deleteExpired(limit = 500): Promise<number> {
    const safeLimit = Math.min(5_000, Math.max(1, Math.floor(limit)));
    const rows = await this.prisma.$queryRaw<Array<{ deleted_count: number }>>(Prisma.sql`
      SELECT security.cleanup_api_rate_limit_buckets(${safeLimit}::integer) AS deleted_count
    `);
    return Number(rows[0]?.deleted_count ?? 0);
  }
}
