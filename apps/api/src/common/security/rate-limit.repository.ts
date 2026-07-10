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
  table_ready: boolean;
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
    if (String(process.env.NODE_ENV ?? '').toLowerCase() !== 'production') return;
    const rows = await this.prisma.$queryRaw<StoreReadinessRow[]>(Prisma.sql`
      SELECT
        to_regclass('security.api_rate_limit_buckets') IS NOT NULL AS table_ready,
        has_schema_privilege(current_user, 'security', 'USAGE') AS schema_usage,
        has_function_privilege(
          current_user,
          'security.consume_api_rate_limit(text,text,integer)',
          'EXECUTE'
        ) AS can_execute_consume,
        has_function_privilege(
          current_user,
          'security.cleanup_api_rate_limit_buckets(integer)',
          'EXECUTE'
        ) AS can_execute_cleanup,
        has_table_privilege(current_user, 'security.api_rate_limit_buckets', 'SELECT') AS can_select,
        has_table_privilege(current_user, 'security.api_rate_limit_buckets', 'INSERT') AS can_insert,
        has_table_privilege(current_user, 'security.api_rate_limit_buckets', 'UPDATE') AS can_update,
        has_table_privilege(current_user, 'security.api_rate_limit_buckets', 'DELETE') AS can_delete
    `);
    const readiness = rows[0];
    const directTableAccess = !!readiness && (
      readiness.can_select || readiness.can_insert || readiness.can_update || readiness.can_delete
    );
    if (
      !readiness
      || !readiness.table_ready
      || !readiness.schema_usage
      || !readiness.can_execute_consume
      || !readiness.can_execute_cleanup
      || directTableAccess
    ) {
      throw new Error('Distributed rate-limit function boundary is not ready for production enforcement.');
    }
  }

  async consume(input: ConsumeRateLimitInput): Promise<RateLimitBucketResult> {
    const rows = await this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      SELECT request_count, expires_at
      FROM security.consume_api_rate_limit(
        ${input.routeName}::text,
        ${input.keyHash}::text,
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
