import { describe, expect, it } from 'vitest';
import { computeControlTowerKpis } from '@/lib/domain/kpi/controlTower';
import { calculateControlTowerMoneyAtRisk, calculateMoneyKpi, type CanonicalDeal } from '@/lib/platform-v7/domain';

const legacyRiskDeal = {
  id: 'DL-RISK-1',
  reservedAmount: 1_000_000,
  holdAmount: 100_000,
  releaseAmount: 900_000,
  riskScore: 80,
  status: 'quality_disputed',
  blockers: [] as string[],
  slaDeadline: null,
  dispute: { id: 'DK-RISK-1' },
};

const canonicalRiskDeal: CanonicalDeal = {
  id: 'DL-RISK-1',
  status: 'DISPUTED',
  legacyStatus: 'quality_disputed',
  grain: 'Пшеница 4 кл.',
  quantity: 100,
  unit: 'т',
  pricePerUnit: 10_000,
  money: {
    totalAmount: 1_000_000,
    reservedAmount: 1_000_000,
    holdAmount: 100_000,
    releaseAmount: 900_000,
  },
  seller: { id: 'seller-1', name: 'Продавец', role: 'seller' },
  buyer: { id: 'buyer-1', name: 'Покупатель', role: 'buyer' },
  driver: null,
  elevator: null,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
  slaDeadline: null,
  dispute: { id: 'DK-RISK-1', title: 'Проверка риска', amountAtRisk: 100_000 },
  riskScore: 80,
  blockers: [],
  timeline: [],
  documents: [],
  maturity: 'sandbox',
};

describe('risk KPI migration safety', () => {
  it('keeps Control Tower risk conservative while ledger risk remains event-based', () => {
    const legacyRisk = computeControlTowerKpis([legacyRiskDeal]).moneyAtRisk.value;
    const canonicalLedgerRisk = calculateMoneyKpi([canonicalRiskDeal]).moneyAtRisk;
    const canonicalControlTowerRisk = calculateControlTowerMoneyAtRisk([canonicalRiskDeal]);

    expect(legacyRisk).toBe(200_000);
    expect(canonicalLedgerRisk).toBe(100_000);
    expect(canonicalControlTowerRisk).toBe(200_000);
    expect(canonicalControlTowerRisk).toBeGreaterThanOrEqual(legacyRisk);
  });
});
