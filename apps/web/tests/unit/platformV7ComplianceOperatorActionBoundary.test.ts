import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 compliance and operator action boundary', () => {
  it('keeps compliance limited to document review, dispute opening and support', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('compliance').map((policy) => policy.actionId)).toEqual([
      'document.accept',
      'dispute.open',
      'support.create_case',
      'support.append_message',
    ]);

    expect(canPlatformV7RoleInvokeAction('compliance', 'document.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('compliance', 'dispute.open').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('compliance', 'support.create_case').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('compliance', 'support.append_message').allowed).toBe(true);

    expect(canPlatformV7RoleInvokeAction('compliance', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'bank.confirm_money_reserved').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'driver.confirm_checkpoint').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'trip.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'arbitration.record_decision').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('compliance', 'proposal.accept').allowed).toBe(false);
  });

  it('keeps operator broad enough for escalation but outside bank-only confirmations and counterpart proposals', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('operator').map((policy) => policy.actionId)).toEqual([
      'seller.create_batch',
      'seller.publish_lot',
      'buyer.create_rfq',
      'buyer.submit_offer',
      'seller.accept_offer',
      'deal.confirm_terms',
      'money.request_reserve',
      'bank.mark_money_ready_to_release',
      'logistics.assign_driver',
      'driver.confirm_checkpoint',
      'trip.accept',
      'trip.open_incident',
      'document.attach',
      'document.accept',
      'dispute.open',
      'arbitration.record_decision',
      'support.create_case',
      'support.append_message',
    ]);

    expect(canPlatformV7RoleInvokeAction('operator', 'seller.accept_offer').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('operator', 'bank.mark_money_ready_to_release').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('operator', 'arbitration.record_decision').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('operator', 'logistics.assign_driver').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('operator', 'document.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('operator', 'support.create_case').allowed).toBe(true);

    expect(canPlatformV7RoleInvokeAction('operator', 'bank.confirm_money_reserved').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('operator', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('operator', 'proposal.submit').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('operator', 'proposal.accept').allowed).toBe(false);
  });
});
