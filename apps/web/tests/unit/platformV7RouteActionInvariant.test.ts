import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
} from '@/lib/platform-v7/action-permission-boundary';
import { canPlatformV7RoleOpenRoute, type PlatformV7Role } from '@/lib/platform-v7/role-access';

const roles = [
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
] as const satisfies readonly PlatformV7Role[];

describe('platform-v7 route action invariant', () => {
  it('does not allow an action unless the role is listed and can open the action route', () => {
    for (const role of roles) {
      for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
        const actionAllowed = canPlatformV7RoleInvokeAction(role, policy.actionId).allowed;
        const roleListed = policy.allowedRoles.includes(role);
        const routeAllowed = canPlatformV7RoleOpenRoute(role, policy.route).allowed;

        expect(actionAllowed).toBe(roleListed && routeAllowed);
      }
    }
  });
});
