import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 action routes', () => {
  it('keeps all action routes inside platform-v7', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.route.startsWith('/platform-v7/'), policy.actionId).toBe(true);
    }
  });

  it('keeps action route values normalized', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.actionId.trim(), policy.route).toBe(policy.actionId);
      expect(policy.route.trim(), policy.actionId).toBe(policy.route);
      expect(policy.route.includes(' '), policy.actionId).toBe(false);
      expect(policy.route.includes('//'), policy.actionId).toBe(false);
    }
  });

  it('keeps action permission policies unique by action id', () => {
    const actionIds = PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => policy.actionId);
    expect(new Set(actionIds).size).toBe(actionIds.length);
  });

  it('keeps action permission policies audit-ready', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.needsDurableWrite, policy.actionId).toBe(true);
      expect(policy.needsAuditEvent, policy.actionId).toBe(true);
      expect(policy.needsIdempotencyKey, policy.actionId).toBe(true);
    }
  });

  it('keeps action permission policies assigned to roles and services', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.allowedRoles.length, policy.actionId).toBeGreaterThan(0);
      expect(policy.serviceName.length, policy.actionId).toBeGreaterThan(0);
      expect(policy.serviceName.trim(), policy.actionId).toBe(policy.serviceName);
    }
  });

  it('keeps action permission roles normalized and unique per policy', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(new Set(policy.allowedRoles).size, policy.actionId).toBe(policy.allowedRoles.length);

      for (const role of policy.allowedRoles) {
        expect(role.trim(), policy.actionId).toBe(role);
      }
    }
  });
});
