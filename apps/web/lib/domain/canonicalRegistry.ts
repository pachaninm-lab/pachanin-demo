import {
  calculateControlTowerKpi,
  calculateInvestorKpi,
  normalizeDomainDeals,
  type CanonicalDeal,
  type ControlTowerKpi,
  type InvestorKpi,
} from '@/lib/platform-v7/domain';
import { domainDeals } from './selectors';
import type { DomainDeal } from './types';

export type CanonicalRegistrySource = 'runtime-domain-selectors';

export interface CanonicalFixtureRegistry {
  readonly source: CanonicalRegistrySource;
  readonly generatedFrom: 'DomainDeal';
  readonly deals: readonly CanonicalDeal[];
  readonly kpis: {
    readonly controlTower: ControlTowerKpi;
    readonly investor: InvestorKpi;
  };
}

export function buildCanonicalFixtureRegistry(deals: readonly DomainDeal[] = domainDeals): CanonicalFixtureRegistry {
  const canonicalDeals = normalizeDomainDeals(deals);

  return {
    source: 'runtime-domain-selectors',
    generatedFrom: 'DomainDeal',
    deals: canonicalDeals,
    kpis: {
      controlTower: calculateControlTowerKpi(canonicalDeals),
      investor: calculateInvestorKpi(canonicalDeals),
    },
  };
}

export const canonicalFixtureRegistry = buildCanonicalFixtureRegistry();
