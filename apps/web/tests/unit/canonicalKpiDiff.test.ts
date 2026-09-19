import { describe, expect, it } from 'vitest';
import { buildControlTowerKpiReconciliationRows, hasKpiReconciliationDelta } from '@/lib/domain/kpi/canonicalReconciliation';
import type { ControlTowerKpi } from '@/lib/platform-v7/domain';
import type { ControlTowerKpis } from '@/lib/domain/kpi/controlTower';

const legacy: ControlTowerKpis = {
  reserveTotal: { value: 100, contributors: [] },
  heldAmount: { value: 10, contributors: [] },
  moneyAtRisk: { value: 20, contributors: [] },
  readyToRelease: { value: 30, contributors: [] },
  integrationStops: { value: 1, contributors: [] },
  transportStops: { value: 0, contributors: [] },
  slaCritical: { value: 2, contributors: [] },
};

const canonical: ControlTowerKpi = {
  activeDeals: 5,
  disputedDeals: 1,
  blockedDeals: 2,
  totalGmv: 120,
  totalReserved: 105,
  totalHold: 10,
  moneyAtRisk: 25,
  readyToRelease: 29,
  averageRiskScore: 42,
  maxRiskScore: 92,
};

describe('canonical KPI diff helper', () => {
  it('builds rows with stable deltas', () => {
    const rows = buildControlTowerKpiReconciliationRows(legacy, canonical);

    expect(rows.map((row) => [row.key, row.delta])).toEqual([
      ['reserve', 5],
      ['held', 0],
      ['moneyAtRisk', 5],
      ['readyToRelease', -1],
    ]);
    expect(hasKpiReconciliationDelta(rows)).toBe(true);
  });

  it('detects zero deltas', () => {
    const rows = buildControlTowerKpiReconciliationRows(legacy, {
      ...canonical,
      totalReserved: 100,
      totalHold: 10,
      moneyAtRisk: 20,
      readyToRelease: 30,
    });

    expect(hasKpiReconciliationDelta(rows)).toBe(false);
  });
});
