import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_INVESTOR_STORY,
  platformV7InvestorStory,
  platformV7InvestorStoryMetrics,
  platformV7InvestorStorySummary,
} from '@/lib/platform-v7/investor-story';

describe('platform-v7 investor story', () => {
  it('contains three investor story blocks', () => {
    expect(platformV7InvestorStory()).toHaveLength(3);
    expect(PLATFORM_V7_INVESTOR_STORY.map((block) => block.id)).toEqual([
      'execution-rail',
      'money-control',
      'controlled-pilot',
    ]);
  });

  it('links story blocks to investor metrics', () => {
    const metrics = platformV7InvestorStoryMetrics(PLATFORM_V7_INVESTOR_STORY[0]!);
    expect(metrics.map((metric) => metric.id)).toEqual(['gmv', 'cycleDays']);
  });

  it('builds story summary without missing metrics', () => {
    const summary = platformV7InvestorStorySummary();
    expect(summary.blocks).toHaveLength(3);
    expect(summary.linkedMetrics).toHaveLength(6);
    expect(summary.totalDelta).toBeGreaterThan(0);
  });
});
