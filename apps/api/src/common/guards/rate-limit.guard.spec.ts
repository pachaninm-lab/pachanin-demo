import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

function context(request: any, response: any, options: any): any {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    __options: options,
  };
}

function responseMock() {
  const headers = new Map<string, string>();
  return {
    headers,
    setHeader: (name: string, value: string) => headers.set(name, String(value)),
  };
}

describe('RateLimitGuard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('sets standard headers and permits an allowed request', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        name: 'auth_login',
        scope: 'ip',
        limit: 8,
        windowSeconds: 60,
      }),
    } as unknown as Reflector;
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({
        allowed: true,
        count: 1,
        remaining: 7,
        limit: 8,
        resetAt: Date.now() + 30_000,
      }),
    };
    const trustedProxy = { resolveRequestIp: jest.fn().mockReturnValue('198.51.100.8') };
    const guard = new RateLimitGuard(reflector, rateLimits as any, trustedProxy as any);
    const response = responseMock();

    await expect(guard.canActivate(context({ params: {}, headers: {}, socket: {} }, response, {}))).resolves.toBe(true);
    expect(rateLimits.consume).toHaveBeenCalledWith('auth_login', 'ip|198.51.100.8', 8, 60);
    expect(response.headers.get('RateLimit-Limit')).toBe('8');
    expect(response.headers.get('RateLimit-Remaining')).toBe('7');
    expect(Number(response.headers.get('RateLimit-Reset'))).toBeGreaterThan(0);
  });

  it('uses server-authoritative user identity and route params in the key', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({
        name: 'deal_command',
        scope: 'user',
        limit: 20,
        windowSeconds: 60,
        includeParams: ['id', 'actionId'],
      }),
    } as unknown as Reflector;
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({ allowed: true, count: 1, remaining: 19, limit: 20, resetAt: Date.now() + 30_000 }),
    };
    const guard = new RateLimitGuard(reflector, rateLimits as any, { resolveRequestIp: jest.fn() } as any);
    const request = {
      user: { id: 'persistent-user', orgId: 'persistent-org' },
      params: { id: 'deal-1', actionId: 'request_release' },
      headers: {},
      socket: {},
    };

    await guard.canActivate(context(request, responseMock(), {}));
    expect(rateLimits.consume).toHaveBeenCalledWith(
      'deal_command',
      'user|persistent-user|id=deal-1|actionId=request_release',
      20,
      60,
    );
  });

  it('returns 429 with Retry-After after the shared limit is exhausted', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({ name: 'bank_callback', scope: 'ip', limit: 1, windowSeconds: 60 }),
    } as unknown as Reflector;
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({ allowed: false, count: 2, remaining: 0, limit: 1, resetAt: Date.now() + 20_000 }),
    };
    const guard = new RateLimitGuard(
      reflector,
      rateLimits as any,
      { resolveRequestIp: jest.fn().mockReturnValue('203.0.113.3') } as any,
    );
    const response = responseMock();

    await expect(guard.canActivate(context({ params: {}, headers: {}, socket: {} }, response, {}))).rejects.toMatchObject({
      status: 429,
    });
    expect(response.headers.get('Retry-After')).toBeDefined();
  });

  it('fails closed when the shared store cannot enforce a critical limit', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue({ name: 'auth_login', scope: 'ip', limit: 8, windowSeconds: 60 }),
    } as unknown as Reflector;
    const rateLimits = { consume: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const guard = new RateLimitGuard(
      reflector,
      rateLimits as any,
      { resolveRequestIp: jest.fn().mockReturnValue('203.0.113.4') } as any,
    );

    await expect(guard.canActivate(context({ params: {}, headers: {}, socket: {} }, responseMock(), {}))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('passes routes without rate-limit metadata without touching storage', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const rateLimits = { consume: jest.fn() };
    const guard = new RateLimitGuard(reflector, rateLimits as any, { resolveRequestIp: jest.fn() } as any);
    await expect(guard.canActivate(context({}, responseMock(), {}))).resolves.toBe(true);
    expect(rateLimits.consume).not.toHaveBeenCalled();
  });
});
