import type { PlatformV7DealStatus } from './execution-model';

export const PLATFORM_V7_DEAL_STATUS_ORDER: readonly PlatformV7DealStatus[] = [
  'draft',
  'awaiting_reserve',
  'money_reserved',
  'awaiting_documents',
  'awaiting_logistics',
  'in_transit',
  'awaiting_acceptance',
  'awaiting_lab',
  'awaiting_money_release',
  'manual_review',
  'dispute',
  'closed',
  'cancelled',
] as const;

const PLATFORM_V7_DEAL_TRANSITIONS: Record<PlatformV7DealStatus, readonly PlatformV7DealStatus[]> = {
  draft: ['awaiting_reserve', 'cancelled'],
  awaiting_reserve: ['money_reserved', 'manual_review', 'cancelled'],
  money_reserved: ['awaiting_documents', 'manual_review', 'cancelled'],
  awaiting_documents: ['awaiting_logistics', 'manual_review', 'dispute'],
  awaiting_logistics: ['in_transit', 'manual_review', 'dispute'],
  in_transit: ['awaiting_acceptance', 'manual_review', 'dispute'],
  awaiting_acceptance: ['awaiting_lab', 'manual_review', 'dispute'],
  awaiting_lab: ['awaiting_money_release', 'manual_review', 'dispute'],
  awaiting_money_release: ['closed', 'manual_review', 'dispute'],
  manual_review: ['awaiting_reserve', 'awaiting_documents', 'awaiting_logistics', 'awaiting_money_release', 'dispute', 'cancelled'],
  dispute: ['manual_review', 'awaiting_money_release', 'closed'],
  closed: [],
  cancelled: [],
};

export function canPlatformV7DealTransition(from: PlatformV7DealStatus, to: PlatformV7DealStatus): boolean {
  return PLATFORM_V7_DEAL_TRANSITIONS[from].includes(to);
}

export function isPlatformV7DealTerminal(status: PlatformV7DealStatus): boolean {
  return status === 'closed' || status === 'cancelled';
}

export function getPlatformV7DealNextStatuses(status: PlatformV7DealStatus): readonly PlatformV7DealStatus[] {
  return PLATFORM_V7_DEAL_TRANSITIONS[status];
}
