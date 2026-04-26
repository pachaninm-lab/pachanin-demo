import type { DomainDeal } from '../../domain/types';
import { toCanonicalDealStatus } from './status-mapper';
import type { CanonicalDeal, CounterpartyRef } from './types';

function toCounterpartyRef(id: string, name: string, role: CounterpartyRef['role'], inn?: string): CounterpartyRef {
  return {
    id,
    name,
    role,
    inn,
  };
}

export function normalizeDomainDeal(deal: DomainDeal): CanonicalDeal {
  const status = toCanonicalDealStatus(deal.status);
  const releaseAmount = deal.releaseAmount ?? Math.max(deal.reservedAmount - deal.holdAmount, 0);
  const totalAmount = deal.totalAmount ?? deal.reservedAmount;

  return {
    id: deal.id,
    status,
    legacyStatus: deal.status,
    phase: undefined,
    grain: deal.grain,
    quantity: deal.quantity,
    unit: deal.unit === 'кг' ? 'кг' : 'т',
    pricePerUnit: deal.pricePerTon ?? (deal.quantity ? Math.round(totalAmount / deal.quantity) : 0),
    money: {
      totalAmount,
      reservedAmount: deal.reservedAmount,
      holdAmount: deal.holdAmount,
      releaseAmount,
    },
    seller: toCounterpartyRef(`${deal.id}-seller`, deal.seller.name, 'seller', deal.seller.inn),
    buyer: toCounterpartyRef(`${deal.id}-buyer`, deal.buyer.name, 'buyer', deal.buyer.inn),
    driver: null,
    elevator: null,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    slaDeadline: deal.slaDeadline,
    dispute: deal.dispute ? { id: deal.dispute.id, title: deal.dispute.id, amountAtRisk: deal.holdAmount } : null,
    riskScore: deal.riskScore,
    blockers: deal.blockers,
    timeline: (deal.events ?? []).map((event) => ({
      status: event.action,
      at: event.ts,
      actor: event.actor,
      canonicalStatus: toCanonicalDealStatus(event.action),
    })),
    documents: [],
    maturity: deal.sourceOfTruth === 'DRAFT' ? 'demo' : deal.sourceOfTruth === 'MANUAL' ? 'sandbox' : 'pre-live',
  };
}

export function normalizeDomainDeals(deals: readonly DomainDeal[]): CanonicalDeal[] {
  return deals.map(normalizeDomainDeal);
}
