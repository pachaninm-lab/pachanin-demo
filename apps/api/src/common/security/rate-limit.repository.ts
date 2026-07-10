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
        has_table_privilege(current_user, 'security.api_rate_limit_buckets', 'SELECT') AS can_select,
        has_table_privilege(current_user, 'security.api_rate_limit_buckets', 'INSERT') AS can_insert,
        has_table_privilege(current_user, 'security.api_rate_limit_buckets', 'UPDATE') AS can_update,
        has_table_privilege(current_user, 'security.api_rate_limit_buckets', 'DELETE') AS can_delete
    `);
    const readiness = rows[0];
    if (!readiness || Object.values(readiness).some((value) => value !== true)) {
      throw new Error('Distributed rate-limit store is not ready for production enforcement.');
    }
  }

  async consume(input: ConsumeRateLimitInput): Promise<RateLimitBucketResult> {
    const rows = await this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      WITH boundary AS (
        SELECT
          to_timestamp(
            floor(extract(epoch FROM clock_timestamp()) / ${input.windowSeconds})
            * ${input.windowSeconds}
          ) AS window_start
      )
      INSERT INTO security.api_rate_limit_buckets AS bucket (
        route_name,
        key_hash,
        window_start,
        window_seconds,
        request_count,
        expires_at,
        created_at,
        updated_at
      )
      SELECT
        ${input.routeName},
        ${input.keyHash},
        boundary.window_start,
        ${input.windowSeconds},
        1,
        boundary.window_start + make_interval(secs => ${input.windowSeconds}),
        clock_timestamp(),
        clock_timestamp()
      FROM boundary
      ON CONFLICT (route_name, key_hash, window_start)
      DO UPDATE SET
        request_count = bucket.request_count + 1,
        updated_at = clock_timestamp()
      RETURNING request_count, expires_at
    `);

    const row = rows[0];
    if (!row) throw new Error('Rate-limit bucket consume returned no row.');
    return { count: Number(row.request_count), resetAt: row.expires_at };
  }

  async deleteExpired(limit = 500): Promise<number> {
    const safeLimit = Math.min(5_000, Math.max(1, Math.floor(limit)));
    return this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM security.api_rate_limit_buckets
      WHERE (route_name, key_hash, window_start) IN (
        SELECT route_name, key_hash, window_start
        FROM security.api_rate_limit_buckets
        WHERE expires_at <= clock_timestamp()
        ORDER BY expires_at ASC
        LIMIT ${safeLimit}
      )
    `);
  }
}
