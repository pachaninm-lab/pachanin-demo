import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_SUMMARY_BY_ROUTE } from '@/components/platform-v7/RoleExecutionSummaryGate';

describe('platform-v7 role execution summary route gate', () => {
  it('adds summary coverage to runtime-heavy role screens without rewriting them', () => {
    expect(PLATFORM_V7_SUMMARY_BY_ROUTE).toEqual({
      '/platform-v7/logistics': 'logistics',
      '/platform-v7/control-tower': 'operator',
      '/platform-v7/investor': 'investor',
    });
  });

  it('keeps the route gate scoped to platform-v7 only', () => {
    for (const route of Object.keys(PLATFORM_V7_SUMMARY_BY_ROUTE)) {
      expect(route.startsWith('/platform-v7/')).toBe(true);
      expect(route.includes('/platform-v7r/')).toBe(false);
      expect(route.includes('/landing')).toBe(false);
    }
  });
});
