import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_DEMO_TOUR_INITIAL_STATE,
  platformV7DemoTourPause,
  platformV7DemoTourPlay,
  platformV7DemoTourSeek,
  platformV7DemoTourTick,
  platformV7DemoTourView,
} from '@/lib/platform-v7/demo-tour-runtime';
import { platformV7DemoTourDurationMs } from '@/lib/platform-v7/demo-tour';

describe('platform-v7 demo tour runtime', () => {
  it('starts from idle state and can play/pause', () => {
    const playing = platformV7DemoTourPlay(PLATFORM_V7_DEMO_TOUR_INITIAL_STATE);
    expect(playing).toEqual({ status: 'playing', elapsedMs: 0 });
    expect(platformV7DemoTourPause(playing)).toEqual({ status: 'paused', elapsedMs: 0 });
  });

  it('ticks only while playing', () => {
    expect(platformV7DemoTourTick({ status: 'paused', elapsedMs: 1000 }, 1000)).toEqual({
      status: 'paused',
      elapsedMs: 1000,
    });
    expect(platformV7DemoTourTick({ status: 'playing', elapsedMs: 1000 }, 1000)).toEqual({
      status: 'playing',
      elapsedMs: 2000,
    });
  });

  it('marks state complete at the end of the tour', () => {
    const state = platformV7DemoTourSeek({ status: 'playing', elapsedMs: 0 }, platformV7DemoTourDurationMs());
    expect(state.status).toBe('complete');
    expect(platformV7DemoTourPlay(state).status).toBe('complete');
  });

  it('builds runtime view for active narration', () => {
    const view = platformV7DemoTourView({ status: 'playing', elapsedMs: 0 });
    expect(view).toMatchObject({
      status: 'playing',
      activeStepId: 'lot-readiness',
      route: '/platform-v7/lots/LOT-2403',
      title: 'Лот и допуск',
      progress: 0,
      isComplete: false,
    });
  });
});
