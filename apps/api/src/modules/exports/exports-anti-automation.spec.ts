import 'reflect-metadata';
import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ExportsController } from './exports.controller';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { RATE_LIMIT_OPTIONS, type RateLimitOptions } from '../../common/decorators/rate-limit.decorator';

// ASVS V2.4.1. Every route on this controller answers with a whole dataset, so
// this is the exfiltration surface: repeated ordinary calls, each of them
// authorised, add up to the database.
//
// The guard spec next door mocks the Reflector, which proves the guard works
// but not that any decorator reaches it. These use a real Reflector against the
// real controller, so a decorator that is present but unreadable - wrong
// import, wrong metadata key, applied to the class instead of the handler -
// fails here rather than passing quietly.

const handlerNames = Object.getOwnPropertyNames(ExportsController.prototype)
  .filter((name) => name !== 'constructor')
  .filter((name) => typeof (ExportsController.prototype as never as Record<string, unknown>)[name] === 'function');

const optionsFor = (name: string): RateLimitOptions | undefined => new Reflector().getAllAndOverride<RateLimitOptions>(
  RATE_LIMIT_OPTIONS,
  [(ExportsController.prototype as never as Record<string, never>)[name], ExportsController],
);

function context(handlerName: string, request: unknown, response: unknown): never {
  return {
    getHandler: () => (ExportsController.prototype as never as Record<string, unknown>)[handlerName],
    getClass: () => ExportsController,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as never;
}

const responseMock = () => {
  const headers = new Map<string, string>();
  return { headers, setHeader: (name: string, value: string) => headers.set(name, String(value)) };
};

describe('exports anti-automation', () => {
  it('has routes to protect, so an empty controller cannot pass this suite', () => {
    expect(handlerNames.length).toBeGreaterThanOrEqual(6);
  });

  it('bounds every route, including any added later', () => {
    // Enumerated rather than listed, so a new export route arrives unprotected
    // here instead of arriving unprotected in production.
    const unbounded = handlerNames.filter((name) => optionsFor(name) === undefined);
    expect(unbounded).toEqual([]);
  });

  it('bounds them per account rather than per address', () => {
    // The caller is authenticated, so the account is the thing worth bounding;
    // one account behind many addresses walks past an IP bound. Compared as a
    // list so a failure names the route rather than just the value.
    expect(handlerNames.map((name) => [name, optionsFor(name)?.scope]))
      .toEqual(handlerNames.map((name) => [name, 'user']));
  });

  it('gives every route its own counter', () => {
    const names = handlerNames.map((name) => optionsFor(name)?.name);
    expect(new Set(names).size).toBe(handlerNames.length);
    expect(names.every((name) => typeof name === 'string' && name.length > 0)).toBe(true);
  });

  it('keeps every bound finite and operator-tunable', () => {
    const malformed = handlerNames.filter((name) => {
      const options = optionsFor(name);
      if (!options) return true;
      return !Number.isInteger(options.limit)
        || (options.limit ?? 0) <= 0
        || (options.windowSeconds ?? 0) <= 0
        || !/^RATE_LIMIT_EXPORTS_/u.test(String(options.limitEnv))
        || !/^RATE_LIMIT_EXPORTS_.*_WINDOW_SECONDS$/u.test(String(options.windowEnv));
    });
    expect(malformed).toEqual([]);
  });

  it('counts a per-deal route against the deal as well as the account', () => {
    // Without this a single deal could be pulled repeatedly under one account's
    // shared budget, or one deal's traffic could exhaust the budget for all.
    const perDeal = ['exportEvidence', 'exportLedger', 'getDealReport'];
    expect(perDeal.map((name) => [name, optionsFor(name)?.includeParams]))
      .toEqual(perDeal.map((name) => [name, ['dealId']]));
  });

  it('reaches the guard: the real decorator drives a real consume call', async () => {
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({
        allowed: true, count: 1, remaining: 5, limit: 6, resetAt: Date.now() + 60_000,
      }),
    };
    const guard = new RateLimitGuard(new Reflector(), rateLimits as never, {} as never);
    const response = responseMock();

    await expect(guard.canActivate(context('exportDeals', { user: { id: 'user-1' }, params: {} }, response)))
      .resolves.toBe(true);
    expect(rateLimits.consume).toHaveBeenCalledWith('exports_deals', 'user|user-1', 6, 300);
    expect(response.headers.get('RateLimit-Limit')).toBe('6');
  });

  it('refuses once the bound is reached, and says when to come back', async () => {
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({
        allowed: false, count: 7, remaining: 0, limit: 6, resetAt: Date.now() + 120_000,
      }),
    };
    const guard = new RateLimitGuard(new Reflector(), rateLimits as never, {} as never);
    const response = responseMock();

    await expect(guard.canActivate(context('exportDeals', { user: { id: 'user-1' }, params: {} }, response)))
      .rejects.toBeInstanceOf(HttpException);
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('partitions the per-deal counter by the deal actually asked for', async () => {
    const rateLimits = {
      consume: jest.fn().mockResolvedValue({
        allowed: true, count: 1, remaining: 19, limit: 20, resetAt: Date.now() + 60_000,
      }),
    };
    const guard = new RateLimitGuard(new Reflector(), rateLimits as never, {} as never);

    await guard.canActivate(context('exportLedger', { user: { id: 'user-1' }, params: { dealId: 'deal-9' } }, responseMock()));
    expect(rateLimits.consume).toHaveBeenCalledWith('exports_ledger', 'user|user-1|dealId=deal-9', 20, 300);
  });
});
