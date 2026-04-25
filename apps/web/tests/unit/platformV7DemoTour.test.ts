import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_DEMO_TOUR_STEPS,
  platformV7DemoTourDurationMs,
  platformV7DemoTourStepById,
  platformV7DemoTourSteps,
} from '@/lib/platform-v7/demo-tour';

describe('platform-v7 demo tour', () => {
  it('contains five ordered demo steps', () => {
    expect(platformV7DemoTourSteps().map((step) => step.id)).toEqual([
      'lot-readiness',
      'rfq-selection',
      'logistics-control',
      'acceptance-quality',
      'money-release',
    ]);
  });

  it('keeps auto-tour within the 2-3 minute acceptance window', () => {
    const durationMs = platformV7DemoTourDurationMs();
    expect(durationMs).toBeGreaterThanOrEqual(120000);
    expect(durationMs).toBeLessThanOrEqual(180000);
  });

  it('keeps every step route and narration usable', () => {
    PLATFORM_V7_DEMO_TOUR_STEPS.forEach((step) => {
      expect(step.route.startsWith('/platform-v7/')).toBe(true);
      expect(step.narration.length).toBeGreaterThan(40);
      expect(step.highlights.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('finds tour steps by id', () => {
    expect(platformV7DemoTourStepById('money-release')).toMatchObject({
      route: '/platform-v7/bank',
      title: 'Деньги и спорность',
    });
  });
});
