import { describe, expect, it } from 'vitest';
import { getPlatformV7HealthCockpitState } from '@/lib/platform-v7/runtime/health-cockpit-state';

describe('PR-6 observability health screens', () => {
  const state = getPlatformV7HealthCockpitState();

  it('derives a full health snapshot from runtime, not fake telemetry', () => {
    expect(state.sourceMeta.runtimeBound).toBe(true);
    expect(state.sourceMeta.liveExternalIntegrations).toBe(false);
    expect(['ok', 'warning', 'critical']).toContain(state.overall);
  });

  it('covers system / deal / money / integration + adapter + queue health areas', () => {
    const labels = state.areas.map((a) => a.label);
    expect(labels).toContain('System Health');
    expect(labels).toContain('Deal Runtime Health');
    expect(labels).toContain('Money Runtime Health');
    expect(labels).toContain('Adapter Health');
    expect(labels).toContain('Queue Health');
  });

  it('exposes adapter health for every external contour (pre-integration)', () => {
    expect(state.adapters.length).toBeGreaterThanOrEqual(6);
    for (const adapter of state.adapters) {
      expect(adapter.system.length).toBeGreaterThan(0);
      expect(['ok', 'warning', 'critical']).toContain(adapter.severity);
    }
  });

  it('provides a manual review queue and a stuck deal monitor', () => {
    expect(Array.isArray(state.manualReviewQueue)).toBe(true);
    expect(Array.isArray(state.stuckDeals)).toBe(true);
    for (const item of [...state.manualReviewQueue, ...state.stuckDeals]) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.reason.length).toBeGreaterThan(0);
    }
  });
});
