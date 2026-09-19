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
  state_table_ready: boolean;
  legacy_table_ready: boolean;
  consume_ready: boolean;
  schema_usage: boolean;
  can_execute_consume: boolean;
  can_select_state: boolean;
  can_insert_state: boolean;
  can_update_state: boolean;
  can_delete_state: boolean;
  can_select_legacy: boolean;
  can_insert_legacy: boolean;
  can_update_legacy: boolean;
  can_delete_legacy: boolean;
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
            to_regclass('security.api_rate_limit_state') AS state_table_oid,
            to_regclass('security.api_rate_limit_buckets') AS legacy_table_oid,
            to_regprocedure('security.consume_api_rate_limit(text,text,integer)') AS consume_oid
        )
        SELECT
          current_user,
          state_table_oid IS NOT NULL AS state_table_ready,
          legacy_table_oid IS NOT NULL AS legacy_table_ready,
          consume_oid IS NOT NULL AS consume_ready,
          has_schema_privilege(current_user, 'security', 'USAGE') AS schema_usage,
          CASE WHEN consume_oid IS NULL THEN FALSE
            ELSE has_function_privilege(current_user, consume_oid, 'EXECUTE') END AS can_execute_consume,
          CASE WHEN state_table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, state_table_oid, 'SELECT') END AS can_select_state,
          CASE WHEN state_table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, state_table_oid, 'INSERT') END AS can_insert_state,
          CASE WHEN state_table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, state_table_oid, 'UPDATE') END AS can_update_state,
          CASE WHEN state_table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, state_table_oid, 'DELETE') END AS can_delete_state,
          CASE WHEN legacy_table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, legacy_table_oid, 'SELECT') END AS can_select_legacy,
          CASE WHEN legacy_table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, legacy_table_oid, 'INSERT') END AS can_insert_legacy,
          CASE WHEN legacy_table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, legacy_table_oid, 'UPDATE') END AS can_update_legacy,
          CASE WHEN legacy_table_oid IS NULL THEN FALSE
            ELSE has_table_privilege(current_user, legacy_table_oid, 'DELETE') END AS can_delete_legacy
        FROM target
      `);
    } catch {
      throw new Error('Distributed rate-limit execution boundary is unavailable.');
    }

    const readiness = rows[0];
    if (
      !readiness
      || !readiness.state_table_ready
      || !readiness.legacy_table_ready
      || !readiness.consume_ready
      || !readiness.schema_usage
      || !readiness.can_execute_consume
      || readiness.can_select_state
      || readiness.can_insert_state
      || readiness.can_update_state
      || readiness.can_delete_state
      || readiness.can_select_legacy
      || readiness.can_insert_legacy
      || readiness.can_update_legacy
      || readiness.can_delete_legacy
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
    if (!row) throw new Error('Rate-limit state consume returned no row.');
    return { count: Number(row.request_count), resetAt: row.expires_at };
  }

  async deleteExpired(_limit = 500): Promise<number> {
    return 0;
  }
}
