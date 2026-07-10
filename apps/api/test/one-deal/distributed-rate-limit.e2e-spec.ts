import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RateLimitRepository } from '../../src/common/security/rate-limit.repository';
import {
  hashRateLimitKey,
  RateLimitService,
  resolveRateLimitHmacKey,
} from '../../src/common/security/rate-limit.service';

function createPrisma(): PrismaService {
  const url = String(process.env.DATABASE_URL ?? '').trim();
  if (!url) throw new Error('DATABASE_URL is required for distributed rate-limit proof');
  return new PrismaService({ datasources: { db: { url } } });
}

function createService(prisma: PrismaService): RateLimitService {
  return new RateLimitService(new RateLimitRepository(prisma));
}

describe('distributed PostgreSQL high-risk rate limits', () => {
  const prismaA = createPrisma();
  const prismaB = createPrisma();

  beforeAll(async () => {
    await Promise.all([prismaA.$connect(), prismaB.$connect()]);
  });

  afterAll(async () => {
    await Promise.allSettled([prismaA.$disconnect(), prismaB.$disconnect()]);
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
    const rows = await prismaA.$queryRaw<Array<{ key_hash: string; request_count: number }>>(Prisma.sql`
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
});
