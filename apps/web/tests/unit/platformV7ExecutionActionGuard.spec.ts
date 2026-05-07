import { expect, it } from 'vitest';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';
import { guardNextActionsForExecutionState } from '@/lib/platform-v7/grain-execution/automation/action-guard-engine';
import { createNextAction } from '@/lib/platform-v7/grain-execution/automation/next-action-engine';

it('keeps unsafe money release disabled when documents or SDIZ still block it', () => {
  const ctx = getGrainExecutionContext();
  const releaseAction = ctx.summary.nextActions.find((action) => action.actionType === 'approve_release' || action.actionType === 'resolve_blocker');

  expect(releaseAction).toBeDefined();
  expect(releaseAction?.disabled).toBe(true);
  expect(releaseAction?.disabledReason).toMatch(/выпуск денег|документ|СДИЗ|остановки/i);
});

it('blocks lot publication below the safe readiness threshold', () => {
  const publishAction = createNextAction({
    seed: 'unsafe-publish-test',
    title: 'Создать лот из партии',
    role: 'seller',
    priority: 'high',
    actionType: 'publish_lot',
    targetRoute: '/platform-v7/batches/view',
  });

  const [guardedAction] = guardNextActionsForExecutionState([publishAction], {
    readiness: {
      batchId: 'GB-TEST',
      score: 65,
      status: 'almost_ready',
      blockers: [],
      nextActions: [],
    },
  });

  expect(guardedAction.disabled).toBe(true);
  expect(guardedAction.disabledReason).toBe('Готовность партии ниже безопасного порога публикации.');
});
