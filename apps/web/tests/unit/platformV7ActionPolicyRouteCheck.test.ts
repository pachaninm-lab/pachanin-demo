import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
} from '@/lib/platform-v7/action-permission-boundary';
import type { PlatformV7Role } from '@/lib/platform-v7/role-access';

const ALL_ROLES = [
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

describe('platform-v7 action policy route check', () => {
  it('allows every listed role to invoke its listed action route', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const role of policy.allowedRoles) {
        expect(canPlatformV7RoleInvokeAction(role, policy.actionId)).toEqual({
          allowed: true,
          reason: 'Маршрут доступен для роли.',
        });
      }
    }
  });

  it('denies every unlisted role before route access is considered', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const role of ALL_ROLES) {
        if (policy.allowedRoles.includes(role)) continue;

        expect(canPlatformV7RoleInvokeAction(role, policy.actionId)).toEqual({
          allowed: false,
          reason: 'Действие закрыто для роли.',
        });
      }
    }
  });
});
