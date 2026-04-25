import { describe, expect, it, vi } from 'vitest';
import { runPlatformV7ActionWorkflow } from '@/lib/platform-v7/action-workflow';

describe('platform-v7 action workflow', () => {
  it('runs successful action and returns log plus toast', async () => {
    let tick = 0;
    const outcome = await runPlatformV7ActionWorkflow({
      actionId: 'releaseFunds',
      entityId: 'DL-9102',
      scope: 'bank',
      actor: 'Оператор',
      log: [],
      now: () => `2026-04-25T09:00:0${tick++}.000Z`,
      run: () => 'ok',
    });

    expect(outcome.result).toBe('ok');
    expect(outcome.feedback.map((item) => item.status)).toEqual(['loading', 'success']);
    expect(outcome.log).toHaveLength(2);
    expect(outcome.toasts).toEqual([
      expect.objectContaining({ message: 'DL-9102: Деньги по сделке выпущены.', type: 'success' }),
    ]);
  });

  it('runs failed action and returns retryable toast', async () => {
    const retry = vi.fn();
    const outcome = await runPlatformV7ActionWorkflow({
      actionId: 'manualReview',
      entityId: 'DL-9118',
      scope: 'bank',
      actor: 'Банк',
      log: [],
      retry,
      now: () => '2026-04-25T09:00:00.000Z',
      run: () => {
        throw new Error('Нет ответа от сервиса.');
      },
    });

    expect(outcome.result).toBeUndefined();
    expect(outcome.feedback.map((item) => item.status)).toEqual(['loading', 'error']);
    expect(outcome.log).toHaveLength(2);
    expect(outcome.toasts[0]).toMatchObject({ type: 'error', duration: 8000 });
    outcome.toasts[0]?.actions?.[0]?.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });
});
