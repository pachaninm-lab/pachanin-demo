import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';
import { PLATFORM_V7_ACTION_SERVICE_MAP } from '@/lib/platform-v7/action-service-map';

describe('platform-v7 action service map completeness', () => {
  it('keeps the service map aligned with action permission policies', () => {
    const policyActionIds = PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => policy.actionId).sort();
    const mapActionIds = Object.keys(PLATFORM_V7_ACTION_SERVICE_MAP).sort();

    expect(mapActionIds).toEqual(policyActionIds);

    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(PLATFORM_V7_ACTION_SERVICE_MAP[policy.actionId]).toBe(policy.serviceName);
    }
  });
});
