import { describe, expect, it } from 'vitest';
import { runtimeFixtureSource } from '@/lib/domain/fixtureSource';
import { domainDeals, domainDisputes, selectActiveDealCount, selectDealCount } from '@/lib/domain/selectors';

describe('runtime fixture bridge', () => {
  it('keeps deal and dispute arrays aligned', () => {
    expect(domainDeals).toEqual(runtimeFixtureSource.deals);
    expect(domainDisputes).toEqual(runtimeFixtureSource.disputes);
  });

  it('keeps deal counters aligned', () => {
    const activeDeals = runtimeFixtureSource.deals.filter((deal) => deal.status !== 'closed');

    expect(selectDealCount()).toBe(runtimeFixtureSource.deals.length);
    expect(selectActiveDealCount()).toBe(activeDeals.length);
  });
});
