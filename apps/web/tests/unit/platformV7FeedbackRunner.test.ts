import { describe, expect, it } from 'vitest';
import { latestPlatformV7Feedback, runWithPlatformV7Feedback } from '@/lib/platform-v7/feedback-runner';

describe('platform-v7 feedback runner', () => {
  it('emits loading and success feedback around a successful action', async () => {
    let tick = 0;
    const outcome = await runWithPlatformV7Feedback({
      actionId: 'releaseFunds',
      entityId: 'DL-9102',
      messages: {
        loading: 'Выпуск денег запущен.',
        success: 'Деньги выпущены.',
        error: 'Деньги не выпущены.',
      },
      now: () => `2026-04-25T08:10:0${tick++}.000Z`,
      run: () => 'ok',
    });

    expect(outcome.result).toBe('ok');
    expect(outcome.feedback.map((item) => item.status)).toEqual(['loading', 'success']);
    expect(latestPlatformV7Feedback(outcome.feedback)?.message).toBe('Деньги выпущены.');
  });

  it('emits loading and retryable error feedback around a failed action', async () => {
    const outcome = await runWithPlatformV7Feedback({
      actionId: 'manualReview',
      entityId: 'DL-9118',
      messages: {
        loading: 'Проверка запущена.',
        success: 'Проверка завершена.',
        error: 'Проверка не завершена.',
      },
      now: () => '2026-04-25T08:10:00.000Z',
      run: () => {
        throw new Error('Повторите действие.');
      },
    });

    expect(outcome.result).toBeUndefined();
    expect(outcome.feedback.map((item) => item.status)).toEqual(['loading', 'error']);
    expect(latestPlatformV7Feedback(outcome.feedback)).toMatchObject({
      severity: 'error',
      retryable: true,
    });
  });

  it('returns null when no feedback exists', () => {
    expect(latestPlatformV7Feedback([])).toBeNull();
  });
});
