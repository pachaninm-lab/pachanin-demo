import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
} from '@/lib/platform-v7/routes';
import {
  PLATFORM_V7_NAV_BY_ROLE,
  PLATFORM_V7_ROLE_ROUTES,
  platformV7NavByRole,
  platformV7RoleRoute,
  platformV7ShellRouteSurface,
} from '@/lib/platform-v7/shellRoutes';
import { platformV7QuickJumpGroups, platformV7QuickJumpItems } from '@/lib/platform-v7/shellQuickJump';
import { platformV7CanShowAsLive, platformV7EnvironmentInfo, type PlatformEnvironment } from '@/lib/platform-v7/environment';

const forbiddenFamilies = ['/platform-v4', '/platform-v9'];
const environments: PlatformEnvironment[] = ['pilot', 'sandbox', 'demo', 'production'];

function expectSafeRoute(route: string) {
  expect(route.trim()).toBe(route);
  expect(route).toMatch(/^\/platform-v7/);
  expect(route.includes('?')).toBe(false);
  expect(route.includes('#')).toBe(false);

  for (const family of forbiddenFamilies) {
    expect(route.includes(family)).toBe(false);
  }
}

describe('platform-v7 final shell hardening pack', () => {
  it('keeps role route registry and helper output identical', () => {
    for (const role of Object.keys(PLATFORM_V7_ROLE_ROUTES) as Array<keyof typeof PLATFORM_V7_ROLE_ROUTES>) {
      expect(platformV7RoleRoute(role)).toBe(PLATFORM_V7_ROLE_ROUTES[role]);
    }
  });

  it('keeps role route registry inside safe platform route families', () => {
    for (const route of Object.values(PLATFORM_V7_ROLE_ROUTES)) {
      expectSafeRoute(route);
    }
  });

  it('keeps role nav registry and helper output identical', () => {
    for (const role of Object.keys(PLATFORM_V7_NAV_BY_ROLE) as Array<keyof typeof PLATFORM_V7_NAV_BY_ROLE>) {
      expect(platformV7NavByRole(role)).toBe(PLATFORM_V7_NAV_BY_ROLE[role]);
    }
  });

  it('keeps role nav item hrefs and labels trimmed', () => {
    for (const items of Object.values(PLATFORM_V7_NAV_BY_ROLE)) {
      for (const item of items) {
        expectSafeRoute(item.href);
        expect(item.label.trim()).toBe(item.label);
        expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps static shell route surfaces unique and safe', () => {
    const routes = [...PLATFORM_V7_COMMAND_ROUTE_SURFACE, ...PLATFORM_V7_SHELL_ROUTE_SURFACE];

    for (const route of routes) {
      expectSafeRoute(route);
    }
    expect(new Set(PLATFORM_V7_COMMAND_ROUTE_SURFACE).size).toBe(PLATFORM_V7_COMMAND_ROUTE_SURFACE.length);
    expect(new Set(PLATFORM_V7_SHELL_ROUTE_SURFACE).size).toBe(PLATFORM_V7_SHELL_ROUTE_SURFACE.length);
  });

  it('keeps execution machine strip routes inside safe platform route families', () => {
    for (const route of PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES) {
      expectSafeRoute(route);
    }
  });

  it('keeps shell route helper output identical to the static shell surface', () => {
    expect(platformV7ShellRouteSurface()).toBe(PLATFORM_V7_SHELL_ROUTE_SURFACE);
  });

  it('keeps quick jump groups and items trimmed', () => {
    for (const group of platformV7QuickJumpGroups()) {
      expect(group.trim()).toBe(group);
      expect(group.length).toBeGreaterThan(0);
    }

    for (const item of platformV7QuickJumpItems()) {
      expect(item.label.trim()).toBe(item.label);
      expect(item.group.trim()).toBe(item.group);
      expectSafeRoute(item.href);
    }
  });

  it('keeps only production allowed to show as live', () => {
    for (const environment of environments) {
      const info = platformV7EnvironmentInfo(environment);

      expect(info.environment).toBe(environment);
      expect(platformV7CanShowAsLive(environment)).toBe(environment === 'production');
    }
  });
});
