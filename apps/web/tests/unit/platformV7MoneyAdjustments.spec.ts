import { expect, it } from 'vitest';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

it('keeps disputed money separated from releasable money', () => {
  const ctx = getGrainExecutionContext();
  expect(ctx.moneyProjection.reservedAmount.value).toBeGreaterThan(0);
  expect(ctx.moneyProjection.heldAmount.value).toBeGreaterThan(0);
  expect(ctx.moneyProjection.adjustments.some((item) => item.allowsPartialRelease)).toBe(true);
  expect(ctx.moneyProjection.releaseBlockedReasons.length).toBeGreaterThan(0);
});
