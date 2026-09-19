import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 logistics action boundary', () => {
  it('keeps logistics limited to driver assignment, incident, document and support actions', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('logistics').map((policy) => policy.actionId)).toEqual([
      'logistics.assign_driver',
      'trip.open_incident',
      'document.attach',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps logistics out of money, bank, acceptance and arbitration actions', () => {
    expect(canPlatformV7RoleInvokeAction('logistics', 'logistics.assign_driver').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('logistics', 'trip.open_incident').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('logistics', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('logistics', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('logistics', 'trip.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('logistics', 'arbitration.record_decision').allowed).toBe(false);
  });
});
