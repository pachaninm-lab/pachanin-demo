import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 action routes', () => {
  it('keeps all action routes inside platform-v7', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.route.startsWith('/platform-v7/'), policy.actionId).toBe(true);
    }
  });
});
