import { describe, expect, it } from 'vitest';
import {
  calculateElevatorWeightImpact,
  selectDealExecutionCase,
} from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('elevator-weight-impact', () => {
  it('creates weight event money impact and dispute trigger when accepted weight is lower', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    if (!executionCase) throw new Error('DL-9106 source of truth missing');

    const impact = calculateElevatorWeightImpact({
      dealId: executionCase.dealId,
      declaredTons: executionCase.commodity.volumeDeclaredTons,
      grossTons: 596.8,
      tareTons: 0,
      moistureAdjustmentTons: 1.5,
      impurityAdjustmentTons: 0.8,
      pricePerTon: executionCase.price.pricePerTon,
    });

    expect(impact.netTons).toBe(596.8);
    expect(impact.acceptedTons).toBe(594.5);
    expect(impact.deltaTons).toBe(5.5);
    expect(impact.weightAdjustmentAmount).toBe(88_440);
    expect(impact.holdAmount).toBe(88_440);
    expect(impact.draftDiscrepancyActRequired).toBe(true);
    expect(impact.disputeTrigger).toBe(true);
    expect(impact.nextRoleTask).toContain('draft акта расхождения');
  });

  it('does not create a hold when accepted weight matches declared weight', () => {
    const executionCase = selectDealExecutionCase('DL-9106');
    if (!executionCase) throw new Error('DL-9106 source of truth missing');

    const impact = calculateElevatorWeightImpact({
      dealId: executionCase.dealId,
      declaredTons: executionCase.commodity.volumeDeclaredTons,
      grossTons: 600,
      tareTons: 0,
      moistureAdjustmentTons: 0,
      impurityAdjustmentTons: 0,
      pricePerTon: executionCase.price.pricePerTon,
    });

    expect(impact.deltaTons).toBe(0);
    expect(impact.holdAmount).toBe(0);
    expect(impact.draftDiscrepancyActRequired).toBe(false);
    expect(impact.disputeTrigger).toBe(false);
  });
});
