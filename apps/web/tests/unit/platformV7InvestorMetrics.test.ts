import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_INVESTOR_METRICS,
  platformV7InvestorMetricById,
  platformV7InvestorMetricDelta,
  platformV7InvestorMetrics,
} from '@/lib/platform-v7/investor-metrics';

describe('platform-v7 investor metrics', () => {
  it('provides at least six investor KPI widgets', () => {
    expect(platformV7InvestorMetrics()).toHaveLength(6);
  });

  it('marks demo assumptions explicitly', () => {
    expect(PLATFORM_V7_INVESTOR_METRICS.every((metric) => metric.note.startsWith('ГИПОТЕЗА'))).toBe(true);
  });

  it('finds metrics by id', () => {
    expect(platformV7InvestorMetricById('gmv')).toMatchObject({
      title: 'GMV',
      value: 182,
      unit: 'млн ₽/мес',
    });
    expect(platformV7InvestorMetricById('unknown')).toBeNull();
  });

  it('calculates trend delta', () => {
    const metric = platformV7InvestorMetricById('gmv');
    expect(metric).not.toBeNull();
    expect(platformV7InvestorMetricDelta(metric!)).toBe(140);
  });
});
