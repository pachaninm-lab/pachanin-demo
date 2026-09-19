import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_FAST_PASS_ROUTE_AUDIT,
  PLATFORM_V7_FAST_PASS_TARGET_ROUTES,
  PLATFORM_V7_P0_SMOKE_ROUTES,
  getPlatformV7KnownRouteGaps,
  getPlatformV7P0SmokeRoutes,
} from '@/lib/platform-v7/route-audit';

describe('platform-v7 fast-pass route audit registry', () => {
  it('keeps the P0 smoke route set unique and scoped to platform-v7', () => {
    const routes = getPlatformV7P0SmokeRoutes();

    expect(routes.length).toBeGreaterThan(10);
    expect(new Set(routes).size).toBe(routes.length);

    for (const route of routes) {
      expect(route.startsWith('/platform-v7')).toBe(true);
      expect(route.includes('/platform-v7r')).toBe(false);
      expect(route.includes('/apps/landing')).toBe(false);
    }
  });

  it('keeps legacy and restricted routes out of P0 smoke', () => {
    const routes = getPlatformV7P0SmokeRoutes();

    expect(routes).not.toContain('/platform-v7/roles');
    expect(routes).not.toContain('/platform-v7/demo');

    expect(PLATFORM_V7_FAST_PASS_ROUTE_AUDIT.find((item) => item.route === '/platform-v7/roles')).toEqual(
      expect.objectContaining({ surface: 'legacy', owner: 'operator', p0Smoke: false })
    );
    expect(PLATFORM_V7_FAST_PASS_ROUTE_AUDIT.find((item) => item.route === '/platform-v7/demo')).toEqual(
      expect.objectContaining({ surface: 'legacy', owner: 'operator', p0Smoke: false })
    );
  });

  it('keeps every P0 route inside the fast-pass target surface', () => {
    const targetRoutes = new Set<string>(PLATFORM_V7_FAST_PASS_TARGET_ROUTES);

    for (const route of PLATFORM_V7_P0_SMOKE_ROUTES) {
      expect(targetRoutes.has(route)).toBe(true);
    }
  });

  it('promotes the field shell route into current smoke after isolation', () => {
    const routes = getPlatformV7P0SmokeRoutes();
    const fieldRoute = PLATFORM_V7_FAST_PASS_ROUTE_AUDIT.find((item) => item.route === '/platform-v7/driver/field');

    expect(routes).toContain('/platform-v7/driver/field');
    expect(fieldRoute).toEqual(
      expect.objectContaining({
        owner: 'driver',
        status: 'current-smoke',
        p0Smoke: true,
      })
    );
  });

  it('keeps investor as a role surface rather than a demo surface', () => {
    expect(PLATFORM_V7_FAST_PASS_ROUTE_AUDIT.find((item) => item.route === '/platform-v7/investor')).toEqual(
      expect.objectContaining({
        surface: 'role',
        owner: 'investor',
        status: 'current-smoke',
        p0Smoke: true,
      })
    );
  });

  it('keeps no current known route gaps after the field shell promotion', () => {
    expect(getPlatformV7KnownRouteGaps()).toEqual([]);
  });

  it('keeps route audit records reviewable and non-empty', () => {
    for (const item of PLATFORM_V7_FAST_PASS_ROUTE_AUDIT) {
      expect(item.route).toMatch(/^\/platform-v7/);
      expect(item.surface.length).toBeGreaterThan(0);
      expect(item.owner.length).toBeGreaterThan(0);
      expect(['current-smoke', 'target-fast-pass', 'known-gap']).toContain(item.status);
    }
  });
});
