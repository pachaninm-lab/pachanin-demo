import type { PlatformV7ActionPermissionId } from './action-permission-boundary';
import type { PlatformV7ExecutionServiceName } from './execution-service-registry-contract';

export const PLATFORM_V7_ACTION_SERVICE_MAP: Record<PlatformV7ActionPermissionId, PlatformV7ExecutionServiceName> = {
  'seller.create_batch': 'batch',
  'seller.publish_lot': 'lot',
  'buyer.create_rfq': 'rfq',
  'buyer.submit_offer': 'proposal',
  'seller.accept_offer': 'proposal',
  'logistics.assign_driver': 'logistics',
  'driver.confirm_checkpoint': 'trip',
  'document.attach': 'document',
  'dispute.open': 'dispute',
  'support.create_case': 'support',
};

export function getPlatformV7ActionServiceName(
  actionId: PlatformV7ActionPermissionId,
): PlatformV7ExecutionServiceName {
  return PLATFORM_V7_ACTION_SERVICE_MAP[actionId];
}
