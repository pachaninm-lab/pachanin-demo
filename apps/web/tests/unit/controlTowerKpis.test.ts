import { describe, expect, it } from 'vitest';
import { computeControlTowerKpis, type KpiDealInput } from '@/lib/domain/kpi/controlTower';

const sampleDeals: KpiDealInput[] = [
  {
    id: 'DL-9102',
    reservedAmount: 6240000,
    holdAmount: 624000,
    releaseAmount: 4368000,
    riskScore: 92,
    status: 'quality_disputed',
    blockers: ['docs'],
    slaDeadline: '2026-04-24',
    dispute: { id: 'DK-2024-89' },
    routeState: 'Прибыл отклонение',
  },
  {
    id: 'DL-9109',
    reservedAmount: 10500000,
    holdAmount: 0,
    releaseAmount: 10500000,
    riskScore: 12,
    status: 'release_requested',
    blockers: [],
    slaDeadline: '2026-04-20',
  },
  {
    id: 'DL-9118',
    reservedAmount: 7800000,
    holdAmount: 1170000,
    releaseAmount: 6630000,
    riskScore: 71,
    status: 'quality_disputed',
    blockers: ['fgis'],
    slaDeadline: '2026-04-30',
    dispute: { id: 'DK-2024-93' },
  },
];

describe('computeControlTowerKpis', () => {
  const kpis = computeControlTowerKpis(sampleDeals, new Date('2026-04-23T12:00:00Z'));

  it('sums reserve total', () => {
    expect(kpis.reserveTotal.value).toBe(24540000);
  });

  it('sums held amount', () => {
    expect(kpis.heldAmount.value).toBe(1794000);
  });

  it('sums ready to release amount', () => {
    expect(kpis.readyToRelease.value).toBe(10500000);
  });

  it('computes money at risk', () => {
    expect(kpis.moneyAtRisk.value).toBe(3198000);
  });

  it('counts integration stops', () => {
    expect(kpis.integrationStops.value).toBe(1);
  });

  it('counts transport stops', () => {
    expect(kpis.transportStops.value).toBe(1);
  });

  it('counts critical SLA deadlines', () => {
    expect(kpis.slaCritical.value).toBe(2);
  });

  it('falls back to reserve minus hold for release amount', () => {
    const result = computeControlTowerKpis([{ ...sampleDeals[1], releaseAmount: undefined }]);
    expect(result.readyToRelease.value).toBe(10500000);
  });
});
