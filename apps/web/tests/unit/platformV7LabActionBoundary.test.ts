import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 lab action boundary', () => {
  it('keeps lab limited to document attachment and support actions', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('lab').map((policy) => policy.actionId)).toEqual([
      'document.attach',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps lab out of money, logistics, acceptance and arbitration actions', () => {
    expect(canPlatformV7RoleInvokeAction('lab', 'document.attach').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('lab', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('lab', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('lab', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('lab', 'trip.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('lab', 'arbitration.record_decision').allowed).toBe(false);
  });
});
