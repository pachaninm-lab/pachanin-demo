import { expect, test } from '@playwright/test';

const ROLE_HINT_ROUTES = [
  '/platform-v7/seller',
  '/platform-v7/buyer',
  '/platform-v7/logistics',
  '/platform-v7/elevator',
  '/platform-v7/lab',
  '/platform-v7/bank',
  '/platform-v7/investor',
] as const;

test.describe('platform-v7 role route hints', () => {
  for (const route of ROLE_HINT_ROUTES) {
    test(`${route} shows role workspace hint`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const response = await page.goto(route, { waitUntil: 'networkidle' });

      expect(response?.ok(), `${route} should return 200`).toBeTruthy();
      await expect(page.locator('body')).not.toContainText(/404|Application error|Unhandled Runtime Error/i);
      await expect(page.getByTestId('platform-v7-role-workspace-hint')).toBeVisible();
      await expect(page.getByTestId('platform-v7-role-workspace-hint')).toContainText(/рабочий экран роли/i);
      await expect(page.getByTestId('platform-v7-role-workspace-hint').getByRole('link')).toBeVisible();

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      expect(overflowX, `${route} should not have horizontal overflow at 390px`).toBe(false);
    });
  }
});
