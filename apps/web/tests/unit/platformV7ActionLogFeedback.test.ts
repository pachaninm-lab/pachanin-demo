import { describe, expect, it } from 'vitest';
import { createPlatformV7ActionFeedback } from '@/lib/platform-v7/action-feedback';
import { appendFeedbackToActionLog, createActionLogEntryFromFeedback } from '@/lib/platform-v7/action-log-feedback';

describe('platform-v7 action log feedback bridge', () => {
  it('creates action log entry from success feedback', () => {
    const feedback = createPlatformV7ActionFeedback({
      actionId: 'releaseFunds',
      entityId: 'DL-9102',
      status: 'success',
      message: 'Деньги выпущены.',
      timestamp: '2026-04-25T08:00:00.000Z',
    });

    expect(createActionLogEntryFromFeedback(feedback, 'bank', 'Оператор')).toMatchObject({
      scope: 'bank',
      status: 'success',
      objectId: 'DL-9102',
      action: 'releaseFunds',
      actor: 'Оператор',
    });
  });

  it('maps loading feedback to started log status', () => {
    const feedback = createPlatformV7ActionFeedback({
      actionId: 'requestRelease',
      entityId: 'DL-9102',
      status: 'loading',
      message: 'Запрос выполняется.',
      timestamp: '2026-04-25T08:00:00.000Z',
    });

    expect(createActionLogEntryFromFeedback(feedback, 'deal').status).toBe('started');
  });

  it('appends feedback to existing action log', () => {
    const feedback = createPlatformV7ActionFeedback({
      actionId: 'closeDispute',
      entityId: 'DK-2024-89',
      status: 'success',
      message: 'Спор закрыт.',
      timestamp: '2026-04-25T08:00:00.000Z',
    });

    expect(appendFeedbackToActionLog([], feedback, 'dispute', 'Арбитр')).toHaveLength(1);
  });
});
