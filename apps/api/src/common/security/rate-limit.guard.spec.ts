import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DecoratedRateLimitGuard,
  PreAuthRateLimitGuard,
} from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

function context(input: {
  path?: string;
  ip?: string;
  user?: Record<string, unknown>;
}) {
  const headers: Record<string, string> = {};
  const response = {
    setHeader: jest.fn((name: string, value: string) => {
      headers[name] = value;
    }),
  };
  const request = {
    path: input.path ?? '/api/auth/login',
    url: input.path ?? '/api/auth/login',
    headers: {},
    socket: { remoteAddress: input.ip ?? '198.51.100.20' },
    ip: input.ip ?? '198.51.100.20',
    user: input.user,
  };
  const execution = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
  return { execution, request, response, headers };
}

describe('distributed rate-limit guards', () => {
  const allowed = {
    allowed: true,
    remaining: 7,
    limit: 8,
    resetAt: Date.now() + 60_000,
    retryAfterSeconds: 0,
  };

  it('enforces the general IP shield before authentication', async () => {
    const service = { consume: jest.fn().mockResolvedValue(allowed) } as unknown as RateLimitService;
    const guard = new PreAuthRateLimitGuard(service);
    const runtime = context({ ip: '198.51.100.20' });

    await expect(guard.canActivate(runtime.execution)).resolves.toBe(true);
    expect(service.consume).toHaveBeenCalledWith(expect.objectContaining({
      policy: 'general',
      scope: 'ip',
      subject: '198.51.100.20',
    }));
    expect(runtime.headers['RateLimit-Limit']).toBe('8');
    expect(runtime.headers['X-RateLimit-Remaining']).toBe('7');
  });

  it('executes route metadata after auth and derives user scope from server identity', async () => {
    const service = { consume: jest.fn().mockResolvedValue(allowed) } as unknown as RateLimitService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        name: 'deal_command',
        scope: 'user',
        limit: 12,
        windowSeconds: 30,
      }),
    } as unknown as Reflector;
    const guard = new DecoratedRateLimitGuard(reflector, service);
    const runtime = context({
      ip: '198.51.100.21',
      user: { id: 'user-1', orgId: 'org-1' },
    });

    await expect(guard.canActivate(runtime.execution)).resolves.toBe(true);
    expect(service.consume).toHaveBeenCalledWith({
      policy: 'deal_command',
      scope: 'user',
      subject: 'user-1',
      limit: 12,
      windowSeconds: 30,
      blockSeconds: 0,
    });
  });

  it('returns 429 with Retry-After when the shared backend denies a request', async () => {
    const service = {
      consume: jest.fn().mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 5,
        resetAt: Date.now() + 15_000,
        retryAfterSeconds: 15,
      }),
    } as unknown as RateLimitService;
    const guard = new PreAuthRateLimitGuard(service);
    const runtime = context({ ip: '198.51.100.22' });

    await expect(guard.canActivate(runtime.execution)).rejects.toMatchObject({
      status: 429,
    } as Partial<HttpException>);
    expect(runtime.headers['Retry-After']).toBe('15');
  });

  it('bypasses only exact liveness/readiness endpoints', async () => {
    const service = { consume: jest.fn() } as unknown as RateLimitService;
    const guard = new PreAuthRateLimitGuard(service);
    await expect(guard.canActivate(context({ path: '/health' }).execution)).resolves.toBe(true);
    expect(service.consume).not.toHaveBeenCalled();

    await guard.canActivate(context({ path: '/health/detailed' }).execution);
    expect(service.consume).toHaveBeenCalledTimes(1);
  });
});
