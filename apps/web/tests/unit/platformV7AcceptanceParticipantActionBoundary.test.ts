import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 acceptance participant action boundary', () => {
  it('keeps elevator limited to acceptance, incidents, documents and support', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('elevator').map((policy) => policy.actionId)).toEqual([
      'trip.accept',
      'trip.open_incident',
      'document.attach',
      'support.create_case',
      'support.append_message',
    ]);

    expect(canPlatformV7RoleInvokeAction('elevator', 'trip.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('elevator', 'trip.open_incident').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('elevator', 'document.attach').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('elevator', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('elevator', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('elevator', 'arbitration.record_decision').allowed).toBe(false);
  });

  it('keeps lab limited to document attachment and support', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('lab').map((policy) => policy.actionId)).toEqual([
      'document.attach',
      'support.create_case',
      'support.append_message',
    ]);

    expect(canPlatformV7RoleInvokeAction('lab', 'document.attach').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('lab', 'trip.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('lab', 'trip.open_incident').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('lab', 'document.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('lab', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('lab', 'bank.confirm_money_released').allowed).toBe(false);
  });

  it('keeps surveyor limited to acceptance, incidents, documents and support', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('surveyor').map((policy) => policy.actionId)).toEqual([
      'trip.accept',
      'trip.open_incident',
      'document.attach',
      'support.create_case',
      'support.append_message',
    ]);

    expect(canPlatformV7RoleInvokeAction('surveyor', 'trip.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'trip.open_incident').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'document.attach').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('surveyor', 'arbitration.record_decision').allowed).toBe(false);
  });
});
