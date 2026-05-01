import { expect, test } from '@playwright/test';

const routes = [
  '/platform-v7/lots',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics/requests',
  '/platform-v7/logistics/trips',
  '/platform-v7/driver',
  '/platform-v7/elevator',
  '/platform-v7/lab',
];

const forbiddenVisibleCopy = [
  'Control Tower',
  'callback',
  'callbacks',
  'evidence-first',
  'release',
  'hold',
  'owner',
  'blocker',
  'sandbox dispatch',
  'Action handoff',
  'domain-core',
  'runtime',
  'idempotency',
  'guard',
  'legacy',
  'mock',
  'debug',
  'test user',
];

test.describe('platform-v7 execution visual gates', () => {
  for (const route of routes) {
    test(`${route} has visible product content and no forbidden visible copy`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} should return ok response`).toBeTruthy();

      await expect(page.locator('body')).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length, `${route} should render meaningful content`).toBeGreaterThan(80);

      for (const copy of forbiddenVisibleCopy) {
        expect(bodyText, `${route} should not show ${copy}`).not.toContain(copy);
      }

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
