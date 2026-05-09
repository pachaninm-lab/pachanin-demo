import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 action routes', () => {
  it('keeps all action routes inside platform-v7', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.route.startsWith('/platform-v7/'), policy.actionId).toBe(true);
    }
  });

  it('keeps action route values normalized', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.actionId.trim(), policy.route).toBe(policy.actionId);
      expect(policy.route.trim(), policy.actionId).toBe(policy.route);
      expect(policy.route.includes(' '), policy.actionId).toBe(false);
      expect(policy.route.includes('//'), policy.actionId).toBe(false);
    }
  });
});
