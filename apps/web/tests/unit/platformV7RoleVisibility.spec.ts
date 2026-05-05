import { expect, it } from 'vitest';
import { getGrainExecutionContext } from '@/lib/platform-v7/grain-execution/context';
import { assertRoleVisibility } from '@/lib/platform-v7/grain-execution/automation/role-visibility-engine';

it('hides money projection from driver role summary', () => {
  const ctx = getGrainExecutionContext();
  const driverSummary = ctx.summaryForRole('driver');
  expect(driverSummary.moneySummary).toBeUndefined();
  expect(assertRoleVisibility(driverSummary)).toEqual([]);
});
