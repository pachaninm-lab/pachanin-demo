import { describe, expect, it } from 'vitest';
import {
  getPlatformV7ActionPermissionPoliciesForService,
  type PlatformV7ActionPermissionId,
} from '@/lib/platform-v7/action-permission-boundary';
import type { PlatformV7ExecutionServiceName } from '@/lib/platform-v7/execution-service-registry-contract';

const EXPECTED_ACTIONS_BY_SERVICE = {
  batch: ['seller.create_batch'],
  lot: ['seller.publish_lot'],
  rfq: ['buyer.create_rfq'],
  proposal: ['buyer.submit_offer', 'seller.accept_offer', 'proposal.submit', 'proposal.accept'],
  deal: ['deal.confirm_terms'],
  money: [
    'money.request_reserve',
    'bank.confirm_money_reserved',
    'bank.mark_money_ready_to_release',
    'bank.confirm_money_released',
  ],
  logistics: ['logistics.assign_driver'],
  trip: ['driver.confirm_checkpoint', 'trip.accept', 'trip.open_incident'],
  document: ['document.attach', 'document.accept'],
  dispute: ['dispute.open', 'arbitration.record_decision'],
  support: ['support.create_case', 'support.append_message'],
  rating: [],
  audit: [],
  notification: [],
  integrations: [],
} as const satisfies Record<PlatformV7ExecutionServiceName, readonly PlatformV7ActionPermissionId[]>;

describe('platform-v7 action service policy boundary', () => {
  it.each(Object.entries(EXPECTED_ACTIONS_BY_SERVICE))(
    'returns only %s action policies',
    (serviceName, expectedActionIds) => {
      const policies = getPlatformV7ActionPermissionPoliciesForService(serviceName as PlatformV7ExecutionServiceName);

      expect(policies.map((policy) => policy.actionId)).toEqual(expectedActionIds);
      expect(policies.every((policy) => policy.serviceName === serviceName)).toBe(true);
      expect(policies.every((policy) => policy.needsDurableWrite)).toBe(true);
      expect(policies.every((policy) => policy.needsAuditEvent)).toBe(true);
      expect(policies.every((policy) => policy.needsIdempotencyKey)).toBe(true);
    },
  );
});
