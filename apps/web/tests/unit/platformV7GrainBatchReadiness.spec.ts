import { expect, it } from 'vitest';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

it('keeps batch readiness connected to blockers and next actions', () => {
  const ctx = getGrainExecutionContext();
  expect(ctx.readiness.batchId).toBe(ctx.primaryBatch.id);
  expect(ctx.readiness.blockers.length).toBeGreaterThan(0);
  expect(ctx.readiness.nextActions.length).toBeGreaterThan(0);
});
