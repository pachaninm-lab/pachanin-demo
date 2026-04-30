import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_AUTH_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_CONNECTORS_ROUTE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_EXECUTIVE_ROUTE,
  PLATFORM_V7_INVESTOR_ROUTE,
  PLATFORM_V7_OPERATOR_QUEUES_ROUTE,
  PLATFORM_V7_PROFILE_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  PLATFORM_V7_STATUS_ROUTE,
} from '@/lib/platform-v7/routes';

const recentPlatformRoutes = [
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_CONNECTORS_ROUTE,
  PLATFORM_V7_AUTH_ROUTE,
  PLATFORM_V7_STATUS_ROUTE,
  PLATFORM_V7_PROFILE_ROUTE,
  PLATFORM_V7_OPERATOR_QUEUES_ROUTE,
  PLATFORM_V7_INVESTOR_ROUTE,
  PLATFORM_V7_EXECUTIVE_ROUTE,
] as const;

const moneyBlockingRoutes = [
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_CONNECTORS_ROUTE,
] as const;

describe('platform-v7 recent route surface closure', () => {
  it('keeps recent platform routes available through command surface', () => {
    for (const route of recentPlatformRoutes) {
      expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(route);
    }
  });

  it('keeps recent operator-facing routes available through shell surface', () => {
    for (const route of recentPlatformRoutes) {
      expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(route);
    }
  });

  it('keeps money-blocking routes inside execution strip', () => {
    for (const route of moneyBlockingRoutes) {
      expect(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).toContain(route);
    }
  });

  it('keeps recent route surfaces unique and canonical', () => {
    const commandSurface = new Set(PLATFORM_V7_COMMAND_ROUTE_SURFACE);
    const shellSurface = new Set(PLATFORM_V7_SHELL_ROUTE_SURFACE);

    expect(commandSurface.size).toBe(PLATFORM_V7_COMMAND_ROUTE_SURFACE.length);
    expect(shellSurface.size).toBe(PLATFORM_V7_SHELL_ROUTE_SURFACE.length);

    for (const route of recentPlatformRoutes) {
      expect(route.startsWith('/platform-v7')).toBe(true);
      expect(route.includes('/platform-v4')).toBe(false);
      expect(route.includes('/platform-v9')).toBe(false);
    }
  });
});
