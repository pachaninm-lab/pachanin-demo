import type { PlatformV7ActionPermissionId } from './action-permission-boundary';
import type { PlatformV7ExecutionServiceName } from './execution-service-registry-contract';

export const PLATFORM_V7_ACTION_SERVICE_MAP: Record<PlatformV7ActionPermissionId, PlatformV7ExecutionServiceName> = {
  'seller.create_batch': 'batch',
  'seller.publish_lot': 'lot',
  'buyer.create_rfq': 'rfq',
  'buyer.submit_offer': 'proposal',
  'seller.accept_offer': 'proposal',
  'proposal.submit': 'proposal',
  'proposal.accept': 'proposal',
  'deal.confirm_terms': 'deal',
  'money.request_reserve': 'money',
  'bank.confirm_money_reserved': 'money',
  'bank.mark_money_ready_to_release': 'money',
  'bank.confirm_money_released': 'money',
  'logistics.assign_driver': 'logistics',
  'driver.confirm_checkpoint': 'trip',
  'trip.accept': 'trip',
  'trip.open_incident': 'trip',
  'document.attach': 'document',
  'document.accept': 'document',
  'dispute.open': 'dispute',
  'arbitration.record_decision': 'dispute',
  'support.create_case': 'support',
  'support.append_message': 'support',
};

export function getPlatformV7ActionServiceName(
  actionId: PlatformV7ActionPermissionId,
): PlatformV7ExecutionServiceName {
  return PLATFORM_V7_ACTION_SERVICE_MAP[actionId];
}
