import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionBoundarySummary,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 action boundary guard', () => {
  it('keeps every runtime action behind durable write, audit event and idempotency requirements', () => {
    const summary = getPlatformV7ActionPermissionBoundarySummary();

    expect(summary.mode).toBe('contract_only_requires_runtime');
    expect(summary.actionCount).toBe(PLATFORM_V7_ACTION_PERMISSION_POLICIES.length);
    expect(summary.needsDurableWrite).toBe(true);
    expect(summary.needsAuditEvent).toBe(true);
    expect(summary.needsIdempotencyKey).toBe(true);
  });

  it('keeps all action policies tied to a route, service and non-empty role list', () => {
    const broken = PLATFORM_V7_ACTION_PERMISSION_POLICIES.flatMap((policy) => {
      const issues: string[] = [];
      if (!policy.route.startsWith('/platform-v7')) issues.push('route outside platform-v7');
      if (!policy.serviceName) issues.push('missing service');
      if (policy.allowedRoles.length === 0) issues.push('missing roles');
      if (!policy.needsDurableWrite) issues.push('missing durable write');
      if (!policy.needsAuditEvent) issues.push('missing audit event');
      if (!policy.needsIdempotencyKey) issues.push('missing idempotency key');
      return issues.map((issue) => `${policy.actionId}: ${issue}`);
    });

    expect(broken).toEqual([]);
  });

  it('keeps money release actions away from non-bank participant roles', () => {
    for (const role of ['seller', 'buyer', 'driver', 'elevator', 'lab', 'surveyor', 'arbitrator', 'compliance'] as const) {
      expect(canPlatformV7RoleInvokeAction(role, 'bank.confirm_money_released').allowed, role).toBe(false);
    }
  });
});
