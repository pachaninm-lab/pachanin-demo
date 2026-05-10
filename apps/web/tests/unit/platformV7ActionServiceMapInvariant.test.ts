import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import {
  getPlatformV7ActionServiceName,
  PLATFORM_V7_ACTION_SERVICE_MAP,
} from '@/lib/platform-v7/action-service-map';
import { PLATFORM_V7_EXECUTION_SERVICE_NAMES } from '@/lib/platform-v7/execution-service-registry-contract';

const policyActionIds = PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => policy.actionId);
const serviceMapActionIds = Object.keys(PLATFORM_V7_ACTION_SERVICE_MAP) as PlatformV7ActionPermissionId[];
const executionServiceNames = new Set<string>(PLATFORM_V7_EXECUTION_SERVICE_NAMES);

describe('platform-v7 action service map invariant', () => {
  it('keeps the action service map complete against permission policies', () => {
    expect(serviceMapActionIds.toSorted()).toEqual(policyActionIds.toSorted());
  });

  it('keeps every mapped service inside the execution service registry', () => {
    for (const [actionId, serviceName] of Object.entries(PLATFORM_V7_ACTION_SERVICE_MAP)) {
      expect(executionServiceNames.has(serviceName), `${actionId}:${serviceName}`).toBe(true);
      expect(serviceName.trim(), actionId).toBe(serviceName);
    }
  });

  it('keeps action-service helper aligned with policy service names', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(getPlatformV7ActionServiceName(policy.actionId), policy.actionId).toBe(policy.serviceName);
    }
  });

  it('keeps critical execution services represented by at least one action', () => {
    const representedServices = new Set(Object.values(PLATFORM_V7_ACTION_SERVICE_MAP));

    expect(representedServices.has('money')).toBe(true);
    expect(representedServices.has('document')).toBe(true);
    expect(representedServices.has('logistics')).toBe(true);
    expect(representedServices.has('trip')).toBe(true);
    expect(representedServices.has('dispute')).toBe(true);
    expect(representedServices.has('support')).toBe(true);
  });
});
