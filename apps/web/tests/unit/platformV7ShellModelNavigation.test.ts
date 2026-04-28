import { describe, expect, it } from 'vitest';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';
import { platformV7NavItems, platformV7RoleStage } from '@/lib/platform-v7/navigation';
import {
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
} from '@/lib/platform-v7/routes';
import { inferPlatformV7RoleFromPath, platformV7ShellModel } from '@/lib/platform-v7/shell';

const rolePaths: Array<{ role: PlatformRole; path: string }> = [
  { role: 'operator', path: '/platform-v7/control-tower' },
  { role: 'buyer', path: '/platform-v7/buyer' },
  { role: 'seller', path: '/platform-v7/seller' },
  { role: 'logistics', path: '/platform-v7/logistics' },
  { role: 'driver', path: '/platform-v7/driver' },
  { role: 'surveyor', path: '/platform-v7/surveyor' },
  { role: 'elevator', path: '/platform-v7/elevator' },
  { role: 'lab', path: '/platform-v7/lab' },
  { role: 'bank', path: '/platform-v7/bank' },
  { role: 'arbitrator', path: '/platform-v7/arbitrator' },
  { role: 'compliance', path: '/platform-v7/compliance' },
  { role: 'executive', path: '/platform-v7/executive' },
];

const inferredRolePaths: Array<{ role: PlatformRole; paths: string[] }> = [
  { role: 'operator', paths: ['/platform-v7/control-tower'] },
  { role: 'buyer', paths: ['/platform-v7/buyer', '/platform-v7/procurement'] },
  { role: 'seller', paths: ['/platform-v7/seller', '/platform-v7/lots'] },
  { role: 'logistics', paths: ['/platform-v7/logistics'] },
  { role: 'driver', paths: ['/platform-v7/driver'] },
  { role: 'surveyor', paths: ['/platform-v7/surveyor'] },
  { role: 'elevator', paths: ['/platform-v7/elevator'] },
  { role: 'lab', paths: ['/platform-v7/lab'] },
  { role: 'bank', paths: ['/platform-v7/bank'] },
  { role: 'arbitrator', paths: ['/platform-v7/arbitrator'] },
  { role: 'compliance', paths: ['/platform-v7/compliance'] },
  { role: 'executive', paths: ['/platform-v7/analytics', '/platform-v7/executive'] },
];

const isCanonicalPlatformV7Route = (route: string) => route === '/platform-v7' || route.startsWith('/platform-v7/');
const isPlatformV7ShellFamilyRoute = (route: string) =>
  isCanonicalPlatformV7Route(route) || route === '/platform-v7r' || route.startsWith('/platform-v7r/');

const forbiddenRouteFamilies = ['/platform-v4', '/platform-v9'];

function expectNoForbiddenRouteFamilies(route: string) {
  for (const family of forbiddenRouteFamilies) {
    expect(route.includes(family)).toBe(false);
  }
}

describe('platform-v7 shell model navigation', () => {
  it('uses navigation registry helpers for nav items and role stage', () => {
    for (const { role, path } of rolePaths) {
      const model = platformV7ShellModel(path, 'buyer');

      expect(model.role).toBe(role);
      expect(model.navItems).toEqual(platformV7NavItems(role));
      expect(model.stage).toEqual(platformV7RoleStage(role));
    }
  });

  it('infers role from platform v7 route families', () => {
    for (const { role, paths } of inferredRolePaths) {
      for (const path of paths) {
        expect(inferPlatformV7RoleFromPath(path, 'buyer')).toBe(role);
        expect(inferPlatformV7RoleFromPath(`${path}/nested`, 'buyer')).toBe(role);
      }
    }
  });

  it('keeps current role for paths without a shell role mapping', () => {
    expect(inferPlatformV7RoleFromPath('/platform-v7/unmapped', 'seller')).toBe('seller');
    expect(inferPlatformV7RoleFromPath('/external', 'bank')).toBe('bank');
  });

  it('keeps shell nav hrefs inside platform v7 route families', () => {
    for (const { path } of rolePaths) {
      const model = platformV7ShellModel(path, 'buyer');

      for (const item of model.navItems) {
        expect(item.href.startsWith('/platform-v7')).toBe(true);
        expect(item.href.includes('/platform-v4')).toBe(false);
        expect(item.href.includes('/platform-v9')).toBe(false);
      }
    }
  });

  it('keeps command route surface canonical to platform v7', () => {
    const uniqueRoutes = new Set(PLATFORM_V7_COMMAND_ROUTE_SURFACE);

    expect(uniqueRoutes.size).toBe(PLATFORM_V7_COMMAND_ROUTE_SURFACE.length);
    for (const route of PLATFORM_V7_COMMAND_ROUTE_SURFACE) {
      expect(isCanonicalPlatformV7Route(route)).toBe(true);
      expect(route.startsWith('/platform-v7r')).toBe(false);
      expectNoForbiddenRouteFamilies(route);
    }
  });

  it('keeps shell route surface limited to platform v7 and v7r role families', () => {
    const uniqueRoutes = new Set(PLATFORM_V7_SHELL_ROUTE_SURFACE);

    expect(uniqueRoutes.size).toBe(PLATFORM_V7_SHELL_ROUTE_SURFACE.length);
    expect(PLATFORM_V7_SHELL_ROUTE_SURFACE.some((route) => route.startsWith('/platform-v7r'))).toBe(true);

    for (const route of PLATFORM_V7_SHELL_ROUTE_SURFACE) {
      expect(isPlatformV7ShellFamilyRoute(route)).toBe(true);
      expectNoForbiddenRouteFamilies(route);
    }
  });

  it('keeps execution machine strip routes inside command route surface', () => {
    const commandRoutes = new Set<string>(PLATFORM_V7_COMMAND_ROUTE_SURFACE);

    for (const route of PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES) {
      expect(commandRoutes.has(route)).toBe(true);
    }
  });

  it('keeps shell nav labels non-empty', () => {
    for (const { path } of rolePaths) {
      const model = platformV7ShellModel(path, 'buyer');

      expect(model.navItems.length).toBeGreaterThan(0);
      for (const item of model.navItems) {
        expect(item.label.trim()).not.toBe('');
      }
    }
  });
});
