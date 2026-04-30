import { describe, expect, it } from 'vitest';
import { PLATFORM_V7_EXECUTION_SOURCE, executionSummary } from '@/lib/platform-v7/deal-execution-source-of-truth';
import {
  PLATFORM_V7_COMMAND_ROUTE_SURFACE,
  PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
  PLATFORM_V7_SHELL_ROUTE_SURFACE,
} from '@/lib/platform-v7/routes';

describe('platform-v7 pilot-ready guard', () => {
  it('keeps the execution source inside sandbox maturity boundaries', () => {
    expect(PLATFORM_V7_EXECUTION_SOURCE.deal.maturity).toBe('песочница');
    expect(executionSummary().maturity).toBe('песочница');
  });

  it('keeps release blocked until controlled-pilot gates are ready', () => {
    const summary = executionSummary();

    expect(summary.canRelease).toBe(false);
    expect(summary.releaseCandidateRub).toBe(0);
    expect(summary.blockersCount).toBeGreaterThan(0);
    expect(summary.blockers).toContain('резерв денег не подтверждён');
    expect(summary.blockers).toContain('СДИЗ не оформлен');
  });

  it('keeps route surfaces canonical and separated from landing', () => {
    const routes = [
      ...PLATFORM_V7_COMMAND_ROUTE_SURFACE,
      ...PLATFORM_V7_SHELL_ROUTE_SURFACE,
      ...PLATFORM_V7_EXECUTION_MACHINE_STRIP_ROUTES,
    ];

    for (const route of routes) {
      expect(route.startsWith('/platform-v7')).toBe(true);
      expect(route.startsWith('/landing')).toBe(false);
      expect(route.includes('apps/landing')).toBe(false);
      expect(route.includes('/platform-v4')).toBe(false);
      expect(route.includes('/platform-v9')).toBe(false);
    }
  });
});
