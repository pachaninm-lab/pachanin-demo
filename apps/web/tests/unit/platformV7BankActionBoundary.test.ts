import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 bank action boundary', () => {
  it('keeps bank limited to money confirmations, release review, arbitration decision and support', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('bank').map((policy) => policy.actionId)).toEqual([
      'bank.confirm_money_reserved',
      'bank.mark_money_ready_to_release',
      'bank.confirm_money_released',
      'arbitration.record_decision',
      'support.create_case',
      'support.append_message',
    ]);

    expect(canPlatformV7RoleInvokeAction('bank', 'bank.confirm_money_reserved').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('bank', 'bank.mark_money_ready_to_release').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('bank', 'bank.confirm_money_released').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('bank', 'arbitration.record_decision').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('bank', 'support.create_case').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('bank', 'support.append_message').allowed).toBe(true);

    expect(canPlatformV7RoleInvokeAction('bank', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'seller.create_batch').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'seller.publish_lot').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'buyer.create_rfq').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'buyer.submit_offer').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'seller.accept_offer').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'proposal.submit').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'proposal.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'deal.confirm_terms').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'driver.confirm_checkpoint').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'trip.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'trip.open_incident').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'document.attach').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'document.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('bank', 'dispute.open').allowed).toBe(false);
  });
});
