import { describe, expect, it, vi } from 'vitest';
import { executePlatformV7Action, platformV7ActionIsBusy } from '@/lib/platform-v7/action-control';

describe('platform-v7 action control', () => {
  it('executes action workflow and emits log plus toast sinks', async () => {
    const onToast = vi.fn();
    const onLog = vi.fn();
    let tick = 0;

    const outcome = await executePlatformV7Action({
      actionId: 'releaseFunds',
      entityId: 'DL-9102',
      scope: 'bank',
      actor: 'Оператор',
      log: [],
      onToast,
      onLog,
      now: () => `2026-04-25T09:20:0${tick++}.000Z`,
      run: () => 'ok',
    });

    expect(outcome.result).toBe('ok');
    expect(onLog).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ objectId: 'DL-9102' })]));
    expect(onToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('checks active action busy state', () => {
    expect(platformV7ActionIsBusy('releaseFunds', 'releaseFunds')).toBe(true);
    expect(platformV7ActionIsBusy('releaseFunds', 'requestRelease')).toBe(false);
    expect(platformV7ActionIsBusy(null, 'releaseFunds')).toBe(false);
  });
});
