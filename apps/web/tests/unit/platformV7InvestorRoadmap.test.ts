import { describe, expect, it } from 'vitest';
import {
  platformV7InvestorRoadmap,
  platformV7InvestorRoadmapByTrack,
  platformV7InvestorRoadmapSummary,
} from '@/lib/platform-v7/investor-roadmap';

describe('platform-v7 investor roadmap', () => {
  it('keeps investor roadmap items explicit and status-based', () => {
    expect(platformV7InvestorRoadmap()).toHaveLength(5);
    expect(platformV7InvestorRoadmap().every((item) => item.evidence.length > 0 && item.risk.length > 0)).toBe(true);
  });

  it('filters roadmap by track', () => {
    expect(platformV7InvestorRoadmapByTrack('product').map((item) => item.id)).toEqual([
      'source-of-truth',
      'action-feedback',
    ]);
  });

  it('summarizes roadmap statuses without claiming done work', () => {
    expect(platformV7InvestorRoadmapSummary()).toEqual({
      done: 0,
      in_progress: 3,
      blocked: 0,
      planned: 2,
    });
  });
});
