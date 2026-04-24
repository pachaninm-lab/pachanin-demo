import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7',
  '/platform-v7/control-tower',
  '/platform-v7/deals/DL-9102',
  '/platform-v7/buyer',
  '/platform-v7/compliance',
  '/platform-v7/field',
  '/platform-v7/disputes/DK-2024-89',
];

test.describe('platform-v7 visual smoke', () => {
  for (const route of routes) {
    test(`${route} has visible brand/header and no broken visible images`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();

      await expect(page.getByText('Прозрачная Цена').first()).toBeVisible();
      await expect(page.locator('header').first()).toBeVisible();

      const brokenImages = await page.locator('img:visible').evaluateAll((images) =>
        images
          .filter((img) => img instanceof HTMLImageElement)
          .filter((img) => !img.complete || img.naturalWidth === 0 || img.naturalHeight === 0)
          .map((img) => ({ src: img.getAttribute('src'), alt: img.getAttribute('alt') }))
      );

      expect(brokenImages, `${route} should not have broken visible images`).toEqual([]);
    });
  }
});
