import { describe, expect, it } from 'vitest';
import { runPlatformAction } from '@/lib/platform-v7/action-runner';

describe('platform-v7 action runner', () => {
  it('returns started and success log entries for successful action', async () => {
    const times = ['2026-04-26T10:00:00Z', '2026-04-26T10:00:01Z'];
    const result = await runPlatformAction({
      scope: 'deal',
      objectId: 'DL-9102',
      action: 'confirm-acceptance',
      actor: 'operator',
      loadingMessage: 'Action started',
      successMessage: (value) => `Action done: ${value}`,
      errorMessage: () => 'Action failed',
      run: async () => 'ok',
      at: () => times.shift() ?? '2026-04-26T10:00:02Z',
    });

    expect(result.phase).toBe('success');
    expect(result.result).toBe('ok');
    expect(result.log).toHaveLength(2);
    expect(result.log[0]?.status).toBe('started');
    expect(result.log[1]?.status).toBe('success');
    expect(result.log[1]?.message).toBe('Action done: ok');
  });

  it('returns started and error log entries for failed action', async () => {
    const result = await runPlatformAction({
      scope: 'bank',
      objectId: 'DL-9109',
      action: 'release-check',
      actor: 'operator',
      loadingMessage: 'Action started',
      successMessage: () => 'Action done',
      errorMessage: (error) => error instanceof Error ? `Action failed: ${error.message}` : 'Action failed',
      run: async () => {
        throw new Error('network');
      },
      at: () => '2026-04-26T10:00:00Z',
    });

    expect(result.phase).toBe('error');
    expect(result.result).toBeUndefined();
    expect(result.log).toHaveLength(2);
    expect(result.log[0]?.status).toBe('started');
    expect(result.log[1]?.status).toBe('error');
    expect(result.log[1]?.error).toBe('network');
    expect(result.log[1]?.message).toBe('Action failed: network');
  });
});
