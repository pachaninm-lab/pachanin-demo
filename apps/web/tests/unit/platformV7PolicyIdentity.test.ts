import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 policy identity', () => {
  it('has unique ids', () => {
    const ids = PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((item) => item.actionId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
