import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';
import { PLATFORM_V7_EXECUTION_SERVICE_NAMES } from '@/lib/platform-v7/execution-service-registry-contract';

describe('platform-v7 execution registry boundary', () => {
  it('keeps action service references inside the execution service registry', () => {
    const serviceNames = new Set<string>(PLATFORM_V7_EXECUTION_SERVICE_NAMES);

    expect(
      PLATFORM_V7_ACTION_PERMISSION_POLICIES.every((policy) => serviceNames.has(policy.serviceName)),
    ).toBe(true);
  });
});
