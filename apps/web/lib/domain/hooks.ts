'use client';

import * as React from 'react';
import {
  domainDeals,
  domainDisputes,
  selectActiveDeals,
  selectControlTowerKpis,
  selectDealById,
  selectDisputeById,
  selectDisputesByDealId,
  selectDomainTotals,
} from './selectors';
import type { ControlTowerKpis } from './kpi/controlTower';
import type { DomainDeal, DomainDispute, DomainTotals } from './types';

export function useDeals(): DomainDeal[] {
  return React.useMemo(() => domainDeals, []);
}

export function useActiveDeals(): DomainDeal[] {
  return React.useMemo(() => selectActiveDeals(domainDeals), []);
}

export function useDeal(dealId: string): DomainDeal | undefined {
  return React.useMemo(() => selectDealById(dealId, domainDeals), [dealId]);
}

export function useDisputes(): DomainDispute[] {
  return React.useMemo(() => domainDisputes, []);
}

export function useDispute(disputeId: string): DomainDispute | undefined {
  return React.useMemo(() => selectDisputeById(disputeId, domainDisputes), [disputeId]);
}

export function useDisputesByDeal(dealId: string): DomainDispute[] {
  return React.useMemo(() => selectDisputesByDealId(dealId, domainDisputes), [dealId]);
}

export function useDomainTotals(): DomainTotals {
  return React.useMemo(() => selectDomainTotals(domainDeals), []);
}

export function useControlTowerKpis(): ControlTowerKpis {
  return React.useMemo(() => selectControlTowerKpis(domainDeals), []);
}
