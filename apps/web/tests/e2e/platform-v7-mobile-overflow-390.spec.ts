import { expect, test } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const OVERFLOW_TOLERANCE_PX = 2;

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

test.describe('platform-v7 390x844 mobile overflow smoke', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  for (const route of KEY_ROUTES) {
    test(`${route} renders without material horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });

      expect(response?.ok(), `${route} should return a successful response`).toBeTruthy();
      await expect(page.locator('body'), `${route} should render body content`).not.toBeEmpty();

      const overflowPx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflowPx, `${route} horizontal overflow should stay within tolerance`).toBeLessThanOrEqual(OVERFLOW_TOLERANCE_PX);
    });
  }
});
