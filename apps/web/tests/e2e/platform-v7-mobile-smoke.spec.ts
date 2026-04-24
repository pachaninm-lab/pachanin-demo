import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7',
  '/platform-v7/control-tower',
  '/platform-v7/deals',
  '/platform-v7/deals/DL-9102',
  '/platform-v7/buyer',
  '/platform-v7/compliance',
  '/platform-v7/field',
  '/platform-v7/disputes/DK-2024-89',
];

test.describe('platform-v7 mobile smoke', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true });

  for (const route of routes) {
    test(`${route} renders at 375px without horizontal overflow`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();

      await expect(page.locator('body')).toBeVisible();
      const overflow = await page.evaluate(() => {
        const documentElement = document.documentElement;
        return documentElement.scrollWidth - documentElement.clientWidth;
      });

      expect(overflow, `${route} should not overflow horizontally`).toBeLessThanOrEqual(2);
    });
  }
});
