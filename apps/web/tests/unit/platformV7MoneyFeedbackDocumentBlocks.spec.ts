import { expect, it } from 'vitest';
import { createActionFeedbackPreview } from '@/lib/platform-v7/grain-execution/automation/action-feedback-engine';
import { calculateMoneyProjection } from '@/lib/platform-v7/grain-execution/automation/money-release-engine';
import { createNextAction } from '@/lib/platform-v7/grain-execution/automation/next-action-engine';
import type { DocumentRequirement } from '@/lib/platform-v7/grain-execution/types';

const documentBlock: DocumentRequirement = {
  id: 'DOC-BLOCK-1',
  dealId: 'DL-GRAIN-450',
  relatedEntityType: 'money',
  relatedEntityId: 'DL-GRAIN-450',
  documentType: 'bank_confirmation',
  required: true,
  status: 'required',
  responsibleRole: 'bank',
  blocksLotPublication: false,
  blocksShipment: false,
  blocksAcceptance: false,
  blocksMoneyRelease: true,
  externalSystem: 'bank',
  createdAt: '2026-05-05T09:00:00.000Z',
  updatedAt: '2026-05-05T09:00:00.000Z',
};

it('closes money action feedback when money release has blocking documents', () => {
  const action = createNextAction({
    seed: 'money-feedback-doc-block-test',
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
    documents: [documentBlock],
  });

  const feedback = createActionFeedbackPreview(action, moneyProjection);

  expect(feedback.title).toBe('Действие пока закрыто');
  expect(feedback.statusText).toContain('незакрытые документы');
  expect(feedback.auditEvent.reason).toContain('блокирующие основания');
});
