import type { Deal, Dispute, MoneyEvent } from '../types';

export function dealGmvCents(deals: Deal[]): number {
  return deals.reduce((sum, deal) => sum + deal.totalAmountCents, 0);
}

export function platformFeeCents(deal: Deal, takeRateBps = 15): number {
  return Math.round((deal.totalAmountCents * takeRateBps) / 10_000);
}

export function reservedMoneyCents(events: MoneyEvent[]): number {
  return events
    .filter(event => event.type === 'reserve_confirmed')
    .reduce((sum, event) => sum + event.amountCents, 0);
}

export function heldMoneyCents(disputes: Dispute[]): number {
  return disputes
    .filter(dispute => dispute.status !== 'resolved' && dispute.status !== 'rejected')
    .reduce((sum, dispute) => sum + dispute.amountImpactCents, 0);
}

export function disputeRatePct(deals: Deal[], disputes: Dispute[]): number {
  if (!deals.length) return 0;
  const disputedDealIds = new Set(disputes.map(dispute => dispute.dealId));
  return Math.round((disputedDealIds.size / deals.length) * 1000) / 10;
}

export function releaseReadyCount(deals: Deal[]): number {
  return deals.filter(deal => deal.reserveConfirmed && deal.documentsComplete && !deal.openDisputeId).length;
}

export function blockedDealsCount(deals: Deal[]): number {
  return deals.filter(deal => !deal.reserveConfirmed || !deal.documentsComplete || Boolean(deal.openDisputeId)).length;
}

export function averageDealAmountCents(deals: Deal[]): number {
  if (!deals.length) return 0;
  return Math.round(dealGmvCents(deals) / deals.length);
}
