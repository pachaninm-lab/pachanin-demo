import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPepper = process.env.RATE_LIMIT_KEY_PEPPER;
  const originalBackendEnforced = process.env.RATE_LIMIT_BACKEND_ENFORCED;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalPepper === undefined) delete process.env.RATE_LIMIT_KEY_PEPPER;
    else process.env.RATE_LIMIT_KEY_PEPPER = originalPepper;
    if (originalBackendEnforced === undefined) delete process.env.RATE_LIMIT_BACKEND_ENFORCED;
    else process.env.RATE_LIMIT_BACKEND_ENFORCED = originalBackendEnforced;
  });

  it('fails closed in production without a strong HMAC pepper', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.RATE_LIMIT_KEY_PEPPER;
    expect(() => new RateLimitService({} as PrismaService)).toThrow(/RATE_LIMIT_KEY_PEPPER/i);

    process.env.RATE_LIMIT_KEY_PEPPER = 'too-short';
    expect(() => new RateLimitService({} as PrismaService)).toThrow(/at least 32/i);
  });

  it('accepts an isolated strong production pepper', () => {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_KEY_PEPPER = 'a'.repeat(64);
    expect(() => new RateLimitService({} as PrismaService)).not.toThrow();
  });

  it('fails startup when the runtime principal lacks the exact SQL boundary', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_KEY_PEPPER = 'b'.repeat(64);
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{
        current_user: 'unsafe_runtime',
        function_exists: true,
        table_exists: true,
        schema_usage: true,
        can_execute: false,
        can_select_table: true,
      }]),
    } as unknown as PrismaService;
    const service = new RateLimitService(prisma);
    await expect(service.onModuleInit()).rejects.toThrow(/principal boundary is invalid/i);
  });

  it('accepts only execute-without-table-read at startup', async () => {
    process.env.NODE_ENV = 'production';
    process.env.RATE_LIMIT_KEY_PEPPER = 'c'.repeat(64);
    const row = {
      current_user: 'runtime_app',
      function_exists: true,
      table_exists: true,
      schema_usage: true,
      can_execute: true,
      can_select_table: false,
    };
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([row]),
    } as unknown as PrismaService;
    const service = new RateLimitService(prisma);
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    await expect(service.verifyBackendBoundary()).resolves.toEqual(row);
  });
});
