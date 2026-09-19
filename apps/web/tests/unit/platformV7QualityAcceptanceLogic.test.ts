import { describe, expect, it } from 'vitest';
import {
  calculateElevatorWeightImpact,
  calculateLabQualityImpact,
  DL_9106_EXECUTION_CASE,
  PLATFORM_V7_WHEAT_4_CLASS_TERMS,
  type DealExecutionLabProtocol,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

const baseProtocol: DealExecutionLabProtocol = {
  crop: 'Пшеница',
  class: '4 класс',
  moisture: 13.8,
  nature: 735,
  protein: 11.8,
  gluten: 18.5,
  idk: 95,
  fallingNumber: 190,
  weedImpurity: 1.8,
  grainImpurity: 4.8,
  infestation: 'не обнаружена',
  protocolNumber: 'LAB-AUDIT-001',
  method: 'ГОСТ / controlled pilot protocol',
  laboratory: 'Лаборатория controlled pilot',
  signer: 'lab-specialist',
  kepStatus: 'ручная проверка КЭП',
  measuredAt: '2026-01-01T12:00:00Z',
};

describe('platform-v7 quality and acceptance logic', () => {
  it('turns accepted-weight shortage into hold, discrepancy act task and dispute trigger', () => {
    const result = calculateElevatorWeightImpact({
      dealId: 'DL-9106',
      declaredTons: 600,
      grossTons: 596.8,
      tareTons: 0,
      moistureAdjustmentTons: 1.5,
      impurityAdjustmentTons: 0.8,
      pricePerTon: DL_9106_EXECUTION_CASE.price.pricePerTon,
    });

    expect(result.deltaTons).toBeGreaterThan(0);
    expect(result.holdAmount).toBe(result.weightAdjustmentAmount);
    expect(result.holdAmount).toBeGreaterThan(0);
    expect(result.draftDiscrepancyActRequired).toBe(true);
    expect(result.disputeTrigger).toBe(true);
    expect(result.nextRoleTask.toLowerCase()).toContain('акт');
  });

  it('does not create a weight hold when accepted tons cover declared tons', () => {
    const result = calculateElevatorWeightImpact({
      dealId: 'DL-9106',
      declaredTons: 600,
      grossTons: 604,
      tareTons: 0,
      moistureAdjustmentTons: 1,
      impurityAdjustmentTons: 1,
      pricePerTon: DL_9106_EXECUTION_CASE.price.pricePerTon,
    });

    expect(result.deltaTons).toBe(0);
    expect(result.holdAmount).toBe(0);
    expect(result.draftDiscrepancyActRequired).toBe(false);
    expect(result.disputeTrigger).toBe(false);
  });

  it('turns quality deviation into price adjustment, hold and bank-visible status', () => {
    const protocol: DealExecutionLabProtocol = {
      ...baseProtocol,
      class: '5 класс',
      moisture: 15.2,
      nature: 724,
      protein: 10.9,
      gluten: 16.7,
      idk: 108,
      fallingNumber: 166,
      weedImpurity: 2.6,
      grainImpurity: 5.8,
    };

    const result = calculateLabQualityImpact(DL_9106_EXECUTION_CASE, protocol, PLATFORM_V7_WHEAT_4_CLASS_TERMS);

    expect(result.qualityDelta.length).toBeGreaterThanOrEqual(5);
    expect(result.priceAdjustmentPerTon).toBeGreaterThan(0);
    expect(result.priceAdjustment).toBeGreaterThan(0);
    expect(result.holdAmount).toBe(result.priceAdjustment);
    expect(result.disputeTrigger).toBe(true);
    expect(result.bankStatus).toContain('качество не закрыто');
    expect(result.nextRoleTask.toLowerCase()).toContain('банк');
  });

  it('keeps clean quality protocol from creating hold or dispute trigger', () => {
    const result = calculateLabQualityImpact(DL_9106_EXECUTION_CASE, baseProtocol, PLATFORM_V7_WHEAT_4_CLASS_TERMS);

    expect(result.qualityDelta).toEqual([]);
    expect(result.priceAdjustmentPerTon).toBe(0);
    expect(result.priceAdjustment).toBe(0);
    expect(result.holdAmount).toBe(0);
    expect(result.disputeTrigger).toBe(false);
    expect(result.bankStatus).toContain('качество закрыто');
  });
});
