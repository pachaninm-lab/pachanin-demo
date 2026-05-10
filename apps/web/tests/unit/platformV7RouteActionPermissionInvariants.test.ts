import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPolicy,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import {
  canPlatformV7RoleOpenRoute,
  type PlatformV7Role,
} from '@/lib/platform-v7/role-access';

const ALL_ROLES: readonly PlatformV7Role[] = [
  'seller', 'buyer', 'logistics', 'driver', 'elevator',
  'lab', 'surveyor', 'bank', 'operator', 'arbitrator',
  'compliance', 'investor', 'executive',
];

describe('platform-v7 route-action permission invariants', () => {
  it('observer roles are absent from every action policy allowed list — static data invariant', () => {
    const observerRoles: readonly PlatformV7Role[] = ['investor', 'executive'];

    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const observerRole of observerRoles) {
        expect(
          policy.allowedRoles,
          `${observerRole} must not appear in allowedRoles for ${policy.actionId}`,
        ).not.toContain(observerRole);
      }
    }
  });

  it('bank confirmation actions statically list only bank as the allowed role', () => {
    const bankOnlyActions: readonly PlatformV7ActionPermissionId[] = [
      'bank.confirm_money_reserved',
      'bank.confirm_money_released',
    ];

    for (const actionId of bankOnlyActions) {
      const policy = getPlatformV7ActionPermissionPolicy(actionId);
      expect(policy.allowedRoles).toEqual(['bank']);
    }
  });

  it('bank-route action policies contain no field execution, commercial, or physical delivery roles', () => {
    const bankRoutePolicies = PLATFORM_V7_ACTION_PERMISSION_POLICIES.filter(
      (p) => p.route === '/platform-v7/bank',
    );

    const forbiddenInBankPolicies: readonly PlatformV7Role[] = [
      'driver', 'logistics', 'seller', 'buyer', 'elevator', 'lab', 'surveyor',
      'arbitrator', 'compliance', 'investor', 'executive',
    ];

    for (const policy of bankRoutePolicies) {
      for (const role of forbiddenInBankPolicies) {
        expect(
          policy.allowedRoles,
          `${role} must not appear in allowedRoles for bank-route action ${policy.actionId}`,
        ).not.toContain(role);
      }
    }
  });

  it('bank is blocked from the lot publication route — bank cannot enter the seller surface', () => {
    expect(canPlatformV7RoleOpenRoute('bank', '/platform-v7/lots/create').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('bank', '/platform-v7/lots/create/draft').allowed).toBe(false);
  });

  it('lab is uniquely blocked from driver/field while elevator and surveyor retain route access', () => {
    expect(canPlatformV7RoleOpenRoute('lab', '/platform-v7/driver/field').allowed).toBe(false);
    expect(canPlatformV7RoleOpenRoute('elevator', '/platform-v7/driver/field').allowed).toBe(true);
    expect(canPlatformV7RoleOpenRoute('surveyor', '/platform-v7/driver/field').allowed).toBe(true);
  });

  it('bank, lab and judicial-oversight roles are route-blocked from the driver field shell', () => {
    const blockedFromField: readonly PlatformV7Role[] = [
      'bank', 'lab', 'arbitrator', 'compliance', 'investor', 'executive',
    ];

    for (const role of blockedFromField) {
      expect(
        canPlatformV7RoleOpenRoute(role, '/platform-v7/driver/field').allowed,
        `${role} must be blocked from /platform-v7/driver/field`,
      ).toBe(false);
    }
  });

  it('roles that can open driver/field but are absent from checkpoint allowedRoles cannot invoke the action — two-layer denial', () => {
    const openButNotAllowed: readonly PlatformV7Role[] = [
      'seller', 'buyer', 'logistics', 'elevator', 'surveyor',
    ];

    for (const role of openButNotAllowed) {
      expect(
        canPlatformV7RoleOpenRoute(role, '/platform-v7/driver/field').allowed,
        `${role} should be able to open /platform-v7/driver/field`,
      ).toBe(true);
      expect(
        canPlatformV7RoleInvokeAction(role, 'driver.confirm_checkpoint').allowed,
        `${role} must not invoke driver.confirm_checkpoint despite route access`,
      ).toBe(false);
    }
  });

  it('no allowed role is simultaneously blocked from its action route — policy data has no internal contradictions', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const role of policy.allowedRoles) {
        expect(
          canPlatformV7RoleOpenRoute(role, policy.route).allowed,
          `${role} is in allowedRoles for ${policy.actionId} but is route-blocked from ${policy.route} — contradiction`,
        ).toBe(true);
      }
    }
  });

  it('every role that cannot invoke an action is either not listed or route-blocked — decision reasons are well-typed', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const role of ALL_ROLES) {
        const decision = canPlatformV7RoleInvokeAction(role, policy.actionId);

        if (decision.allowed) {
          expect(policy.allowedRoles).toContain(role);
          expect(canPlatformV7RoleOpenRoute(role, policy.route).allowed).toBe(true);
        } else {
          const roleListed = policy.allowedRoles.includes(role);
          const routeAllowed = canPlatformV7RoleOpenRoute(role, policy.route).allowed;
          expect(roleListed && routeAllowed).toBe(false);
        }
      }
    }
  });
});
