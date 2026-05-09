import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 investor action boundary', () => {
  it('does not expose execution actions to investors', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('investor')).toEqual([]);
  });

  it('keeps investors out of every write action', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(canPlatformV7RoleInvokeAction('investor', policy.actionId).allowed).toBe(false);
    }
  });
});
