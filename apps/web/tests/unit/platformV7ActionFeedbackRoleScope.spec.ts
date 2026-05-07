import { expect, it } from 'vitest';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

it('hides next-action feedback from investor role', () => {
  const ctx = getGrainExecutionContext();

  expect(ctx.actionFeedbackPreviews.length).toBeGreaterThan(0);
  expect(ctx.actionFeedbackPreviewsForRole('investor')).toHaveLength(0);
});

it('keeps operator action feedback complete', () => {
  const ctx = getGrainExecutionContext();

  expect(ctx.actionFeedbackPreviewsForRole('operator').length).toBe(ctx.actionFeedbackPreviews.length);
});

it('does not expose bank release feedback to driver role', () => {
  const ctx = getGrainExecutionContext();
  const driverFeedback = ctx.actionFeedbackPreviewsForRole('driver');

  expect(driverFeedback.every((item) => item.auditEvent.actorRole === 'driver')).toBe(true);
  expect(driverFeedback.some((item) => /банк|банков/i.test(item.statusText))).toBe(false);
});
