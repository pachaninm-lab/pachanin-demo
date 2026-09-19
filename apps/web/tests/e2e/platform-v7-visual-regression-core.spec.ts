import { expect, test } from '@playwright/test';

const CORE_VISUAL_ROUTES = [
  { route: '/platform-v7', name: 'entry' },
  { route: '/platform-v7/control-tower', name: 'control-tower' },
  { route: '/platform-v7/bank', name: 'bank' },
  { route: '/platform-v7/driver/field', name: 'driver-field' },
  { route: '/platform-v7/disputes', name: 'disputes' },
] as const;

const VIEWPORTS = [
  { label: 'mobile-390', width: 390, height: 844 },
  { label: 'desktop-1440', width: 1440, height: 900 },
] as const;

test.describe('platform-v7 core visual regression', () => {
  for (const viewport of VIEWPORTS) {
    for (const item of CORE_VISUAL_ROUTES) {
      test(`${item.route} matches ${viewport.label} screenshot`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        const response = await page.goto(item.route, { waitUntil: 'networkidle' });

        expect(response?.ok(), `${item.route} should return 200`).toBeTruthy();
        await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);

        const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflowX, `${item.route} should not have horizontal overflow at ${viewport.label}`).toBe(false);

        await expect(page).toHaveScreenshot(`platform-v7-${item.name}-${viewport.label}.png`, {
          fullPage: true,
          maxDiffPixelRatio: 0.03,
        });
      });
    }
  }
});
