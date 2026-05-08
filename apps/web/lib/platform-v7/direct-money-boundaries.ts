import type { PlatformV7ApiBoundaryId } from './api-boundary-contracts';

export const PLATFORM_V7_DIRECT_MONEY_BOUNDARIES: readonly PlatformV7ApiBoundaryId[] = [
  'request_money_reserve',
  'confirm_money_reserved',
  'mark_money_ready_to_release',
  'confirm_money_released',
];

export function isPlatformV7DirectMoneyBoundary(boundaryId: string): boundaryId is PlatformV7ApiBoundaryId {
  return PLATFORM_V7_DIRECT_MONEY_BOUNDARIES.includes(boundaryId as PlatformV7ApiBoundaryId);
}
