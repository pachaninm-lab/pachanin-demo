import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RateLimitRepository } from '../../src/common/security/rate-limit.repository';
import {
  hashRateLimitKey,
  RateLimitService,
  resolveRateLimitHmacKey,
} from '../../src/common/security/rate-limit.service';

function createPrisma(url = String(process.env.DATABASE_URL ?? '').trim()): PrismaService {
  if (!url) throw new Error('DATABASE_URL is required for distributed rate-limit proof');
  return new PrismaService({ datasources: { db: { url } } });
}

function createService(prisma: PrismaService): RateLimitService {
  return new RateLimitService(new RateLimitRepository(prisma));
}

describe('distributed PostgreSQL high-risk rate limits', () => {
  const adminUrl = String(process.env.ONE_DEAL_ADMIN_URL ?? '').trim();
  if (!adminUrl) throw new Error('ONE_DEAL_ADMIN_URL is required for distributed rate-limit proof');
  const admin = createPrisma(adminUrl);
  const prismaA = createPrisma();
  const prismaB = createPrisma();

  beforeAll(async () => {
    await admin.$connect();
    await admin.$executeRawUnsafe('REVOKE ALL ON TABLE security.api_rate_limit_buckets FROM one_deal_app');
    await admin.$executeRawUnsafe(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA security REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM one_deal_app',
    );
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA security TO one_deal_app');
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION security.consume_api_rate_limit(TEXT, TEXT, INTEGER) TO one_deal_app',
    );
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION security.cleanup_api_rate_limit_buckets(INTEGER) TO one_deal_app',
    );
    await Promise.all([prismaA.$connect(), prismaB.$connect()]);
  });

  afterAll(async () => {
    await Promise.allSettled([admin.$disconnect(), prismaA.$disconnect(), prismaB.$disconnect()]);
  });

  it('shares one atomic bucket across two service instances under concurrency', async () => {
    const routeName = `e2e_concurrent_${randomUUID().replace(/-/g, '')}`;
    const rawKey = `user:${randomUUID()}`;
    const first = createService(prismaA);
    const second = createService(prismaB);

    const results = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        (index % 2 === 0 ? first : second).consume(routeName, rawKey, 7, 300),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(7);
    expect(results.map((result) => result.count).sort((left, right) => left - right)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1),
    );
    expect(new Set(results.map((result) => result.resetAt)).size).toBe(1);

    const keyHash = hashRateLimitKey(rawKey, resolveRateLimitHmacKey());
    const rows = await admin.$queryRaw<Array<{ key_hash: string; request_count: number }>>(Prisma.sql`
      SELECT key_hash, request_count
      FROM security.api_rate_limit_buckets
      WHERE route_name = ${routeName}
    `);
    expect(rows).toEqual([{ key_hash: keyHash, request_count: 40 }]);
    expect(JSON.stringify(rows)).not.toContain(rawKey);
  });

  it('does not reset the active window when a service instance is recreated', async () => {
    const routeName = `e2e_restart_${randomUUID().replace(/-/g, '')}`;
    const rawKey = `org:${randomUUID()}`;
    const transientPrisma = createPrisma();
    await transientPrisma.$connect();
    const transientService = createService(transientPrisma);

    const first = await transientService.consume(routeName, rawKey, 5, 300);
    await transientPrisma.$disconnect();
    const afterRestart = await createService(prismaB).consume(routeName, rawKey, 5, 300);

    expect(first.count).toBe(1);
    expect(afterRestart.count).toBe(2);
    expect(afterRestart.resetAt).toBe(first.resetAt);
  });

  it('keeps separate route and actor partitions', async () => {
    const suffix = randomUUID().replace(/-/g, '');
    const service = createService(prismaA);
    const [routeA, routeB, actorB] = await Promise.all([
      service.consume(`e2e_partition_a_${suffix}`, 'actor-a', 1, 300),
      service.consume(`e2e_partition_b_${suffix}`, 'actor-a', 1, 300),
      service.consume(`e2e_partition_a_${suffix}`, 'actor-b', 1, 300),
    ]);
    expect([routeA.allowed, routeB.allowed, actorB.allowed]).toEqual([true, true, true]);
  });

  it('allows only function execution and passes the production startup boundary', async () => {
    const rows = await admin.$queryRaw<Array<{
      can_consume: boolean;
      can_cleanup: boolean;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
      is_superuser: boolean;
      bypass_rls: boolean;
    }>>(Prisma.sql`
      SELECT
        has_function_privilege(
          'one_deal_app',
          'security.consume_api_rate_limit(text,text,integer)',
          'EXECUTE'
        ) AS can_consume,
        has_function_privilege(
          'one_deal_app',
          'security.cleanup_api_rate_limit_buckets(integer)',
          'EXECUTE'
        ) AS can_cleanup,
        has_table_privilege('one_deal_app', 'security.api_rate_limit_buckets', 'SELECT') AS can_select,
        has_table_privilege('one_deal_app', 'security.api_rate_limit_buckets', 'INSERT') AS can_insert,
        has_table_privilege('one_deal_app', 'security.api_rate_limit_buckets', 'UPDATE') AS can_update,
        has_table_privilege('one_deal_app', 'security.api_rate_limit_buckets', 'DELETE') AS can_delete,
        role.rolsuper AS is_superuser,
        role.rolbypassrls AS bypass_rls
      FROM pg_roles AS role
      WHERE role.rolname = 'one_deal_app'
    `);
    expect(rows).toEqual([{
      can_consume: true,
      can_cleanup: true,
      can_select: false,
      can_insert: false,
      can_update: false,
      can_delete: false,
      is_superuser: false,
      bypass_rls: false,
    }]);

    await expect(prismaA.$queryRaw(Prisma.sql`
      SELECT count(*) FROM security.api_rate_limit_buckets
    `)).rejects.toThrow();

    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(new RateLimitRepository(prismaA).onModuleInit()).resolves.toBeUndefined();
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
