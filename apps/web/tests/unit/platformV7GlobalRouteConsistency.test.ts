import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ANTI_BYPASS_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_CONNECTORS_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_READINESS_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  PLATFORM_V7_TRADING_ROUTE,
} from '@/lib/platform-v7/routes';

const criticalExecutionRoutes = [
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_READINESS_ROUTE,
  PLATFORM_V7_RELEASE_SAFETY_ROUTE,
  PLATFORM_V7_BANK_FACTORING_ROUTE,
  PLATFORM_V7_BANK_ESCROW_ROUTE,
  PLATFORM_V7_LOGISTICS_ROUTE,
  PLATFORM_V7_DISPUTES_ROUTE,
  PLATFORM_V7_CONNECTORS_ROUTE,
  PLATFORM_V7_ANTI_BYPASS_ROUTE,
  PLATFORM_V7_TRADING_ROUTE,
] as const;

describe('platform-v7 global route consistency', () => {
  it('keeps critical execution routes reachable from command surface', () => {
    for (const route of criticalExecutionRoutes) {
      expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(route);
    }
  });

  it('keeps operator execution routes available in shell navigation surface', () => {
    const shellCriticalRoutes = [
      PLATFORM_V7_DEALS_ROUTE,
      PLATFORM_V7_RELEASE_SAFETY_ROUTE,
      PLATFORM_V7_BANK_FACTORING_ROUTE,
      PLATFORM_V7_BANK_ESCROW_ROUTE,
      PLATFORM_V7_LOGISTICS_ROUTE,
      PLATFORM_V7_DISPUTES_ROUTE,
      PLATFORM_V7_CONNECTORS_ROUTE,
    ] as const;

    for (const route of shellCriticalRoutes) {
      expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(route);
    }
  });

  it('keeps money, logistics, documents, dispute and connector gates inside execution strip', () => {
    const stripCriticalRoutes = [
      PLATFORM_V7_READINESS_ROUTE,
      PLATFORM_V7_RELEASE_SAFETY_ROUTE,
      PLATFORM_V7_BANK_FACTORING_ROUTE,
      PLATFORM_V7_BANK_ESCROW_ROUTE,
      PLATFORM_V7_LOGISTICS_ROUTE,
      PLATFORM_V7_DISPUTES_ROUTE,
      PLATFORM_V7_CONNECTORS_ROUTE,
    ] as const;

    for (const route of stripCriticalRoutes) {
      expect(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).toContain(route);
    }
  });

  it('keeps all platform-v7 surfaces canonical and unique', () => {
    const surfaces = [
      ...PLATFORM_V7_COMMAND_ROUTE_SURFACE,
      ...PLATFORM_V7_SHELL_ROUTE_SURFACE,
      ...PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
    ];

    for (const route of surfaces) {
      expect(route.startsWith('/platform-v7')).toBe(true);
      expect(route.includes('/platform-v4')).toBe(false);
      expect(route.includes('/platform-v9')).toBe(false);
    }

    expect(new Set(PLATFORM_V7_COMMAND_ROUTE_SURFACE).size).toBe(PLATFORM_V7_COMMAND_ROUTE_SURFACE.length);
    expect(new Set(PLATFORM_V7_SHELL_ROUTE_SURFACE).size).toBe(PLATFORM_V7_SHELL_ROUTE_SURFACE.length);
    expect(new Set(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).size).toBe(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES.length);
  });
});
