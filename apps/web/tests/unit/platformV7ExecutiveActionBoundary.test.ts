import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 executive action boundary', () => {
  it('does not expose execution actions to executives', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('executive')).toEqual([]);
  });

  it('keeps executives out of every write action', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(canPlatformV7RoleInvokeAction('executive', policy.actionId).allowed).toBe(false);
    }
  });
});
