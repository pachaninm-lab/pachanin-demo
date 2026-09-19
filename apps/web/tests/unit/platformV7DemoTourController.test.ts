import { describe, expect, it } from 'vitest';
import {
  clampPlatformV7DemoTourElapsed,
  platformV7DemoTourCanJumpTo,
  platformV7DemoTourElapsedForStep,
  platformV7DemoTourNextStep,
  platformV7DemoTourPosition,
  platformV7DemoTourPreviousStep,
} from '@/lib/platform-v7/demo-tour-controller';
import { platformV7DemoTourDurationMs } from '@/lib/platform-v7/demo-tour';

describe('platform-v7 demo tour controller', () => {
  it('clamps elapsed time to the tour duration', () => {
    expect(clampPlatformV7DemoTourElapsed(-1)).toBe(0);
    expect(clampPlatformV7DemoTourElapsed(platformV7DemoTourDurationMs() + 1)).toBe(platformV7DemoTourDurationMs());
  });

  it('resolves current step by elapsed time', () => {
    expect(platformV7DemoTourPosition(0)).toMatchObject({
      stepIndex: 0,
      step: expect.objectContaining({ id: 'lot-readiness' }),
      isComplete: false,
    });
    expect(platformV7DemoTourPosition(platformV7DemoTourDurationMs())).toMatchObject({
      stepIndex: 4,
      step: expect.objectContaining({ id: 'money-release' }),
      isComplete: true,
      progress: 1,
    });
  });

  it('calculates elapsed offset for jump-to-step', () => {
    expect(platformV7DemoTourElapsedForStep('lot-readiness')).toBe(0);
    expect(platformV7DemoTourElapsedForStep('rfq-selection')).toBe(22000);
  });

  it('moves between steps', () => {
    expect(platformV7DemoTourNextStep('lot-readiness')?.id).toBe('rfq-selection');
    expect(platformV7DemoTourPreviousStep('rfq-selection')?.id).toBe('lot-readiness');
    expect(platformV7DemoTourNextStep('money-release')).toBeNull();
  });

  it('validates jump targets', () => {
    expect(platformV7DemoTourCanJumpTo('money-release')).toBe(true);
    expect(platformV7DemoTourCanJumpTo('unknown')).toBe(false);
  });
});
