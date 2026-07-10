import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { PreAuthRateLimitGuard } from './pre-auth-rate-limit.guard';

function runtime(path = '/api/auth/login') {
  const headers = new Map<string, string>();
  const response = {
    setHeader: jest.fn((name: string, value: string) => headers.set(name, String(value))),
  };
  const request = {
    path,
    url: path,
    headers: {},
    socket: { remoteAddress: '198.51.100.20' },
  };
  const context = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { context, response, headers };
}

describe('PreAuthRateLimitGuard', () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_GENERAL;
    delete process.env.RATE_LIMIT_GENERAL_WINDOW_SECONDS;
  });

  it('protects a request before JWT processing with the trusted client IP', async () => {
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 299,
        limit: 300,
        resetAt: Date.now() + 60_000,
      }),
    };
    const trustedProxy = { resolveRequestIp: jest.fn().mockReturnValue('203.0.113.8') };
    const guard = new PreAuthRateLimitGuard(rateLimits as any, trustedProxy as any);
    const target = runtime();

    await expect(guard.canActivate(target.context)).resolves.toBe(true);
    expect(rateLimits.consume).toHaveBeenCalledWith('general_pre_auth', 'ip|203.0.113.8', 300, 60);
    expect(target.headers.get('RateLimit-Limit')).toBe('300');
    expect(target.headers.get('RateLimit-Remaining')).toBe('299');
  });

  it('returns 429 and Retry-After when the shared general bucket is exhausted', async () => {
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({
        allowed: false,
        count: 301,
        remaining: 0,
        limit: 300,
        resetAt: Date.now() + 20_000,
      }),
    };
    const guard = new PreAuthRateLimitGuard(
      rateLimits as any,
      { resolveRequestIp: jest.fn().mockReturnValue('203.0.113.9') } as any,
    );
    const target = runtime();

    await expect(guard.canActivate(target.context)).rejects.toMatchObject({ status: 429 });
    expect(Number(target.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('fails closed when the durable protection backend is unavailable', async () => {
    const guard = new PreAuthRateLimitGuard(
      { consume: jest.fn().mockRejectedValue(new Error('database unavailable')) } as any,
      { resolveRequestIp: jest.fn().mockReturnValue('203.0.113.10') } as any,
    );
    await expect(guard.canActivate(runtime().context)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each(['/health', '/ready', '/version', '/metrics'])('does not couple %s to the limiter backend', async (path) => {
    const rateLimits = { consume: jest.fn() };
    const guard = new PreAuthRateLimitGuard(
      rateLimits as any,
      { resolveRequestIp: jest.fn() } as any,
    );
    await expect(guard.canActivate(runtime(path).context)).resolves.toBe(true);
    expect(rateLimits.consume).not.toHaveBeenCalled();
  });

  it('keeps detailed health and all other routes protected', async () => {
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 299,
        limit: 300,
        resetAt: Date.now() + 60_000,
      }),
    };
    const guard = new PreAuthRateLimitGuard(
      rateLimits as any,
      { resolveRequestIp: jest.fn().mockReturnValue('203.0.113.11') } as any,
    );
    await expect(guard.canActivate(runtime('/health/detailed').context)).resolves.toBe(true);
    expect(rateLimits.consume).toHaveBeenCalledTimes(1);
  });
});
