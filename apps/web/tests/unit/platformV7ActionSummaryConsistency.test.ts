import { describe, expect, it } from 'vitest';
import {
  getPlatformV7ActionPermissionBoundarySummary,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 action summary consistency', () => {
  it('keeps boundary summary counts derived from the action policies', () => {
    const summary = getPlatformV7ActionPermissionBoundarySummary();
    const serviceNames = new Set(PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => policy.serviceName));

    expect(summary.actionCount).toBe(PLATFORM_V7_ACTION_PERMISSION_POLICIES.length);
    expect(summary.serviceCount).toBe(serviceNames.size);
  });
});
