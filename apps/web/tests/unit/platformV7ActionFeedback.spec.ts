import { expect, it } from 'vitest';
import { createActionFeedbackPreview } from '@/lib/platform-v7/grain-execution/automation/action-feedback-engine';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';
import { createNextAction } from '@/lib/platform-v7/grain-execution/automation/next-action-engine';

it('creates action feedback previews for guarded next actions', () => {
  const ctx = getGrainExecutionContext();

  expect(ctx.actionFeedbackPreviews.length).toBe(ctx.nextActions.length);
  expect(ctx.actionFeedbackPreviews[0]?.auditEvent.entityType).toBe('next_action');
  expect(ctx.actionFeedbackPreviews[0]?.externalConfirmationText).toMatch(/не имитируется/i);
});

it('does not pretend that bank release has external confirmation', () => {
  const action = createNextAction({
    seed: 'bank-release-feedback-test',
    title: 'Подготовить выпуск денег через банк',
    role: 'bank',
    priority: 'high',
    actionType: 'approve_release',
    targetRoute: '/platform-v7/deals/DL-GRAIN-450/release',
    requiresReason: true,
  });

  const feedback = createActionFeedbackPreview(action);

  expect(feedback.statusText).toContain('банковского подтверждения');
  expect(feedback.externalConfirmationText).toBe('Внешнее банковое подтверждение не имитируется. Нужен ответ банка или ручная сверка.');
  expect(feedback.auditEvent.reason).toMatch(/журнале/i);
});
