import type { PlatformV7ActionPermissionId } from './action-permission-boundary';
import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';

export const PLATFORM_V7_API_ACTION_MAP: Partial<Record<PlatformV7ApiBoundaryId, PlatformV7ActionPermissionId>> = {
  create_batch: 'seller.create_batch',
  publish_lot: 'seller.publish_lot',
  create_rfq: 'buyer.create_rfq',
  submit_proposal: 'buyer.submit_offer',
  accept_proposal: 'seller.accept_offer',
  confirm_deal_terms: 'deal.confirm_terms',
  request_money_reserve: 'money.request_reserve',
  confirm_money_reserved: 'bank.confirm_money_reserved',
  mark_money_ready_to_release: 'bank.mark_money_ready_to_release',
  confirm_money_released: 'bank.confirm_money_released',
  assign_driver: 'logistics.assign_driver',
  mark_trip_arrived: 'driver.confirm_checkpoint',
  accept_trip: 'trip.accept',
  open_incident: 'trip.open_incident',
  upload_document: 'document.attach',
  accept_document: 'document.accept',
  open_dispute: 'dispute.open',
  resolve_dispute: 'arbitration.record_decision',
  create_support_case: 'support.create_case',
  append_support_message: 'support.append_message',
};

export function getPlatformV7ActionForApiBoundary(
  boundaryId: PlatformV7ApiBoundaryId,
): PlatformV7ActionPermissionId | undefined {
  return PLATFORM_V7_API_ACTION_MAP[boundaryId];
}
