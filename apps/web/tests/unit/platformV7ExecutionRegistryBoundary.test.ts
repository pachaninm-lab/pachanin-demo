import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';
import {
  doesPlatformV7ExecutionRegistryRequireTripBoundary,
  hasOnlyNamedPlatformV7ExecutionServices,
  hasUniquePlatformV7ExecutionServiceNames,
  isPlatformV7ExecutionServiceName,
  PLATFORM_V7_EXECUTION_SERVICE_NAMES,
} from '@/lib/platform-v7/execution-service-registry-contract';

describe('platform-v7 execution registry boundary', () => {
  it('keeps execution service names unique, named and trip-aware', () => {
    expect(hasUniquePlatformV7ExecutionServiceNames()).toBe(true);
    expect(hasOnlyNamedPlatformV7ExecutionServices()).toBe(true);
    expect(doesPlatformV7ExecutionRegistryRequireTripBoundary()).toBe(true);
  });

  it('keeps action service references inside the execution service registry', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(isPlatformV7ExecutionServiceName(policy.serviceName), policy.actionId).toBe(true);
    }
  });

  it('keeps every action service represented by the registry set', () => {
    const policyServiceNames = new Set(
      PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => policy.serviceName),
    );

    for (const serviceName of policyServiceNames) {
      expect(PLATFORM_V7_EXECUTION_SERVICE_NAMES).toContain(serviceName);
    }
  });
});
