import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_AUTH_ROUTE,
  PLATFORM_V7_BANK_ROUTE,
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_CONNECTORS_ROUTE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_OPERATOR_QUEUES_ROUTE,
  PLATFORM_V7_PROFILE_ROUTE,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
  PLATFORM_V7_STATUS_ROUTE,
} from '@/lib/platform-v7/routes';

describe('platform-v7 connector routing registry', () => {
  it('keeps connector targets in command and shell route surfaces', () => {
    const connectorTargets = [
      PLATFORM_V7_CONNECTORS_ROUTE,
      PLATFORM_V7_AUTH_ROUTE,
      PLATFORM_V7_BANK_ROUTE,
      PLATFORM_V7_STATUS_ROUTE,
      PLATFORM_V7_PROFILE_ROUTE,
      PLATFORM_V7_OPERATOR_QUEUES_ROUTE,
    ];

    for (const route of connectorTargets) {
      expect(PLATFORM_V7_COMMAND_ROUTE_SURFACE).toContain(route);
      expect(PLATFORM_V7_SHELL_ROUTE_SURFACE).toContain(route);
    }
  });

  it('keeps connectors inside execution machine strip because FGIS/ESIA gates can block money release', () => {
    expect(PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES).toContain(PLATFORM_V7_CONNECTORS_ROUTE);
  });

  it('uses platform-v7 canonical URLs for connector target routes', () => {
    expect(PLATFORM_V7_AUTH_ROUTE).toBe('/platform-v7/auth');
    expect(PLATFORM_V7_STATUS_ROUTE).toBe('/platform-v7/status');
    expect(PLATFORM_V7_PROFILE_ROUTE).toBe('/platform-v7/profile');
    expect(PLATFORM_V7_OPERATOR_QUEUES_ROUTE).toBe('/platform-v7/operator-cockpit/queues');
  });
});
