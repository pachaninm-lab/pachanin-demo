import { describe, expect, it } from 'vitest';
import {
  calculatePlatformV7NetTons,
  calculatePlatformV7WeightDeltaTons,
  canPlatformV7WeighingCloseStep,
  hasPlatformV7WeightDeviation,
  shouldPlatformV7WeighingCreateHold,
  type PlatformV7WeighingResult,
} from '@/lib/platform-v7/weighing-model';

const result: PlatformV7WeighingResult = {
  id: 'weight-1',
  dealId: 'deal-1',
  tripId: 'trip-1',
  expectedNetTons: 600,
  grossTons: 620,
  tareTons: 20,
  toleranceTons: 0.5,
  evidenceItemIds: ['ev-1'],
  actId: 'act-1',
  holdRub: 0,
};

describe('platform-v7 weighing model', () => {
  it('calculates net and delta tons from gross and tare', () => {
    expect(calculatePlatformV7NetTons(result)).toBe(600);
    expect(calculatePlatformV7WeightDeltaTons(result)).toBe(0);
  });

  it('detects deviations only outside tolerance', () => {
    expect(hasPlatformV7WeightDeviation(result)).toBe(false);
    expect(hasPlatformV7WeightDeviation({ ...result, grossTons: 621 })).toBe(true);
  });

  it('closes weighing only with act, evidence, no deviation and no hold', () => {
    expect(canPlatformV7WeighingCloseStep(result)).toBe(true);
    expect(canPlatformV7WeighingCloseStep({ ...result, actId: undefined })).toBe(false);
    expect(canPlatformV7WeighingCloseStep({ ...result, evidenceItemIds: [] })).toBe(false);
    expect(canPlatformV7WeighingCloseStep({ ...result, grossTons: 621 })).toBe(false);
    expect(canPlatformV7WeighingCloseStep({ ...result, holdRub: 1000 })).toBe(false);
  });

  it('creates hold when deviation exists or hold amount is already set', () => {
    expect(shouldPlatformV7WeighingCreateHold(result)).toBe(false);
    expect(shouldPlatformV7WeighingCreateHold({ ...result, grossTons: 621 })).toBe(true);
    expect(shouldPlatformV7WeighingCreateHold({ ...result, holdRub: 1000 })).toBe(true);
  });
});
