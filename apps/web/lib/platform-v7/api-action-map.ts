import type { PlatformV7ActionPermissionId } from './action-permission-boundary';
import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';

export const PLATFORM_V7_API_ACTION_MAP: Partial<Record<PlatformV7ApiBoundaryId, PlatformV7ActionPermissionId>> = {
  create_batch: 'seller.create_batch',
  publish_lot: 'seller.publish_lot',
  create_rfq: 'buyer.create_rfq',
  submit_proposal: 'buyer.submit_offer',
  accept_proposal: 'seller.accept_offer',
  assign_driver: 'logistics.assign_driver',
  mark_trip_arrived: 'driver.confirm_checkpoint',
  upload_document: 'document.attach',
  open_dispute: 'dispute.open',
  create_support_case: 'support.create_case',
};

export function getPlatformV7ActionForApiBoundary(
  boundaryId: PlatformV7ApiBoundaryId,
): PlatformV7ActionPermissionId | undefined {
  return PLATFORM_V7_API_ACTION_MAP[boundaryId];
}
