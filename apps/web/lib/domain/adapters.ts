import type { Deal, Dispute } from '@/lib/v7r/data';
import type { DomainDeal, DomainDispute, SourceOfTruth } from './types';

const DEFAULT_CREATED_AT = '2026-04-01T00:00:00.000Z';
const DEFAULT_UPDATED_AT = '2026-04-24T00:00:00.000Z';

function inferSourceOfTruth(deal: Pick<Deal, 'lotId'>): SourceOfTruth {
  return deal.lotId ? 'FGIS' : 'MANUAL';
}

export function toDomainDeal(deal: Deal): DomainDeal {
  return {
    ...deal,
    version: 1,
    sourceOfTruth: inferSourceOfTruth(deal),
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_UPDATED_AT,
  };
}

export function toDomainDispute(dispute: Dispute): DomainDispute {
  return {
    ...dispute,
    version: 1,
    sourceOfTruth: 'MANUAL',
    createdAt: DEFAULT_CREATED_AT,
    updatedAt: DEFAULT_UPDATED_AT,
  };
}

export function toDomainDeals(deals: Deal[]): DomainDeal[] {
  return deals.map(toDomainDeal);
}

export function toDomainDisputes(disputes: Dispute[]): DomainDispute[] {
  return disputes.map(toDomainDispute);
}
