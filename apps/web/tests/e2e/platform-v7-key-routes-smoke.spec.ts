import { expect, test } from '@playwright/test';

const KEY_ROUTES = [
  '/platform-v7',
  '/platform-v7/roles',
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/driver/field',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/control-tower',
  '/platform-v7/disputes',
  '/platform-v7/compliance',
  '/platform-v7/arbitrator',
  '/platform-v7/support',
  '/platform-v7/deals/grain-release',
] as const;

const FATAL_RENDER_COPY = /404|Application error|Unhandled Runtime Error|Internal Server Error|This page could not be found/i;

test.describe('platform-v7 key route smoke skeleton', () => {
  for (const route of KEY_ROUTES) {
    test(`${route} renders without fatal route crash`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

      expect(response, `${route} should return a response`).not.toBeNull();
      expect(response?.ok(), `${route} should return a successful response`).toBeTruthy();
      await expect(page.locator('body'), `${route} should render body content`).not.toBeEmpty();
      await expect(page.locator('body'), `${route} should not show fatal crash copy`).not.toContainText(FATAL_RENDER_COPY);
      await expect(page.locator('html'), `${route} should render an html root`).toBeAttached();
    });
  }
});
