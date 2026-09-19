import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 action runtime flags', () => {
  it('sets all write flags on every action policy', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.needsDurableWrite).toBe(true);
      expect(policy.needsAuditEvent).toBe(true);
      expect(policy.needsIdempotencyKey).toBe(true);
    }
  });
});
