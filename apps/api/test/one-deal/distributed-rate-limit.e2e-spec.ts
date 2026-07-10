import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RateLimitRepository } from '../../src/common/security/rate-limit.repository';
import {
  hashRateLimitKey,
  RateLimitService,
  resolveRateLimitHmacKey,
} from '../../src/common/security/rate-limit.service';

function createPrisma(url: string): PrismaService {
  return new PrismaService({ datasources: { db: { url } } });
}

function applicationUrl(): string {
  const url = String(process.env.DATABASE_URL ?? '').trim();
  if (!url) throw new Error('DATABASE_URL is required for distributed rate-limit proof');
  return url;
}

function adminUrl(): string {
  const url = String(process.env.ONE_DEAL_ADMIN_URL ?? '').trim();
  if (!url) throw new Error('ONE_DEAL_ADMIN_URL is required for distributed rate-limit proof');
  return url;
}

function createService(prisma: PrismaService): RateLimitService {
  return new RateLimitService(new RateLimitRepository(prisma));
}

describe('distributed PostgreSQL high-risk rate limits', () => {
  const admin = createPrisma(adminUrl());
  const prismaA = createPrisma(applicationUrl());
  const prismaB = createPrisma(applicationUrl());
  const repositoryA = new RateLimitRepository(prismaA);
  const repositoryB = new RateLimitRepository(prismaB);

  beforeAll(async () => {
    await admin.$connect();
    await admin.$executeRawUnsafe('REVOKE ALL ON security.api_rate_limit_buckets FROM one_deal_app');
    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA security TO one_deal_app');
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION security.consume_api_rate_limit(TEXT, TEXT, INTEGER) TO one_deal_app',
    );
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION security.cleanup_api_rate_limit_buckets(INTEGER) TO one_deal_app',
    );
    await Promise.all([prismaA.$connect(), prismaB.$connect()]);
    await expect(repositoryA.verifyReadiness()).resolves.toMatchObject({
      current_user: 'one_deal_app',
      table_ready: true,
      consume_ready: true,
      cleanup_ready: true,
      schema_usage: true,
      can_execute_consume: true,
      can_execute_cleanup: true,
      can_select: false,
      can_insert: false,
      can_update: false,
      can_delete: false,
    });
    await expect(repositoryB.verifyReadiness()).resolves.toMatchObject({
      current_user: 'one_deal_app',
      can_execute_consume: true,
      can_select: false,
    });
  });

  afterAll(async () => {
    await Promise.allSettled([admin.$disconnect(), prismaA.$disconnect(), prismaB.$disconnect()]);
  });

  it('shares one atomic bucket across two service instances under concurrency', async () => {
    const routeName = `e2e_concurrent_${randomUUID().replace(/-/g, '')}`;
    const rawKey = `user:${randomUUID()}`;
    const first = new RateLimitService(repositoryA);
    const second = new RateLimitService(repositoryB);

    const results = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        (index % 2 === 0 ? first : second).consume(routeName, rawKey, 7, 300),
      ),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(7);
    expect(results.map((result) => result.count).sort((left, right) => left - right)).toEqual(
      Array.from({ length: 40 }, (_, index) => index + 1),
    );
    expect(new Set(results.map((result) => result.resetAt)).toHaveLength(1);

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
    const transientPrisma = createPrisma(applicationUrl());
    await transientPrisma.$connect();
    const transientRepository = new RateLimitRepository(transientPrisma);
    await expect(transientRepository.verifyReadiness()).resolves.toMatchObject({
      can_execute_consume: true,
      can_select: false,
    });
    const transientService = new RateLimitService(transientRepository);

    const first = await transientService.consume(routeName, rawKey, 5, 300);
    await transientPrisma.$disconnect();
    const afterRestart = await new RateLimitService(repositoryB).consume(routeName, rawKey, 5, 300);

    expect(first.count).toBe(1);
    expect(afterRestart.count).toBe(2);
    expect(afterRestart.resetAt).toBe(first.resetAt);
  });

  it('keeps separate route and actor partitions', async () => {
    const suffix = randomUUID().replace(/-/g, '');
    const service = new RateLimitService(repositoryA);
    const [routeA, routeB, actorB] = await Promise.all([
      service.consume(`e2e_partition_a_${suffix}`, 'actor-a', 1, 300),
      service.consume(`e2e_partition_b_${suffix}`, 'actor-a', 1, 300),
      service.consume(`e2e_partition_a_${suffix}`, 'actor-b', 1, 300),
    ]);
    expect([routeA.allowed, routeB.allowed, actorB.allowed]).toEqual([true, true, true]);
  });

  it('does not grant direct bucket-table access to the runtime principal', async () => {
    const rows = await admin.$queryRaw<Array<{
      can_execute_consume: boolean;
      can_execute_cleanup: boolean;
      can_select: boolean;
      can_insert: boolean;
      can_update: boolean;
      can_delete: boolean;
      is_superuser: boolean;
      bypass_rls: boolean;
    }>>(Prisma.sql`
      SELECT
        has_function_privilege('one_deal_app', 'security.consume_api_rate_limit(text,text,integer)', 'EXECUTE') AS can_execute_consume,
        has_function_privilege('one_deal_app', 'security.cleanup_api_rate_limit_buckets(integer)', 'EXECUTE') AS can_execute_cleanup,
        has_table_privilege('one_deal_app', 'security.api_rate_limit_buckets', 'SELECT') AS can_select,
        has_table_privilege('one_deal_app', 'security.api_rate_limit_buckets', 'INSERT') AS can_insert,
        has_table_privilege('one_deal_app', 'security.api_rate_limit_buckets', 'UPDATE') AS can_update,
        has_table_privilege('one_deal_app', 'security.api_rate_limit_buckets', 'DELETE') AS can_delete,
        rolsuper AS is_superuser,
        rolbypassrls AS bypass_rls
      FROM pg_roles
      WHERE rolname = 'one_deal_app'
    `);
    expect(rows).toEqual([{
      can_execute_consume: true,
      can_execute_cleanup: true,
      can_select: false,
      can_insert: false,
      can_update: false,
      can_delete: false,
      is_superuser: false,
      bypass_rls: false,
    }]);
  });
});
