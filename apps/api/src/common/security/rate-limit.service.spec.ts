import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from './rate-limit.service';

describe('RateLimitService configuration', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalPepper = process.env.RATE_LIMIT_KEY_PEPPER;

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalPepper === undefined) delete process.env.RATE_LIMIT_KEY_PEPPER;
    else process.env.RATE_LIMIT_KEY_PEPPER = originalPepper;
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
});
