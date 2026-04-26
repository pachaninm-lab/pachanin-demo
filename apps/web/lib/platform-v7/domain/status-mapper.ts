import type { CanonicalDealStatus } from './canonical';

export const LEGACY_DEAL_STATUS_TO_CANONICAL: Record<string, CanonicalDealStatus> = {
  draft: 'DRAFT',
  counterparty_check: 'COUNTERPARTY_CHECK',
  offer_accepted: 'OFFER_ACCEPTED',
  contract_draft: 'CONTRACT_DRAFT',
  contract_signed: 'CONTRACT_SIGNED',
  payment_reserved: 'MONEY_RESERVED',
  money_reserved: 'MONEY_RESERVED',
  reserve_confirmed: 'MONEY_RESERVED',
  loading_scheduled: 'LOGISTICS_PLANNED',
  logistics_planned: 'LOGISTICS_PLANNED',
  loading_started: 'LOADING',
  loading_done: 'IN_TRANSIT',
  in_transit: 'IN_TRANSIT',
  arrived: 'ARRIVED',
  unloading_done: 'WEIGHING',
  weighing: 'WEIGHING',
  quality_check: 'LAB_ANALYSIS',
  lab_analysis: 'LAB_ANALYSIS',
  quality_pending: 'ACCEPTANCE_PENDING',
  acceptance_pending: 'ACCEPTANCE_PENDING',
  accepted: 'ACCEPTED',
  docs_pending: 'DOCUMENTS_PENDING',
  docs_missing: 'DOCUMENTS_PENDING',
  docs_complete: 'DOCUMENTS_COMPLETE',
  release_requested: 'RELEASE_PENDING',
  release_approved: 'RELEASE_PENDING',
  partial_released: 'PARTIAL_RELEASED',
  quality_disputed: 'DISPUTED',
  disputed: 'DISPUTED',
  final_released: 'FINAL_RELEASED',
  closed: 'CLOSED',
  canceled: 'CANCELED',
  cancelled: 'CANCELED',
  degraded: 'DEGRADED',
};

export function toCanonicalDealStatus(status: string): CanonicalDealStatus {
  const normalized = status.trim().toLowerCase();
  return LEGACY_DEAL_STATUS_TO_CANONICAL[normalized] ?? 'DEGRADED';
}

export function isKnownLegacyDealStatus(status: string): boolean {
  return status.trim().toLowerCase() in LEGACY_DEAL_STATUS_TO_CANONICAL;
}
