import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE,
  PLATFORM_V7_REPORTS_ROUTE,
  PLATFORM_V7_SIMULATOR_ROUTE,
  PLATFORM_V7_TRUST_ROUTE,
} from '@/lib/platform-v7/routes';
import { platformV7NavByRole, platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';

const nav = (role: Parameters<typeof platformV7NavByRole>[0]) => platformV7NavByRole(role).map((item) => item.href);

describe('platform-v7 controlled pilot nav', () => {
  it('keeps bank and trust routes visible for control roles', () => {
    expect(nav('operator')).toContain(PLATFORM_V7_BANK_CLEAN_ROUTE);
    expect(nav('operator')).toContain(PLATFORM_V7_BANK_EVENTS_ROUTE);
    expect(nav('operator')).toContain(PLATFORM_V7_TRUST_ROUTE);
    expect(nav('operator')).toContain(PLATFORM_V7_REPORTS_ROUTE);

    expect(platformV7RoleRoute('bank')).toBe(PLATFORM_V7_BANK_CLEAN_ROUTE);
    expect(nav('bank')).toContain(PLATFORM_V7_BANK_CLEAN_ROUTE);
    expect(nav('bank')).toContain(PLATFORM_V7_BANK_EVENTS_ROUTE);
    expect(nav('bank')).toContain(PLATFORM_V7_TRUST_ROUTE);
    expect(nav('bank')).toContain(PLATFORM_V7_REPORTS_ROUTE);
  });

  it('keeps demo scenario routes in executive nav only among checked roles', () => {
    expect(nav('executive')).toContain(PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE);
    expect(nav('executive')).toContain(PLATFORM_V7_SIMULATOR_ROUTE);
    expect(nav('executive')).toContain(PLATFORM_V7_BANK_CLEAN_ROUTE);

    expect(nav('driver')).not.toContain(PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE);
    expect(nav('driver')).not.toContain(PLATFORM_V7_SIMULATOR_ROUTE);
    expect(nav('driver')).not.toContain(PLATFORM_V7_BANK_EVENTS_ROUTE);
    expect(nav('driver')).not.toContain(PLATFORM_V7_BANK_CLEAN_ROUTE);
  });
});
