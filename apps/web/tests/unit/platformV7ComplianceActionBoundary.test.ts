import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 compliance action boundary', () => {
  it('keeps compliance limited to document review, dispute opening and support actions', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('compliance').map((policy) => policy.actionId)).toEqual([
      'document.accept',
      'dispute.open',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps compliance out of money, logistics and arbitration execution actions', () => {
    expect(canPlatformV7RoleInvokeAction('compliance', 'document.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('compliance', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'arbitration.record_decision').allowed).toBe(false);
  });
});
