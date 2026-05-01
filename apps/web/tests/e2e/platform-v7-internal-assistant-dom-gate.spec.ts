import { expect, test } from '@playwright/test';

const externalRoutes = [
  '/platform-v7/lots',
  '/platform-v7/buyer',
  '/platform-v7/seller',
  '/platform-v7/logistics/requests',
  '/platform-v7/logistics/trips',
  '/platform-v7/driver',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank/release-safety',
  '/platform-v7/deals/DL-9116',
  '/platform-v7/lots/LOT-2403/bids',
];

const forbiddenVisibleFragments = ['GigaChat', 'assistant', 'Assistant', 'AI', 'ИИ'];

test.describe('platform-v7 internal assistant DOM gate', () => {
  for (const route of externalRoutes) {
    test(`${route} does not render internal assistant DOM`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'networkidle' });
      expect(response?.ok(), `${route} must render`).toBeTruthy();

      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('.pc-giga')).toHaveCount(0);
      await expect(page.locator('[data-testid="internal-assistant"]')).toHaveCount(0);

      const body = await page.locator('body').innerText();
      for (const fragment of forbiddenVisibleFragments) {
        expect(body, `${route} must not expose ${fragment}`).not.toContain(fragment);
      }
    });
  }
});
