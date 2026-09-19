import {
  calculateControlTowerKpi,
  calculateInvestorKpi,
  normalizeDomainDeals,
  type CanonicalDeal,
  type ControlTowerKpi,
  type InvestorKpi,
} from '@/lib/platform-v7/domain';
import { runtimeFixtureSource, type RuntimeFixtureSource } from './fixtureSource';

export type CanonicalRegistrySource = 'runtime-fixture-source';

export interface CanonicalFixtureRegistry {
  readonly source: CanonicalRegistrySource;
  readonly generatedFrom: RuntimeFixtureSource['generatedFrom'];
  readonly deals: readonly CanonicalDeal[];
  readonly kpis: {
    readonly controlTower: ControlTowerKpi;
    readonly investor: InvestorKpi;
  };
}

export function buildCanonicalFixtureRegistry(source: RuntimeFixtureSource = runtimeFixtureSource): CanonicalFixtureRegistry {
  const canonicalDeals = normalizeDomainDeals(source.deals);

  return {
    source: 'runtime-fixture-source',
    generatedFrom: source.generatedFrom,
    deals: canonicalDeals,
    kpis: {
      controlTower: calculateControlTowerKpi(canonicalDeals),
      investor: calculateInvestorKpi(canonicalDeals),
    },
  };
}

export const canonicalFixtureRegistry = buildCanonicalFixtureRegistry();
