import { expect, it } from 'vitest';
import { createActionFeedbackPreview } from '@/lib/platform-v7/grain-execution/automation/action-feedback-engine';
import { calculateMoneyProjection } from '@/lib/platform-v7/grain-execution/automation/money-release-engine';
import { createNextAction } from '@/lib/platform-v7/grain-execution/automation/next-action-engine';

it('closes money action feedback when money parts do not reconcile', () => {
  const action = createNextAction({
    seed: 'money-feedback-reconciliation-test',
    title: 'Подготовить выпуск денег через банк',
    role: 'bank',
    priority: 'high',
    actionType: 'approve_release',
    targetRoute: '/platform-v7/deals/DL-GRAIN-450/release',
    requiresReason: true,
  });
  const moneyProjection = calculateMoneyProjection({
    dealId: 'DL-GRAIN-450',
    grossDealAmount: 1000,
    reservedAmount: 1000,
    releasedAmount: 10,
  });

  const feedback = createActionFeedbackPreview(action, moneyProjection);

  expect(feedback.title).toBe('Действие пока закрыто');
  expect(feedback.statusText).toContain('суммы резерва');
  expect(feedback.auditEvent.reason).toContain('сверка денежных сумм');
});
