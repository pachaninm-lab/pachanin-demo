import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import type { PlatformV7Role } from '@/lib/platform-v7/role-access';

const MONEY_BANK_ACTIONS = [
  'money.request_reserve',
  'bank.confirm_money_reserved',
  'bank.mark_money_ready_to_release',
  'bank.confirm_money_released',
] as const satisfies readonly PlatformV7ActionPermissionId[];

const PHYSICAL_EXECUTION_ACTIONS = [
  'logistics.assign_driver',
  'driver.confirm_checkpoint',
  'trip.accept',
  'trip.open_incident',
] as const satisfies readonly PlatformV7ActionPermissionId[];

const SENSITIVE_DENY_MATRIX = [
  {
    role: 'driver',
    actions: [...MONEY_BANK_ACTIONS, 'document.accept', 'arbitration.record_decision', 'logistics.assign_driver'],
  },
  {
    role: 'investor',
    actions: [
      ...MONEY_BANK_ACTIONS,
      ...PHYSICAL_EXECUTION_ACTIONS,
      'document.attach',
      'document.accept',
      'dispute.open',
      'arbitration.record_decision',
      'support.create_case',
      'support.append_message',
    ],
  },
  {
    role: 'compliance',
    actions: [...MONEY_BANK_ACTIONS, ...PHYSICAL_EXECUTION_ACTIONS, 'arbitration.record_decision'],
  },
  {
    role: 'operator',
    actions: ['bank.confirm_money_reserved', 'bank.confirm_money_released'],
  },
  {
    role: 'bank',
    actions: [
      'seller.create_batch',
      'seller.publish_lot',
      'buyer.create_rfq',
      'buyer.submit_offer',
      'seller.accept_offer',
      'proposal.submit',
      'proposal.accept',
      'deal.confirm_terms',
      ...PHYSICAL_EXECUTION_ACTIONS,
      'document.attach',
      'document.accept',
      'dispute.open',
    ],
  },
] as const satisfies readonly {
  readonly role: PlatformV7Role;
  readonly actions: readonly PlatformV7ActionPermissionId[];
}[];

describe('platform-v7 sensitive role action matrix', () => {
  it('denies sensitive actions outside each role boundary', () => {
    for (const { role, actions } of SENSITIVE_DENY_MATRIX) {
      for (const actionId of actions) {
        const decision = canPlatformV7RoleInvokeAction(role, actionId);
        expect(decision.allowed, `${role}:${actionId}`).toBe(false);
      }
    }
  });

  it('keeps investor read-only at the action permission boundary', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('investor')).toEqual([]);
  });

  it('keeps driver write permissions limited to field execution and support', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('driver').map((policy) => policy.actionId)).toEqual([
      'driver.confirm_checkpoint',
      'trip.open_incident',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps final bank money movement bank-only', () => {
    expect(canPlatformV7RoleInvokeAction('bank', 'bank.confirm_money_released').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('operator', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'bank.confirm_money_released').allowed).toBe(false);
  });
});
