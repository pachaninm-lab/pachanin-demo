import { expect, test } from '@playwright/test';

const MONEY_VISIBLE_ROUTES = [
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/bank',
] as const;

const MONEY_HIDDEN_ROUTES = [
  '/platform-v7/driver/field',
  '/platform-v7/logistics',
  '/platform-v7/elevator',
  '/platform-v7/lab',
] as const;

test.describe('platform-v7 MoneyTree role usage', () => {
  for (const route of MONEY_VISIBLE_ROUTES) {
    test(`${route} shows read-only MoneyTree`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${route} should return 200`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
      await expect(page.getByTestId('platform-v7-money-tree-strip')).toBeVisible();
      await expect(page.getByTestId('platform-v7-money-tree-strip')).toContainText(/резерв/i);
      await expect(page.getByTestId('platform-v7-money-tree-strip')).toContainText(/части ниже не складываются/i);
    });
  }

  for (const route of MONEY_HIDDEN_ROUTES) {
    test(`${route} does not show MoneyTree`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${route} should return 200`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
      await expect(page.getByTestId('platform-v7-money-tree-strip')).toHaveCount(0);
    });
  }
});
