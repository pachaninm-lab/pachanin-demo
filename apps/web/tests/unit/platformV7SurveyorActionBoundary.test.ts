import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 surveyor action boundary', () => {
  it('keeps surveyor limited to acceptance, incident, document and support actions', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('surveyor').map((policy) => policy.actionId)).toEqual([
      'trip.accept',
      'trip.open_incident',
      'document.attach',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps surveyor out of money, logistics and arbitration actions', () => {
    expect(canPlatformV7RoleInvokeAction('surveyor', 'trip.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'document.attach').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'arbitration.record_decision').allowed).toBe(false);
  });
});
