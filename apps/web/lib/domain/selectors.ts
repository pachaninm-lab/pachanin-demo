import {
  CALLBACKS,
  DEALS,
  DISPUTES,
  RFQ_LIST,
  getDealIntegrationState,
  type CallbackItem,
  type Deal as RuntimeDeal,
  type DealIntegrationState,
  type Dispute as RuntimeDispute,
  type RfqItem as RuntimeRfqItem,
} from '@/lib/v7r/data';
import { toDomainDeals, toDomainDisputes } from './adapters';
import { computeControlTowerKpis, type ControlTowerKpis } from './kpi/controlTower';
import type { DomainDeal, DomainDispute, DomainTotals } from './types';

export type RuntimeDealStatus = RuntimeDeal['status'];
export type { RuntimeRfqItem };

export const domainDeals: DomainDeal[] = toDomainDeals(DEALS);
export const domainDisputes: DomainDispute[] = toDomainDisputes(DISPUTES);
export const domainCallbacks: CallbackItem[] = CALLBACKS;

export function selectRuntimeDeals(deals: RuntimeDeal[] = DEALS): RuntimeDeal[] {
  return deals;
}

export function selectRuntimeDisputes(disputes: RuntimeDispute[] = DISPUTES): RuntimeDispute[] {
  return disputes;
}

export function selectRuntimeRfqs(rfqs: RuntimeRfqItem[] = RFQ_LIST): RuntimeRfqItem[] {
  return rfqs;
}

export function selectRuntimeCallbacks(callbacks: CallbackItem[] = CALLBACKS): CallbackItem[] {
  return callbacks;
}

export function selectRuntimeDealById(id: string, deals: RuntimeDeal[] = DEALS): RuntimeDeal | undefined {
  return deals.find((deal) => deal.id === id);
}

export function selectRuntimeDealByLotId(lotId: string, deals: RuntimeDeal[] = DEALS): RuntimeDeal | undefined {
  return deals.find((deal) => deal.lotId === lotId);
}

export function selectRuntimeDisputeById(id: string, disputes: RuntimeDispute[] = DISPUTES): RuntimeDispute | undefined {
  return disputes.find((dispute) => dispute.id === id);
}

export function selectRuntimeRfqById(id: string, rfqs: RuntimeRfqItem[] = RFQ_LIST): RuntimeRfqItem | undefined {
  return rfqs.find((rfq) => rfq.id === id);
}

export function selectAllDeals(deals: DomainDeal[] = domainDeals): DomainDeal[] {
  return deals;
}

export function selectActiveDeals(deals: DomainDeal[] = domainDeals): DomainDeal[] {
  return deals.filter((deal) => deal.status !== 'closed');
}

export function selectDealById(id: string, deals: DomainDeal[] = domainDeals): DomainDeal | undefined {
  return deals.find((deal) => deal.id === id);
}

export function selectDealIntegrationState(deal: Pick<DomainDeal, 'id' | 'lotId'>): DealIntegrationState {
  return getDealIntegrationState(deal.id, deal.lotId);
}

export function selectDisputeById(id: string, disputes: DomainDispute[] = domainDisputes): DomainDispute | undefined {
  return disputes.find((dispute) => dispute.id === id);
}

export function selectDisputesByDealId(dealId: string, disputes: DomainDispute[] = domainDisputes): DomainDispute[] {
  return disputes.filter((dispute) => dispute.dealId === dealId);
}

export function selectBankCallbackById(id: string, callbacks: CallbackItem[] = domainCallbacks): CallbackItem | undefined {
  return callbacks.find((callback) => callback.id === id);
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

export function selectControlTowerKpis(deals: DomainDeal[] = domainDeals, now: Date = new Date('2026-04-19T12:00:00Z')): ControlTowerKpis {
  return computeControlTowerKpis(selectActiveDeals(deals), now);
}

export function selectDealCount(deals: DomainDeal[] = domainDeals): number {
  return deals.length;
}

export function selectActiveDealCount(deals: DomainDeal[] = domainDeals): number {
  return selectActiveDeals(deals).length;
}
