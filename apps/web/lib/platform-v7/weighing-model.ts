import type { PlatformV7EntityId, PlatformV7RubAmount, PlatformV7Tons } from './execution-model';

export interface PlatformV7WeighingResult {
  id: PlatformV7EntityId;
  dealId: PlatformV7EntityId;
  tripId: PlatformV7EntityId;
  expectedNetTons: PlatformV7Tons;
  grossTons: PlatformV7Tons;
  tareTons: PlatformV7Tons;
  toleranceTons: PlatformV7Tons;
  evidenceItemIds: PlatformV7EntityId[];
  actId?: PlatformV7EntityId;
  holdRub: PlatformV7RubAmount;
}

export function calculatePlatformV7NetTons(result: PlatformV7WeighingResult): PlatformV7Tons {
  return Number((result.grossTons - result.tareTons).toFixed(3));
}

export function calculatePlatformV7WeightDeltaTons(result: PlatformV7WeighingResult): PlatformV7Tons {
  return Number((calculatePlatformV7NetTons(result) - result.expectedNetTons).toFixed(3));
}

export function hasPlatformV7WeightDeviation(result: PlatformV7WeighingResult): boolean {
  return Math.abs(calculatePlatformV7WeightDeltaTons(result)) > result.toleranceTons;
}

export function canPlatformV7WeighingCloseStep(result: PlatformV7WeighingResult): boolean {
  return Boolean(result.actId) && !hasPlatformV7WeightDeviation(result) && result.holdRub === 0 && result.evidenceItemIds.length > 0;
}

export function shouldPlatformV7WeighingCreateHold(result: PlatformV7WeighingResult): boolean {
  return hasPlatformV7WeightDeviation(result) || result.holdRub > 0;
}
