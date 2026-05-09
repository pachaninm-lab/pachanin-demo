import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
} from '@/lib/platform-v7/action-permission-boundary';
import {
  PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES,
  PLATFORM_V7_ROLE_HOME_ROUTE,
  type PlatformV7Role,
} from '@/lib/platform-v7/role-access';

const knownRoles = Object.keys(PLATFORM_V7_ROLE_HOME_ROUTE) as PlatformV7Role[];
const knownRoleSet = new Set(knownRoles);

function isRouteBlockedForRole(role: PlatformV7Role, route: string): boolean {
  return PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES[role].some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`),
  );
}

describe('platform-v7 action policy roles', () => {
  it('uses only registered platform-v7 roles in action policies', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const role of policy.allowedRoles) {
        expect(knownRoleSet.has(role)).toBe(true);
      }
    }
  });

  it('keeps every action policy route inside the platform-v7 route tree', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.route).toMatch(/^\/platform-v7(\/|$)/);
    }
  });

  it('returns only policies that explicitly allow the requested role', () => {
    for (const role of knownRoles) {
      const policiesForRole = getPlatformV7ActionPermissionPoliciesForRole(role);
      const expectedActionIds = PLATFORM_V7_ACTION_PERMISSION_POLICIES.filter((policy) =>
        policy.allowedRoles.includes(role),
      ).map((policy) => policy.actionId);

      expect(policiesForRole.map((policy) => policy.actionId)).toEqual(expectedActionIds);

      for (const policy of policiesForRole) {
        expect(policy.allowedRoles).toContain(role);
      }
    }
  });

  it('does not permit an action when its route is blocked for the role', () => {
    for (const role of knownRoles) {
      for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
        if (isRouteBlockedForRole(role, policy.route)) {
          expect(canPlatformV7RoleInvokeAction(role, policy.actionId).allowed).toBe(false);
        }
      }
    }
  });
});
