import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_BANK_CLEAN_ROUTE,
  PLATFORM_V7_BANK_EVENTS_ROUTE,
  PLATFORM_V7_CONTROL_TOWER_ROUTE,
  PLATFORM_V7_DEALS_ROUTE,
  PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE,
  PLATFORM_V7_EXECUTIVE_ROUTE,
  PLATFORM_V7_SIMULATOR_ROUTE,
} from '@/lib/platform-v7/routes';
import { platformV7NavByRole, platformV7RoleRoute } from '@/lib/platform-v7/shellRoutes';

// platformV7NavByRole returns the role's bottom dock — strictly scoped to the
// role's own cabinet (cross-cabinet routes live in the drawer, not the dock).
const nav = (role: Parameters<typeof platformV7NavByRole>[0]) => platformV7NavByRole(role).map((item) => item.href);

describe('platform-v7 controlled pilot nav', () => {
  it('keeps each control cabinet dock scoped to its own surfaces', () => {
    expect(nav('operator')).toContain(PLATFORM_V7_CONTROL_TOWER_ROUTE);
    expect(nav('operator')).toContain(PLATFORM_V7_DEALS_ROUTE);

    expect(platformV7RoleRoute('bank')).toBe(PLATFORM_V7_BANK_CLEAN_ROUTE);
    expect(nav('bank')).toContain(PLATFORM_V7_BANK_CLEAN_ROUTE);

    expect(nav('executive')).toContain(PLATFORM_V7_EXECUTIVE_ROUTE);
  });

  it('keeps field roles isolated from control/demo/bank routes', () => {
    expect(nav('driver')).not.toContain(PLATFORM_V7_DEMO_EXECUTION_FLOW_ROUTE);
    expect(nav('driver')).not.toContain(PLATFORM_V7_SIMULATOR_ROUTE);
    expect(nav('driver')).not.toContain(PLATFORM_V7_BANK_EVENTS_ROUTE);
    expect(nav('driver')).not.toContain(PLATFORM_V7_BANK_CLEAN_ROUTE);
  });
});
