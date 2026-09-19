import { describe, expect, it } from 'vitest';
import {
  canPlatformV7QualityAffectMoney,
  canPlatformV7QualityResultBecomeEvidence,
  getPlatformV7QualityDeviations,
  hasPlatformV7QualityDeviation,
  type PlatformV7QualityResult,
} from '@/lib/platform-v7/quality-model';

const result: PlatformV7QualityResult = {
  id: 'quality-1',
  dealId: 'deal-1',
  batchId: 'batch-1',
  tripId: 'trip-1',
  labProtocolId: 'lab-1',
  discountRub: 0,
  createsDispute: false,
  evidenceItemIds: ['ev-1'],
  metrics: [
    { key: 'moisture', label: 'Влажность', contractValue: 14, actualValue: 14.2, tolerance: 0.5, unit: '%' },
    { key: 'foreign_matter', label: 'Сорность', contractValue: 2, actualValue: 2.1, tolerance: 0.3, unit: '%' },
  ],
};

describe('platform-v7 quality model', () => {
  it('detects only metrics outside tolerance as deviations', () => {
    expect(getPlatformV7QualityDeviations(result)).toEqual([]);
    expect(getPlatformV7QualityDeviations({ ...result, metrics: [{ ...result.metrics[0], actualValue: 15 }] })).toHaveLength(1);
  });

  it('keeps quality deviation explicit', () => {
    expect(hasPlatformV7QualityDeviation(result)).toBe(false);
    expect(hasPlatformV7QualityDeviation({ ...result, metrics: [{ ...result.metrics[0], actualValue: 15 }] })).toBe(true);
  });

  it('affects money only through discount or dispute flag', () => {
    expect(canPlatformV7QualityAffectMoney(result)).toBe(false);
    expect(canPlatformV7QualityAffectMoney({ ...result, discountRub: 25_000 })).toBe(true);
    expect(canPlatformV7QualityAffectMoney({ ...result, createsDispute: true })).toBe(true);
  });

  it('becomes evidence only when lab protocol and evidence items exist', () => {
    expect(canPlatformV7QualityResultBecomeEvidence(result)).toBe(true);
    expect(canPlatformV7QualityResultBecomeEvidence({ ...result, labProtocolId: undefined })).toBe(false);
    expect(canPlatformV7QualityResultBecomeEvidence({ ...result, evidenceItemIds: [] })).toBe(false);
  });
});
