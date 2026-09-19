import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import {
  PLATFORM_V7_ROLE_BLOCKED_ROUTE_PREFIXES,
  PLATFORM_V7_ROLE_HOME_ROUTE,
  type PlatformV7Role,
} from '@/lib/platform-v7/role-access';

const knownRoles = Object.keys(PLATFORM_V7_ROLE_HOME_ROUTE) as PlatformV7Role[];
const knownRoleSet = new Set(knownRoles);

type CriticalActionMatrixRole = 'bank' | 'driver' | 'investor' | 'compliance' | 'operator';

const criticalActionMatrixRoles = [
  'bank',
  'driver',
  'investor',
  'compliance',
  'operator',
] as const satisfies readonly CriticalActionMatrixRole[];

const criticalRoleAllowedActionIds = {
  bank: [
    'bank.confirm_money_reserved',
    'bank.mark_money_ready_to_release',
    'bank.confirm_money_released',
    'arbitration.record_decision',
    'support.create_case',
    'support.append_message',
  ],
  driver: [
    'driver.confirm_checkpoint',
    'trip.open_incident',
    'support.create_case',
    'support.append_message',
  ],
  investor: [],
  compliance: [
    'document.accept',
    'dispute.open',
    'support.create_case',
    'support.append_message',
  ],
  operator: [
    'seller.create_batch',
    'seller.publish_lot',
    'buyer.create_rfq',
    'buyer.submit_offer',
    'seller.accept_offer',
    'deal.confirm_terms',
    'money.request_reserve',
    'bank.mark_money_ready_to_release',
    'logistics.assign_driver',
    'driver.confirm_checkpoint',
    'trip.accept',
    'trip.open_incident',
    'document.attach',
    'document.accept',
    'dispute.open',
    'arbitration.record_decision',
    'support.create_case',
    'support.append_message',
  ],
} as const satisfies Record<CriticalActionMatrixRole, readonly PlatformV7ActionPermissionId[]>;

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

  it('keeps the critical role action permission matrix explicit', () => {
    for (const role of criticalActionMatrixRoles) {
      const allowedActionIds = getPlatformV7ActionPermissionPoliciesForRole(role).map(
        (policy) => policy.actionId,
      );

      expect(allowedActionIds).toEqual(criticalRoleAllowedActionIds[role]);

      for (const actionId of criticalRoleAllowedActionIds[role]) {
        expect(canPlatformV7RoleInvokeAction(role, actionId).allowed).toBe(true);
      }
    }
  });

  it('keeps investor read-only at the action boundary', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('investor')).toEqual([]);

    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(canPlatformV7RoleInvokeAction('investor', policy.actionId).allowed).toBe(false);
    }
  });
});
