import { describe, expect, it } from 'vitest';
import { getPlatformV7DriverCockpitState } from '@/lib/platform-v7/runtime/driver-cockpit-state';
import { PLATFORM_V7_EXECUTION_SOURCE } from '@/lib/platform-v7/deal-execution-source-of-truth';

describe('platform-v7 driver cockpit runtime binding (VP-5)', () => {
  it('derives the driver mission from the execution runtime source, not decorative data', () => {
    const state = getPlatformV7DriverCockpitState();

    expect(state.sourceMeta.runtimeBound).toBe(true);
    expect(state.sourceMeta.liveExternalIntegrations).toBe(false);
    expect(state.tripId).toBe(PLATFORM_V7_EXECUTION_SOURCE.logistics.tripId);
    expect(state.route).toContain(PLATFORM_V7_EXECUTION_SOURCE.logistics.deliveryPoint);
    expect(state.progressPercent).toBeGreaterThanOrEqual(0);
    expect(state.progressPercent).toBeLessThanOrEqual(100);
  });

  it('keeps the driver mission free of money and exposes a field next action', () => {
    const state = getPlatformV7DriverCockpitState();

    expect(state.photoChecklist.length).toBe(3);
    expect(state.nextAction.length).toBeGreaterThan(0);
    expect(JSON.stringify(state)).not.toMatch(/₽|выплат|резерв|банк/i);
  });
});
