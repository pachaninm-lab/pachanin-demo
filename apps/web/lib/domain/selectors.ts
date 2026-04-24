import { DEALS, DISPUTES } from '@/lib/v7r/data';
import { toDomainDeals, toDomainDisputes } from './adapters';
import type { DomainDeal, DomainDispute, DomainTotals } from './types';

export const domainDeals: DomainDeal[] = toDomainDeals(DEALS);
export const domainDisputes: DomainDispute[] = toDomainDisputes(DISPUTES);

export function selectAllDeals(deals: DomainDeal[] = domainDeals): DomainDeal[] {
  return deals;
}

export function selectActiveDeals(deals: DomainDeal[] = domainDeals): DomainDeal[] {
  return deals.filter((deal) => deal.status !== 'closed');
}

export function selectDealById(id: string, deals: DomainDeal[] = domainDeals): DomainDeal | undefined {
  return deals.find((deal) => deal.id === id);
}

export function selectDisputeById(id: string, disputes: DomainDispute[] = domainDisputes): DomainDispute | undefined {
  return disputes.find((dispute) => dispute.id === id);
}

export function selectDisputesByDealId(dealId: string, disputes: DomainDispute[] = domainDisputes): DomainDispute[] {
  return disputes.filter((dispute) => dispute.dealId === dealId);
}

export function selectReserveTotal(deals: DomainDeal[] = domainDeals): number {
  return selectActiveDeals(deals).reduce((sum, deal) => sum + deal.reservedAmount, 0);
}

export function selectHeldTotal(deals: DomainDeal[] = domainDeals): number {
  return selectActiveDeals(deals).reduce((sum, deal) => sum + deal.holdAmount, 0);
}

export function selectReadyToReleaseTotal(deals: DomainDeal[] = domainDeals): number {
  return selectActiveDeals(deals).reduce((sum, deal) => {
    const release = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
    return sum + (deal.status === 'release_requested' || deal.status === 'docs_complete' ? release : 0);
  }, 0);
}

export function selectDomainTotals(deals: DomainDeal[] = domainDeals): DomainTotals {
  return {
    reserveTotal: selectReserveTotal(deals),
    heldTotal: selectHeldTotal(deals),
    readyToReleaseTotal: selectReadyToReleaseTotal(deals),
  };
}

export function selectDealCount(deals: DomainDeal[] = domainDeals): number {
  return deals.length;
}

export function selectActiveDealCount(deals: DomainDeal[] = domainDeals): number {
  return selectActiveDeals(deals).length;
}
