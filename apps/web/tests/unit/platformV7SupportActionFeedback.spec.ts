import { expect, it } from 'vitest';
import { createSupportActionFeedback } from '@/lib/platform-v7/grain-execution/automation/support-action-feedback-engine';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

it('links support action feedback to the exact support case and related entity', () => {
  const ctx = getGrainExecutionContext();
  const supportCase = ctx.supportCases[0];

  expect(supportCase).toBeDefined();

  const feedback = createSupportActionFeedback(supportCase!);

  expect(feedback.supportCaseId).toBe(supportCase!.id);
  expect(feedback.auditEvent.entityType).toBe('support_case');
  expect(feedback.auditEvent.entityId).toBe(supportCase!.id);
  expect(feedback.auditEvent.reason).toContain(supportCase!.relatedEntityId);
  expect(feedback.statusText).toMatch(/связано с объектом сделки|обработке/i);
});

it('exposes support feedback from the grain execution context', () => {
  const ctx = getGrainExecutionContext();

  expect(ctx.supportActionFeedback.length).toBe(ctx.supportCases.length);
  expect(ctx.supportActionFeedback[0]?.nextVisibleState).toBeTruthy();
});
