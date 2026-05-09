import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';
import { PLATFORM_V7_EXECUTION_SERVICE_NAMES } from '@/lib/platform-v7/execution-service-registry-contract';

describe('platform-v7 policy identity', () => {
  it('has unique ids', () => {
    const ids = PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((item) => item.actionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has at least one role per policy', () => {
    for (const item of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(item.allowedRoles.length).toBeGreaterThan(0);
    }
  });

  it('uses registered services', () => {
    const services = new Set(PLATFORM_V7_EXECUTION_SERVICE_NAMES);

    for (const item of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(services.has(item.serviceName)).toBe(true);
    }
  });
});
