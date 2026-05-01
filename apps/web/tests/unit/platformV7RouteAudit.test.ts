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

  it('keeps every P0 route inside the fast-pass target surface', () => {
    const targetRoutes = new Set<string>(PLATFORM_V7_FAST_PASS_TARGET_ROUTES);

    for (const route of PLATFORM_V7_P0_SMOKE_ROUTES) {
      expect(targetRoutes.has(route)).toBe(true);
    }
  });

  it('documents the current driver field-shell compatibility gap instead of pretending it is green', () => {
    const knownGaps = getPlatformV7KnownRouteGaps();

    expect(knownGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          route: '/platform-v7/driver/field',
          owner: 'driver',
          status: 'known-gap',
          p0Smoke: false,
        }),
      ])
    );
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
