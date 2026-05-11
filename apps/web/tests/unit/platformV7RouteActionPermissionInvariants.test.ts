import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import { canPlatformV7RoleOpenRoute, type PlatformV7Role } from '@/lib/platform-v7/role-access';

const observerRoles = ['investor', 'executive'] as const satisfies readonly PlatformV7Role[];
const fieldRoles = ['driver', 'elevator', 'lab', 'surveyor'] as const satisfies readonly PlatformV7Role[];
const commercialRoles = ['seller', 'buyer', 'logistics'] as const satisfies readonly PlatformV7Role[];
const physicalRoles = ['driver', 'elevator', 'lab', 'surveyor', 'logistics'] as const satisfies readonly PlatformV7Role[];
const fieldRouteReaderRoles = ['seller', 'buyer', 'logistics', 'elevator', 'surveyor'] as const satisfies readonly PlatformV7Role[];

function policyFor(actionId: PlatformV7ActionPermissionId) {
  const policy = PLATFORM_V7_ACTION_PERMISSION_POLICIES.find((item) => item.actionId === actionId);
  if (!policy) throw new Error(`Missing policy: ${actionId}`);
  return policy;
}

describe('platform-v7 route and action permission invariants', () => {
  it('keeps observer roles out of action allowedRoles', () => {
    PLATFORM_V7_ACTION_PERMISSION_POLICIES.forEach((policy) => {
      observerRoles.forEach((role) => {
        expect(policy.allowedRoles).not.toContain(role);
      });
    });
  });

  it('keeps bank confirmation actions bank-only', () => {
    expect(policyFor('bank.confirm_money_reserved').allowedRoles).toEqual(['bank']);
    expect(policyFor('bank.confirm_money_released').allowedRoles).toEqual(['bank']);
  });

  it('keeps bank route actions away from field and commercial roles', () => {
    const bankRoutePolicies = PLATFORM_V7_ACTION_PERMISSION_POLICIES.filter((policy) => policy.route.startsWith('/platform-v7/bank'));
    expect(bankRoutePolicies.length).toBeGreaterThan(0);

    bankRoutePolicies.forEach((policy) => {
      [...fieldRoles, ...commercialRoles].forEach((role) => {
        expect(policy.allowedRoles).not.toContain(role);
      });
    });
  });

  it('keeps bank out of lot creation route', () => {
    expect(canPlatformV7RoleOpenRoute('bank', '/platform-v7/lots/create')).toMatchObject({ allowed: false });
  });

  it('keeps lab blocked from driver field while elevator and surveyor retain route access', () => {
    expect(canPlatformV7RoleOpenRoute('lab', '/platform-v7/driver/field')).toMatchObject({ allowed: false });
    expect(canPlatformV7RoleOpenRoute('elevator', '/platform-v7/driver/field')).toMatchObject({ allowed: true });
    expect(canPlatformV7RoleOpenRoute('surveyor', '/platform-v7/driver/field')).toMatchObject({ allowed: true });
  });

  it('keeps field route access separate from driver checkpoint authority', () => {
    fieldRouteReaderRoles.forEach((role) => {
      expect(canPlatformV7RoleOpenRoute(role, '/platform-v7/driver/field')).toMatchObject({ allowed: true });
      expect(canPlatformV7RoleInvokeAction(role, 'driver.confirm_checkpoint')).toMatchObject({ allowed: false });
    });
  });

  it('keeps physical delivery roles away from bank money confirmation actions', () => {
    physicalRoles.forEach((role) => {
      expect(canPlatformV7RoleInvokeAction(role, 'bank.confirm_money_reserved')).toMatchObject({ allowed: false });
      expect(canPlatformV7RoleInvokeAction(role, 'bank.confirm_money_released')).toMatchObject({ allowed: false });
    });
  });

  it('has no policy where an allowed role is blocked from the policy route', () => {
    PLATFORM_V7_ACTION_PERMISSION_POLICIES.forEach((policy) => {
      policy.allowedRoles.forEach((role) => {
        expect(canPlatformV7RoleOpenRoute(role, policy.route), `${role} should open ${policy.route} for ${policy.actionId}`).toMatchObject({ allowed: true });
      });
    });
  });

  it('returns a concrete denial or approval for every policy and platform role pair', () => {
    const roles: readonly PlatformV7Role[] = [
      'seller',
      'buyer',
      'logistics',
      'driver',
      'elevator',
      'lab',
      'surveyor',
      'bank',
      'operator',
      'arbitrator',
      'compliance',
      'investor',
      'executive',
    ];

    PLATFORM_V7_ACTION_PERMISSION_POLICIES.forEach((policy) => {
      roles.forEach((role) => {
        const decision = canPlatformV7RoleInvokeAction(role, policy.actionId);
        expect(typeof decision.allowed).toBe('boolean');
        expect(decision.reason.length).toBeGreaterThan(0);
      });
    });
  });
});
