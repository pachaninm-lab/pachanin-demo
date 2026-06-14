import { describe, expect, it } from 'vitest';
import { getPlatformV7ObservabilityCockpitState } from '@/lib/platform-v7/runtime/observability-cockpit-state';

describe('M3-4 observability cockpit (§32)', () => {
  it('derives runtime-bound health areas and overall severity', () => {
    const state = getPlatformV7ObservabilityCockpitState();
    expect(state.sourceMeta.runtimeBound).toBe(true);
    expect(state.sourceMeta.liveExternalIntegrations).toBe(false);
    expect(state.areas.map((a) => a.key)).toEqual(['system', 'integration', 'deal', 'money']);
    expect(['ok', 'warning', 'critical']).toContain(state.overall);
    for (const area of state.areas) {
      expect(['ok', 'warning', 'critical']).toContain(area.severity);
      expect(area.label.length).toBeGreaterThan(0);
    }
  });

  it('produces an incident journal as array of severity-tagged items', () => {
    const state = getPlatformV7ObservabilityCockpitState();
    expect(Array.isArray(state.incidents)).toBe(true);
    for (const inc of state.incidents) {
      expect(['ok', 'warning', 'critical']).toContain(inc.severity);
      expect(typeof inc.message).toBe('string');
    }
  });
});
