import { expect, it } from 'vitest';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';

it('matches RFQ to grain batches with risk and delivered price', () => {
  const ctx = getGrainExecutionContext();
  expect(ctx.rfqMatches.length).toBeGreaterThan(0);
  expect(ctx.rfqMatches[0].deliveredPricePerTon.value).toBeGreaterThan(0);
  expect(ctx.rfqMatches[0].nextAction.targetRoute).toContain('/platform-v7/buyer/rfq/');
});
