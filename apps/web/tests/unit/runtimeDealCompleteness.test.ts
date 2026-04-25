import { describe, expect, it } from 'vitest';
import { selectActiveDeals, selectControlTowerKpis, selectRuntimeDeals } from '@/lib/domain/selectors';

describe('runtime deal completeness', () => {
  it('exposes the full runtime deal list through selectors', () => {
    const deals = selectRuntimeDeals();
    expect(deals.length).toBeGreaterThanOrEqual(15);
  });

  it('keeps active deal counts aligned between runtime and domain selectors', () => {
    const runtimeActive = selectRuntimeDeals().filter((deal) => deal.status !== 'closed').length;
    const domainActive = selectActiveDeals().length;
    expect(domainActive).toBe(runtimeActive);
  });

  it('computes control tower money totals from selector data', () => {
    const kpis = selectControlTowerKpis();
    expect(kpis.reserveTotal).toBeGreaterThan(0);
    expect(kpis.heldAmount).toBeGreaterThanOrEqual(0);
    expect(kpis.readyToRelease).toBeGreaterThanOrEqual(0);
  });
});
