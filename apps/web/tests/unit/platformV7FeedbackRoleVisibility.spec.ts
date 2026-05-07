import { expect, it } from 'vitest';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

it('hides support feedback from driver and investor roles', () => {
  const ctx = getGrainExecutionContext();

  expect(ctx.supportActionFeedback.length).toBeGreaterThan(0);
  expect(ctx.supportActionFeedbackForRole('driver')).toHaveLength(0);
  expect(ctx.supportActionFeedbackForRole('investor')).toHaveLength(0);
});

it('keeps support feedback scoped for execution roles', () => {
  const ctx = getGrainExecutionContext();

  expect(ctx.supportActionFeedbackForRole('operator').length).toBe(ctx.supportActionFeedback.length);
  expect(ctx.supportActionFeedbackForRole('logistics').every((item) => item.auditEvent.entityType === 'support_case')).toBe(true);
});
