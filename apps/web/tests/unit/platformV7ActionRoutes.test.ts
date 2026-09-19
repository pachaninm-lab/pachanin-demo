import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_PERMISSION_POLICIES } from '@/lib/platform-v7/action-permission-boundary';

const DISALLOWED_ACTION_BOUNDARY_ROUTE_SEGMENTS = ['/demo', '/marketplace', '/domain-core'] as const;

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
      expect(policy.route.includes('?'), policy.actionId).toBe(false);
      expect(policy.route.includes('#'), policy.actionId).toBe(false);
      expect(policy.route.endsWith('/'), policy.actionId).toBe(false);
      expect(policy.route).toBe(policy.route.toLowerCase());
      expect(policy.route).toMatch(/^\/platform-v7\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
    }
  });

  it('keeps action permission routes away from weak legacy surfaces', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      for (const segment of DISALLOWED_ACTION_BOUNDARY_ROUTE_SEGMENTS) {
        expect(policy.route.includes(segment), policy.actionId).toBe(false);
      }
    }
  });

  it('keeps action permission policies unique by action id', () => {
    const actionIds = PLATFORM_V7_ACTION_PERMISSION_POLICIES.map((policy) => policy.actionId);
    expect(new Set(actionIds).size).toBe(actionIds.length);
  });

  it('keeps action permission action ids namespaced and non-route-like', () => {
    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      expect(policy.actionId.includes('.'), policy.route).toBe(true);
      expect(policy.actionId.includes('/'), policy.route).toBe(false);
      expect(policy.actionId.includes('?'), policy.route).toBe(false);
      expect(policy.actionId.includes('#'), policy.route).toBe(false);
      expect(policy.actionId).toMatch(/^[a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*$/);
    }
  });

  it('keeps shared action permission policy routes explicit', () => {
    const actionIdsByRoute = new Map<string, string[]>();

    for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
      actionIdsByRoute.set(policy.route, [...(actionIdsByRoute.get(policy.route) ?? []), policy.actionId]);
    }

    const sharedRoutes = [...actionIdsByRoute.entries()]
      .filter(([, actionIds]) => actionIds.length > 1)
      .map(([route, actionIds]) => [route, actionIds] as const);

    expect(sharedRoutes).toEqual([
      ['/platform-v7/buyer', ['buyer.submit_offer', 'money.request_reserve']],
      ['/platform-v7/deals', ['proposal.submit', 'proposal.accept', 'deal.confirm_terms', 'trip.accept']],
      [
        '/platform-v7/bank',
        ['bank.confirm_money_reserved', 'bank.mark_money_ready_to_release', 'bank.confirm_money_released'],
      ],
      ['/platform-v7/logistics', ['logistics.assign_driver', 'trip.open_incident']],
      ['/platform-v7/disputes', ['dispute.open', 'arbitration.record_decision']],
    ]);
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
      expect(policy.serviceName.includes('/'), policy.actionId).toBe(false);
      expect(policy.serviceName.includes('?'), policy.actionId).toBe(false);
      expect(policy.serviceName.includes('#'), policy.actionId).toBe(false);
      expect(policy.serviceName).toMatch(/^[a-z]+(?:_[a-z]+)*$/);
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
