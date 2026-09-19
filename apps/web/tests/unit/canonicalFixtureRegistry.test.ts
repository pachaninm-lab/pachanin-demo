import { describe, expect, it } from 'vitest';
import { buildCanonicalFixtureRegistry, canonicalFixtureRegistry } from '@/lib/domain/canonicalRegistry';
import { runtimeFixtureSource } from '@/lib/domain/fixtureSource';

describe('canonical fixture registry', () => {
  it('builds a read-only canonical registry from the runtime fixture source', () => {
    const registry = buildCanonicalFixtureRegistry(runtimeFixtureSource);

    expect(registry.source).toBe('runtime-fixture-source');
    expect(registry.generatedFrom).toBe('apps/web/lib/v7r/data');
    expect(registry.deals).toHaveLength(runtimeFixtureSource.deals.length);
    expect(registry.deals[0]?.id).toBe(runtimeFixtureSource.deals[0]?.id);
    expect(registry.kpis.controlTower.totalReserved).toBeGreaterThan(0);
    expect(registry.kpis.investor.gmv).toBeGreaterThan(0);
  });

  it('exports a stable default registry for read-only consumers', () => {
    expect(canonicalFixtureRegistry.source).toBe('runtime-fixture-source');
    expect(canonicalFixtureRegistry.deals.length).toBe(runtimeFixtureSource.deals.length);
    expect(canonicalFixtureRegistry.kpis.controlTower.activeDeals).toBeGreaterThan(0);
    expect(canonicalFixtureRegistry.kpis.controlTower.totalHold).toBeGreaterThanOrEqual(0);
  });
});
