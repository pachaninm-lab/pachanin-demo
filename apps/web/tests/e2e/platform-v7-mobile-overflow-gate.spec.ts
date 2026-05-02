import { expect, test } from '@playwright/test';

const PRIORITY_ROUTES = [
  '/platform-v7',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/connectors',
  '/platform-v7/investor',
] as const;

test.describe('platform-v7 mobile overflow gate', () => {
  for (const route of PRIORITY_ROUTES) {
    test(`${route} has no horizontal overflow at 390px`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${route} should return 200`).toBeTruthy();

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflowX, `${route} should not have horizontal overflow at 390px`).toBe(false);
    });
  }
});
