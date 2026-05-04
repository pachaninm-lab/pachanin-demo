import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_DARK_QA_ACCEPTANCE,
  PLATFORM_V7_DARK_QA_BLOCKERS,
  PLATFORM_V7_DARK_QA_P0_ROUTES,
  PLATFORM_V7_DARK_QA_VIEWPORTS,
} from '@/lib/platform-v7/design/dark-qa';

describe('platform-v7 dark QA manifest', () => {
  it('requires dark QA on every P0 route', () => {
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.darkModeRequired).toBe(true);
    expect(PLATFORM_V7_DARK_QA_P0_ROUTES).toContain('/platform-v7');
    expect(PLATFORM_V7_DARK_QA_P0_ROUTES).toContain('/platform-v7/control-tower');
    expect(PLATFORM_V7_DARK_QA_P0_ROUTES).toContain('/platform-v7/deals/DL-9106/clean');
    expect(PLATFORM_V7_DARK_QA_P0_ROUTES).toContain('/platform-v7/deploy-check');
    expect(new Set(PLATFORM_V7_DARK_QA_P0_ROUTES).size).toBe(PLATFORM_V7_DARK_QA_P0_ROUTES.length);
  });

  it('covers mobile, tablet and desktop dark viewports', () => {
    expect(PLATFORM_V7_DARK_QA_VIEWPORTS.map((viewport) => viewport.width)).toEqual([
      360,
      375,
      430,
      768,
      1024,
      1280,
      1366,
      1440,
      1728,
      1920,
      2560,
    ]);
  });

  it('defines blockers for partial or unsafe dark mode', () => {
    expect(PLATFORM_V7_DARK_QA_BLOCKERS).toContain('dark mode toggle exists but full dark token set is missing');
    expect(PLATFORM_V7_DARK_QA_BLOCKERS).toContain('dark mode uses light-only hardcoded surface');
    expect(PLATFORM_V7_DARK_QA_BLOCKERS).toContain('dark mode muted text contrast below AA');
    expect(PLATFORM_V7_DARK_QA_BLOCKERS).toContain('role surface exposes data outside role permission boundary');
  });

  it('keeps acceptance boundaries honest for controlled-pilot maturity', () => {
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.appsLandingUnchanged).toBe(true);
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.noProductionReadyClaims).toBe(true);
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.noLiveIntegratedClaims).toBe(true);
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.noFakePayoutCta).toBe(true);
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.noRolePermissionRegression).toBe(true);
    expect(PLATFORM_V7_DARK_QA_ACCEPTANCE.minMobileCriticalActionPx).toBe(44);
  });
});
