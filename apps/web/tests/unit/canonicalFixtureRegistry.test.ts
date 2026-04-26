import { describe, expect, it } from 'vitest';
import { buildCanonicalFixtureRegistry, canonicalFixtureRegistry } from '@/lib/domain/canonicalRegistry';
import { domainDeals } from '@/lib/domain/selectors';

describe('canonical fixture registry', () => {
  it('builds a read-only canonical registry from current DomainDeal fixtures', () => {
    const registry = buildCanonicalFixtureRegistry(domainDeals);

    expect(registry.source).toBe('runtime-domain-selectors');
    expect(registry.generatedFrom).toBe('DomainDeal');
    expect(registry.deals).toHaveLength(domainDeals.length);
    expect(registry.deals[0]?.id).toBe(domainDeals[0]?.id);
    expect(registry.kpis.controlTower.totalReserved).toBeGreaterThan(0);
    expect(registry.kpis.investor.gmv).toBeGreaterThan(0);
  });

  it('exports a stable default registry for read-only consumers', () => {
    expect(canonicalFixtureRegistry.deals.length).toBe(domainDeals.length);
    expect(canonicalFixtureRegistry.kpis.controlTower.activeDeals).toBeGreaterThan(0);
    expect(canonicalFixtureRegistry.kpis.controlTower.totalHold).toBeGreaterThanOrEqual(0);
  });
});
