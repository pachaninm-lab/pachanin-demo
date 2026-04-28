import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import {
  PLATFORM_V7_NAV_BY_ROLE,
  PLATFORM_V7_ROLE_ROUTES,
  platformV7NavByRole,
  platformV7RoleRoute,
  platformV7ShellRouteSurface,
} from '@/lib/platform-v7/shellRoutes';
import { PLATFORM_V7_DEALS_ROUTE } from '@/lib/platform-v7/routes';

const PLATFORM_ROLES: PlatformRole[] = [
  'operator',
  'buyer',
  'seller',
  'logistics',
  'driver',
  'surveyor',
  'elevator',
  'lab',
  'bank',
  'arbitrator',
  'compliance',
  'executive',
];

describe('platform-v7 shell route registry', () => {
  it('keeps a landing route for every platform role', () => {
    expect(Object.keys(PLATFORM_V7_ROLE_ROUTES).sort()).toEqual([...PLATFORM_ROLES].sort());

    for (const role of PLATFORM_ROLES) {
      expect(platformV7RoleRoute(role)).toMatch(/^\/platform-v7r?\//);
    }
  });

  it('keeps side navigation for every platform role', () => {
    expect(Object.keys(PLATFORM_V7_NAV_BY_ROLE).sort()).toEqual([...PLATFORM_ROLES].sort());

    for (const role of PLATFORM_ROLES) {
      const items = platformV7NavByRole(role);
      expect(items.length, `${role} must expose at least one shell navigation item`).toBeGreaterThan(0);
      expect(items[0]?.href).toBe(platformV7RoleRoute(role));
      expect(items.every((item) => item.label.length > 0)).toBe(true);
    }
  });

  it('keeps shell navigation hrefs inside the approved route surface', () => {
    const shellRoutes = new Set<string>(platformV7ShellRouteSurface());

    expect(shellRoutes.size).toBe(platformV7ShellRouteSurface().length);

    for (const role of PLATFORM_ROLES) {
      for (const item of platformV7NavByRole(role)) {
        const isDealDetailRoute = item.href.startsWith(`${PLATFORM_V7_DEALS_ROUTE}/`);
        expect(shellRoutes.has(item.href) || isDealDetailRoute, `${role}: ${item.href} must be approved`).toBe(true);
      }
    }
  });
});
