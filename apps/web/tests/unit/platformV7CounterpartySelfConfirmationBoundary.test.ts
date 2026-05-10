import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';

const BANK_CONFIRMATION_ACTIONS = [
  'bank.confirm_money_reserved',
  'bank.mark_money_ready_to_release',
  'bank.confirm_money_released',
] as const satisfies readonly PlatformV7ActionPermissionId[];

describe('platform-v7 counterparty self-confirmation boundary', () => {
  it('keeps seller out of bank money confirmation actions', () => {
    for (const actionId of BANK_CONFIRMATION_ACTIONS) {
      expect(canPlatformV7RoleInvokeAction('seller', actionId).allowed, actionId).toBe(false);
    }
  });

  it('keeps buyer out of bank money confirmation actions', () => {
    for (const actionId of BANK_CONFIRMATION_ACTIONS) {
      expect(canPlatformV7RoleInvokeAction('buyer', actionId).allowed, actionId).toBe(false);
    }
  });

  it('keeps seller out of third-party confirmation actions', () => {
    expect(canPlatformV7RoleInvokeAction('seller', 'document.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('seller', 'trip.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('seller', 'arbitration.record_decision').allowed).toBe(false);
  });

  it('keeps buyer out of third-party confirmation actions', () => {
    expect(canPlatformV7RoleInvokeAction('buyer', 'document.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('buyer', 'trip.accept').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('buyer', 'arbitration.record_decision').allowed).toBe(false);
  });

  it('keeps seller write surface limited to deal, lot, document and support functions', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('seller').map((p) => p.actionId)).toEqual([
      'seller.create_batch',
      'seller.publish_lot',
      'seller.accept_offer',
      'proposal.submit',
      'proposal.accept',
      'deal.confirm_terms',
      'document.attach',
      'dispute.open',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps buyer write surface limited to offer, deal, document and support functions', () => {
    expect(getPlatformV7ActionPermissionPoliciesForRole('buyer').map((p) => p.actionId)).toEqual([
      'buyer.create_rfq',
      'buyer.submit_offer',
      'proposal.submit',
      'proposal.accept',
      'deal.confirm_terms',
      'money.request_reserve',
      'document.attach',
      'dispute.open',
      'support.create_case',
      'support.append_message',
    ]);
  });

  it('keeps seller and buyer symmetric on proposal but separate on commercial specifics', () => {
    expect(canPlatformV7RoleInvokeAction('seller', 'proposal.submit').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('buyer', 'proposal.submit').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('seller', 'proposal.accept').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('buyer', 'proposal.accept').allowed).toBe(true);

    expect(canPlatformV7RoleInvokeAction('seller', 'buyer.create_rfq').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('seller', 'buyer.submit_offer').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('buyer', 'seller.create_batch').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('buyer', 'seller.publish_lot').allowed).toBe(false);
    expect(canPlatformV7RoleInvokeAction('buyer', 'seller.accept_offer').allowed).toBe(false);
  });

  it('keeps buyer as sole requester of money reserve — seller cannot request reserve', () => {
    expect(canPlatformV7RoleInvokeAction('buyer', 'money.request_reserve').allowed).toBe(true);
    expect(canPlatformV7RoleInvokeAction('seller', 'money.request_reserve').allowed).toBe(false);
  });
});
