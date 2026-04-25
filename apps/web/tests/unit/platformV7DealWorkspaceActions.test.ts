import { describe, expect, it } from 'vitest';
import {
  platformV7DealWorkspaceActionById,
  platformV7DealWorkspaceActionPlan,
  platformV7DealWorkspaceActionPlanIsValid,
  platformV7DealWorkspaceActions,
} from '@/lib/platform-v7/deal-workspace-actions';

describe('platform-v7 deal workspace actions', () => {
  it('keeps the canonical action catalog', () => {
    expect(platformV7DealWorkspaceActions().map((action) => action.id)).toEqual([
      'request-release',
      'release-funds',
      'start-documents',
      'complete-documents',
      'open-dispute',
      'resolve-dispute',
      'open-bank',
      'open-disputes',
    ]);
  });

  it('finds actions by id', () => {
    expect(platformV7DealWorkspaceActionById('open-bank')).toMatchObject({
      label: 'Банк',
      href: '/platform-v7/bank',
      kind: 'tertiary',
    });
  });

  it('enforces one primary and two secondary actions in a plan', () => {
    const plan = platformV7DealWorkspaceActionPlan([
      'request-release',
      'release-funds',
      'start-documents',
      'complete-documents',
      'open-dispute',
      'open-bank',
      'open-disputes',
    ]);

    expect(plan.primary).toHaveLength(1);
    expect(plan.secondary).toHaveLength(2);
    expect(plan.tertiary).toHaveLength(2);
    expect(platformV7DealWorkspaceActionPlanIsValid(plan)).toBe(true);
  });
});
