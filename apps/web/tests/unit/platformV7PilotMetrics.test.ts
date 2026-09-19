import { describe, expect, it } from 'vitest';
import { getPlatformV7PilotMetrics, buildPlatformV7PilotReport } from '@/lib/platform-v7/runtime/pilot-metrics';

describe('PR-7 BI runtime metrics binding', () => {
  const snapshot = getPlatformV7PilotMetrics();

  it('binds metrics to runtime, not decorative scenarios', () => {
    expect(snapshot.sourceMeta.runtimeBound).toBe(true);
    expect(snapshot.sourceMeta.liveExternalIntegrations).toBe(false);
    const runtimeMetrics = snapshot.metrics.filter((m) => m.basis === 'runtime');
    expect(runtimeMetrics.length).toBeGreaterThan(8);
  });

  it('covers the pilot KPI set', () => {
    const keys = snapshot.metrics.map((m) => m.key);
    for (const key of ['gmv', 'take-rate', 'hold', 'dispute-rate', 'manual-review-rate', 'release-ready', 'document-blockers', 'logistics-delay', 'elevator-delay', 'lab-delay', 'reconciliation-mismatch', 'time-to-money']) {
      expect(keys, `missing metric ${key}`).toContain(key);
    }
  });

  it('marks non-runtime metrics (take rate, time-to-money) as scenario', () => {
    const takeRate = snapshot.metrics.find((m) => m.key === 'take-rate');
    const timeToMoney = snapshot.metrics.find((m) => m.key === 'time-to-money');
    expect(takeRate?.basis).toBe('scenario');
    expect(timeToMoney?.basis).toBe('scenario');
  });

  it('exports a serializable pilot report snapshot', () => {
    const report = buildPlatformV7PilotReport(() => '2026-06-14T00:00:00.000Z');
    expect(report.generatedAt).toBe('2026-06-14T00:00:00.000Z');
    expect(report.metrics.length).toBeGreaterThan(8);
    expect(typeof report.dealCount).toBe('number');
    expect(JSON.parse(JSON.stringify(report)).metrics.length).toBe(report.metrics.length);
  });
});
