import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
} from '@/lib/platform-v7/action-permission-boundary';
import type { PlatformV7Role } from '@/lib/platform-v7/role-access';

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

describe('platform-v7 action decision reasons', () => {
  it('returns a non-empty reason for every role/action decision', () => {
    for (const role of roles) {
      for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
        const decision = canPlatformV7RoleInvokeAction(role, policy.actionId);

        expect(decision.reason.trim().length, `${role}:${policy.actionId}`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps role-denied actions explicitly explained', () => {
    for (const role of roles) {
      for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
        if (policy.allowedRoles.includes(role)) continue;

        expect(canPlatformV7RoleInvokeAction(role, policy.actionId)).toEqual({
          allowed: false,
          reason: 'Действие закрыто для роли.',
        });
      }
    }
  });
});
