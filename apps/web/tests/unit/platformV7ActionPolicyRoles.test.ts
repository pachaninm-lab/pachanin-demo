import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';
import { PLATFORM_V7_ROLE_HOME_ROUTE, type PlatformV7Role } from '@/lib/platform-v7/role-access';

const knownRoles = new Set(Object.keys(PLATFORM_V7_ROLE_HOME_ROUTE) as PlatformV7Role[]);

describe('platform-v7 action policy roles', () => {
  it('uses only registered platform-v7 roles in action policies', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const role of policy.allowedRoles) {
        expect(knownRoles.has(role)).toBe(true);
      }
    }
  });

  it('keeps every action policy route inside the platform-v7 route tree', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.route).toMatch(/^\/platform-v7(\/|$)/);
    }
  });
});
