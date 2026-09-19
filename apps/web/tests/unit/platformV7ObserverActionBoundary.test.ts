import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  getPlatformV7ActionPermissionPoliciesForRole,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import type { PlatformV7Role } from '@/lib/platform-v7/role-access';

const OBSERVER_ROLES = ['investor', 'executive'] as const satisfies readonly PlatformV7Role[];

const EXECUTION_ACTIONS = [
  'seller.create_batch',
  'seller.publish_lot',
  'buyer.create_rfq',
  'buyer.submit_offer',
  'seller.accept_offer',
  'proposal.submit',
  'proposal.accept',
  'deal.confirm_terms',
  'money.request_reserve',
  'bank.confirm_money_reserved',
  'bank.mark_money_ready_to_release',
  'bank.confirm_money_released',
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
] as const satisfies readonly PlatformV7ActionPermissionId[];

describe('platform-v7 observer role action boundary', () => {
  it.each(OBSERVER_ROLES)('keeps %s out of execution actions', (role) => {
    expect(getPlatformV7ActionPermissionPoliciesForRole(role)).toEqual([]);

    for (const actionId of EXECUTION_ACTIONS) {
      expect(canPlatformV7RoleInvokeAction(role, actionId).allowed).toBe(false);
    }
  });
});
