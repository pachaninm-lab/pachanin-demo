import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
} from '@/lib/platform-v7/action-permission-boundary';

describe('platform-v7 dispute decision role action boundary', () => {
  it('keeps arbitrator limited to dispute opening, arbitration decision and support', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('arbitrator').map((policy) => policy.actionId)).toEqual([
      'dispute.open',
      'arbitration.record_decision',
      'support.create_case',
      'support.append_message',
    ]);

    expect(canPlatformV7RoleInvokeAction('arbitrator', 'dispute.open').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'arbitration.record_decision').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'support.create_case').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'support.append_message').allowed).toBe(true);

    expect(canPlatformV7RoleInvokeAction('arbitrator', 'seller.create_batch').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'seller.publish_lot').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'buyer.create_rfq').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'buyer.submit_offer').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'seller.accept_offer').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'proposal.submit').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'proposal.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'deal.confirm_terms').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'money.request_reserve').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'bank.confirm_money_reserved').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'bank.mark_money_ready_to_release').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'bank.confirm_money_released').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'logistics.assign_driver').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'driver.confirm_checkpoint').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'trip.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'trip.open_incident').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'document.attach').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('arbitrator', 'document.accept').allowed).toBe(false);
  });
});
