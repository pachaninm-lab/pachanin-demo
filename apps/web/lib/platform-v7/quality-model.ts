import type { PlatformV7EntityId, PlatformV7RubAmount } from './execution-model';

export interface PlatformV7QualityMetric {
  key: 'moisture' | 'foreign_matter' | 'gluten' | 'test_weight' | 'protein' | 'infection' | 'class';
  label: string;
  contractValue: number;
  actualValue: number;
  tolerance: number;
  unit: string;
}

export interface PlatformV7QualityResult {
  id: PlatformV7EntityId;
  dealId: PlatformV7EntityId;
  batchId: PlatformV7EntityId;
  tripId: PlatformV7EntityId;
  labProtocolId?: PlatformV7EntityId;
  metrics: PlatformV7QualityMetric[];
  discountRub: PlatformV7RubAmount;
  createsDispute: boolean;
  evidenceItemIds: PlatformV7EntityId[];
}

export function getPlatformV7QualityDeviations(result: PlatformV7QualityResult): PlatformV7QualityMetric[] {
  return result.metrics.filter((metric) => Math.abs(metric.actualValue - metric.contractValue) > metric.tolerance);
}

export function hasPlatformV7QualityDeviation(result: PlatformV7QualityResult): boolean {
  return getPlatformV7QualityDeviations(result).length > 0;
}

export function canPlatformV7QualityAffectMoney(result: PlatformV7QualityResult): boolean {
  return result.discountRub > 0 || result.createsDispute;
}

export function canPlatformV7QualityResultBecomeEvidence(result: PlatformV7QualityResult): boolean {
  return Boolean(result.labProtocolId) && result.evidenceItemIds.length > 0;
}
