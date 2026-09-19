import { expect, it } from 'vitest';
import { createActionFeedbackPreview } from '@/lib/platform-v7/grain-execution/automation/action-feedback-engine';
import { createNextAction } from '@/lib/platform-v7/grain-execution/automation/next-action-engine';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

it('keeps platform-v7 feedback copy explicit about external confirmation boundaries', () => {
  const moneyFeedback = createActionFeedbackPreview(createNextAction({
    seed: 'feedback-copy-safety-money-boundary',
    title: 'Подготовить выпуск денег через банк',
    role: 'bank',
    actionType: 'approve_release',
    targetRoute: '/platform-v7/deals/DL-GRAIN-450/release',
    requiresReason: true,
  }));

  expect(moneyFeedback.externalConfirmationText).toMatch(/банк|банков/i);
  expect(moneyFeedback.externalConfirmationText).toMatch(/не имитируется/i);
});

it('keeps support feedback tied to execution objects', () => {
  const ctx = getGrainExecutionContext();

  expect(ctx.supportActionFeedback.length).toBeGreaterThan(0);
  expect(ctx.supportActionFeedback.every((item) => item.auditEvent.entityType === 'support_case')).toBe(true);
  expect(ctx.supportActionFeedback.every((item) => item.auditEvent.entityId === item.supportCaseId)).toBe(true);
});
