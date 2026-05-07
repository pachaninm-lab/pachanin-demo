import { expect, it } from 'vitest';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

it('keeps platform-v7 feedback copy explicit about external confirmation boundaries', () => {
  const ctx = getGrainExecutionContext();
  const moneyFeedback = ctx.actionFeedbackPreviews.filter((item) => /банк|банков/i.test(item.externalConfirmationText));

  expect(moneyFeedback.length).toBeGreaterThan(0);
  expect(moneyFeedback.every((item) => /не имитируется/i.test(item.externalConfirmationText))).toBe(true);
});

it('keeps support feedback tied to execution objects', () => {
  const ctx = getGrainExecutionContext();

  expect(ctx.supportActionFeedback.length).toBeGreaterThan(0);
  expect(ctx.supportActionFeedback.every((item) => item.auditEvent.entityType === 'support_case')).toBe(true);
  expect(ctx.supportActionFeedback.every((item) => item.auditEvent.entityId === item.supportCaseId)).toBe(true);
});
