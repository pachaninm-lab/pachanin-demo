import type { Deal, DomainExecutionState, MoneyEvent } from './types';

export interface ExecutionKpiSnapshot {
  totalGmvRub: number;
  reservedRub: number;
  blockedRub: number;
  readyForReleaseRub: number;
  openDisputes: number;
  activeDeals: number;
  avgDealRub: number;
  reserveCoveragePct: number;
  documentReadinessPct: number;
  disputeRatePct: number;
}

export function calculateDealAmountRub(deal: Pick<Deal, 'volumeTonnes' | 'pricePerTonneRub'>): number {
  return Number((deal.volumeTonnes * deal.pricePerTonneRub).toFixed(2));
}

export function calculatePlatformFeeRub(deal: Pick<Deal, 'volumeTonnes' | 'pricePerTonneRub'>, takeRatePct = 0.15): number {
  return Number((calculateDealAmountRub(deal) * (takeRatePct / 100)).toFixed(2));
}

export function sumMoneyEvents(events: MoneyEvent[], type?: MoneyEvent['type']): number {
  return events
    .filter((event) => !type || event.type === type)
    .reduce((sum, event) => sum + event.amountRub, 0);
}

export function calculateGmvRub(deals: Deal[]): number {
  return deals.reduce((sum, deal) => sum + calculateDealAmountRub(deal), 0);
}

export function calculateDocumentReadinessPct(state: DomainExecutionState): number {
  if (state.deals.length === 0) return 0;
  const ready = state.deals.filter((deal) => deal.requiredDocumentsReady).length;
  return Number(((ready / state.deals.length) * 100).toFixed(2));
}

export function calculateReserveCoveragePct(state: DomainExecutionState): number {
  if (state.deals.length === 0) return 0;
  const reserved = state.deals.filter((deal) => deal.reserveConfirmed).length;
  return Number(((reserved / state.deals.length) * 100).toFixed(2));
}

export function calculateDisputeRatePct(state: DomainExecutionState): number {
  if (state.deals.length === 0) return 0;
  const disputedDealIds = new Set(state.disputes.filter((dispute) => !['resolved', 'closed'].includes(dispute.status)).map((dispute) => dispute.dealId));
  return Number(((disputedDealIds.size / state.deals.length) * 100).toFixed(2));
}

export function calculateExecutionKpis(state: DomainExecutionState): ExecutionKpiSnapshot {
  const totalGmvRub = calculateGmvRub(state.deals);
  const activeDeals = state.deals.filter((deal) => !['CLOSED', 'FINAL_RELEASED'].includes(deal.status)).length;
  const openDisputes = state.disputes.filter((dispute) => !['resolved', 'closed'].includes(dispute.status)).length;
  const reservedRub = sumMoneyEvents(state.moneyEvents.filter((event) => event.status === 'confirmed'), 'reserve_confirmed');
  const blockedRub = sumMoneyEvents(state.moneyEvents.filter((event) => event.status === 'blocked'));
  const readyForReleaseRub = state.deals
    .filter((deal) => deal.reserveConfirmed && deal.requiredDocumentsReady && !deal.openDisputeId)
    .reduce((sum, deal) => sum + calculateDealAmountRub(deal), 0);

  return {
    totalGmvRub,
    reservedRub,
    blockedRub,
    readyForReleaseRub,
    openDisputes,
    activeDeals,
    avgDealRub: state.deals.length ? Number((totalGmvRub / state.deals.length).toFixed(2)) : 0,
    reserveCoveragePct: calculateReserveCoveragePct(state),
    documentReadinessPct: calculateDocumentReadinessPct(state),
    disputeRatePct: calculateDisputeRatePct(state)
  };
}
