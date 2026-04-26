'use client';

import * as React from 'react';
import { canonicalFixtureRegistry } from './canonicalRegistry';
import type { CanonicalDeal, ControlTowerKpi as CanonicalControlTowerKpi, InvestorKpi as CanonicalInvestorKpi } from '@/lib/platform-v7/domain';

export function useCanonicalRegistryDeals(): readonly CanonicalDeal[] {
  return React.useMemo(() => canonicalFixtureRegistry.deals, []);
}

export function useCanonicalRegistryControlTowerKpis(): CanonicalControlTowerKpi {
  return React.useMemo(() => canonicalFixtureRegistry.kpis.controlTower, []);
}

export function useCanonicalRegistryInvestorKpis(): InvestorKpi {
  return React.useMemo(() => canonicalFixtureRegistry.kpis.investor, []);
}
