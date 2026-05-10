import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 elevator action boundary', () => {
  it('keeps elevator limited to acceptance, incident, document and support actions', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('elevator').map((policy) => policy.actionId)).toEqual([
      'trip.accept',
      'trip.open_incident',
      'document.attach',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps elevator out of money, logistics and arbitration actions', () => {
    expect(canPlatformV7RoleInvokeAction('elevator', 'trip.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('elevator', 'document.attach').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('elevator', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('elevator', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('elevator', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('elevator', 'arbitration.record_decision').allowed).toBe(false);
  });
});
