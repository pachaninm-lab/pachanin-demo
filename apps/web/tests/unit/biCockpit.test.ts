import { describe, expect, it } from 'vitest';
import { getPlatformV7BiCockpitState } from '@/lib/platform-v7/runtime/bi-cockpit-state';

describe('M3-5 BI / unit economics (§35)', () => {
  it('derives metrics from runtime with honest scenario flags', () => {
    const state = getPlatformV7BiCockpitState();
    expect(state.sourceMeta.runtimeBound).toBe(true);
    expect(state.sourceMeta.liveExternalIntegrations).toBe(false);
    const keys = state.metrics.map((m) => m.key);
    expect(keys).toContain('gmv');
    expect(keys).toContain('dispute-rate');
    expect(keys).toContain('take-rate');
    // take-rate / commission are scenario, GMV is runtime-derived
    expect(state.metrics.find((m) => m.key === 'gmv')?.basis).toBe('runtime');
    expect(state.metrics.find((m) => m.key === 'take-rate')?.basis).toBe('scenario');
    expect(state.note).toMatch(/runtime/i);
  });
});
