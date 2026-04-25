import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_ACTION_MESSAGES,
  platformV7ActionMessageIds,
  platformV7ActionMessages,
} from '@/lib/platform-v7/action-messages';

describe('platform-v7 action messages', () => {
  it('keeps terminal action messages centralized', () => {
    expect(platformV7ActionMessages('releaseFunds')).toEqual({
      loading: 'Запускаем выпуск денег.',
      success: 'Деньги по сделке выпущены.',
      error: 'Не удалось выпустить деньги.',
    });
  });

  it('covers core E03 actions', () => {
    expect(platformV7ActionMessageIds()).toEqual([
      'startDocs',
      'completeDocs',
      'requestRelease',
      'releaseFunds',
      'openDispute',
      'resolveDispute',
      'manualReview',
      'retryWebhook',
    ]);
  });

  it('keeps every action with loading success and error copy', () => {
    Object.values(PLATFORM_V7_ACTION_MESSAGES).forEach((messages) => {
      expect(messages.loading.length).toBeGreaterThan(0);
      expect(messages.success.length).toBeGreaterThan(0);
      expect(messages.error.length).toBeGreaterThan(0);
    });
  });
});
