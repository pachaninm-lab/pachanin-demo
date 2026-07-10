import { randomUUID } from 'crypto';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { RateLimitService } from '../../src/common/security/rate-limit.service';

const ADMIN_URL = String(process.env.ONE_DEAL_ADMIN_URL ?? '');
const APP_URL = String(process.env.DATABASE_URL ?? '');

function prisma(url: string): PrismaService {
  return new PrismaService({ datasources: { db: { url } } });
}

describe('distributed PostgreSQL rate limiting', () => {
  const admin = prisma(ADMIN_URL);
  const firstPrisma = prisma(APP_URL);
  const secondPrisma = prisma(APP_URL);
  const first = new RateLimitService(firstPrisma);
  const second = new RateLimitService(secondPrisma);

  beforeAll(async () => {
    if (!ADMIN_URL || !APP_URL) {
      throw new Error('ONE_DEAL_ADMIN_URL and DATABASE_URL are required.');
    }
    if (!process.env.RATE_LIMIT_KEY_PEPPER) {
      throw new Error('RATE_LIMIT_KEY_PEPPER is required.');
    }
    await admin.$connect();

    const deniedPrisma = prisma(APP_URL);
    await deniedPrisma.$connect();
    try {
      const denied = new RateLimitService(deniedPrisma);
      await expect(denied.verifyBackendBoundary()).rejects.toThrow(/principal boundary is invalid/i);
    } finally {
      await deniedPrisma.$disconnect();
    }

    await admin.$executeRawUnsafe('GRANT USAGE ON SCHEMA security TO one_deal_app');
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION security.consume_rate_limit(TEXT, TEXT, INTEGER, INTEGER, INTEGER) TO one_deal_app',
    );
    await admin.$executeRawUnsafe(
      'GRANT EXECUTE ON FUNCTION security.cleanup_rate_limit_buckets(INTEGER) TO one_deal_app',
    );
    await Promise.all([firstPrisma.$connect(), secondPrisma.$connect()]);
    await expect(first.verifyBackendBoundary()).resolves.toMatchObject({
      current_user: 'one_deal_app',
      function_exists: true,
      table_exists: true,
      schema_usage: true,
      can_execute: true,
      can_select_table: false,
    });
    await expect(second.verifyBackendBoundary()).resolves.toMatchObject({
      current_user: 'one_deal_app',
      can_execute: true,
      can_select_table: false,
    });
  });

  afterAll(async () => {
    await Promise.allSettled([
      admin.$disconnect(),
      firstPrisma.$disconnect(),
      secondPrisma.$disconnect(),
    ]);
  });

  it('shares one atomic window across instances and survives restart', async () => {
    const policy = `e2e_${randomUUID().replace(/-/g, '')}`;
    const subject = '198.51.100.77';
    const requests = Array.from({ length: 24 }, (_, index) => {
      const service = index % 2 === 0 ? first : second;
      return service.consume({
        policy,
        scope: 'ip',
        subject,
        limit: 7,
        windowSeconds: 120,
      });
    });
    const decisions = await Promise.all(requests);
    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(7);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(17);
    expect(decisions.every((decision) => decision.limit === 7)).toBe(true);

    const restartPrisma = prisma(APP_URL);
    const restart = new RateLimitService(restartPrisma);
    await restartPrisma.$connect();
    try {
      await expect(restart.verifyBackendBoundary()).resolves.toMatchObject({
        current_user: 'one_deal_app',
        can_execute: true,
        can_select_table: false,
      });
      await expect(restart.consume({
        policy,
        scope: 'ip',
        subject,
        limit: 7,
        windowSeconds: 120,
      })).resolves.toMatchObject({
        allowed: false,
        remaining: 0,
      });
      await expect(restart.consume({
        policy,
        scope: 'ip',
        subject: '198.51.100.78',
        limit: 7,
        windowSeconds: 120,
      })).resolves.toMatchObject({
        allowed: true,
        remaining: 6,
      });
    } finally {
      await restartPrisma.$disconnect();
    }

    const rows = await admin.$queryRawUnsafe<Array<{
      policy: string;
      key_hash: string;
      request_count: number;
      raw_subject_count: bigint;
    }>>(
      `SELECT policy, key_hash, request_count,
        (SELECT count(*) FROM security.rate_limit_buckets WHERE key_hash LIKE '%198.51.100.77%')::bigint AS raw_subject_count
       FROM security.rate_limit_buckets
       WHERE policy = $1`,
      policy,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => /^[a-f0-9]{64}$/.test(row.key_hash))).toBe(true);
    expect(rows.every((row) => row.raw_subject_count === 0n)).toBe(true);
    expect(rows.find((row) => row.request_count > 7)?.request_count).toBeGreaterThan(7);
  });

  it('grants only function execution to the application principal', async () => {
    const rows = await admin.$queryRawUnsafe<Array<{
      can_execute: boolean;
      can_select: boolean;
      is_superuser: boolean;
      bypass_rls: boolean;
    }>>(`
      SELECT
        has_function_privilege(
          'one_deal_app',
          'security.consume_rate_limit(text,text,integer,integer,integer)',
          'EXECUTE'
        ) AS can_execute,
        has_table_privilege('one_deal_app', 'security.rate_limit_buckets', 'SELECT') AS can_select,
        r.rolsuper AS is_superuser,
        r.rolbypassrls AS bypass_rls
      FROM pg_roles r
      WHERE r.rolname = 'one_deal_app'
    `);
    expect(rows).toEqual([{
      can_execute: true,
      can_select: false,
      is_superuser: false,
      bypass_rls: false,
    }]);
  });
});
