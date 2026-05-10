import { describe, expect, it } from 'vitest';
import {
  canPlatformV7RoleInvokeAction,
  PLATFORM_V7_ACTION_PERMISSION_POLICIES,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import type { PlatformV7Role } from '@/lib/platform-v7/role-access';

const allowed = {
  bank: [
    'bank.confirm_money_reserved',
    'bank.mark_money_ready_to_release',
    'bank.confirm_money_released',
    'arbitration.record_decision',
    'support.create_case',
    'support.append_message',
  ],
  driver: ['driver.confirm_checkpoint', 'trip.open_incident', 'support.create_case', 'support.append_message'],
  investor: [],
  compliance: ['document.accept', 'dispute.open', 'support.create_case', 'support.append_message'],
  operator: [
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
  ],
} as const satisfies Record<string, readonly PlatformV7ActionPermissionId[]>;

describe('platform-v7 sensitive role actions', () => {
  it('blocks sensitive roles from actions outside their explicit allow list', () => {
    for (const [role, actionIds] of Object.entries(allowed)) {
      const allowSet = new Set<PlatformV7ActionPermissionId>(actionIds);

      for (const policy of PLATFORM_V7_ACTION_PERMISSION_POLICIES) {
        expect(canPlatformV7RoleInvokeAction(role as PlatformV7Role, policy.actionId).allowed).toBe(
          allowSet.has(policy.actionId),
        );
      }
    }
  });
});
