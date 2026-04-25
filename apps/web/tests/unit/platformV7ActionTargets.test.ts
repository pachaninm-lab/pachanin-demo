import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_ACTION_TARGETS, platformV7ActionTargetById, platformV7ActionTargets } from '@/lib/platform-v7/action-targets';

describe('platform-v7 action targets', () => {
  it('covers at least twenty action buttons for E03', () => {
    expect(PLATFORM_V7_ACTION_TARGETS).toHaveLength(20);
    expect(PLATFORM_V7_ACTION_TARGETS.every((target) => target.requiresFeedback)).toBe(true);
  });

  it('filters targets by surface', () => {
    expect(platformV7ActionTargets('deal-detail').map((target) => target.id)).toEqual([
      'deal-start-docs',
      'deal-complete-docs',
      'deal-request-release',
      'deal-release-funds',
      'deal-open-dispute',
      'deal-resolve-dispute',
    ]);
  });

  it('finds target by id', () => {
    expect(platformV7ActionTargetById('bank-webhook-retry')).toMatchObject({
      surface: 'bank-webhooks',
      actionId: 'retryWebhook',
      scope: 'bank',
    });
    expect(platformV7ActionTargetById('unknown')).toBeNull();
  });
});
