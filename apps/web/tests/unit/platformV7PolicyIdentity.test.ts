import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';
import {
  PLATFORM_V7_EXECUTION_SERVICE_NAMES,
  hasUniquePlatformV7ExecutionServiceNames,
} from '@/lib/platform-v7/execution-service-registry-contract';

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

  it('does not repeat roles inside one policy', () => {
    for (const item of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(new Set(item.allowedRoles).size).toBe(item.allowedRoles.length);
    }
  });

  it('keeps every policy behind execution boundaries', () => {
    for (const item of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(item.needsDurableWrite).toBe(true);
      expect(item.needsAuditEvent).toBe(true);
      expect(item.needsIdempotencyKey).toBe(true);
    }
  });

  it('keeps every policy route inside platform-v7', () => {
    for (const item of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(item.route.startsWith('/platform-v7')).toBe(true);
    }
  });

  it('keeps execution service names unique', () => {
    expect(hasUniquePlatformV7ExecutionServiceNames()).toBe(true);
    expect(hasUniquePlatformV7ExecutionServiceNames(['deal', 'deal'])).toBe(false);
  });

  it('uses registered services', () => {
    const services = new Set(PLATFORM_V7_EXECUTION_SERVICE_NAMES);

    for (const item of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(services.has(item.serviceName)).toBe(true);
    }
  });
});
