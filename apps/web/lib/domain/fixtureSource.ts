import { DEALS, DISPUTES } from '@/lib/v7r/data';
import { toDomainDeals, toDomainDisputes } from './adapters';
import type { DomainDeal, DomainDispute } from './types';

export type RuntimeFixtureSourceId = 'v7r-data';

export interface RuntimeFixtureSource {
  readonly id: RuntimeFixtureSourceId;
  readonly generatedFrom: 'apps/web/lib/v7r/data';
  readonly deals: readonly DomainDeal[];
  readonly disputes: readonly DomainDispute[];
}

export function buildRuntimeFixtureSource(): RuntimeFixtureSource {
  return {
    id: 'v7r-data',
    generatedFrom: 'apps/web/lib/v7r/data',
    deals: toDomainDeals(DEALS),
    disputes: toDomainDisputes(DISPUTES),
  };
}

export const runtimeFixtureSource = buildRuntimeFixtureSource();
