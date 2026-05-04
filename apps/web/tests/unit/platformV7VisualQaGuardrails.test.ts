import { describe, expect, it } from 'vitest';
import {
  PLATFORM_V7_QA_VIEWPORTS,
  PLATFORM_V7_VISUAL_QA_BLOCKERS,
  PLATFORM_V7_VISUAL_QA_ROUTES,
  getPlatformV7MobileCriticalRoutes,
  getPlatformV7P0QaRoutes,
} from '@/lib/platform-v7/visual-qa-guardrails';

describe('platform-v7 visual QA guardrails', () => {
  it('contains the required mobile, tablet and desktop viewport matrix', () => {
    expect(PLATFORM_V7_QA_VIEWPORTS.android360.width).toBe(360);
    expect(PLATFORM_V7_QA_VIEWPORTS.iphoneSe375.width).toBe(375);
    expect(PLATFORM_V7_QA_VIEWPORTS.iphone14ProMax430.width).toBe(430);
    expect(PLATFORM_V7_QA_VIEWPORTS.ipad768.width).toBe(768);
    expect(PLATFORM_V7_QA_VIEWPORTS.ipadLandscape1024.width).toBe(1024);
    expect(PLATFORM_V7_QA_VIEWPORTS.desktop1280.width).toBe(1280);
    expect(PLATFORM_V7_QA_VIEWPORTS.desktop1366.width).toBe(1366);
    expect(PLATFORM_V7_QA_VIEWPORTS.desktop1440.width).toBe(1440);
    expect(PLATFORM_V7_QA_VIEWPORTS.desktop1728.width).toBe(1728);
    expect(PLATFORM_V7_QA_VIEWPORTS.desktop1920.width).toBe(1920);
    expect(PLATFORM_V7_QA_VIEWPORTS.desktop2560.width).toBe(2560);
  });

  it('keeps the full core execution route in the P0 QA set', () => {
    const p0Paths = getPlatformV7P0QaRoutes().map((route) => route.path);

    expect(p0Paths).toContain('/platform-v7');
    expect(p0Paths).toContain('/platform-v7/seller');
    expect(p0Paths).toContain('/platform-v7/buyer');
    expect(p0Paths).toContain('/platform-v7/logistics');
    expect(p0Paths).toContain('/platform-v7/logistics/inbox');
    expect(p0Paths).toContain('/platform-v7/driver');
    expect(p0Paths).toContain('/platform-v7/elevator');
    expect(p0Paths).toContain('/platform-v7/bank');
    expect(p0Paths).toContain('/platform-v7/documents');
    expect(p0Paths).toContain('/platform-v7/disputes');
    expect(p0Paths).toContain('/platform-v7/connectors');
    expect(p0Paths).toContain('/platform-v7/deals/DL-9106/clean');
    expect(p0Paths).toContain('/platform-v7/lots/LOT-2403');
  });

  it('marks mobile-critical routes for mobile QA', () => {
    const mobileCritical = getPlatformV7MobileCriticalRoutes();

    expect(mobileCritical).toContain('/platform-v7');
    expect(mobileCritical).toContain('/platform-v7/driver');
    expect(mobileCritical).toContain('/platform-v7/elevator');
    expect(mobileCritical).toContain('/platform-v7/logistics/inbox');
    expect(mobileCritical).toContain('/platform-v7/demo');
  });

  it('documents blockers that must fail visual acceptance', () => {
    expect(PLATFORM_V7_VISUAL_QA_BLOCKERS).toContain('apps/landing changed');
    expect(PLATFORM_V7_VISUAL_QA_BLOCKERS).toContain('production-ready or live-integrated claim appears without proof');
    expect(PLATFORM_V7_VISUAL_QA_BLOCKERS).toContain('fake payout or release CTA appears without release conditions');
    expect(PLATFORM_V7_VISUAL_QA_BLOCKERS).toContain('mobile horizontal scroll');
    expect(PLATFORM_V7_VISUAL_QA_BLOCKERS).toContain('catch-all masks an unknown broken route as valid product screen');
  });

  it('requires every QA route to answer at least five product-critical questions', () => {
    for (const route of PLATFORM_V7_VISUAL_QA_ROUTES) {
      expect(route.mustAnswer.length).toBeGreaterThanOrEqual(5);
      expect(route.expectedSurface.length).toBeGreaterThan(8);
    }
  });
});
